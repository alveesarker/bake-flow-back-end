const { pool } = require("../config/db");

exports.getDistributorsName = async (req, res, next) => {
    try {
        const [rows] = await pool.query(
            `SELECT d.distributor_id, d.name
            FROM distributor d
            WHERE d.status = 'Active'`
        );

        if (rows.length == 0) {
            return res.status(404).json({ success: false, message: "No distributors" });
        }

        return res.json({ success: true, data: rows });
    } catch (err) {
        next(err);
    }
}