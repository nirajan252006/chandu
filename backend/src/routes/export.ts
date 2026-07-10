// ============================================
// Export Routes
// ============================================

import { Router, Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';
import * as db from '../database/queries';
import {
  generateExcelReport,
  generateCsv,
  generateUniqueEmailsReport,
  generateFailedVehiclesReport,
  generateProcessingLogReport
} from '../services/excel-generator';
import config from '../config';
import logger from '../utils/logger';

const router = Router();

router.get('/:id/excel', async (req: Request, res: Response) => {
  try {
    const jobId = String(req.params.id);
    const results = db.getResults(jobId);
    const summary = db.getJobSummary(jobId);

    if (results.length === 0) {
      res.status(404).json({ error: 'No results to export' });
      return;
    }

    const job = db.getJob(jobId);
    const totalVehicles = job ? job.totalVehicles : results.length;
    const processedCount = results.length;

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19).replace('T', '_');
    let customFilename: string | undefined = undefined;
    if (job) {
      if (job.status === 'cancelled') {
        customFilename = `Vehicle_Report_PARTIAL_${processedCount}_of_${totalVehicles}_${timestamp}.xlsx`;
      } else if (job.status === 'completed') {
        customFilename = `Vehicle_Report_COMPLETE_${totalVehicles}_${timestamp}.xlsx`;
      }
    }

    const filePath = await generateExcelReport(jobId, results, summary, customFilename);
    const filename = path.basename(filePath);

    res.download(filePath, filename, (err) => {
      if (err) {
        logger.error(`Download error: ${err}`);
      }
    });
  } catch (error) {
    logger.error(`Export error: ${error}`);
    res.status(500).json({ error: 'Failed to generate Excel report' });
  }
});

/**
 * GET /api/export/:id/csv - Download CSV
 */
router.get('/:id/csv', (req: Request, res: Response) => {
  try {
    const results = db.getResults(String(req.params.id));

    if (results.length === 0) {
      res.status(404).json({ error: 'No results to export' });
      return;
    }

    const csv = generateCsv(results);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=Vehicle_Report_${String(req.params.id)}.csv`);
    res.send(csv);
  } catch (error) {
    logger.error(`CSV export error: ${error}`);
    res.status(500).json({ error: 'Failed to generate CSV' });
  }
});

/**
 * GET /api/export/:id/json - Download JSON
 */
router.get('/:id/json', (req: Request, res: Response) => {
  try {
    const results = db.getResults(String(req.params.id));
    const summary = db.getJobSummary(String(req.params.id));

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=Vehicle_Report_${String(req.params.id)}.json`);
    res.json({ summary, results });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate JSON' });
  }
});

/**
 * GET /api/export/:id/failed - Download failed vehicles
 */
router.get('/:id/failed', (req: Request, res: Response) => {
  try {
    const failed = db.getFailedResults(String(req.params.id));

    const csv = [
      'Vehicle Number,Error,Retry Count,Search Status',
      ...failed.map(r =>
        `${r.vehicleNumber},${r.errorMessage?.replace(/,/g, ';')},${r.retryCount},${r.searchStatus}`
      ),
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=Failed_Vehicles_${String(req.params.id)}.csv`);
    res.send(csv);
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate failed vehicles list' });
  }
});

/**
 * GET /api/export/:id/logs - Download logs
 */
router.get('/:id/logs', (req: Request, res: Response) => {
  try {
    const logs = db.getLogs(String(req.params.id), 10000);

    const logText = logs.map(l =>
      `[${l.timestamp}] [${l.level.toUpperCase()}] ${l.message}${l.vehicleNumber ? ` | Vehicle: ${l.vehicleNumber}` : ''}${l.workerId ? ` | Worker: ${l.workerId}` : ''}`
    ).join('\n');

    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename=Logs_${String(req.params.id)}.txt`);
    res.send(logText);
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate logs' });
  }
});

/**
 * GET /api/export/:id/unique-emails - Download unique emails report
 */
router.get('/:id/unique-emails', async (req: Request, res: Response) => {
  try {
    const jobId = String(req.params.id);
    const results = db.getResults(jobId);
    const filePath = await generateUniqueEmailsReport(jobId, results);
    res.download(filePath, `Unique_Emails_${jobId}.xlsx`);
  } catch (error) {
    logger.error(`Unique email export error: ${error}`);
    res.status(500).json({ error: 'Failed to generate unique emails report' });
  }
});

/**
 * GET /api/export/:id/failed-excel - Download failed vehicles report (Excel)
 */
router.get('/:id/failed-excel', async (req: Request, res: Response) => {
  try {
    const jobId = String(req.params.id);
    const failedResults = db.getFailedResults(jobId);
    const filePath = await generateFailedVehiclesReport(jobId, failedResults);
    res.download(filePath, `Failed_Vehicles_${jobId}.xlsx`);
  } catch (error) {
    logger.error(`Failed vehicles excel export error: ${error}`);
    res.status(500).json({ error: 'Failed to generate failed vehicles report' });
  }
});

/**
 * GET /api/export/:id/logs-excel - Download processing log report (Excel)
 */
router.get('/:id/logs-excel', async (req: Request, res: Response) => {
  try {
    const jobId = String(req.params.id);
    const logs = db.getLogs(jobId, 10000);
    const filePath = await generateProcessingLogReport(jobId, logs);
    res.download(filePath, `Processing_Log_${jobId}.xlsx`);
  } catch (error) {
    logger.error(`Logs excel export error: ${error}`);
    res.status(500).json({ error: 'Failed to generate logs report' });
  }
});

/**
 * POST /api/export/open-folder - Open export directory in file explorer
 */
router.post('/open-folder', (_req: Request, res: Response) => {
  try {
    const folderPath = path.resolve(config.exportDir);
    
    // Windows specific open command
    let command = `explorer "${folderPath}"`;
    if (process.platform === 'darwin') {
      command = `open "${folderPath}"`;
    } else if (process.platform === 'linux') {
      command = `xdg-open "${folderPath}"`;
    }

    exec(command, (err) => {
      if (err) {
        logger.error(`Failed to open folder: ${err}`);
        res.status(500).json({ error: 'Failed to open directory' });
      } else {
        res.json({ success: true });
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to open export folder' });
  }
});

export default router;
