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