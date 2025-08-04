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
  console.log("📨 Received message:", message.type);

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
    case "connection_request":
      handleConnectionRequest(ws, message);
      break;
    case "connection_accepted":
      handleConnectionAccepted(ws, message);
      break;
    case "connection_rejected":
      handleConnectionRejected(ws, message);
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

// Handle session creation
function handleCreateSession(ws, message) {
  const { sessionId } = message;

  let session = sessions.get(sessionId);

  if (session && session.host) {
    ws.send(
      JSON.stringify({
        type: "session_error",
        sessionId,
        error: "Session already exists",
      })
    );
    return;
  }

  if (!session) {
    // Create new session
    session = {
      host: ws,
      clients: new Map(),
      pendingClients: new Map(),
      createdAt: new Date(),
    };
    sessions.set(sessionId, session);
  } else {
    // Session exists but no host - set this connection as host
    session.host = ws;
  }

  console.log("✅ Session created:", sessionId);
  ws.send(
    JSON.stringify({
      type: "session_created",
      sessionId,
    })
  );

  // Check if there are any pending clients waiting for this session
  if (session.pendingClients && session.pendingClients.size > 0) {
    console.log("📨 Found pending clients for session:", sessionId);
    session.pendingClients.forEach((clientWs, clientId) => {
      console.log("📨 Sending connection request to host for pending client:", clientId);
      ws.send(
        JSON.stringify({
          type: "connection_request",
          sessionId,
          clientId,
          fromSessionId: clientId.split('_')[0],
          fromClientId: clientId,
        })
      );
    });
  }
}

// Handle session joining
function handleJoinSession(ws, message) {
  const { sessionId, clientId } = message;

  const session = sessions.get(sessionId);
  if (!session) {
    // Session doesn't exist yet - store the client's request and wait for host
    console.log("📨 Client trying to join non-existent session:", sessionId, "Client:", clientId);
    console.log("📨 Storing client request for when host creates session");

    // Store the client's WebSocket connection for when the host creates the session
    const pendingSession = {
      host: null,
      clients: new Map(),
      pendingClients: new Map(),
      createdAt: new Date(),
    };
    pendingSession.pendingClients.set(clientId, ws);
    sessions.set(sessionId, pendingSession);

    // Send session creation request to all connected clients (potential hosts)
    console.log("📨 Broadcasting session creation request to all clients");
    let broadcastCount = 0;
    wss.clients.forEach((client) => {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        broadcastCount++;
        console.log(`📨 Broadcasting to client ${broadcastCount}`);
        client.send(
          JSON.stringify({
            type: "session_creation_request",
            sessionId,
            clientId,
            fromSessionId: clientId.split('_')[0],
            fromClientId: clientId,
          })
        );
      }
    });
    console.log(`📨 Broadcasted to ${broadcastCount} clients`);

    console.log("📨 Client request stored for session:", sessionId);
    return;
  }

  // Send connection request to host
  if (session.host) {
    session.host.send(
      JSON.stringify({
        type: "connection_request",
        sessionId,
        clientId,
        fromSessionId: clientId.split('_')[0], // Extract session ID from client ID
        fromClientId: clientId,
      })
    );

    // Store client temporarily until host accepts
    session.pendingClients = session.pendingClients || new Map();
    session.pendingClients.set(clientId, ws);

    console.log("📨 Connection request sent to host for client:", clientId);
  } else {
    // No host available but session exists - store client request
    session.pendingClients = session.pendingClients || new Map();
    session.pendingClients.set(clientId, ws);
    console.log("📨 Client request stored for session:", sessionId, "Client:", clientId);
  }
}

// Handle connection request
function handleConnectionRequest(ws, message) {
  const { sessionId, clientId, fromSessionId, fromClientId } = message;

  const session = sessions.get(sessionId);
  if (!session) return;

  // Forward connection request to host
  if (session.host) {
    session.host.send(
      JSON.stringify({
        type: "connection_request",
        sessionId,
        clientId,
        fromSessionId,
        fromClientId,
      })
    );
  }
}

// Handle connection accepted
function handleConnectionAccepted(ws, message) {
  const { sessionId, clientId } = message;

  const session = sessions.get(sessionId);
  if (!session) return;

  // Move client from pending to active
  if (session.pendingClients && session.pendingClients.has(clientId)) {
    const clientWs = session.pendingClients.get(clientId);
    session.clients.set(clientId, clientWs);
    session.pendingClients.delete(clientId);

    console.log("✅ Client connection accepted:", sessionId, "Client:", clientId);
    clientWs.send(
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
}

// Handle connection rejected
function handleConnectionRejected(ws, message) {
  const { sessionId, clientId } = message;

  const session = sessions.get(sessionId);
  if (!session) return;

  // Remove client from pending
  if (session.pendingClients && session.pendingClients.has(clientId)) {
    const clientWs = session.pendingClients.get(clientId);
    session.pendingClients.delete(clientId);

    console.log("❌ Client connection rejected:", sessionId, "Client:", clientId);
    clientWs.send(
      JSON.stringify({
        type: "connection_rejected",
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
      clientWs.send(JSON.stringify(message));
    });
  } else {
    // Control message from client to host
    if (session.host) {
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
      // Also notify pending clients
      if (session.pendingClients) {
        session.pendingClients.forEach((clientWs) => {
          clientWs.send(
            JSON.stringify({
              type: "host_disconnected",
              sessionId,
            })
          );
        });
      }
      sessions.delete(sessionId);
      break;
    }

    // Check active clients
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

    // Check pending clients
    if (session.pendingClients) {
      for (const [clientId, clientWs] of session.pendingClients.entries()) {
        if (clientWs === ws) {
          console.log(
            "🔌 Pending client disconnected from session:",
            sessionId,
            "Client:",
            clientId
          );
          session.pendingClients.delete(clientId);
          break;
        }
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
