// ============================================
// Job Management Routes
// ============================================

import { Router, Request, Response } from 'express';
import { jobProcessor } from '../services/job-processor';
import { queueManager } from '../services/queue-manager';
import { browserManager } from '../automation/browser-manager';
import * as db from '../database/queries';
import logger from '../utils/logger';

const router = Router();

/**
 * GET /api/jobs - List all jobs
 */
router.get('/', (_req: Request, res: Response) => {
  try {
    const jobs = db.getAllJobs();
    res.json({ success: true, jobs });
  } catch (error) {
    logger.error(`Error listing jobs: ${error}`);
    res.status(500).json({ error: 'Failed to list jobs' });
  }
});

/**
 * GET /api/jobs/:id - Get job details
 */
router.get('/:id', (req: Request, res: Response) => {
  try {
    const job = db.getJob(String(req.params.id));
    if (!job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }

    const progress = queueManager.processing && jobProcessor.getActiveJobId() === String(req.params.id)
      ? queueManager.getProgress()
      : null;

    res.json({ success: true, job, progress });
  } catch (error) {
    logger.error(`Error getting job: ${error}`);
    res.status(500).json({ error: 'Failed to get job details' });
  }
});

/**
 * POST /api/jobs/:id/start - Start processing a job
 */
router.post('/:id/start', async (req: Request, res: Response) => {
  try {
    const jobId = String(req.params.id);
    const job = db.getJob(jobId);

    if (!job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }

    const concurrency = req.body.concurrency ? parseInt(String(req.body.concurrency), 10) : undefined;

    // Respond immediately, processing happens in background
    res.json({ success: true, message: 'Job started', jobId });

    // Start processing in background with configured concurrency
    jobProcessor.startJob(jobId, concurrency).catch(error => {
      logger.error(`Background job processing failed: ${error}`);
    });
  } catch (error) {
    logger.error(`Error starting job: ${error}`);
    res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to start job' });
  }
});

/**
 * POST /api/jobs/:id/pause - Pause a running job
 */
router.post('/:id/pause', (req: Request, res: Response) => {
  try {
    jobProcessor.pauseJob(String(req.params.id));
    res.json({ success: true, message: 'Job paused' });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to pause' });
  }
});

/**
 * POST /api/jobs/:id/resume - Resume a paused job
 */
router.post('/:id/resume', (req: Request, res: Response) => {
  try {
    jobProcessor.resumeJob(String(req.params.id));
    res.json({ success: true, message: 'Job resumed' });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to resume' });
  }
});

/**
 * POST /api/jobs/:id/cancel - Cancel a running job
 */
router.post('/:id/cancel', (req: Request, res: Response) => {
  try {
    jobProcessor.cancelJob(String(req.params.id));
    res.json({ success: true, message: 'Job cancelled' });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Failed to cancel' });
  }
});

/**
 * GET /api/jobs/:id/results - Get processed results
 */
router.get('/:id/results', (req: Request, res: Response) => {
  try {
    const results = db.getResults(String(req.params.id));
    res.json({ success: true, results, count: results.length });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get results' });
  }
});

/**
 * GET /api/jobs/:id/logs - Get job logs
 */
router.get('/:id/logs', (req: Request, res: Response) => {
  try {
    const limit = parseInt(String(req.query.limit || '500'), 10);
    const logs = db.getLogs(String(req.params.id), limit);
    res.json({ success: true, logs });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get logs' });
  }
});

/**
 * GET /api/jobs/:id/summary - Get job summary
 */
router.get('/:id/summary', (req: Request, res: Response) => {
  try {
    const summary = db.getJobSummary(String(req.params.id));
    if (!summary) {
      res.status(404).json({ error: 'Summary not available' });
      return;
    }
    res.json({ success: true, summary });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get summary' });
  }
});

/**
 * GET /api/browser/status - Get browser status
 */
router.get('/browser/status', (_req: Request, res: Response) => {
  res.json({ success: true, status: browserManager.getStatus() });
});

export default router;
