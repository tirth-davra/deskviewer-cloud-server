const Recent_sessions = require("../models/Recent_sessions");
const User = require("../models/User");

// Add a recent session for a user
const addRecentSession = async (req, res) => {
  try {
    const { session_id } = req.body;
    const user_id = req.user.id; // From authenticated user

    // Validate required fields
    if (!session_id) {
      return res.status(400).json({
        success: false,
        message: "Session ID is required",
      });
    }

    // Validate session_id format (10 digits)
    if (!/^\d{10}$/.test(session_id)) {
      return res.status(400).json({
        success: false,
        message: "Session ID must be exactly 10 digits",
      });
    }

    // Check if this session already exists for this user
    const existingSession = await Recent_sessions.findOne({
      where: {
        user_id,
        session_id: parseInt(session_id), // Convert to integer
      },
    });

    if (existingSession) {
      // Session already exists, no need to update anything
      return res.json({
        success: true,
        message: "Session already exists in recent sessions",
        data: existingSession,
      });
    } else {
      // Create new session
      const newSession = await Recent_sessions.create({
        user_id,
        session_id: parseInt(session_id), // Convert to integer
      });

      return res.status(201).json({
        success: true,
        message: "Recent session added",
        data: newSession,
      });
    }
  } catch (error) {
    console.error("Add recent session error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to add recent session",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : "Internal server error",
    });
  }
};

// Get recent sessions for authenticated user
const getRecentSessions = async (req, res) => {
  try {
    const user_id = req.user.id; // From authenticated user
    const limit = parseInt(req.query.limit) || 10; // Default 10, max 50

    // Validate limit
    if (limit > 50) {
      return res.status(400).json({
        success: false,
        message: "Limit cannot exceed 50",
      });
    }

    const recentSessions = await Recent_sessions.findAll({
      where: { user_id },
      order: [["created_at", "DESC"]], // Most recent first (using created_at for proper chronological ordering)
      limit: limit,
      attributes: ["id", "session_id"], // Only return id and session_id
    });

    res.json({
      success: true,
      message: "Recent sessions retrieved",
      data: recentSessions,
    });
  } catch (error) {
    console.error("Get recent sessions error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get recent sessions",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : "Internal server error",
    });
  }
};

// Remove a recent session
const removeRecentSession = async (req, res) => {
  try {
    const { session_id } = req.params;
    const user_id = req.user.id;

    if (!session_id) {
      return res.status(400).json({
        success: false,
        message: "Session ID is required",
      });
    }

    const deletedSession = await Recent_sessions.destroy({
      where: {
        user_id,
        session_id: parseInt(session_id), // Convert to integer
      },
    });

    if (deletedSession === 0) {
      return res.status(404).json({
        success: false,
        message: "Recent session not found",
      });
    }

    res.json({
      success: true,
      message: "Recent session removed",
    });
  } catch (error) {
    console.error("Remove recent session error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to remove recent session",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : "Internal server error",
    });
  }
};

module.exports = {
  addRecentSession,
  getRecentSessions,
  removeRecentSession,
};
