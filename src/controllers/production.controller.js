const { pool } = require("../config/db");

// Shared SELECT for list/detail: production row + product name + employee
// name, so every response has a consistent shape for the frontend.
const BASE_QUERY = `
  SELECT
    pd.production_id,
    pd.product_id,
    p.product_name,
    pd.employee_id,
    e.name AS employee_name,
    pd.planned_quantity,
    pd.produced_quantity,
    pd.production_date,
    pd.status,
    pd.notes
  FROM production pd
  JOIN product p ON p.product_id = pd.product_id
  LEFT JOIN employee e ON e.employee_id = pd.employee_id
`;

// Loads the raw-material breakdown (product_recipe joined with raw_material
// and raw_material_inventory) needed to produce `plannedQuantity` units of
// `productId`. Shared by getProductionById (display) and completeProduction
// (stock check + deduction), so both always agree on what's "needed".
async function getMaterialBreakdown(connection, productId, plannedQuantity) {
  const [rows] = await connection.query(
    `SELECT pr.material_id, rm.material_name, rm.unit, pr.quantity AS quantity_per_unit,
            COALESCE(rmi.current_stock, 0) AS current_stock
     FROM product_recipe pr
     JOIN raw_material rm ON rm.material_id = pr.material_id
     LEFT JOIN raw_material_inventory rmi ON rmi.material_id = pr.material_id
     WHERE pr.product_id = ?`,
    [productId]
  );

  return rows.map((m) => {
    const quantityNeeded = Math.round(Number(m.quantity_per_unit) * Number(plannedQuantity) * 1000) / 1000;
    return {
      material_id: m.material_id,
      material_name: m.material_name,
      unit: m.unit,
      quantity_per_unit: Number(m.quantity_per_unit),
      quantity_needed: quantityNeeded,
      current_stock: Number(m.current_stock),
    };
  });
}

// GET /api/production
exports.getAllProduction = async (req, res, next) => {
  try {
    const [rows] = await pool.query(`${BASE_QUERY} ORDER BY pd.production_id DESC`);
    res.json({ success: true, count: rows.length, data: rows });
  } catch (err) {
    next(err);
  }
};

// GET /api/production/:id
// Returns the batch plus a `materials` breakdown: how much of each raw
// material is needed for this batch's planned_quantity, and how much is
// currently in stock.
exports.getProductionById = async (req, res, next) => {
  const { id } = req.params;
  try {
    const [rows] = await pool.query(`${BASE_QUERY} WHERE pd.production_id = ?`, [id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: `Production batch ${id} not found` });
    }
    const batch = rows[0];
    const materials = await getMaterialBreakdown(pool, batch.product_id, batch.planned_quantity);
    res.json({ success: true, data: { ...batch, materials } });
  } catch (err) {
    next(err);
  }
};

// POST /api/production
// Body: { product_id, quantity, employee_id, date, notes? }
// Creates a new batch with status 'Planned' (the "pending" state the
// frontend shows). Does NOT touch raw_material_inventory — stock is only
// deducted when the batch is completed.
exports.createProduction = async (req, res, next) => {
  const { product_id, quantity, employee_id, date, notes } = req.body;

  if (!product_id || !quantity || quantity <= 0 || !employee_id || !date) {
    return res.status(400).json({
      success: false,
      message: "product_id, quantity, employee_id and date are required",
    });
  }

  try {
    const [result] = await pool.query(
      `INSERT INTO production (product_id, employee_id, planned_quantity, produced_quantity, production_date, status, notes)
       VALUES (?, ?, ?, ?, ?, 'Planned', ?)`,
      [product_id, employee_id, quantity, quantity, date, notes || null]
    );

    const [rows] = await pool.query(`${BASE_QUERY} WHERE pd.production_id = ?`, [result.insertId]);
    res.status(201).json({ success: true, message: "Production batch created", data: rows[0] });
  } catch (err) {
    next(err);
  }
};

// POST /api/production/:id/complete
// Marks the batch 'Completed' and deducts the raw materials it used from
// raw_material_inventory, all in one transaction. Refuses (409) if any
// material doesn't have enough stock, and reports exactly which ones and by
// how much they're short so the frontend can show a useful error.
exports.completeProduction = async (req, res, next) => {
  const { id } = req.params;
  const connection = await pool.getConnection();

  console.log("hello1");
  try {
    const [rows] = await connection.query("SELECT * FROM production WHERE production_id = ?", [id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: `Production batch ${id} not found` });
    }
    const batch = rows[0];

    if (batch.status === "Completed") {
      return res.status(409).json({ success: false, message: "This production batch is already completed" });
    }

    const materials = await getMaterialBreakdown(connection, batch.product_id, batch.planned_quantity);

    const shortages = materials
      .filter((m) => m.current_stock < m.quantity_needed)
      .map((m) => ({
        material_id: m.material_id,
        material_name: m.material_name,
        unit: m.unit,
        needed: m.quantity_needed,
        available: m.current_stock,
      }));

    if (shortages.length > 0) {
      return res.status(409).json({
        success: false,
        message: "Not enough raw material stock to complete this production batch",
        shortages,
      });
    }

    console.log("Hello 2");
    await connection.beginTransaction();

    for (const m of materials) {
      await connection.query(
        `UPDATE raw_material_inventory SET current_stock = current_stock - ? WHERE material_id = ?`,
        [m.quantity_needed, m.material_id]
      );
    }

    
    // The finished units go into stock — bump product_inventory by the
    // batch's planned_quantity. Uses an upsert so this still works even if
    // a product was somehow created without an inventory row.
    console.log("hello");
    await connection.query(
      `INSERT INTO product_inventory (product_id, stock_quantity)
       VALUES (?, ?)
       ON DUPLICATE KEY UPDATE stock_quantity = stock_quantity + VALUES(stock_quantity)`,
      [batch.product_id, batch.planned_quantity]
    );

    await connection.query(
      `UPDATE production SET status = 'Completed', produced_quantity = planned_quantity WHERE production_id = ?`,
      [id]
    );

    await connection.commit();

    res.json({ success: true, message: "Production batch completed: raw materials deducted and product stock increased" });
  } catch (err) {
    try {
      await connection.rollback();
    } catch (_) {
      // no-op: rollback is a no-op if no transaction was open yet
    }
    next(err);
  } finally {
    connection.release();
  }
};