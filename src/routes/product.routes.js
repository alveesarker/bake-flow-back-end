const router = require("express").Router();
const controller = require("../controllers/product.controller");

router.get("/", controller.getAllProducts);
router.get("/distributor-products", controller.getAllProductsForDistributor);
router.get("/customer-products", controller.getAllProductsForCustomer);
router.get("/:id", controller.getProductById);
router.post("/", controller.createProduct);
router.put("/:id", controller.updateProduct);
router.delete("/:id", controller.deleteProduct);

module.exports = router;
