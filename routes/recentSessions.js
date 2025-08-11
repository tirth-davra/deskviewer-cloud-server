const express = require("express");
const router = express.Router();
const recentSessionsController = require("../controllers/recentSessionsController");
const { authenticateToken } = require("../middleware/auth");

// All routes require authentication
router.use(authenticateToken);

// POST /api/recent-sessions - Add a recent session
router.post("/add", recentSessionsController.addRecentSession);

// GET /api/recent-sessions - Get user's recent sessions
router.get("/get", recentSessionsController.getRecentSessions);

// DELETE /api/recent-sessions/:session_id - Remove a recent session
router.delete(
  "/remove/:session_id",
  recentSessionsController.removeRecentSession
);

module.exports = router;
