const express = require("express");
const router = express.Router();
const rawMaterialController = require("../controllers/inventory.controller");

// Purchase route must be declared before "/:id" is used with GET only,
// but since it's a distinct path with its own method it's fine either order.
router.get("/", rawMaterialController.getAllRawMaterials);
router.get("/:id", rawMaterialController.getRawMaterialById);
router.post("/", rawMaterialController.createRawMaterial);
router.post("/purchase", rawMaterialController.purchaseRawMaterials);
router.put("/:id", rawMaterialController.updateRawMaterial);
router.delete("/:id", rawMaterialController.deleteRawMaterial);

module.exports = router;

// In your main app/server file, mount this router with:
// const rawMaterialRoutes = require("./routes/rawMaterial.routes");
// app.use("/api/raw-materials", rawMaterialRoutes);