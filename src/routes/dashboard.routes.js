const express = require("express");
const router = express.Router();
const dashboardController = require("../controllers/dashboard.controller");

router.use("/daily-info", dashboardController.getDailyInfo);
router.use("/monthly-sales", dashboardController.getMonthlySales);
router.use("/low-stock-p", dashboardController.getLowStockProducts);
router.use("/low-stock-rm", dashboardController.getLowStockRawMaterial);
router.use("/top-selling-products", dashboardController.getTopSellingProducts)

module.exports = router;
