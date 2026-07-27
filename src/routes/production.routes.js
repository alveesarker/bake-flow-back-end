const express = require("express");
const router = express.Router();
const productionController = require("../controllers/production.controller");

router.get("/", productionController.getAllProduction);
router.get("/:id", productionController.getProductionById);
router.post("/", productionController.createProduction);
router.post("/:id/complete", productionController.completeProduction);

module.exports = router;

// In your main app/server file, mount this router with:
// const productionRoutes = require("./routes/production.routes");
// app.use("/api/production", productionRoutes);