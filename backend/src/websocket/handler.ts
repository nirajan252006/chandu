// ============================================
// WebSocket Handler
// ============================================

import { Server as SocketServer, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import { jobProcessor } from '../services/job-processor';
import { queueManager } from '../services/queue-manager';
import { browserManager } from '../automation/browser-manager';
import logger from '../utils/logger';
import config from '../config';

let io: SocketServer | null = null;

/**
 * Initialize WebSocket server
 */
export function initializeWebSocket(httpServer: HttpServer): SocketServer {
  io = new SocketServer(httpServer, {
    cors: {
      origin: config.frontendUrl,
      methods: ['GET', 'POST'],
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Set up the job processor's WS emitter
  jobProcessor.setWSEmitter((event: string, data: any) => {
    if (io) {
      io.emit(event, data);
    }
  });

  io.on('connection', (socket: Socket) => {
    logger.info(`WebSocket client connected: ${socket.id}`);

    // Send current browser status on connect
    socket.emit('browser:status', browserManager.getStatus());

    // Send current job status if active
    const activeJobId = jobProcessor.getActiveJobId();
    if (activeJobId) {
      socket.emit('job:status', { jobId: activeJobId, status: queueManager.getStatus() });
    }

    // Send current queue progress if processing
    if (queueManager.processing) {
      socket.emit('job:progress', queueManager.getProgress());
    }

    socket.on('disconnect', (reason) => {
      logger.info(`WebSocket client disconnected: ${socket.id} (${reason})`);
    });

    socket.on('error', (error) => {
      logger.error(`WebSocket error from ${socket.id}: ${error}`);
    });
  });

  logger.info('WebSocket server initialized');
  return io;
}

/**
 * Emit an event to all connected clients
 */
export function emitToAll(event: string, data: any): void {
  if (io) {
    io.emit(event, data);
  }
}

/**
 * Get the Socket.IO server instance
 */
export function getIO(): SocketServer | null {
  return io;
}

export default initializeWebSocket;
