const express = require("express");
const router = express.Router();
const employeeController = require("../controllers/employee.controller");


router.get("/employee-name", employeeController.getEmployeeName);

module.exports = router;
