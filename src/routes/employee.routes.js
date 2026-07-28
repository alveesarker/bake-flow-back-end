const express = require("express");
const router = express.Router();
const employeeController = require("../controllers/employee.controller");


router.get("/employee-name", employeeController.getEmployeeName);
router.get('/', employeeController.getAllEmployees);

// GET single employee by id
router.get('/:id', employeeController.getEmployeeById);

// POST create new employee
router.post('/', employeeController.addEmployee);

// PUT update employee by id
router.put('/:id', employeeController.updateEmployee);

// DELETE employee by id
router.delete('/:id', employeeController.deleteEmployee);

module.exports = router;
