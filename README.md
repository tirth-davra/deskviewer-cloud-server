# DeskViewer Cloud Server

Express + WebSocket server with MySQL database, Sequelize ORM, and JWT authentication for DeskViewer remote desktop application.

## 🏗️ Project Structure

```
deskviewer-cloud-server/
├── config/
│   └── database.js          # Database configuration
├── controllers/
│   └── authController.js     # Authentication logic
├── middleware/
│   └── auth.js              # JWT authentication middleware
├── models/
│   └── User.js              # User model with Sequelize
├── routes/
│   ├── index.js             # Main routes index
│   └── auth.js              # Authentication routes
├── cloud-websocket-server.js # Main server file
├── package.json
└── .env.example             # Environment variables template
```

## Running on Local Network

To run the server on your local IP so other computers can access it:

### Method 1: Using npm scripts
```bash
# Install dependencies
npm install

# Run in development mode (will show your local IP addresses)
npm run dev
```

### Method 2: Direct node command
```bash
# Install dependencies
npm install

# Run with explicit host binding
HOST=0.0.0.0 node cloud-websocket-server.js
```

### Method 3: Using nodemon for development
```bash
# Install dependencies
npm install

# Run with nodemon (auto-restart on file changes)
HOST=0.0.0.0 nodemon cloud-websocket-server.js
```

## Access from Other Computers

When you run the server, it will display your local IP addresses. Other computers on your network can connect using:

- **WebSocket URL**: `ws://YOUR_LOCAL_IP:8080`
- **HTTP URL**: `http://YOUR_LOCAL_IP:8080`

Example:
- If your local IP is `192.168.1.100`, other computers would use:
  - `ws://192.168.1.100:8080` (for WebSocket connections)
  - `http://192.168.1.100:8080` (for HTTP API calls)

## 🗄️ Database Setup

1. **Install MySQL** and create a database:
   ```sql
   CREATE DATABASE deskviewer_db;
   ```

2. **Configure environment variables** (copy `.env.example` to `.env`):
   ```bash
   cp .env.example .env
   ```

3. **Update `.env` file** with your database credentials:
   ```env
   DB_HOST=localhost
   DB_PORT=3306
   DB_NAME=deskviewer_db
   DB_USER=root
   DB_PASSWORD=your_password
   JWT_SECRET=your-super-secret-jwt-key
   ```

## 🔐 Authentication API Endpoints

### Public Routes (No Authentication Required)
- `POST /api/auth/login` - User login

### API Usage Examples

**Login with email:**
```bash
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123"
  }'
```

**Response includes session code:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": { "id": 1, "email": "user@example.com" },
    "token": "jwt_token_here",
    "sessionCode": "1234567890"
  }
}
```



## Environment Variables

- `PORT`: Server port (default: 8080)
- `HOST`: Server host (default: 0.0.0.0 - all interfaces)

## Features

- **WebSocket signaling** for WebRTC connections
- **Express API server** for HTTP endpoints
- **Session management** for remote desktop sessions
- **Real-time control message relay**
- **Automatic cleanup** of disconnected clients
- **CORS enabled** for cross-origin requests
- **JSON API endpoints** for future features
- **MD5 password hashing** for compatibility with existing database
- **JWT authentication** for secure API access

## Development

The server will automatically restart when you make changes to the code (when using `npm run dev`). 