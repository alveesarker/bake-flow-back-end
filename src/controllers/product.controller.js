const { pool } = require("../config/db");

// Shared SELECT used by list/detail so every response has the same shape:
// the product's own columns + its category name + its live stock quantity
// from product_inventory (0 if no inventory row exists yet).
const BASE_QUERY = `
  SELECT
    p.product_id,
    p.product_name,
    p.product_code,
    p.category_id,
    pc.category_name,
    p.description,
    p.customer_price,
    p.distributor_price,
    p.unit,
    p.weight,
    p.minimum_stock,
    p.status,
    pi.inventory_id,
    COALESCE(pi.stock_quantity, 0) AS stock_quantity,
    pi.last_updated AS stock_last_updated
  FROM product p
  LEFT JOIN product_category pc ON p.category_id = pc.category_id
  LEFT JOIN product_inventory pi ON p.product_id = pi.product_id
`;

const EDITABLE_FIELDS = [
  "product_name",
  "product_code",
  "category_id",
  "description",
  "customer_price",
  "distributor_price",
  "unit",
  "weight",
  "minimum_stock",
  "status",
];

// GET /api/products
// Returns every product together with its category name and current stock
// quantity (joined from product_category and product_inventory).
exports.getAllProducts = async (req, res, next) => {
  try {
    const [rows] = await pool.query(`${BASE_QUERY} ORDER BY p.product_id DESC`);
    res.json({ success: true, count: rows.length, data: rows });
  } catch (err) {
    next(err);
  }
};

// GET /api/products/:id
exports.getProductById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query(`${BASE_QUERY} WHERE p.product_id = ?`, [id]);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: `Product ${id} not found` });
    }
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    next(err);
  }
};

// POST /api/products
// Creates the product row and its matching product_inventory row in one
// transaction, so a product never exists without a stock record.
exports.createProduct = async (req, res, next) => {
  const {
    product_name,
    product_code,
    category_id,
    description,
    customer_price,
    distributor_price,
    unit,
    weight,
    minimum_stock,
    status,
    stock_quantity,
  } = req.body;

  if (!product_name || !category_id || customer_price == null || distributor_price == null || !unit) {
    return res.status(400).json({
      success: false,
      message: "product_name, category_id, customer_price, distributor_price and unit are required",
    });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [result] = await connection.query(
      `INSERT INTO product
        (product_name, product_code, category_id, description, customer_price, distributor_price, unit, weight, minimum_stock, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        product_name,
        product_code || null,
        category_id,
        description || null,
        customer_price,
        distributor_price,
        unit,
        weight ?? null,
        minimum_stock ?? 0,
        status || "Active",
      ]
    );

    const productId = result.insertId;

    await connection.query(
      `INSERT INTO product_inventory (product_id, stock_quantity) VALUES (?, ?)`,
      [productId, stock_quantity ?? 0]
    );

    await connection.commit();

    const [rows] = await pool.query(`${BASE_QUERY} WHERE p.product_id = ?`, [productId]);
    res.status(201).json({ success: true, data: rows[0] });
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
};

// PUT /api/products/:id
// Lets the client edit any product column. If `stock_quantity` is included
// in the body, product_inventory is upserted too, so one request can update
// both the product's own fields and its stock level.
exports.updateProduct = async (req, res, next) => {
  const { id } = req.params;

  const updates = [];
  const values = [];
  EDITABLE_FIELDS.forEach((field) => {
    if (req.body[field] !== undefined) {
      updates.push(`${field} = ?`);
      values.push(req.body[field]);
    }
  });

  if (updates.length === 0 && req.body.stock_quantity === undefined) {
    return res.status(400).json({ success: false, message: "No editable fields were provided" });
  }

  const connection = await pool.getConnection();
  try {
    const [existing] = await connection.query("SELECT product_id FROM product WHERE product_id = ?", [id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: `Product ${id} not found` });
    }

    await connection.beginTransaction();

    if (updates.length > 0) {
      values.push(id);
      await connection.query(`UPDATE product SET ${updates.join(", ")} WHERE product_id = ?`, values);
    }

    if (req.body.stock_quantity !== undefined) {
      await connection.query(
        `INSERT INTO product_inventory (product_id, stock_quantity)
         VALUES (?, ?)
         ON DUPLICATE KEY UPDATE stock_quantity = VALUES(stock_quantity)`,
        [id, req.body.stock_quantity]
      );
    }

    await connection.commit();

    const [rows] = await pool.query(`${BASE_QUERY} WHERE p.product_id = ?`, [id]);
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
};

// DELETE /api/products/:id
// Deletes the product_inventory row first, then the product row, inside a
// single transaction — so a product is never left with an orphaned or a
// deleted inventory row is never left without a rolled-back product delete.
exports.deleteProduct = async (req, res, next) => {
  const { id } = req.params;
  const connection = await pool.getConnection();
  try {
    const [existing] = await connection.query("SELECT product_id FROM product WHERE product_id = ?", [id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: `Product ${id} not found` });
    }

    await connection.beginTransaction();

    await connection.query("DELETE FROM product_inventory WHERE product_id = ?", [id]);
    await connection.query("DELETE FROM product WHERE product_id = ?", [id]);

    await connection.commit();

    res.json({
      success: true,
      message: `Product ${id} and its product_inventory record were deleted`,
    });
  } catch (err) {
    await connection.rollback();

    if (err.code === "ER_ROW_IS_REFERENCED_2" || err.code === "ER_ROW_IS_REFERENCED") {
      return res.status(409).json({
        success: false,
        message:
          "This product can't be deleted because it's still referenced elsewhere (recipes, sales, or production records). Remove those first.",
      });
    }
    next(err);
  } finally {
    connection.release();
  }
};
