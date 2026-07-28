const express = require("express");
const router = express.Router();
const distributorOrderController = require("../controllers/distributor_order.controller");


router.post("/", distributorOrderController.saveOrder);

module.exports = router;
