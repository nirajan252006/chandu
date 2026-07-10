// ============================================
// Filter Engine - Core Business Logic v3
// ============================================
//
// RULE: The ONLY column that determines the result
//       is "Days From Last Trip".
//
// DO NOT check Email, Vehicle Creation, Last Trip Date,
// Tag Creation, or any other column for deciding.
//
// Algorithm:
//   1. Read ALL rows
//   2. Look ONLY at "Days From Last Trip" column
//   3. Ignore: No data, blank, NULL, -, NaN, undefined
//   4. Keep only NUMERIC values
//   5. Find the SMALLEST numeric value
//   6. Export the ENTIRE ROW with that minimum value
//   7. If EVERY row has "No data" → return "No Eligible Record"
// ============================================

import { LookerRow, FilterResult } from '../types';
import logger from '../utils/logger';

export function filterVehicleRows(
  rows: LookerRow[],
  vehicleNumber: string
): FilterResult {
  if (!rows || rows.length === 0) {
    logger.warn(`No rows returned for vehicle: ${vehicleNumber}`);
    return {
      status: 'no_eligible_record',
      selectedRow: null,
      totalRows: 0,
      validRows: 0,
      minDaysFromLastTrip: null,
    };
  }

  // Log all column keys from first row
  const allKeys = Object.keys(rows[0]);
  logger.info(`[Filter] Vehicle ${vehicleNumber}: ${rows.length} rows, columns: [${allKeys.join(' | ')}]`);

  // Log ALL row data
  rows.forEach((row, i) => {
    logger.info(`[Filter] Vehicle ${vehicleNumber} Row ${i}: ${JSON.stringify(row)}`);
  });

  // ── Step 1: Find the "Days From Last Trip" column ──
  let daysColumnKey = findDaysColumn(rows[0]);
  logger.info(`[Filter] Vehicle ${vehicleNumber}: Days column key found = "${daysColumnKey}"`);

  // ── Step 2: If no named column found, try ALL columns for numeric values ──
  if (!daysColumnKey) {
    logger.warn(`[Filter] No "Days" column found by name. Trying brute-force column scan...`);
    daysColumnKey = findDaysColumnBruteForce(rows);
    if (daysColumnKey) {
      logger.info(`[Filter] Brute-force found potential days column: "${daysColumnKey}"`);
    }
  }

  // ── Step 3: If STILL no column, check if any value across ALL columns is numeric ──
  if (!daysColumnKey) {
    logger.warn(`[Filter] Could not find any "Days" column for vehicle: ${vehicleNumber}`);
    // Return first row as fallback but mark as success (data exists)
    return {
      status: 'success',
      selectedRow: rows[0],
      totalRows: rows.length,
      validRows: rows.length,
      minDaysFromLastTrip: null,
    };
  }

  // ── Step 4: Extract Days values and identify valid/invalid rows ──
  const allDaysValues: string[] = [];
  const ignoredValues: string[] = [];
  const numericEntries: { index: number; value: number; row: LookerRow }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const rawVal = String(rows[i][daysColumnKey] || '').trim();
    allDaysValues.push(rawVal);

    if (isNonNumeric(rawVal)) {
      ignoredValues.push(rawVal || '(empty)');
      continue;
    }

    const num = parseFloat(rawVal.replace(/,/g, ''));
    if (!isNaN(num) && isFinite(num)) {
      numericEntries.push({ index: i, value: num, row: rows[i] });
    } else {
      ignoredValues.push(rawVal);
    }
  }

  // ── Step 5: If column found by name has ALL non-numeric, try brute force ──
  if (numericEntries.length === 0 && rows.length > 0) {
    logger.warn(`[Filter] Named column "${daysColumnKey}" has all non-numeric values. Trying other columns...`);
    const altKey = findDaysColumnBruteForce(rows, daysColumnKey);
    if (altKey) {
      logger.info(`[Filter] Alternative days column found: "${altKey}"`);
      // Re-run with the new column
      for (let i = 0; i < rows.length; i++) {
        const rawVal = String(rows[i][altKey] || '').trim();
        if (isNonNumeric(rawVal)) continue;
        const num = parseFloat(rawVal.replace(/,/g, ''));
        if (!isNaN(num) && isFinite(num)) {
          numericEntries.push({ index: i, value: num, row: rows[i] });
        }
      }
      if (numericEntries.length > 0) {
        daysColumnKey = altKey;
        logger.info(`[Filter] Switched to column "${altKey}" which has ${numericEntries.length} numeric values`);
      }
    }
  }

  // ── Step 6: If still no numeric rows → "No Eligible Record" ──
  if (numericEntries.length === 0) {
    logger.info(`
========================================================
DEBUG MODE: Vehicle ${vehicleNumber} → No Eligible Record
========================================================
- Rows Found           : ${rows.length}
- Days Column Used     : "${daysColumnKey}"
- All Days Values      : [${allDaysValues.join(', ')}]
- Ignored Values       : [${ignoredValues.join(', ')}]
- Numeric Rows         : 0
- Reason               : EVERY row has non-numeric "Days From Last Trip"
========================================================
    `);

    return {
      status: 'no_eligible_record',
      selectedRow: null,
      totalRows: rows.length,
      validRows: 0,
      minDaysFromLastTrip: null,
    };
  }

  // ── Step 7: Find the MINIMUM numeric value ──
  let minEntry = numericEntries[0];
  for (let i = 1; i < numericEntries.length; i++) {
    if (numericEntries[i].value < minEntry.value) {
      minEntry = numericEntries[i];
    }
  }

  const minRow = minEntry.row;
  const minVal = minEntry.value;
  const selectedIndex = minEntry.index;

  // Helper to get value from row by keyword (two-pass: clean keys first, then dirty keys with stripped newlines)
  const getRowVal = (keywords: string[]): string => {
    const allKeys = Object.keys(minRow);

    // Pass 1: clean keys (no newlines, <80 chars)
    const cleanMatches: { key: string; len: number }[] = [];
    for (const key of allKeys) {
      if (key.includes('\n') || key.includes('\r')) continue;
      if (key.length > 80) continue;
      const lower = key.toLowerCase();
      if (keywords.every(kw => lower.includes(kw))) {
        cleanMatches.push({ key, len: key.length });
      }
    }
    if (cleanMatches.length > 0) {
      cleanMatches.sort((a, b) => a.len - b.len);
      return String(minRow[cleanMatches[0].key] || '').trim();
    }

    // Pass 2: dirty keys — strip newline suffix and match on base text
    const dirtyMatches: { key: string; len: number }[] = [];
    for (const key of allKeys) {
      if (key.length > 80) continue;
      if (!key.includes('\n') && !key.includes('\r')) continue;
      const baseName = key.split('\n')[0].split('\r')[0].trim();
      if (!baseName) continue;
      const lowerBase = baseName.toLowerCase();
      if (keywords.every(kw => lowerBase.includes(kw))) {
        dirtyMatches.push({ key, len: baseName.length });
      }
    }
    if (dirtyMatches.length > 0) {
      dirtyMatches.sort((a, b) => a.len - b.len);
      return String(minRow[dirtyMatches[0].key] || '').trim();
    }

    return '--';
  };

  logger.info(`
========================================================
DEBUG MODE: Vehicle ${vehicleNumber} → SUCCESS
========================================================
- Vehicle Number                      : ${vehicleNumber}
- Rows Found                         : ${rows.length}
- Days Column Used                    : "${daysColumnKey}"
- All Days From Last Trip values      : [${allDaysValues.join(', ')}]
- Ignored values                      : [${ignoredValues.join(', ')}]
- Numeric values                      : [${numericEntries.map(e => e.value).join(', ')}]
- Selected minimum value              : ${minVal}
- Selected row index                  : ${selectedIndex}
- Selected Email                      : ${getRowVal(['email'])}
- Selected Vehicle Creation Timestamp : ${getRowVal(['vehicle', 'creation'])}
- Selected Last Trip Date             : ${getRowVal(['last', 'trip'])}
- Selected Days From Last Trip        : ${minVal}
- Selected Tag Creation Timestamp     : ${getRowVal(['tag', 'creation'])}
- Selected Tag Addition Check         : ${getRowVal(['tag', 'addition'])}
========================================================
  `);

  return {
    status: 'success',
    selectedRow: minRow,
    totalRows: rows.length,
    validRows: numericEntries.length,
    minDaysFromLastTrip: minVal,
  };
}

/**
 * Check if a value is non-numeric / should be ignored
 */
function isNonNumeric(val: string): boolean {
  if (!val) return true;
  const lower = val.toLowerCase().trim();
  if (!lower) return true;
  if (lower === 'no data') return true;
  if (lower === 'n/a') return true;
  if (lower === 'na') return true;
  if (lower === '-') return true;
  if (lower === '--') return true;
  if (lower === 'null') return true;
  if (lower === 'undefined') return true;
  if (lower === 'nan') return true;
  if (lower === 'none') return true;
  return false;
}

/**
 * Find the column key for "Days from last trip" (case-insensitive, flexible)
 */
function findDaysColumn(row: LookerRow): string | null {
  const keys = Object.keys(row);

  const getBaseName = (key: string): string => {
    if (key.length > 80) return ''; // skip garbage compound keys
    return key.split('\n')[0].split('\r')[0].trim().toLowerCase();
  };

  // Exact-ish matches first
  for (const key of keys) {
    const base = getBaseName(key);
    if (!base) continue;
    const cleaned = base.replace(/[_\-\s]+/g, ' ').trim();
    if (cleaned === 'days from last trip' || cleaned.includes('days from last trip')) {
      return key;
    }
  }

  // Partial matches - "days" + "last" + "trip"
  for (const key of keys) {
    const base = getBaseName(key);
    if (!base) continue;
    if (base.includes('days') && base.includes('last') && base.includes('trip')) {
      return key;
    }
    if (base.includes('days') && base.includes('trip')) {
      return key;
    }
  }

  // Broader: "days from"
  for (const key of keys) {
    const base = getBaseName(key);
    if (!base) continue;
    if (base.includes('days from')) {
      return key;
    }
  }

  // Broadest: "days" alone
  for (const key of keys) {
    const base = getBaseName(key);
    if (!base) continue;
    if (base === 'days' || base.startsWith('days')) {
      return key;
    }
  }

  return null;
}

/**
 * Brute-force: scan ALL columns across ALL rows to find which column
 * contains numeric values that look like "days" (integers between 0 and 99999).
 * Skip any explicitly excluded column key.
 */
function findDaysColumnBruteForce(rows: LookerRow[], excludeKey?: string): string | null {
  if (rows.length === 0) return null;

  const keys = Object.keys(rows[0]).filter(k => k !== excludeKey);

  // For each column, count how many rows have valid numeric values
  // that look like day counts (integers or small numbers)
  let bestKey: string | null = null;
  let bestNumericCount = 0;

  for (const key of keys) {
    const lower = key.toLowerCase();
    // Skip columns that are obviously not "days"
    if (lower.includes('email') || lower.includes('timestamp') || lower.includes('date') || lower.includes('phone')) {
      continue;
    }

    let numericCount = 0;
    for (const row of rows) {
      const val = String(row[key] || '').trim().replace(/,/g, '');
      const num = parseFloat(val);
      if (!isNaN(num) && isFinite(num) && num >= 0 && num < 100000) {
        numericCount++;
      }
    }

    if (numericCount > bestNumericCount) {
      bestNumericCount = numericCount;
      bestKey = key;
    }
  }

  return bestKey;
}

export default filterVehicleRows;
