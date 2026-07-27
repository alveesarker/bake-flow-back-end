const express = require("express");
const router = express.Router();
const dashboardController = require("../controllers/dashboard.controller");

router.use("/daily-info", dashboardController.getDailyInfo);
router.use("/monthly-sales", dashboardController.getMonthlySales);

module.exports = router;
