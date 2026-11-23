
import 'dotenv/config';
import dns from 'node:dns';
import http from 'node:http';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { Server } from 'socket.io';

import { app, allowedOrigins } from './src/app.js';
import { setIO } from './src/services/notify.js';

// ==========================================
// 1. DNS CONFIGURATION
// ==========================================

// Fix MongoDB Atlas SRV DNS resolution on your network.
dns.setServers(['8.8.8.8', '1.1.1.1']);

// ==========================================
// 2. ENVIRONMENT VALIDATION
// ==========================================

const { MONGODB_URI, JWT_SECRET } = process.env;

if (
  !MONGODB_URI ||
  !JWT_SECRET ||
  JWT_SECRET.length < 32 ||
  JWT_SECRET.includes('CHANGE_ME')
) {
  console.error(
    'Set MONGODB_URI and a JWT_SECRET of at least 32 characters in server/.env'
  );
  process.exit(1);
}

// ==========================================
// 3. MONGODB CONNECTION
// ==========================================

try {
  await mongoose.connect(MONGODB_URI, {
    serverSelectionTimeoutMS: 15000
  });

  console.log('MongoDB connected successfully');
} catch (error) {
  console.error('\nMongoDB connection failed:', error.message);

  // Print underlying network errors for each Atlas server.
  if (error.reason?.servers) {
    for (const [address, server] of error.reason.servers) {
      console.error('\nServer:', address);
      console.error('Error:', server.error?.message || 'Unknown');
      console.error('Code:', server.error?.code || 'N/A');
      console.error(
        'Cause:',
        server.error?.cause?.message || 'N/A'
      );
    }
  }

  process.exit(1);
}

// ==========================================
// 4. HTTP SERVER
// ==========================================

const server = http.createServer(app);

// ==========================================
// 5. SOCKET.IO CONFIGURATION
// ==========================================

const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true
  }
});

// ==========================================
// 6. SOCKET AUTHENTICATION
// ==========================================

io.use((socket, next) => {
  try {
    const cookieHeader =
      socket.handshake.headers.cookie || '';

    const cookies = Object.fromEntries(
      cookieHeader
        .split(';')
        .map((cookie) =>
          cookie
            .trim()
            .split('=')
            .map(decodeURIComponent)
        )
        .filter((parts) => parts.length === 2)
    );

    const token = cookies.citizen_session;

    // Allow public connections for live map updates.
    if (!token) {
      return next();
    }

    const decoded = jwt.verify(token, JWT_SECRET);

    if (decoded.kind === 'citizen') {
      socket.data.userId = decoded.id;
    }

    next();
  } catch (error) {
    // Invalid sessions do not prevent public map access.
    next();
  }
});

// ==========================================
// 7. SOCKET CONNECTION HANDLER
// ==========================================

io.on('connection', (socket) => {
  if (socket.data.userId) {
    socket.join(`user:${socket.data.userId}`);
  }
});

// Make Socket.IO available to notification services.
setIO(io);

// ==========================================
// 8. START EXPRESS SERVER
// ==========================================

const PORT = Number(process.env.PORT || 4000);

server.listen(PORT, () => {
  console.log(
    `CivicAlert API running at http://localhost:${PORT}`
  );
});

// ==========================================
// 9. GRACEFUL SHUTDOWN
// ==========================================

process.on('SIGINT', async () => {
  console.log('\nShutting down CivicAlert API...');

  server.close();

  await mongoose.disconnect();

  process.exit(0);
});
