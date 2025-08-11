const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");

// Public routes (no authentication required)
router.post("/login", authController.login);

module.exports = router;
