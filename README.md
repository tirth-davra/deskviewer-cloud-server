# DeskViewer Cloud Server

This is the cloud WebSocket server for DeskViewer, deployed on Railway to handle signaling between remote desktop connections.

## Features

- **WebSocket Signaling**: Handles WebRTC signaling between peers
- **Session Management**: Manages remote desktop sessions
- **Permission-Based Connections**: Host must accept incoming connections
- **Connection Request Flow**: New unified interface with automatic role detection
- **Cross-Network Support**: Enables connections across different networks

## Deployment

### Railway Deployment

1. **Connect to Railway**:
   ```bash
   # Install Railway CLI
   npm install -g @railway/cli
   
   # Login to Railway
   railway login
   ```

2. **Deploy to Railway**:
   ```bash
   # Navigate to cloud server directory
   cd deskviewer-cloud-server
   
   # Deploy to Railway
   railway up
   ```

3. **Set Environment Variables**:
   - `PORT`: Railway will set this automatically
   - No additional environment variables needed

### Manual Deployment

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Start Server**:
   ```bash
   node cloud-websocket-server.js
   ```

## Connection Flow

### New Permission-Based Flow

1. **Client Initiates Connection**:
   - Client enters host's Session ID
   - Client clicks "Connect"
   - Server sends connection request to host

2. **Host Receives Request**:
   - Host sees popup: "Accept incoming connection from [Session ID]?"
   - Host can accept or decline

3. **Connection Established**:
   - On accept: Screen sharing begins automatically
   - On decline: Client receives "Connection Rejected" message

### Message Types

- `connection_request`: Sent to host when client wants to connect
- `connection_accepted`: Sent by host to accept connection
- `connection_rejected`: Sent by host to reject connection
- `session_joined`: Sent to client when connection is accepted
- `client_joined`: Sent to host when client successfully joins

## Server Architecture

### Session Management

```javascript
const sessions = new Map();
// Each session contains:
// - host: WebSocket connection to host
// - clients: Map of active client connections
// - pendingClients: Map of clients waiting for host approval
// - createdAt: Session creation timestamp
```

### Connection States

1. **Pending**: Client has requested connection, waiting for host approval
2. **Active**: Host has accepted, client can view and control
3. **Disconnected**: Connection ended or rejected

## Monitoring

The server logs all important events:
- Connection requests and responses
- Session creation and cleanup
- Client connections and disconnections
- Error handling

## Troubleshooting

### Common Issues

1. **Connection Timeout**: Check if Railway server is running
2. **Session Not Found**: Verify Session ID is correct
3. **Permission Denied**: Host must explicitly accept connections

### Logs

Monitor Railway logs:
```bash
railway logs
```

## Security

- No authentication required (simple Session ID system)
- Host must explicitly accept connections
- Connections are peer-to-peer after initial handshake
- No screen data passes through the server (only signaling)

## Performance

- Lightweight WebSocket server
- Minimal memory usage
- Automatic cleanup of disconnected sessions
- Supports multiple concurrent sessions 