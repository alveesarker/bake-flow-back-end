const { pool } = require("../config/db");

// GET /api/expenses
exports.getAllExpenses = async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT e.expense_id, e.category_id, c.category_name, e.amount, e.expense_date, e.description, e.employee_id
       FROM expense e
       JOIN expense_category c ON e.category_id = c.category_id
       ORDER BY e.expense_date DESC, e.expense_id DESC`
    );
    res.status(200).json(rows);
  } catch (err) {
    console.error('Error fetching expenses:', err);
    res.status(500).json({ message: 'Failed to fetch expenses', error: err.message });
  }
};

// GET /api/expenses/categories
exports.getExpenseCategories = async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT category_id, category_name FROM expense_category ORDER BY category_name ASC'
    );
    res.status(200).json(rows);
  } catch (err) {
    console.error('Error fetching categories:', err);
    res.status(500).json({ message: 'Failed to fetch categories', error: err.message });
  }
};

// GET /api/expenses/:id
exports.getExpenseById = async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query(
      `SELECT e.expense_id, e.category_id, c.category_name, e.amount, e.expense_date, e.description, e.employee_id
       FROM expense e
       JOIN expense_category c ON e.category_id = c.category_id
       WHERE e.expense_id = ?`,
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Expense not found' });
    }

    res.status(200).json(rows[0]);
  } catch (err) {
    console.error('Error fetching expense:', err);
    res.status(500).json({ message: 'Failed to fetch expense', error: err.message });
  }
};

// POST /api/expenses
exports.addExpense = async (req, res) => {
  try {
    const { category_id, amount, expense_date, description, employee_id } = req.body;

    if (!category_id) return res.status(400).json({ message: 'Category is required' });
    if (amount === undefined || amount === null || Number(amount) <= 0) {
      return res.status(400).json({ message: 'A positive amount is required' });
    }
    if (!expense_date) return res.status(400).json({ message: 'Date is required' });

    const [result] = await pool.query(
      `INSERT INTO expense (category_id, amount, expense_date, description, employee_id)
       VALUES (?, ?, ?, ?, ?)`,
      [category_id, amount, expense_date, description || null, employee_id || null]
    );

    const [newExpense] = await pool.query(
      `SELECT e.expense_id, e.category_id, c.category_name, e.amount, e.expense_date, e.description, e.employee_id
       FROM expense e
       JOIN expense_category c ON e.category_id = c.category_id
       WHERE e.expense_id = ?`,
      [result.insertId]
    );

    res.status(201).json(newExpense[0]);
  } catch (err) {
    console.error('Error adding expense:', err);
    res.status(500).json({ message: 'Failed to add expense', error: err.message });
  }
};

// PUT /api/expenses/:id
exports.updateExpense = async (req, res) => {
  try {
    const { id } = req.params;
    const { category_id, amount, expense_date, description, employee_id } = req.body;

    const [existing] = await pool.query('SELECT * FROM expense WHERE expense_id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ message: 'Expense not found' });
    }

    await pool.query(
      `UPDATE expense SET
        category_id = ?,
        amount = ?,
        expense_date = ?,
        description = ?,
        employee_id = ?
       WHERE expense_id = ?`,
      [
        category_id ?? existing[0].category_id,
        amount ?? existing[0].amount,
        expense_date ?? existing[0].expense_date,
        description ?? existing[0].description,
        employee_id ?? existing[0].employee_id,
        id,
      ]
    );

    const [updated] = await pool.query(
      `SELECT e.expense_id, e.category_id, c.category_name, e.amount, e.expense_date, e.description, e.employee_id
       FROM expense e
       JOIN expense_category c ON e.category_id = c.category_id
       WHERE e.expense_id = ?`,
      [id]
    );

    res.status(200).json(updated[0]);
  } catch (err) {
    console.error('Error updating expense:', err);
    res.status(500).json({ message: 'Failed to update expense', error: err.message });
  }
};

// DELETE /api/expenses/:id
exports.deleteExpense = async (req, res) => {
  try {
    const { id } = req.params;

    const [existing] = await pool.query('SELECT * FROM expense WHERE expense_id = ?', [id]);
    if (existing.length === 0) {
      return res.status(404).json({ message: 'Expense not found' });
    }

    await pool.query('DELETE FROM expense WHERE expense_id = ?', [id]);

    res.status(200).json({ message: 'Expense deleted successfully' });
  } catch (err) {
    console.error('Error deleting expense:', err);
    res.status(500).json({ message: 'Failed to delete expense', error: err.message });
  }
};