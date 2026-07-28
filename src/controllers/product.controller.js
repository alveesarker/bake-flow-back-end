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

const BASE_QUERY2 = `
  SELECT
    p.product_id,
    p.product_name,
    p.product_code,
    pc.category_name,
    p.distributor_price,
    COALESCE(pi.stock_quantity, 0) AS stock_quantity
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

// Loads product_recipe rows (joined with raw_material for name/unit) for the
// given set of product ids and attaches them to each product as `recipe`.
// Used by getAllProducts / getProductById / createProduct / updateProduct so
// every response the frontend sees already carries the BOM it needs to
// pre-fill the edit dialog.
async function attachRecipes(products) {
  if (products.length === 0) return products;

  const ids = products.map((p) => p.product_id);
  const [recipeRows] = await pool.query(
    `SELECT pr.recipe_id, pr.product_id, pr.material_id, pr.quantity, rm.material_name, rm.unit
     FROM product_recipe pr
     JOIN raw_material rm ON rm.material_id = pr.material_id
     WHERE pr.product_id IN (?)`,
    [ids]
  );

  const grouped = {};
  recipeRows.forEach((r) => {
    if (!grouped[r.product_id]) grouped[r.product_id] = [];
    grouped[r.product_id].push({
      recipe_id: r.recipe_id,
      material_id: r.material_id,
      quantity: r.quantity,
      material_name: r.material_name,
      unit: r.unit,
    });
  });

  return products.map((p) => ({ ...p, recipe: grouped[p.product_id] || [] }));
}

// Replaces all product_recipe rows for a product with the given list.
// Pass an empty array to clear the recipe entirely. Runs on the connection
// passed in so it stays inside the caller's transaction.
async function saveRecipe(connection, productId, recipe) {
  await connection.query("DELETE FROM product_recipe WHERE product_id = ?", [productId]);

  if (!Array.isArray(recipe) || recipe.length === 0) return;

  for (const item of recipe) {
    if (!item.material_id || !item.quantity || item.quantity <= 0) continue;
    await connection.query(
      `INSERT INTO product_recipe (product_id, material_id, quantity) VALUES (?, ?, ?)`,
      [productId, item.material_id, item.quantity]
    );
  }
}

// GET /api/products
// Returns every product together with its category name, current stock
// quantity, and its raw-material recipe (BOM).
exports.getAllProducts = async (req, res, next) => {
  try {
    const [rows] = await pool.query(`${BASE_QUERY} ORDER BY p.product_id DESC`);
    const withRecipes = await attachRecipes(rows);
    res.json({ success: true, count: withRecipes.length, data: withRecipes });
  } catch (err) {
    next(err);
  }
};


exports.getAllProductsForDistributor = async (req, res, next) => {
  try {
    const [rows] = await pool.query(`${BASE_QUERY2} ORDER BY p.product_id DESC`);
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

    const [withRecipe] = await attachRecipes(rows);
    res.json({ success: true, data: withRecipe });
  } catch (err) {
    next(err);
  }
};

// POST /api/products
// Creates the product row and its matching product_inventory row in one
// transaction, so a product never exists without a stock record. If a
// `recipe` array is included in the body ([{ material_id, quantity }, ...]),
// it's saved to product_recipe in the same transaction.
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
    recipe,
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

    if (Array.isArray(recipe) && recipe.length > 0) {
      await saveRecipe(connection, productId, recipe);
    }

    await connection.commit();

    const [rows] = await pool.query(`${BASE_QUERY} WHERE p.product_id = ?`, [productId]);
    const [withRecipe] = await attachRecipes(rows);
    res.status(201).json({ success: true, data: withRecipe });
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
};

// PUT /api/products/:id
// Lets the client edit any product column. If `stock_quantity` is included
// in the body, product_inventory is upserted too. If `recipe` is included
// (even as an empty array, to clear it), product_recipe is fully replaced
// with the given list — so one request can update the product's own fields,
// its stock level, and its raw-material BOM together.
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

  const hasStockUpdate = req.body.stock_quantity !== undefined;
  const hasRecipeUpdate = req.body.recipe !== undefined;

  if (updates.length === 0 && !hasStockUpdate && !hasRecipeUpdate) {
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

    if (hasStockUpdate) {
      await connection.query(
        `INSERT INTO product_inventory (product_id, stock_quantity)
         VALUES (?, ?)
         ON DUPLICATE KEY UPDATE stock_quantity = VALUES(stock_quantity)`,
        [id, req.body.stock_quantity]
      );
    }

    if (hasRecipeUpdate) {
      await saveRecipe(connection, id, req.body.recipe);
    }

    await connection.commit();

    const [rows] = await pool.query(`${BASE_QUERY} WHERE p.product_id = ?`, [id]);
    const [withRecipe] = await attachRecipes(rows);
    res.json({ success: true, data: withRecipe });
  } catch (err) {
    await connection.rollback();
    next(err);
  } finally {
    connection.release();
  }
};

// DELETE /api/products/:id
// Deletes product_recipe rows, then the product_inventory row, then the
// product row, all inside a single transaction — so a product is never left
// with an orphaned recipe/inventory row, and nothing is left half-deleted if
// any step fails.
exports.deleteProduct = async (req, res, next) => {
  const { id } = req.params;
  const connection = await pool.getConnection();
  try {
    const [existing] = await connection.query("SELECT product_id FROM product WHERE product_id = ?", [id]);
    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: `Product ${id} not found` });
    }

    await connection.beginTransaction();

    await connection.query("DELETE FROM product_recipe WHERE product_id = ?", [id]);
    await connection.query("DELETE FROM product_inventory WHERE product_id = ?", [id]);
    await connection.query("DELETE FROM product WHERE product_id = ?", [id]);

    await connection.commit();

    res.json({
      success: true,
      message: `Product ${id} and its product_inventory/product_recipe records were deleted`,
    });
  } catch (err) {
    await connection.rollback();

    if (err.code === "ER_ROW_IS_REFERENCED_2" || err.code === "ER_ROW_IS_REFERENCED") {
      return res.status(409).json({
        success: false,
        message:
          "This product can't be deleted because it's still referenced elsewhere (sales or production records). Remove those first.",
      });
    }
    next(err);
  } finally {
    connection.release();
  }
};