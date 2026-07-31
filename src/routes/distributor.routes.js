const express = require("express");
const router = express.Router();
const distributorController = require("../controllers/distributor.controller");


router.get("/distributor-name", distributorController.getDistributorsName);
router.get("/:id", distributorController.getDistributorById);

module.exports = router;
