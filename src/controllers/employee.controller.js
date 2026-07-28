const {pool} = require(("../config/db"))


exports.getEmployeeName = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT em.employee_id,
              em.name
       FROM employee em
       ORDER BY em.employee_id ASC`
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error("GetEmployeeName error:", err);
    res.status(500).json({ success: false, message: "Failed to fetch Employee Name" });
  }
};

// GET /api/employees
exports.getAllEmployees = async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM employee ORDER BY name ASC'
    );
    res.status(200).json(rows);
  } catch (err) {
    console.error('Error fetching employees:', err);
    res.status(500).json({ message: 'Failed to fetch employees', error: err.message });
  }
};
 
// GET /api/employees/:id
exports.getEmployeeById = async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query(
      'SELECT * FROM employee WHERE employee_id = ?',
      [id]
    );
 
    if (rows.length === 0) {
      return res.status(404).json({ message: 'Employee not found' });
    }
 
    res.status(200).json(rows[0]);
  } catch (err) {
    console.error('Error fetching employee:', err);
    res.status(500).json({ message: 'Failed to fetch employee', error: err.message });
  }
};
 
// POST /api/employees
exports.addEmployee = async (req, res) => {
  try {
    const {
      name,
      phone,
      address,
      designation,
      salary,
      joining_date,
      status,
    } = req.body;
 
    if (!name) {
      return res.status(400).json({ message: 'Name is required' });
    }
 
    const [result] = await pool.query(
      `INSERT INTO employee
        (name, phone, address, designation, salary, joining_date, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        name,
        phone || null,
        address || null,
        designation || null,
        salary || null,
        joining_date || null,
        status || 'Active',
      ]
    );
 
    const [newEmployee] = await pool.query(
      'SELECT * FROM employee WHERE employee_id = ?',
      [result.insertId]
    );
 
    res.status(201).json(newEmployee[0]);
  } catch (err) {
    console.error('Error adding employee:', err);
    res.status(500).json({ message: 'Failed to add employee', error: err.message });
  }
};
 
// PUT /api/employees/:id
exports.updateEmployee = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      phone,
      address,
      designation,
      salary,
      joining_date,
      status,
    } = req.body;
 
    const [existing] = await pool.query(
      'SELECT * FROM employee WHERE employee_id = ?',
      [id]
    );
 
    if (existing.length === 0) {
      return res.status(404).json({ message: 'Employee not found' });
    }
 
    await pool.query(
      `UPDATE employee SET
        name = ?,
        phone = ?,
        address = ?,
        designation = ?,
        salary = ?,
        joining_date = ?,
        status = ?
       WHERE employee_id = ?`,
      [
        name ?? existing[0].name,
        phone ?? existing[0].phone,
        address ?? existing[0].address,
        designation ?? existing[0].designation,
        salary ?? existing[0].salary,
        joining_date ?? existing[0].joining_date,
        status ?? existing[0].status,
        id,
      ]
    );
 
    const [updated] = await pool.query(
      'SELECT * FROM employee WHERE employee_id = ?',
      [id]
    );
 
    res.status(200).json(updated[0]);
  } catch (err) {
    console.error('Error updating employee:', err);
    res.status(500).json({ message: 'Failed to update employee', error: err.message });
  }
};
 
// DELETE /api/employees/:id
exports.deleteEmployee = async (req, res) => {
  try {
    const { id } = req.params;
 
    const [existing] = await pool.query(
      'SELECT * FROM employee WHERE employee_id = ?',
      [id]
    );
 
    if (existing.length === 0) {
      return res.status(404).json({ message: 'Employee not found' });
    }
 
    await pool.query('DELETE FROM employee WHERE employee_id = ?', [id]);
 
    res.status(200).json({ message: 'Employee deleted successfully' });
  } catch (err) {
    console.error('Error deleting employee:', err);
    res.status(500).json({ message: 'Failed to delete employee', error: err.message });
  }
};