// ============================================
// Excel Report Generator - Professional Output
// ============================================

import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs';
import { VehicleRecord, JobSummary } from '../types';
import config from '../config';
import logger from '../utils/logger';

// Style constants
const HEADER_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF1A1A2E' },
};

const HEADER_FONT: Partial<ExcelJS.Font> = {
  name: 'Calibri',
  size: 11,
  bold: true,
  color: { argb: 'FFFFFFFF' },
};

const HEADER_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: 'FF4A4A6A' } },
  bottom: { style: 'thin', color: { argb: 'FF4A4A6A' } },
  left: { style: 'thin', color: { argb: 'FF4A4A6A' } },
  right: { style: 'thin', color: { argb: 'FF4A4A6A' } },
};

const DATA_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: 'FFD0D0D0' } },
  bottom: { style: 'thin', color: { argb: 'FFD0D0D0' } },
  left: { style: 'thin', color: { argb: 'FFD0D0D0' } },
  right: { style: 'thin', color: { argb: 'FFD0D0D0' } },
};

const SUCCESS_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFE8F5E9' },
};

const WARNING_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFFFF3E0' },
};

const FAILED_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFFCE4EC' },
};

const ALT_ROW_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFF8F9FA' },
};

const COLUMNS = [
  { header: 'S.No', key: 'sno', width: 8 },
  { header: 'Vehicle Number', key: 'vehicleNumber', width: 18 },
  { header: 'Email', key: 'email', width: 30 },
  { header: 'Vehicle Creation Timestamp', key: 'vehicleCreationTimestamp', width: 26 },
  { header: 'Last Trip Date', key: 'lastTripDate', width: 18 },
  { header: 'Days From Last Trip', key: 'daysFromLastTrip', width: 20 },
  { header: 'Tag Creation Timestamp', key: 'tagCreationTimestamp', width: 24 },
  { header: 'Tag Addition Check', key: 'tagAdditionCheck', width: 20 },
  { header: 'Owner Name', key: 'ownerName', width: 22 },
  { header: 'Phone Number', key: 'phoneNumber', width: 18 },
  { header: 'Status', key: 'status', width: 14 },
  { header: 'Remarks', key: 'remarks', width: 36 },
  { header: 'Search Status', key: 'searchStatus', width: 16 },
  { header: 'Search Time (ms)', key: 'searchDurationMs', width: 16 },
];

/**
 * Generate a professional Excel report
 */
export async function generateExcelReport(
  jobId: string,
  results: VehicleRecord[],
  summary: JobSummary | null,
  filename?: string
): Promise<string> {
  const workbook = new ExcelJS.Workbook();

  // Workbook properties
  workbook.creator = 'Vehicle Data Retriever Pro';
  workbook.lastModifiedBy = 'Vehicle Data Retriever Pro';
  workbook.created = new Date();
  workbook.modified = new Date();

  // Sheet 1: Vehicle Data
  createDataSheet(workbook, results);

  // Sheet 2: Summary
  if (summary) {
    createSummarySheet(workbook, summary);
  }

  // Sheet 3: Failed Vehicles
  const failedResults = results.filter(r => r.searchStatus === 'failed' || r.searchStatus === 'timeout');
  if (failedResults.length > 0) {
    createFailedSheet(workbook, failedResults);
  }

  // Ensure export directory exists
  if (!fs.existsSync(config.exportDir)) {
    fs.mkdirSync(config.exportDir, { recursive: true });
  }

  // Save file
  const outputFilename = filename || `Vehicle_Report_${jobId}_${formatDateForFilename()}.xlsx`;
  const outputPath = path.join(config.exportDir, outputFilename);
  await workbook.xlsx.writeFile(outputPath);

  logger.info(`Excel report generated: ${outputPath}`);
  return outputPath;
}

/**
 * Create the main data sheet
 */
function createDataSheet(workbook: ExcelJS.Workbook, results: VehicleRecord[]): void {
  const sheet = workbook.addWorksheet('Vehicle Data', {
    views: [{ state: 'frozen', ySplit: 3 }], // Freeze header rows
  });

  // Title row
  sheet.mergeCells('A1:N1');
  const titleCell = sheet.getCell('A1');
  titleCell.value = '🚗 VEHICLE DATA RETRIEVER PRO - Report';
  titleCell.font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FF1A1A2E' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  sheet.getRow(1).height = 40;

  // Subtitle row
  sheet.mergeCells('A2:N2');
  const subtitleCell = sheet.getCell('A2');
  subtitleCell.value = `Generated: ${new Date().toLocaleString()} | Total Records: ${results.length}`;
  subtitleCell.font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF666666' } };
  subtitleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  sheet.getRow(2).height = 22;

  // Header row (row 3)
  sheet.columns = COLUMNS.map(col => ({ ...col, key: col.key }));

  const headerRow = sheet.getRow(3);
  COLUMNS.forEach((col, idx) => {
    const cell = headerRow.getCell(idx + 1);
    cell.value = col.header;
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.border = HEADER_BORDER;
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  });
  headerRow.height = 30;

  // Data rows
  results.forEach((result, index) => {
    const rowNumber = index + 4; // Data starts at row 4
    const row = sheet.getRow(rowNumber);

    const values = [
      index + 1, // S.No
      result.vehicleNumber?.toLowerCase() || '',
      extractCleanEmail(result.email || ''),
      result.vehicleCreationTimestamp || '',
      result.lastTripDate || '',
      result.daysFromLastTrip || '',
      result.tagCreationTimestamp || '',
      result.tagAdditionCheck || '',
      result.ownerName || '',
      result.phoneNumber || '',
      result.status || '',
      result.remarks || '',
      result.searchStatus || '',
      result.searchDurationMs || 0,
    ];

    values.forEach((val, colIdx) => {
      const cell = row.getCell(colIdx + 1);
      cell.value = val;
      cell.border = DATA_BORDER;
      cell.font = { name: 'Calibri', size: 10 };
      cell.alignment = { vertical: 'middle', wrapText: true };
    });

    // Alternating row colors
    if (index % 2 === 1) {
      values.forEach((_, colIdx) => {
        row.getCell(colIdx + 1).fill = ALT_ROW_FILL;
      });
    }

    // Conditional formatting based on search status
    const statusFill = getStatusFill(result.searchStatus);
    if (statusFill) {
      values.forEach((_, colIdx) => {
        row.getCell(colIdx + 1).fill = statusFill;
      });
    }

    row.height = 22;
  });

  // Auto-filter
  const lastRow = results.length + 3;
  sheet.autoFilter = {
    from: { row: 3, column: 1 },
    to: { row: lastRow, column: COLUMNS.length },
  };

  // Column widths
  COLUMNS.forEach((col, idx) => {
    const column = sheet.getColumn(idx + 1);
    column.width = col.width;
  });
}

/**
 * Create the summary sheet
 */
function createSummarySheet(workbook: ExcelJS.Workbook, summary: JobSummary): void {
  const sheet = workbook.addWorksheet('Summary', {
    properties: { tabColor: { argb: 'FF4CAF50' } },
  });

  // Title
  sheet.mergeCells('A1:D1');
  const titleCell = sheet.getCell('A1');
  titleCell.value = '📊 Processing Summary';
  titleCell.font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FF1A1A2E' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  sheet.getRow(1).height = 40;

  // Summary data
  const summaryData = [
    ['', '', '', ''],
    ['Metric', 'Value', 'Details', ''],
    ['Total Vehicles', summary.totalVehicles, '', ''],
    ['✅ Success', summary.successCount, `${summary.successRate}%`, ''],
    ['❌ Failed', summary.failedCount, `${100 - summary.successRate - (summary.noRecordCount / summary.totalVehicles * 100)}%`, ''],
    ['⚠️ No Eligible Record', summary.noRecordCount, `${Math.round(summary.noRecordCount / summary.totalVehicles * 100)}%`, ''],
    ['', '', '', ''],
    ['📈 Performance Metrics', '', '', ''],
    ['Average Days From Last Trip', summary.averageDaysFromLastTrip, 'days', ''],
    ['Average Search Time', `${summary.averageSearchTimeMs}ms`, formatMs(summary.averageSearchTimeMs), ''],
    ['Total Processing Time', `${summary.totalProcessingTimeMs}ms`, formatMs(summary.totalProcessingTimeMs), ''],
    ['Success Rate', `${summary.successRate}%`, '', ''],
    ['', '', '', ''],
    ['⏱️ Timestamps', '', '', ''],
    ['Job Started', summary.startTime, '', ''],
    ['Job Completed', summary.endTime, '', ''],
    ['Report Generated', new Date().toISOString(), '', ''],
  ];

  summaryData.forEach((data, rowIdx) => {
    const row = sheet.getRow(rowIdx + 2);
    data.forEach((val, colIdx) => {
      const cell = row.getCell(colIdx + 1);
      cell.value = val;
      cell.font = { name: 'Calibri', size: 11 };
      if (rowIdx === 1 || rowIdx === 7 || rowIdx === 13) {
        cell.font = { ...cell.font, bold: true, size: 12 };
        cell.fill = HEADER_FILL;
        cell.font.color = { argb: 'FFFFFFFF' };
      }
      cell.border = DATA_BORDER;
    });
  });

  // Column widths
  sheet.getColumn(1).width = 30;
  sheet.getColumn(2).width = 25;
  sheet.getColumn(3).width = 20;
  sheet.getColumn(4).width = 15;
}

/**
 * Create the failed vehicles sheet
 */
function createFailedSheet(workbook: ExcelJS.Workbook, failedResults: VehicleRecord[]): void {
  const sheet = workbook.addWorksheet('Failed Vehicles', {
    properties: { tabColor: { argb: 'FFF44336' } },
  });

  // Title
  sheet.mergeCells('A1:E1');
  const titleCell = sheet.getCell('A1');
  titleCell.value = '❌ Failed Vehicles';
  titleCell.font = { name: 'Calibri', size: 16, bold: true, color: { argb: 'FFF44336' } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  sheet.getRow(1).height = 40;

  // Headers
  const headers = ['S.No', 'Vehicle Number', 'Error Message', 'Retry Count', 'Search Status'];
  const headerRow = sheet.getRow(2);
  headers.forEach((header, idx) => {
    const cell = headerRow.getCell(idx + 1);
    cell.value = header;
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF44336' } };
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.border = HEADER_BORDER;
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });

  // Data
  failedResults.forEach((result, index) => {
    const row = sheet.getRow(index + 3);
    const values = [
      index + 1,
      result.vehicleNumber?.toLowerCase() || '',
      result.errorMessage || 'Unknown error',
      result.retryCount,
      result.searchStatus,
    ];

    values.forEach((val, colIdx) => {
      const cell = row.getCell(colIdx + 1);
      cell.value = val;
      cell.font = { name: 'Calibri', size: 10 };
      cell.border = DATA_BORDER;
      cell.fill = index % 2 === 1 ? ALT_ROW_FILL : FAILED_FILL;
    });
  });

  // Column widths
  sheet.getColumn(1).width = 8;
  sheet.getColumn(2).width = 18;
  sheet.getColumn(3).width = 50;
  sheet.getColumn(4).width = 14;
  sheet.getColumn(5).width = 16;
}

/**
 * Generate CSV export
 */
export function generateCsv(results: VehicleRecord[]): string {
  const headers = COLUMNS.map(c => c.header);
  const rows = results.map((r, i) => [
    i + 1,
    r.vehicleNumber?.toLowerCase() || '',
    extractCleanEmail(r.email || ''),
    r.vehicleCreationTimestamp || '',
    r.lastTripDate || '',
    r.daysFromLastTrip || '',
    r.tagCreationTimestamp || '',
    r.tagAdditionCheck || '',
    r.ownerName || '',
    r.phoneNumber || '',
    r.status || '',
    r.remarks || '',
    r.searchStatus || '',
    r.searchDurationMs || 0,
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell =>
      typeof cell === 'string' && cell.includes(',') ? `"${cell}"` : cell
    ).join(',')),
  ].join('\n');

  return csvContent;
}

/**
 * Generate Unique Emails Report
 */
export async function generateUniqueEmailsReport(
  jobId: string,
  results: VehicleRecord[]
): Promise<string> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Unique Emails');

  // Header
  sheet.getRow(1).values = ['Unique Email ID'];
  sheet.getRow(1).getCell(1).fill = HEADER_FILL;
  sheet.getRow(1).getCell(1).font = HEADER_FONT;
  sheet.getRow(1).getCell(1).border = HEADER_BORDER;
  sheet.getRow(1).getCell(1).alignment = { horizontal: 'center' };
  sheet.getRow(1).height = 25;

  // Filter unique emails
  const uniqueEmails = Array.from(
    new Set(
      results
        .filter(r => r.email && r.email !== 'No data' && r.email.trim() !== '')
        .map(r => r.email.trim().toLowerCase())
    )
  );

  uniqueEmails.forEach((email, idx) => {
    const row = sheet.getRow(idx + 2);
    const cell = row.getCell(1);
    cell.value = email;
    cell.border = DATA_BORDER;
    cell.font = { name: 'Calibri', size: 10 };
    if (idx % 2 === 1) {
      cell.fill = ALT_ROW_FILL;
    }
  });

  sheet.getColumn(1).width = 40;

  const outputPath = path.join(config.exportDir, `Unique_Emails_${jobId}.xlsx`);
  await workbook.xlsx.writeFile(outputPath);
  return outputPath;
}

/**
 * Generate Failed Vehicles Excel Report
 */
export async function generateFailedVehiclesReport(
  jobId: string,
  failedResults: VehicleRecord[]
): Promise<string> {
  const workbook = new ExcelJS.Workbook();
  createFailedSheet(workbook, failedResults);
  
  const outputPath = path.join(config.exportDir, `Failed_Vehicles_${jobId}.xlsx`);
  await workbook.xlsx.writeFile(outputPath);
  return outputPath;
}

/**
 * Generate Processing Log Excel Report
 */
export async function generateProcessingLogReport(
  jobId: string,
  logs: any[]
): Promise<string> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Processing Log');

  const headers = ['Vehicle', 'Worker', 'Status', 'Search Time', 'Duration', 'Retry Count'];
  const headerRow = sheet.getRow(1);
  headers.forEach((h, idx) => {
    const cell = headerRow.getCell(idx + 1);
    cell.value = h;
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.border = HEADER_BORDER;
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
  });
  headerRow.height = 25;

  logs.forEach((log, idx) => {
    const row = sheet.getRow(idx + 2);
    // Parse duration and workers from metadata or message
    const duration = log.durationMs ? `${log.durationMs}ms` : '--';
    const status = log.level === 'success' ? 'Success' : log.level === 'error' ? 'Failed' : log.level.toUpperCase();

    const values = [
      log.vehicleNumber?.toUpperCase() || '--',
      log.workerId ? `Worker ${log.workerId}` : '--',
      status,
      log.timestamp || '--',
      duration,
      log.metadata?.retryCount || 0
    ];

    values.forEach((val, colIdx) => {
      const cell = row.getCell(colIdx + 1);
      cell.value = val;
      cell.border = DATA_BORDER;
      cell.font = { name: 'Calibri', size: 10 };
      if (idx % 2 === 1) {
        cell.fill = ALT_ROW_FILL;
      }
    });
  });

  const widths = [18, 14, 14, 26, 14, 14];
  widths.forEach((w, idx) => {
    sheet.getColumn(idx + 1).width = w;
  });

  const outputPath = path.join(config.exportDir, `Processing_Log_${jobId}.xlsx`);
  await workbook.xlsx.writeFile(outputPath);
  return outputPath;
}

// Helper functions

/**
 * Extract only the first valid email address from a raw string.
 * Strips dates, timestamps, numbers, and any extra lines.
 */
function extractCleanEmail(raw: string): string {
  if (!raw) return '';
  const match = raw.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
  return match ? match[0] : '';
}

function getStatusFill(status: string): ExcelJS.Fill | null {
  switch (status) {
    case 'success': return SUCCESS_FILL;
    case 'no_eligible_record': return WARNING_FILL;
    case 'failed':
    case 'timeout': return FAILED_FILL;
    default: return null;
  }
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

function formatDateForFilename(): string {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

export default generateExcelReport;
