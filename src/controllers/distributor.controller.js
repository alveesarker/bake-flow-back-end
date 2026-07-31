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

exports.getDistributorById = async (req, res, next) => {
    try {
        const { id } = req.params;

        const [rows] = await pool.query(
            `SELECT *
        FROM distributor
        WHERE distributor_id = ?`,
            [id]
        );

        if (rows.length == 0) {
            return res.status(404).json({ success: false, message: `Id ${id} is not found` });
        }

        return res.status(200).json({ success: true, data: rows[0] })
    } catch (err) {
        next(err)
    }
}