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
    skip_empty_lines: false,
    trim: true,
    relax_column_count: true,
  });

  const values: string[] = [];
  for (const record of records) {
    if (Array.isArray(record) && record.length > 0) {
      const val = String(record[0]).trim();
      values.push(val);
    } else {
      values.push('');
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

  const lastRowNumber = worksheet.rowCount;
  for (let rowNumber = startRow; rowNumber <= lastRowNumber; rowNumber++) {
    const row = worksheet.getRow(rowNumber);
    const cell = row.getCell(vehicleCol);
    const val = String(cell.value || '').trim();
    values.push(val);
  }

  return values;
}

/**
 * Process raw vehicle numbers: normalize, dedup, validate
 */
function processVehicleNumbers(rawValues: string[]): ParseResult {
  const errors: string[] = [];
  let blankRows = 0;
  let invalidFormat = 0;

  const vehicles: any[] = [];

  for (let i = 0; i < rawValues.length; i++) {
    const raw = rawValues[i];
    const rowIndex = i + 1;

    if (!raw || raw.trim() === '') {
      blankRows++;
      vehicles.push({ rowIndex, vehicleNumber: '' });
      continue;
    }

    const vn = normalizeVehicleNumber(raw);

    if (!isValidVehicleNumber(vn)) {
      invalidFormat++;
      errors.push(`Row ${rowIndex} - Possible invalid format: "${raw}" → "${vn}"`);
    }

    vehicles.push({ rowIndex, vehicleNumber: vn });
  }

  const total = rawValues.length;
  const unique = total;
  const duplicatesRemoved = 0;

  logger.info(
    `Parsed file: ${total} rows. Preservation: ${vehicles.length} queued (0 duplicates removed, ${blankRows} blank, ${invalidFormat} unusual format)`
  );

  return {
    total,
    unique,
    duplicatesRemoved,
    invalidFormat,
    blankRows,
    vehicles,
    errors,
  };
}

export default parseUploadedFile;
