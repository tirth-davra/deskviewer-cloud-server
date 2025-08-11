const crypto = require('crypto');

// Store active session codes to ensure uniqueness
const activeSessionCodes = new Set();

// Generate a unique 10-digit numeric session code
const generateSessionCode = () => {
  let sessionCode;
  let attempts = 0;
  const maxAttempts = 100;

  do {
    // Generate a random 10-digit number
    sessionCode = Math.floor(1000000000 + Math.random() * 9000000000).toString();
    attempts++;
    
    // Prevent infinite loop
    if (attempts > maxAttempts) {
      throw new Error('Unable to generate unique session code after maximum attempts');
    }
  } while (activeSessionCodes.has(sessionCode));

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
  getActiveSessionCodes
}; 