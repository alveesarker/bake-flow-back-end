const { pool } = require("../config/db");

exports.getDailyInfo = async (req, res) => {
    try {
        const [
            [rows1],
            [rows2],
            [rows3],
            [rows4],
            [rows5],
            [rows6],
            [rows7],
            [rows8],
            [rows9],
            [rows10],
        ] = await Promise.all([
            pool.query(
                `SELECT COALESCE(SUM(total_amount), 0) AS total_sales_today
             FROM customer_sale
             WHERE DATE(sale_date) = CURDATE();`,
            ),
            pool.query(
                `SELECT COALESCE(SUM(total_amount), 0) AS total_dis_sales_today
            FROM distributor_sale
            WHERE DATE(sale_date) = CURDATE();`,
            ),
            pool.query(
                `SELECT COALESCE(SUM(total_amount), 0) AS total_sales_this_month
            FROM customer_sale
            WHERE YEAR(sale_date) = YEAR(CURDATE())
            AND MONTH(sale_date) = MONTH(CURDATE());`,
            ),
            pool.query(
                `SELECT COALESCE(SUM(total_amount), 0) AS total_sales_this_month_dis
            FROM distributor_sale
            WHERE YEAR(sale_date) = YEAR(CURDATE())
            AND MONTH(sale_date) = MONTH(CURDATE());`,
            ),
            pool.query(
                `SELECT COALESCE(SUM(produced_quantity), 0) AS total_produced_quantity
            FROM production
            WHERE DATE(production_date) = CURDATE();`,
            ),
            pool.query(
                `SELECT COALESCE(SUM(stock_quantity), 0) AS total_product_stock
            FROM product_inventory;`,
            ),
            pool.query(
                `SELECT COALESCE(SUM(current_stock), 0) AS total_raw_m_stock
            FROM raw_material_inventory;`,
            ),
            pool.query(
                `SELECT COUNT(*) AS total_rows
            FROM product;`,
            ),
            pool.query(
                `SELECT COUNT(*) AS total_emp
            FROM employee;`,
            ),
            pool.query(
                `SELECT COUNT(*) AS total_distributor
            FROM distributor;`,
            ),
        ]);

        const total_sales_today =
            Number(rows1[0].total_sales_today) +
            Number(rows2[0].total_dis_sales_today);
        const total_sales_this_month_dis_cus =
            Number(rows3[0].total_sales_this_month) +
            Number(rows4[0].total_sales_this_month_dis);

        res.json({
            success: true,
            data: {
                tatal_sales_for_today: total_sales_today,
                total_sales_this_month: total_sales_this_month_dis_cus,
                todaysProduction: rows5[0].total_produced_quantity,
                total_product_stock: rows6[0].total_product_stock,
                total_raw_m_stock: rows7[0].total_raw_m_stock,
                total_product: rows8[0].total_rows,
                total_employees: rows9[0].total_emp,
                total_distributor: rows10[0].total_distributor ?? 0,
            },
        });
    } catch (err) {
        console.error("getDailyInfo error:", err);
        res
            .status(500)
            .json({ success: false, message: "Failed to fetch daily info" });
    }
};

exports.getMonthlySales = async (req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT DATE_FORMAT(sale_date, '%b') AS month,
            YEAR(sale_date) AS year,
            SUM(total_amount) AS value
            FROM distributor_sale
            WHERE sale_date >= DATE_FORMAT(DATE_SUB(CURDATE(), INTERVAL 5 MONTH), '%Y-%m-01')
            GROUP BY YEAR(sale_date), MONTH(sale_date)
            ORDER BY YEAR(sale_date) DESC, MONTH(sale_date) DESC
            LIMIT 6;`,
        );

        if (rows.length == 0) {
            return res.status(404).json({ success: false, message: "No Data" });
        }

        res.json({ success: true, data: rows });
    } catch (err) {
        res
            .status(500)
            .json({ success: false, message: "Failed to fetch monthly sales" });
    }
};
