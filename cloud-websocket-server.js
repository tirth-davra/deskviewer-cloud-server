const WebSocket = require("ws");
const http = require("http");

// Create HTTP server
const server = http.createServer();

// Create WebSocket server
const wss = new WebSocket.Server({ server });

// Session management
const sessions = new Map();

// Session interface
class Session {
  constructor(sessionId) {
    this.sessionId = sessionId;
    this.host = null;
    this.clients = new Map();
    this.createdAt = new Date();
    this.connectionOrder = []; // Track connection order for role assignment
  }
}

console.log("🚀 Cloud WebSocket Server Starting...");

// Handle WebSocket connections
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
    case "connect_to_session":
      handleConnectToSession(ws, message);
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
    default:
      console.warn("⚠️ Unknown message type:", message.type);
  }
}

// New unified connection handler
function handleConnectToSession(ws, message) {
  const { sessionId, clientId } = message;

  // Get or create session
  let session = sessions.get(sessionId);
  if (!session) {
    session = new Session(sessionId);
    sessions.set(sessionId, session);
    console.log("✅ Created new session:", sessionId);
  }

  // Add connection to order tracking
  session.connectionOrder.push({ ws, clientId });

  // Determine role based on connection order
  let role;
  if (session.connectionOrder.length === 1) {
    // First connection = host
    role = "host";
    session.host = ws;
    console.log("✅ First connection - assigned as host:", clientId);
  } else {
    // Subsequent connections = client
    role = "client";
    session.clients.set(clientId, ws);
    console.log("✅ Subsequent connection - assigned as client:", clientId);
  }

  // Send connection confirmation with role
  ws.send(
    JSON.stringify({
      type: "session_connected",
      sessionId,
      clientId,
      role,
    })
  );

  // If this is a client, notify the host
  if (role === "client" && session.host) {
    session.host.send(
      JSON.stringify({
        type: "client_joined",
        sessionId,
        clientId,
      })
    );
  }

  console.log(
    `✅ ${role} connected to session:`,
    sessionId,
    "Client ID:",
    clientId
  );
}

// Handle session leaving
function handleLeaveSession(ws, message) {
  const { sessionId, clientId } = message;

  const session = sessions.get(sessionId);
  if (!session) return;

  // Find and remove from connection order
  const connectionIndex = session.connectionOrder.findIndex(
    (conn) => conn.ws === ws
  );
  if (connectionIndex !== -1) {
    session.connectionOrder.splice(connectionIndex, 1);
  }

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

// Handle signaling messages (offer, answer, ICE candidates)
function handleSignalingMessage(ws, message) {
  const { sessionId, clientId } = message;

  const session = sessions.get(sessionId);
  if (!session) return;

  // Forward signaling messages
  if (session.host === ws) {
    // Host sending to specific client
    const targetClient = session.clients.get(clientId);
    if (targetClient) {
      targetClient.send(JSON.stringify(message));
    }
  } else {
    // Client sending to host
    if (session.host) {
      session.host.send(JSON.stringify(message));
    }
  }
}

// Handle control messages (mouse, keyboard, screen resolution)
function handleControlMessage(ws, message) {
  const { sessionId } = message;

  const session = sessions.get(sessionId);
  if (!session) return;

  // Forward control messages
  if (session.host === ws) {
    // Host sending to all clients
    session.clients.forEach((clientWs) => {
      clientWs.send(JSON.stringify(message));
    });
  } else {
    // Client sending to host
    if (session.host) {
      session.host.send(JSON.stringify(message));
    }
  }
}

// Clean up disconnected clients
function cleanupDisconnectedClient(ws) {
  for (const [sessionId, session] of sessions.entries()) {
    // Check if this is the host
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

    // Check if this is a client
    for (const [clientId, clientWs] of session.clients.entries()) {
      if (clientWs === ws) {
        console.log(
          "🔌 Client disconnected from session:",
          sessionId,
          "Client:",
          clientId
        );
        session.clients.delete(clientId);

        // Remove from connection order
        const connectionIndex = session.connectionOrder.findIndex(
          (conn) => conn.ws === ws
        );
        if (connectionIndex !== -1) {
          session.connectionOrder.splice(connectionIndex, 1);
        }

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
  console.log(
    `📡 Server URL: wss://deskviewer-cloud-server-production.up.railway.app`
  );
  console.log(`📊 Sessions: ${sessions.size}`);
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
