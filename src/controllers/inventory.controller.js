const { pool } = require("../config/db");

// ---------------------------------------------------------------------------
// GET /api/raw-materials
// List all raw materials joined with their current stock.
// ---------------------------------------------------------------------------
exports.getAllRawMaterials = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT rm.material_id,
              rm.material_name,
              rm.material_code,
              rm.unit,
              rm.minimum_stock,
              COALESCE(rmi.current_stock, 0) AS current_stock
       FROM raw_material rm
       LEFT JOIN raw_material_inventory rmi ON rmi.material_id = rm.material_id
       ORDER BY rm.material_name ASC`
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error("getAllRawMaterials error:", err);
    res.status(500).json({ success: false, message: "Failed to fetch raw materials" });
  }
};


exports.getAllRawMaterialstName = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT rm.material_id,
              rm.material_name,
              rm.unit
       FROM raw_material rm
       ORDER BY rm.material_name ASC`
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    console.log("Hello alvee");
    console.error("getAllRawMaterials error:", err);
    res.status(500).json({ success: false, message: "Failed to fetch raw materials" });
  }
};

exports.getInventoryStock = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT rm.material_id,
              rm.material_name,
              rm.unit,
              rmi.current_stock
       FROM raw_material rm
       LEFT JOIN raw_material_inventory rmi ON rmi.material_id = rm.material_id`
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error("getAllRawMaterials error:", err);
    res.status(500).json({ success: false, message: "Failed to fetch raw materials" });
  }
};
// ---------------------------------------------------------------------------
// GET /api/raw-materials/:id
// ---------------------------------------------------------------------------
exports.getRawMaterialById = async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await pool.query(
      `SELECT rm.material_id,
              rm.material_name,
              rm.material_code,
              rm.unit,
              rm.minimum_stock,
              COALESCE(rmi.current_stock, 0) AS current_stock
       FROM raw_material rm
       LEFT JOIN raw_material_inventory rmi ON rmi.material_id = rm.material_id
       WHERE rm.material_id = ?`,
      [id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "Raw material not found" });
    }
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error("getRawMaterialById error:", err);
    res.status(500).json({ success: false, message: "Failed to fetch raw material" });
  }
};

// ---------------------------------------------------------------------------
// POST /api/raw-materials
// Body: { name, code, unit, minStock }
// ---------------------------------------------------------------------------
exports.createRawMaterial = async (req, res) => {
  const { name, code, unit, minStock } = req.body;

  if (!name || !unit) {
    return res.status(400).json({ success: false, message: "name and unit are required" });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [result] = await conn.query(
      `INSERT INTO raw_material (material_name, material_code, unit, minimum_stock)
       VALUES (?, ?, ?, ?)`,
      [name, code || null, unit, minStock || 0]
    );
    const materialId = result.insertId;

    await conn.query(
      `INSERT INTO raw_material_inventory (material_id, current_stock) VALUES (?, 0)`,
      [materialId]
    );

    await conn.commit();
    res.status(201).json({ success: true, message: "Raw material created", data: { material_id: materialId } });
  } catch (err) {
    await conn.rollback();
    console.error("createRawMaterial error:", err);
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ success: false, message: "A raw material with this code already exists" });
    }
    res.status(500).json({ success: false, message: "Failed to create raw material" });
  } finally {
    conn.release();
  }
};

// ---------------------------------------------------------------------------
// PUT /api/raw-materials/:id
// Body: { name, code, unit, minStock }
// ---------------------------------------------------------------------------
exports.updateRawMaterial = async (req, res) => {
  const { id } = req.params;
  const { name, code, unit, minStock } = req.body;

  if (!name || !unit) {
    return res.status(400).json({ success: false, message: "name and unit are required" });
  }

  try {
    const [result] = await pool.query(
      `UPDATE raw_material
       SET material_name = ?, material_code = ?, unit = ?, minimum_stock = ?
       WHERE material_id = ?`,
      [name, code || null, unit, minStock || 0, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: "Raw material not found" });
    }

    res.json({ success: true, message: "Raw material updated" });
  } catch (err) {
    console.error("updateRawMaterial error:", err);
    if (err.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ success: false, message: "A raw material with this code already exists" });
    }
    res.status(500).json({ success: false, message: "Failed to update raw material" });
  }
};

// ---------------------------------------------------------------------------
// DELETE /api/raw-materials/:id
// ---------------------------------------------------------------------------
exports.deleteRawMaterial = async (req, res) => {
  const { id } = req.params;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    await conn.query(`DELETE FROM raw_material_inventory WHERE material_id = ?`, [id]);
    const [result] = await conn.query(`DELETE FROM raw_material WHERE material_id = ?`, [id]);

    if (result.affectedRows === 0) {
      await conn.rollback();
      return res.status(404).json({ success: false, message: "Raw material not found" });
    }

    await conn.commit();
    res.json({ success: true, message: "Raw material deleted" });
  } catch (err) {
    await conn.rollback();
    console.error("deleteRawMaterial error:", err);
    if (err.code === "ER_ROW_IS_REFERENCED_2" || err.code === "ER_ROW_IS_REFERENCED") {
      return res.status(409).json({
        success: false,
        message: "This raw material is used in a recipe or purchase and cannot be deleted",
      });
    }
    res.status(500).json({ success: false, message: "Failed to delete raw material" });
  } finally {
    conn.release();
  }
};

// ---------------------------------------------------------------------------
// POST /api/raw-materials/purchase
// Body: { items: [{ materialId, quantity, unitPrice }], invoiceNumber, purchaseDate, notes }
// Creates one purchase header row, one purchase-item row per material, and
// increments each material's stock in raw_material_inventory.
// ---------------------------------------------------------------------------
exports.purchaseRawMaterials = async (req, res) => {
  const { items, invoiceNumber, purchaseDate, notes } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, message: "At least one item is required" });
  }

  for (const item of items) {
    if (!item.materialId || !item.quantity || item.quantity <= 0 || !item.unitPrice || item.unitPrice <= 0) {
      return res.status(400).json({ success: false, message: "Each item needs a valid materialId, quantity, and unitPrice" });
    }
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const totalCost = items.reduce((sum, item) => sum + Number(item.quantity) * Number(item.unitPrice), 0);

    const [purchaseResult] = await conn.query(
      `INSERT INTO raw_material_purchase (purchase_date, invoice_number, total_cost, notes)
       VALUES (?, ?, ?, ?)`,
      [purchaseDate || new Date(), invoiceNumber || null, totalCost, notes || null]
    );
    const purchaseId = purchaseResult.insertId;

    // Fetch material names for the expense description
    const materialIds = items.map((item) => item.materialId);
    const [materials] = await conn.query(
      `SELECT material_id, material_name FROM raw_material WHERE material_id IN (?)`,
      [materialIds]
    );
    const materialNameMap = {};
    materials.forEach((m) => {
      materialNameMap[m.material_id] = m.material_name;
    });

    for (const item of items) {
      const subtotal = Number(item.quantity) * Number(item.unitPrice);

      await conn.query(
        `INSERT INTO raw_material_purchase_item (purchase_id, material_id, quantity, unit_price, subtotal)
         VALUES (?, ?, ?, ?, ?)`,
        [purchaseId, item.materialId, item.quantity, item.unitPrice, subtotal]
      );

      await conn.query(
        `INSERT INTO raw_material_inventory (material_id, current_stock)
         VALUES (?, ?)
         ON DUPLICATE KEY UPDATE current_stock = current_stock + VALUES(current_stock)`,
        [item.materialId, item.quantity]
      );
    }

    // Build the expense description: "MaterialName x2 @ $5.00, MaterialName2 x1 @ $3.50, ..."
    const description = items
      .map((item) => {
        const name = materialNameMap[item.materialId] || `Material #${item.materialId}`;
        return `${name} x${item.quantity} @ ${Number(item.unitPrice).toFixed(2)}`;
      })
      .join(", ");

    // Record the corresponding expense (category_id 13 = Raw Materials)
    await conn.query(
      `INSERT INTO expense (category_id, amount, expense_date, description, employee_id)
       VALUES (?, ?, ?, ?, ?)`,
      [13, totalCost, purchaseDate || new Date(), description, req.body.employeeId || null]
    );

    await conn.commit();
    res.status(201).json({
      success: true,
      message: "Purchase recorded",
      data: { purchase_id: purchaseId, total_cost: totalCost },
    });
  } catch (err) {
    await conn.rollback();
    console.error("purchaseRawMaterials error:", err);
    res.status(500).json({ success: false, message: "Failed to record purchase" });
  } finally {
    conn.release();
  }
};