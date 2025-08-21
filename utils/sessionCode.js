const crypto = require("crypto");
const User = require("../models/User");

// Store active session codes to ensure uniqueness
const activeSessionCodes = new Set();

// Generate a unique 10-digit numeric session code that's not used by any other user
const generateSessionCode = async () => {
  let sessionCode;
  let attempts = 0;
  const maxAttempts = 100;

  do {
    // Generate a random 10-digit number
    sessionCode = Math.floor(
      1000000000 + Math.random() * 9000000000
    ).toString();
    attempts++;

    // Prevent infinite loop
    if (attempts > maxAttempts) {
      throw new Error(
        "Unable to generate unique session code after maximum attempts"
      );
    }

    // Check if this session code is already in active codes
    if (activeSessionCodes.has(sessionCode)) {
      continue; // Try again with next iteration
    }

    // Check if this session_id already exists in the users table
    const existingUser = await User.findOne({
      where: { session_id: parseInt(sessionCode) },
    });

    // If no user has this session_id, it's unique
    if (!existingUser) {
      break;
    }
  } while (true);

  // Add to active codes
  activeSessionCodes.add(sessionCode);

  return sessionCode;
};

// Remove session code when session ends
const removeSessionCode = (sessionCode) => {
  activeSessionCodes.delete(sessionCode);
};

// Check if session code exists
const isSessionCodeActive = (sessionCode) => {
  return activeSessionCodes.has(sessionCode);
};

// Get all active session codes (for debugging)
const getActiveSessionCodes = () => {
  return Array.from(activeSessionCodes);
};

module.exports = {
  generateSessionCode,
  removeSessionCode,
  isSessionCodeActive,
  getActiveSessionCodes,
};
