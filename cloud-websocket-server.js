const WebSocket = require("ws");
const http = require("http");

// Create HTTP server
const server = http.createServer();

// Create WebSocket server
const wss = new WebSocket.Server({ server });

// Store active sessions with sessionId as key
const activeSessions = new Map();

// Store WebSocket connections by sessionId
const sessionConnections = new Map();

console.log("🚀 Cloud WebSocket Server Starting...");

wss.on("connection", (ws) => {
  console.log("🔌 New WebSocket connection established");

  ws.on("message", (data) => {
    try {
      const message = JSON.parse(data.toString());
      handleWebSocketMessage(ws, message);
    } catch (error) {
      console.error("❌ Error parsing WebSocket message:", error);
    }
  });

  ws.on("close", () => {
    console.log("🔌 WebSocket connection closed");
    cleanupDisconnectedClient(ws);
  });
});

// Handle WebSocket messages
function handleWebSocketMessage(ws, message) {
  console.log("📨 Received message:", message.type);

  switch (message.type) {
    case "register_session":
      handleRegisterSession(ws, message);
      break;
    case "request_connection":
      handleRequestConnection(ws, message);
      break;
    case "connection_response":
      handleConnectionResponse(ws, message);
      break;
    case "start_screen_sharing":
      handleStartScreenSharing(ws, message);
      break;
    case "offer":
    case "answer":
    case "ice_candidate":
      handleSignalingMessage(ws, message);
      break;
    case "mouse_move":
    case "mouse_click":
    case "mouse_down":
    case "mouse_up":
    case "key_down":
    case "key_up":
    case "screen_resolution":
      handleControlMessage(ws, message);
      break;
    default:
      console.warn("⚠️ Unknown message type:", message.type);
  }
}

// Handle session registration (app startup)
function handleRegisterSession(ws, message) {
  const { sessionId } = message;

  if (activeSessions.has(sessionId)) {
    ws.send(
      JSON.stringify({
        type: "registration_error",
        sessionId,
        error: "Session ID already exists",
      })
    );
    return;
  }

  // Register the session as available
  activeSessions.set(sessionId, {
    ws: ws,
    status: "available",
    createdAt: new Date(),
    lastHeartbeat: new Date(),
  });

  sessionConnections.set(sessionId, ws);

  console.log("✅ Session registered:", sessionId);
  ws.send(
    JSON.stringify({
      type: "session_registered",
      sessionId,
    })
  );
}

// Handle connection request
function handleRequestConnection(ws, message) {
  const { targetSessionId, fromSessionId } = message;

  const targetSession = activeSessions.get(targetSessionId);
  if (!targetSession) {
    ws.send(
      JSON.stringify({
        type: "connection_error",
        error: "Target session not found",
        targetSessionId,
      })
    );
    return;
  }

  if (targetSession.status !== "available") {
    ws.send(
      JSON.stringify({
        type: "connection_error",
        error: "Target session is not available",
        targetSessionId,
      })
    );
    return;
  }

  // Send permission request to target user
  targetSession.ws.send(
    JSON.stringify({
      type: "incoming_connection_request",
      fromSessionId,
      targetSessionId,
    })
  );

  console.log("📤 Connection request sent from", fromSessionId, "to", targetSessionId);
}

// Handle connection response (accept/decline)
function handleConnectionResponse(ws, message) {
  const { targetSessionId, fromSessionId, accepted } = message;

  const requesterSession = activeSessions.get(fromSessionId);
  if (!requesterSession) {
    console.log("❌ Requester session not found:", fromSessionId);
    return;
  }

  if (accepted) {
    // Update session status to connected
    const targetSession = activeSessions.get(targetSessionId);
    if (targetSession) {
      targetSession.status = "connected";
      targetSession.connectedTo = fromSessionId;
    }

    // Notify requester that connection was accepted
    requesterSession.ws.send(
      JSON.stringify({
        type: "connection_accepted",
        targetSessionId,
        fromSessionId,
      })
    );

    // Automatically send start_screen_sharing to the client (requester)
    requesterSession.ws.send(
      JSON.stringify({
        type: "start_screen_sharing",
        sessionId: targetSessionId, // Host session ID
        targetSessionId: fromSessionId, // Client session ID
      })
    );

    console.log("✅ Connection accepted between", fromSessionId, "and", targetSessionId);
    console.log("📺 Auto-sent start_screen_sharing to client");
  } else {
    // Notify requester that connection was declined
    requesterSession.ws.send(
      JSON.stringify({
        type: "connection_declined",
        targetSessionId,
        fromSessionId,
      })
    );

    console.log("❌ Connection declined between", fromSessionId, "and", targetSessionId);
  }
}

// Handle start screen sharing
function handleStartScreenSharing(ws, message) {
  const { sessionId, targetSessionId } = message;

  const targetSession = activeSessions.get(targetSessionId);
  if (!targetSession) {
    ws.send(
      JSON.stringify({
        type: "screen_sharing_error",
        error: "Target session not found",
      })
    );
    return;
  }

  // Notify target to start screen sharing
  targetSession.ws.send(
    JSON.stringify({
      type: "start_screen_sharing",
      sessionId,
      targetSessionId,
    })
  );

  console.log("📺 Screen sharing started between", sessionId, "and", targetSessionId);
}

// Handle signaling messages
function handleSignalingMessage(ws, message) {
  const { sessionId, targetSessionId } = message;

  const targetSession = activeSessions.get(targetSessionId);
  if (!targetSession) return;

  targetSession.ws.send(JSON.stringify(message));
}

// Handle control messages
function handleControlMessage(ws, message) {
  const { sessionId, targetSessionId } = message;

  const targetSession = activeSessions.get(targetSessionId);
  if (!targetSession) return;

  targetSession.ws.send(JSON.stringify(message));
}

// Clean up disconnected clients
function cleanupDisconnectedClient(ws) {
  for (const [sessionId, session] of activeSessions.entries()) {
    if (session.ws === ws) {
      console.log("🔌 Session disconnected:", sessionId);
      
      // Notify connected peer if any
      if (session.connectedTo) {
        const connectedSession = activeSessions.get(session.connectedTo);
        if (connectedSession) {
          connectedSession.ws.send(
            JSON.stringify({
              type: "peer_disconnected",
              sessionId,
            })
          );
          connectedSession.status = "available";
          delete connectedSession.connectedTo;
        }
      }
      
      activeSessions.delete(sessionId);
      sessionConnections.delete(sessionId);
      break;
    }
  }
}

// Heartbeat to keep sessions alive
setInterval(() => {
  const now = new Date();
  for (const [sessionId, session] of activeSessions.entries()) {
    const timeSinceHeartbeat = now - session.lastHeartbeat;
    if (timeSinceHeartbeat > 30000) { // 30 seconds
      console.log("💓 Session timeout:", sessionId);
      session.ws.close();
      activeSessions.delete(sessionId);
      sessionConnections.delete(sessionId);
    }
  }
}, 10000); // Check every 10 seconds

// Get port from environment or use default
const PORT = process.env.PORT || 8080;

server.listen(PORT, () => {
  console.log(`✅ Cloud WebSocket server running on port ${PORT}`);
  console.log(`🌐 Server is ready for internet connections`);
  console.log(`📡 Active sessions: ${activeSessions.size}`);
});

// Handle server errors
server.on("error", (error) => {
  console.error("❌ Server error:", error);
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("🔄 Shutting down server...");
  server.close(() => {
    console.log("✅ Server closed");
    process.exit(0);
  });
});
