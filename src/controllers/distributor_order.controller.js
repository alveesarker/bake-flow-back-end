const { pool } = require("../config/db");

exports.saveOrder = async (req, res, next) => {
    const {
        distributor_id,
        payment_method,
        discount,
        total_amount,
        paid_amount,
        sale_items,
    } = req.body;

    if (
        !distributor_id ||
        !payment_method ||
        total_amount == null ||
        sale_items.length == 0
    ) {
        return res
            .status(400)
            .json({
                success: false,
                message:
                    "Need distributor id and payment method and total amount. Or there is no order to save",
            });
    }

    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const [result] = await connection.query(
            `INSERT INTO distributor_sale
              (distributor_id, payment_method, discount, total_amount, paid_amount)
            VALUES(?, ?, ?, ?, ?)`,
            [
                distributor_id,
                payment_method,
                discount ?? 0,
                total_amount,
                paid_amount,
            ],
        );

        const sale_id = result.insertId;

        const values = sale_items.map((item) => [
            sale_id,
            item.product_id,
            item.quantity,
            item.unit_price,
            item.quantity * item.unit_price,
        ]);

        console.log(values);

        await connection.query(
            `INSERT INTO distributor_sale_item
            (sale_id, product_id, quantity, unit_price, subtotal)
            VALUES ?`,
            [values],
        );

        for (const item of sale_items) {
            await connection.query(
                `UPDATE product_inventory
         SET stock_quantity = stock_quantity - ?
         WHERE product_id = ?`,
                [item.quantity, item.product_id],
            );
        }

        await connection.commit();

        return res.status(201).json({
            success: true,
            sale_id,
        });
    } catch (err) {
        await connection.rollback();
        next(err);
    } finally {
        connection.release();
    }
};
