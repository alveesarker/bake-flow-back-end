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


exports.getAllDistributor = async (req, res, next) => {
    try {
        const [rows] = await pool.query(
            `SELECT *
        FROM distributor`,
        );

        if (rows.length == 0) {
            return res.status(404).json({ success: false, message: `no distributors` });
        }

        return res.status(200).json({ success: true, data: rows });
    } catch (err) {
        next(err)
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


exports.editDistributor = async (req, res, next) => {
    try {

        const { id } = req.params;

        const {
            name,
            phone,
            email,
            address,
            status
        } = req.body;

        const [existing] = await pool.query(
            `SELECT * FROM distributor WHERE distributor_id = ?`, [id]
        );

        if (existing.length == 0) {
            return res.status(404).json({ success: false, message: `ID ${id} is not founnd` })
        }

        await pool.query(
            `UPDATE distributor SET
        name = ?,
        phone = ?,
        email = ?,
        address = ?,
        status = ?
        WHERE distributor_id = ?`,
            [name, phone, email, address, status, id]
        );


        const [update] = await pool.query(
            `SELECT * FROM distributor WHERE distributor_id = ?`,
            [id]
        );

        res.status(200).json({ success: true, message: "Successfully Updated", data: update[0] })


    } catch (err) {
        next(err)
    }

}


exports.addDistributor = async (req, res, next) => {
    try {
        const {
            name,
            phone,
            email,
            address,
            status,
        } = req.body;

        if (!name) {
            return res.status(400).json({ message: 'Name is required' });
        }

        const [result] = await pool.query(
            `INSERT INTO distributor
        (name, phone, email, address, status)
       VALUES (?, ?, ?, ?, ?)`,
            [
                name,
                phone || null,
                email || null,
                address || null,
                status || 'Active',
            ]
        );

        const [newDistributor] = await pool.query(
            'SELECT * FROM distributor WHERE distributor_id = ?',
            [result.insertId]
        );

        res.status(201).json(newDistributor[0]);
    } catch (err) {
        next(err);
    }
};


exports.getOrderInfoById = async (req, res, next) => {
    const { id } = req.params;

    try {
        const [rows] = await pool.query(
            `SELECT
                distributor_id,
                COALESCE(SUM(total_amount), 0) AS total_purchased_amount,
                COALESCE(SUM(paid_amount), 0) AS total_paid_amount,
                COALESCE(SUM(total_amount), 0) - COALESCE(SUM(paid_amount), 0) AS total_due,
                COUNT(*) AS total_orders
            FROM distributor_sale
            WHERE distributor_id = ?
            GROUP BY distributor_id;`,
            [id]
        );

        res.json({
            success: true,
            data: rows.length > 0
                ? rows[0]
                : {
                    distributor_id: id,
                    total_purchased_amount: 0,
                    total_paid_amount: 0,
                    total_due: 0,
                    total_orders: 0
                }
        });

    } catch (err) {
        next(err);
    }
};