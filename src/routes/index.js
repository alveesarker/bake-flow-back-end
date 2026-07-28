const router = require("express").Router();
const productRoutes = require("./product.routes");
const inventoryRoutes = require("./inventory.routes")
const producitonRoutes = require("./production.routes");
const employeeRoutes = require("./employee.routes");
const dashboardRoutes = require("./dashboard.routes");
const distributorRoutes = require("./distributor.routes");
const distributorOrderRoutes = require("./distributor_order.routes");
const customerSaleRoutes = require("./customer_sale.routes");
const expenseRoutes = require("./expense.routes");

// Additional resources (raw materials, production, sales, employees, ...)
// can be added the same way as this project grows:
//   const rawMaterialRoutes = require("./rawMaterial.routes");
//   router.use("/raw-materials", rawMaterialRoutes);
router.use("/products", productRoutes);
router.use("/raw-materials", inventoryRoutes);
router.use("/production", producitonRoutes);
router.use("/employee", employeeRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/distributor", distributorRoutes);
router.use("/distributor-order", distributorOrderRoutes);
router.use("/customer-sale", customerSaleRoutes);
router.use("/expenses", expenseRoutes);

module.exports = router;
