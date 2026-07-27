const express = require("express");
const router = express.Router();
const dashboardController = require("../controllers/dashboard.controller");

router.use("/daily-info", dashboardController.getDailyInfo);
router.use("/monthly-sales", dashboardController.getMonthlySales);
router.use("/low-stock-p", dashboardController.getLowStockProducts);

module.exports = router;
