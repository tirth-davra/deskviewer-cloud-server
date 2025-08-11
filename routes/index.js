const express = require("express");
const router = express.Router();
const authRoutes = require("./auth");
const recentSessionsRoutes = require("./recentSessions");

// Mount authentication routes
router.use("/auth", authRoutes);

// Mount recent sessions routes (authenticated)
router.use("/recentSessions", recentSessionsRoutes);

// Health check route
router.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "Server is healthy",
    timestamp: new Date().toISOString(),
  });
});

// API info route
router.get("/", (req, res) => {
  res.json({
    success: true,
    message: "DeskViewer API Server",
    version: "1.0.0",
    endpoints: {
      auth: "/api/auth",
      health: "/api/health",
    },
  });
});

module.exports = router;
