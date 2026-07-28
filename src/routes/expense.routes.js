const express = require("express");
const router = express.Router();
const expenseConntroller = require("../controllers/expense.controller");

router.get('/', expenseConntroller.getAllExpenses);

router.get('/categories', expenseConntroller.getExpenseCategories);

router.get('/:id', expenseConntroller.getExpenseById);

router.post('/', expenseConntroller.addExpense);

router.put('/:id', expenseConntroller.updateExpense);

router.delete('/:id', expenseConntroller.deleteExpense);

module.exports = router;