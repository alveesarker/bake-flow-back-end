const express = require("express");
const router = express.Router();
const customerSaleController = require("../controllers/customer_sale.controller");


router.post("/", customerSaleController.saveSaleInfo);

module.exports = router;
