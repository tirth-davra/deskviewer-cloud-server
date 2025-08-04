# DeskViewer Cloud WebSocket Server

This is the cloud WebSocket server for DeskViewer remote desktop application.

## 🚀 Quick Start

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Start Server**:
   ```bash
   npm start
   ```

## 📦 What This Does

- Handles WebSocket connections for DeskViewer
- Manages sessions between host and client
- Routes signaling messages for WebRTC
- Forwards mouse/keyboard control events

## 🌐 Deployment

This server is designed to be deployed to Railway, Heroku, or any cloud platform.

### Railway Deployment

1. Connect this repository to Railway
2. Railway will auto-detect Node.js and deploy
3. Get your WebSocket URL from Railway dashboard

## 🔧 Configuration

- **Port**: Uses `process.env.PORT` or defaults to 8080
- **WebSocket**: Handles all DeskViewer signaling
- **Sessions**: Manages multiple concurrent sessions

## 📡 API

The server handles these message types:
- `create_session` - Create new sharing session
- `join_session` - Join existing session
- `offer/answer/ice_candidate` - WebRTC signaling
- `mouse_*` - Mouse control events
- `key_*` - Keyboard control events
- `screen_resolution` - Screen size info

## 🎯 Usage

Once deployed, update your DeskViewer app with the WebSocket URL:
```typescript
const wsUrl = 'wss://your-railway-app.railway.app'
``` 