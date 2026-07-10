// ============================================
// Upload Routes
// ============================================

import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { parseUploadedFile } from '../services/excel-parser';
import * as db from '../database/queries';
import { generateJobId } from '../utils/helpers';
import config from '../config';
import logger from '../utils/logger';

const router = Router();

// Ensure upload directory exists
if (!fs.existsSync(config.uploadDir)) {
  fs.mkdirSync(config.uploadDir, { recursive: true });
}

// Multer configuration
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, config.uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}_${Math.round(Math.random() * 1E9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `upload_${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: config.maxUploadSize },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.xlsx', '.xls', '.csv'].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only .xlsx, .xls, and .csv files are supported'));
    }
  },
});

/**
 * POST /api/upload - Upload an Excel file
 */
router.post('/', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    logger.info(`File uploaded: ${req.file.originalname} (${req.file.size} bytes)`);

    // Parse the file
    const parseResult = await parseUploadedFile(req.file.path);

    if (parseResult.vehicles.length === 0) {
      res.status(400).json({
        error: 'No valid vehicle numbers found in the uploaded file',
        details: parseResult,
      });
      return;
    }

    // Create a job
    const jobId = generateJobId();

    db.createJob(
      jobId,
      req.file.originalname,
      parseResult.total,
      parseResult.unique,
      JSON.stringify(parseResult.vehicles)
    );

    logger.info(`Job created: ${jobId} (${parseResult.unique} unique vehicles)`);

    res.json({
      success: true,
      jobId,
      filename: req.file.originalname,
      parseResult,
    });
  } catch (error) {
    logger.error(`Upload error: ${error}`);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Upload failed',
    });
  }
});

export default router;
