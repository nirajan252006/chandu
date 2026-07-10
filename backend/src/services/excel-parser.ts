// ============================================
// Excel Parser Service
// ============================================

import ExcelJS from 'exceljs';
import { parse as csvParse } from 'csv-parse/sync';
import fs from 'fs';
import path from 'path';
import { ParseResult } from '../types';
import { normalizeVehicleNumber, isValidVehicleNumber } from '../utils/helpers';
import logger from '../utils/logger';

/**
 * Parse uploaded Excel/CSV file and extract vehicle numbers
 */
export async function parseUploadedFile(filePath: string): Promise<ParseResult> {
  const ext = path.extname(filePath).toLowerCase();
  let rawValues: string[] = [];

  if (ext === '.csv') {
    rawValues = await parseCsv(filePath);
  } else if (ext === '.xlsx' || ext === '.xls') {
    rawValues = await parseExcel(filePath);
  } else {
    throw new Error(`Unsupported file format: ${ext}. Supported: .xlsx, .xls, .csv`);
  }

  return processVehicleNumbers(rawValues);
}

/**
 * Parse CSV file
 */
async function parseCsv(filePath: string): Promise<string[]> {
  const content = fs.readFileSync(filePath, 'utf-8');
  const records = csvParse(content, {
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
  });

  const values: string[] = [];
  for (const record of records) {
    if (Array.isArray(record) && record.length > 0) {
      const val = String(record[0]).trim();
      if (val) values.push(val);
    }
  }

  return values;
}

/**
 * Parse Excel file (.xlsx / .xls)
 */
async function parseExcel(filePath: string): Promise<string[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const values: string[] = [];
  const worksheet = workbook.getWorksheet(1);

  if (!worksheet) {
    throw new Error('No worksheet found in the uploaded file');
  }

  // Try to detect the column with vehicle numbers
  let vehicleCol = 1;
  const headerRow = worksheet.getRow(1);
  let hasHeader = false;

  headerRow.eachCell((cell, colNumber) => {
    const val = String(cell.value || '').toLowerCase().trim();
    if (
      val.includes('vehicle') ||
      val.includes('registration') ||
      val.includes('license') ||
      val.includes('plate') ||
      val.includes('number') ||
      val.includes('reg')
    ) {
      vehicleCol = colNumber;
      hasHeader = true;
    }
  });

  // Check if first row looks like a header
  const firstCellVal = String(headerRow.getCell(1).value || '').toLowerCase().trim();
  if (
    firstCellVal.includes('vehicle') ||
    firstCellVal.includes('number') ||
    firstCellVal.includes('sr') ||
    firstCellVal.includes('#') ||
    firstCellVal.includes('registration') ||
    firstCellVal.includes('s.no')
  ) {
    hasHeader = true;
  }

  const startRow = hasHeader ? 2 : 1;

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber < startRow) return;

    const cell = row.getCell(vehicleCol);
    const val = String(cell.value || '').trim();
    if (val) values.push(val);
  });

  return values;
}

/**
 * Process raw vehicle numbers: normalize, dedup, validate
 */
function processVehicleNumbers(rawValues: string[]): ParseResult {
  const errors: string[] = [];
  let blankRows = 0;
  let invalidFormat = 0;

  // Normalize all values
  const normalized: string[] = [];
  for (const raw of rawValues) {
    if (!raw || raw.trim() === '') {
      blankRows++;
      continue;
    }

    const vn = normalizeVehicleNumber(raw);

    if (!isValidVehicleNumber(vn)) {
      // Still include it — user may have non-standard formats
      // Just log a warning
      invalidFormat++;
      errors.push(`Possible invalid format: "${raw}" → "${vn}"`);
    }

    normalized.push(vn);
  }

  // Remove duplicates
  const uniqueSet = new Set(normalized);
  const vehicles = Array.from(uniqueSet);
  const duplicatesRemoved = normalized.length - vehicles.length;

  logger.info(
    `Parsed file: ${rawValues.length} raw → ${normalized.length} valid → ${vehicles.length} unique ` +
    `(${duplicatesRemoved} duplicates, ${blankRows} blank, ${invalidFormat} unusual format)`
  );

  return {
    total: rawValues.length,
    unique: vehicles.length,
    duplicatesRemoved,
    invalidFormat,
    blankRows,
    vehicles,
    errors,
  };
}

export default parseUploadedFile;
