// ============================================
// Express Server + WebSocket
// ============================================

import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import path from 'path';
import fs from 'fs';

import config from './config';
import logger from './utils/logger';
import { runMigrations } from './database/migrations';
import { closeDb } from './database/connection';
import { browserManager } from './automation/browser-manager';
import { initializeWebSocket } from './websocket/handler';

// Routes
import uploadRoutes from './routes/upload';
import jobRoutes from './routes/jobs';
import exportRoutes from './routes/export';

// Create Express app
const app = express();
const httpServer = createServer(app);

// Middleware
const allowedOrigins = [config.frontendUrl, 'http://localhost:5173', 'http://localhost:3000'].filter(Boolean);
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    const isAllowed = allowedOrigins.includes(origin) || origin.endsWith('.vercel.app');
    if (isAllowed) {
      callback(null, true);
    } else {
      callback(new Error(`Origin ${origin} not allowed by CORS`));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  credentials: true,
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Ensure data directories exist
const dirs = [config.uploadDir, config.exportDir, config.logDir, path.dirname(config.dbPath)];
dirs.forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Static file serving for exports
app.use('/exports', express.static(config.exportDir));

// API Routes
app.use('/api/upload', uploadRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/export', exportRoutes);

// Health check
const healthCheckHandler = (_req: express.Request, res: express.Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    browser: browserManager.getStatus(),
    uptime: process.uptime(),
  });
};
app.get('/health', healthCheckHandler);
app.get('/api/health', healthCheckHandler);

// Config endpoint
app.get('/api/config', (_req, res) => {
  res.json({
    success: true,
    config: {
      maxParallelTabs: config.queue.maxParallelTabs,
      maxRetries: config.queue.maxRetries,
      autoThrottle: config.queue.autoThrottle,
      pageLoadTimeout: config.queue.pageLoadTimeout,
      searchTimeout: config.queue.searchTimeout,
    },
  });
});

// Initialize
async function start() {
  try {
    // Run database migrations
    runMigrations();

    // Initialize WebSocket
    initializeWebSocket(httpServer);

    // Start HTTP server
    httpServer.listen(config.port, () => {
      logger.info(`
╔══════════════════════════════════════════════════════╗
║     🚗 VEHICLE DATA RETRIEVER PRO                   ║
║     Server running on port ${config.port}                    ║
║     Frontend: ${config.frontendUrl}              ║
║     API: http://localhost:${config.port}/api                ║
╚══════════════════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    logger.error(`Failed to start server: ${error}`);
    process.exit(1);
  }
}

// Graceful shutdown
async function shutdown(signal: string) {
  logger.info(`\nReceived ${signal}. Shutting down gracefully...`);

  try {
    await browserManager.shutdown();
    closeDb();
    httpServer.close();
    logger.info('Server shut down successfully');
    process.exit(0);
  } catch (error) {
    logger.error(`Error during shutdown: ${error}`);
    process.exit(1);
  }
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('uncaughtException', (error) => {
  logger.error(`Uncaught exception: ${error}`);
});
process.on('unhandledRejection', (reason) => {
  logger.error(`Unhandled rejection: ${reason}`);
});

start();

export default app;
