const router = require("express").Router();
const productRoutes = require("./product.routes");

// Additional resources (raw materials, production, sales, employees, ...)
// can be added the same way as this project grows:
//   const rawMaterialRoutes = require("./rawMaterial.routes");
//   router.use("/raw-materials", rawMaterialRoutes);
router.use("/products", productRoutes);

module.exports = router;
