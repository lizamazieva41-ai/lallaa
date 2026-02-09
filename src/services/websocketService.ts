import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { verify } from 'jsonwebtoken';
import config from '../config';
import { logger } from '../utils/logger';
import { getJobQueue } from './jobQueue';
import { websocketRateLimit } from '../middleware/security';

let io: SocketIOServer | null = null;

/**
 * Initialize WebSocket server
 */
export const initializeWebSocket = (httpServer: HTTPServer): SocketIOServer => {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: config.websocket.corsOrigin,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingInterval: config.websocket.pingInterval,
    pingTimeout: config.websocket.pingTimeout,
  });

  // Rate limiting middleware (before authentication)
  io.use(websocketRateLimit);

  // Authentication middleware
  io.use(async (socket: Socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
      
      if (!token) {
        return next(new Error('Authentication token required'));
      }

      // Verify JWT token
      const decoded = verify(token, config.jwt.secret) as { userId: string; email: string };
      (socket as any).userId = decoded.userId;
      (socket as any).userEmail = decoded.email;
      
      next();
    } catch (error) {
      logger.warn('WebSocket authentication failed', { error });
      next(new Error('Authentication failed'));
    }
  });

  // Connection handler
  io.on('connection', (socket: Socket) => {
    const userId = (socket as any).userId;
    logger.info('WebSocket client connected', { userId, socketId: socket.id });

    // Join user-specific room
    socket.join(`user:${userId}`);

    // Handle job status subscription
    socket.on('subscribe:job', async (jobId: string) => {
      logger.debug('Client subscribed to job updates', { userId, jobId, socketId: socket.id });
      socket.join(`job:${jobId}`);
    });

    // Handle job status unsubscribe
    socket.on('unsubscribe:job', (jobId: string) => {
      logger.debug('Client unsubscribed from job updates', { userId, jobId, socketId: socket.id });
      socket.leave(`job:${jobId}`);
    });

    // Handle disconnect
    socket.on('disconnect', (reason) => {
      logger.info('WebSocket client disconnected', { userId, socketId: socket.id, reason });
    });

    // Handle errors
    socket.on('error', (error) => {
      logger.error('WebSocket error', { error, userId, socketId: socket.id });
    });
  });

  logger.info('WebSocket server initialized');
  return io;
};

/**
 * Get WebSocket server instance
 */
export const getWebSocketServer = (): SocketIOServer | null => {
  return io;
};

/**
 * Emit job progress update
 */
export const emitJobProgress = (jobId: string, progress: number, data?: any): void => {
  if (!io) {
    return;
  }

  io.to(`job:${jobId}`).emit('job:progress', {
    jobId,
    progress,
    data,
    timestamp: new Date().toISOString(),
  });
};

/**
 * Emit job completion
 */
export const emitJobCompleted = (jobId: string, result: any): void => {
  if (!io) {
    return;
  }

  io.to(`job:${jobId}`).emit('job:completed', {
    jobId,
    result,
    timestamp: new Date().toISOString(),
  });
};

/**
 * Emit job error
 */
export const emitJobError = (jobId: string, error: string): void => {
  if (!io) {
    return;
  }

  io.to(`job:${jobId}`).emit('job:error', {
    jobId,
    error,
    timestamp: new Date().toISOString(),
  });
};

/**
 * Get connected clients count
 */
export const getConnectedClientsCount = (): number => {
  if (!io) {
    return 0;
  }

  return io.sockets.sockets.size;
};

/**
 * Close WebSocket server
 */
export const closeWebSocket = async (): Promise<void> => {
  if (io) {
    io.close();
    io = null;
    logger.info('WebSocket server closed');
  }
};
