const WebSocket = require("ws");
const express = require("express");
const cors = require("cors");
require("dotenv").config();

// Import database and models
const { sequelize, testConnection } = require("./config/database");
const User = require("./models/User");

// Import routes
const apiRoutes = require("./routes");

// Create Express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Create HTTP server from Express app
const server = require("http").createServer(app);

// Create WebSocket server
const wss = new WebSocket.Server({ server });

// Store sessions
const sessions = new Map();

// Mount API routes
app.use("/api", apiRoutes);

// Initialize database and sync models
const initializeDatabase = async () => {
  try {
    await testConnection();
    await sequelize.sync(); 
    console.log("✅ Database models synchronized");
  } catch (error) {
    console.error("❌ Database initialization failed:", error);
  }
};

console.log("🚀 DeskViewer Express + WebSocket Server Starting...");

// Initialize database before starting server
initializeDatabase()
  .then(() => {
    console.log("✅ Database initialized successfully");
  })
  .catch((error) => {
    console.error("❌ Database initialization failed:", error);
  });

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
    case "permission_request":
    case "permission_response":
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

  // Check if session already exists
  if (sessions.has(sessionId)) {
    const existingSession = sessions.get(sessionId);
    
    // If the existing session's host is disconnected (WebSocket is closed), 
    // allow recreation of the session
    if (existingSession.host.readyState !== WebSocket.OPEN) {
      console.log("🔄 Recreating session with disconnected host:", sessionId);
      
      // Notify any remaining clients that the session is being recreated
      existingSession.clients.forEach((clientWs) => {
        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.send(
            JSON.stringify({
              type: "host_disconnected",
              sessionId,
            })
          );
        }
      });
      
      // Remove the old session
      sessions.delete(sessionId);
    } else {
      // Session exists with an active host
      ws.send(
        JSON.stringify({
          type: "session_error",
          sessionId,
          error: "Session already exists",
        })
      );
      return;
    }
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

// Get port and host from environment or use defaults
const PORT = process.env.PORT || 8080;
const HOST = process.env.HOST || "0.0.0.0"; // Listen on all network interfaces

server.listen(PORT, HOST, () => {
  console.log(`✅ Express + WebSocket server running on ${HOST}:${PORT}`);
  console.log(`🌐 Server is ready for network connections`);
  console.log(`📡 Active sessions: ${sessions.size}`);

  // Display local IP addresses for easy access
  const os = require("os");
  const networkInterfaces = os.networkInterfaces();

  console.log("\n🌍 Available network addresses:");
  Object.keys(networkInterfaces).forEach((interfaceName) => {
    networkInterfaces[interfaceName].forEach((interface) => {
      if (interface.family === "IPv4" && !interface.internal) {
        console.log(`   HTTP: http://${interface.address}:${PORT}`);
        console.log(`   WebSocket: ws://${interface.address}:${PORT}`);
      }
    });
  });
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
