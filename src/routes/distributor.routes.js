const express = require("express");
const router = express.Router();
const distributorController = require("../controllers/distributor.controller");


router.get("/", distributorController.getAllDistributor)
router.get("/distributor-name", distributorController.getDistributorsName);
router.get("/:id", distributorController.getDistributorById);
router.post("/", distributorController.addDistributor);
router.put("/:id", distributorController.editDistributor);

module.exports = router;
