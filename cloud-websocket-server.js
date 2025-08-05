const WebSocket = require("ws");
const http = require("http");

// Create HTTP server
const server = http.createServer();

// Create WebSocket server
const wss = new WebSocket.Server({ server });

// Store sessions
const sessions = new Map();

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
  // Optimized: Only log non-frequent message types
  if (!['mouse_move'].includes(message.type)) {
    console.log("📨 Received message:", message.type);
  }

  switch (message.type) {
    case "create_session":
      handleCreateSession(ws, message);
      break;
    case "join_session":
      handleJoinSession(ws, message);
      break;
    case "leave_session":
      handleLeaveSession(ws, message);
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
    case "permission_request":
    case "permission_response":
      handlePermissionMessage(ws, message);
      break;
    default:
      console.warn("⚠️ Unknown message type:", message.type);
  }
}

// Handle session creation
function handleCreateSession(ws, message) {
  const { sessionId } = message;

  if (sessions.has(sessionId)) {
    ws.send(
      JSON.stringify({
        type: "session_error",
        sessionId,
        error: "Session already exists",
      })
    );
    return;
  }

  sessions.set(sessionId, {
    host: ws,
    clients: new Map(),
    createdAt: new Date(),
  });

  console.log("✅ Session created:", sessionId);
  ws.send(
    JSON.stringify({
      type: "session_created",
      sessionId,
    })
  );
}

// Handle session joining
function handleJoinSession(ws, message) {
  const { sessionId, clientId } = message;

  const session = sessions.get(sessionId);
  if (!session) {
    ws.send(
      JSON.stringify({
        type: "session_error",
        sessionId,
        error: "Session not found",
      })
    );
    return;
  }

  session.clients.set(clientId, ws);

  console.log("✅ Client joined session:", sessionId, "Client:", clientId);
  ws.send(
    JSON.stringify({
      type: "session_joined",
      sessionId,
      clientId,
    })
  );

  // Notify host about new client
  if (session.host) {
    session.host.send(
      JSON.stringify({
        type: "client_joined",
        sessionId,
        clientId,
      })
    );
  }
}

// Handle session leaving
function handleLeaveSession(ws, message) {
  const { sessionId, clientId } = message;

  const session = sessions.get(sessionId);
  if (!session) return;

  if (session.host === ws) {
    // Host is leaving
    console.log("🔌 Host leaving session:", sessionId);
    session.clients.forEach((clientWs) => {
      clientWs.send(
        JSON.stringify({
          type: "host_disconnected",
          sessionId,
        })
      );
    });
    sessions.delete(sessionId);
  } else {
    // Client is leaving
    session.clients.delete(clientId);
    console.log("🔌 Client leaving session:", sessionId, "Client:", clientId);

    if (session.host) {
      session.host.send(
        JSON.stringify({
          type: "client_left",
          sessionId,
          clientId,
        })
      );
    }
  }
}

// Handle signaling messages
function handleSignalingMessage(ws, message) {
  const { sessionId, clientId } = message;

  const session = sessions.get(sessionId);
  if (!session) return;

  if (session.host === ws) {
    // Message from host to specific client
    const clientWs = session.clients.get(clientId);
    if (clientWs) {
      clientWs.send(JSON.stringify(message));
    }
  } else {
    // Message from client to host
    if (session.host) {
      session.host.send(JSON.stringify(message));
    }
  }
}

// Handle control messages
function handleControlMessage(ws, message) {
  const { sessionId, clientId } = message;

  const session = sessions.get(sessionId);
  if (!session) return;

  if (session.host === ws) {
    // Control message from host to clients
    session.clients.forEach((clientWs) => {
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify(message));
      }
    });
  } else {
    // Control message from client to host
    if (session.host && session.host.readyState === WebSocket.OPEN) {
      session.host.send(JSON.stringify(message));
    }
  }
}

// Handle permission messages
function handlePermissionMessage(ws, message) {
  const { sessionId, clientId } = message;

  const session = sessions.get(sessionId);
  if (!session) return;

  if (session.host === ws) {
    // Permission response from host to specific client
    const clientWs = session.clients.get(clientId);
    if (clientWs) {
      console.log(`🔐 Host ${message.granted ? 'granted' : 'denied'} permission for client ${clientId}`);
      clientWs.send(JSON.stringify(message));
    }
  } else {
    // Permission request from client to host (shouldn't happen in our flow, but handle it)
    if (session.host) {
      console.log(`🔐 Permission request from client ${clientId} to host`);
      session.host.send(JSON.stringify(message));
    }
  }
}

// Clean up disconnected clients
function cleanupDisconnectedClient(ws) {
  for (const [sessionId, session] of sessions.entries()) {
    if (session.host === ws) {
      console.log("🔌 Host disconnected from session:", sessionId);
      session.clients.forEach((clientWs) => {
        clientWs.send(
          JSON.stringify({
            type: "host_disconnected",
            sessionId,
          })
        );
      });
      sessions.delete(sessionId);
      break;
    }

    for (const [clientId, clientWs] of session.clients.entries()) {
      if (clientWs === ws) {
        console.log(
          "🔌 Client disconnected from session:",
          sessionId,
          "Client:",
          clientId
        );
        session.clients.delete(clientId);

        if (session.host) {
          session.host.send(
            JSON.stringify({
              type: "client_left",
              sessionId,
              clientId,
            })
          );
        }
        break;
      }
    }
  }
}

// Get port from environment or use default
const PORT = process.env.PORT || 8080;

server.listen(PORT, () => {
  console.log(`✅ Cloud WebSocket server running on port ${PORT}`);
  console.log(`🌐 Server is ready for internet connections`);
  console.log(`📡 Sessions: ${sessions.size}`);
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
