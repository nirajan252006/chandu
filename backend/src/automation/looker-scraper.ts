// ============================================
// Looker Studio Scraper - Ultra-Fast Single Worker v5
// ============================================
//
// OPTIMIZATIONS:
//   1. Persistent MutationObserver per page
//   2. Fast input replacement inside the page context (< 20ms)
//   3. Two-phase result detection with adaptive stabilization (50-250ms)
//   4. Single DOM extraction combining Strategies B, C, and D
//   5. Stale data protection with search sequence IDs and input verification
//   6. Precise phase-level timing with bottleneck warnings
// ============================================

import { Page, Locator } from 'playwright';
import { LookerRow, SearchResult, FilterResult } from '../types';
import { filterVehicleRows } from './filter-engine';
import { now } from '../utils/helpers';
import logger from '../utils/logger';
import config from '../config';

// ============================================
// CONFIGURABLE CONSTANTS
// ============================================

/** Fast-path timeout for waiting for initial mutation */
const FAST_TIMEOUT_MS = 1500;

/** Polling interval for fingerprint comparison in fallback path */
const POLL_INTERVAL_MS = 100;

// ============================================
// STATE & LOCATOR SYSTEM
// ============================================

interface PageSearchState {
  sequenceId: number;
  expectedVehicle: string;
  onMutation?: (bodySnippet: string) => void;
  lastMutationTime: number;
  mutationsCount: number;
}

const pageStates = new Map<Page, PageSearchState>();

let cachedInput: Locator | null = null;
let cachedPageUrl: string = '';

/**
 * Resolve the search input locator once, cache it for reuse.
 */
async function getCachedInput(page: Page): Promise<Locator> {
  const currentUrl = page.url();

  if (cachedInput && currentUrl === cachedPageUrl) {
    try {
      if (await cachedInput.isVisible()) {
        return cachedInput;
      }
    } catch {
      // ignore
    }
  }

  const strategies: (() => Locator)[] = [
    () => page.locator('input[type="text"]').first(),
    () => page.locator('input:not([type="hidden"])').first(),
    () => page.getByPlaceholder(/license|plate|vehicle|registration|search/i),
    () => page.getByLabel(/license|plate|vehicle|registration|number/i),
    () => page.getByRole('textbox', { name: /license|plate|vehicle|search/i }),
  ];

  const filterSelectors = [
    '[data-type="TEXTBOX"]',
    '[class*="filter-control"]',
    '[class*="control-container"]',
    '[role="combobox"]',
  ];

  for (const selector of filterSelectors) {
    try {
      const widget = page.locator(selector).first();
      if (await widget.count() > 0 && await widget.isVisible()) {
        await widget.click();
        try {
          await page.waitForSelector('input:focus', { timeout: 1500 });
        } catch {
          // ignore
        }
        break;
      }
    } catch {
      continue;
    }
  }

  for (const strategy of strategies) {
    try {
      const locator = strategy();
      const count = await locator.count();
      if (count > 0 && await locator.first().isVisible()) {
        cachedInput = locator.first();
        cachedPageUrl = currentUrl;
        logger.debug('Search input locator cached successfully');
        return cachedInput;
      }
    } catch {
      continue;
    }
  }

  throw new Error('Could not find search input on the page');
}

/**
 * Invalidate the cached locator
 */
export function invalidateLocatorCache(): void {
  cachedInput = null;
  cachedPageUrl = '';
}

// ============================================
// MUTATIONOBSERVER REGISTRATION (Node -> Page)
// ============================================

/**
 * Register Node callback for page mutations. Called during page initialization.
 */
export async function registerPageMutationObserver(page: Page): Promise<void> {
  try {
    await page.exposeFunction('onTableMutation', (data: { bodySnippet: string }) => {
      const state = pageStates.get(page);
      if (state) {
        state.lastMutationTime = performance.now();
        state.mutationsCount++;
        if (state.onMutation) {
          state.onMutation(data.bodySnippet);
        }
      }
    });
    logger.debug('Exposed onTableMutation for tab');
  } catch (e) {
    // Already exposed
  }
}

/**
 * Setup MutationObserver in DOM context. Called on navigateToReport.
 */
export async function initMutationObserverInPage(page: Page): Promise<void> {
  try {
    await page.evaluate(() => {
      if ((window as any).__mutationObserver) {
        return;
      }
      const observer = new MutationObserver(() => {
        (window as any).onTableMutation({
          bodySnippet: document.body ? document.body.innerText.substring(0, 2000) : ''
        });
      });
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true
      });
      (window as any).__mutationObserver = observer;
    });
    logger.debug('Initialized MutationObserver in page context');
  } catch (err) {
    logger.error('Failed to initialize MutationObserver in page context: ' + err);
  }
}

// ============================================
// TABLE FINGERPRINT
// ============================================

interface TableFingerprint {
  rowCount: number;
  firstCellText: string;
  bodySnippet: string;
}

async function getTableFingerprint(page: Page): Promise<TableFingerprint> {
  try {
    return await page.evaluate(() => {
      const body = document.body ? document.body.innerText : '';
      const rows = document.querySelectorAll('[role="row"]');
      const trs = document.querySelectorAll('tr');
      const rowCount = Math.max(rows.length, trs.length);

      let firstCellText = '';
      const firstCell = document.querySelector('[role="cell"], [role="gridcell"], td');
      if (firstCell) {
        firstCellText = (firstCell as HTMLElement).innerText?.trim()?.substring(0, 100) || '';
      }

      return {
        rowCount,
        firstCellText,
        bodySnippet: body.substring(0, 2000),
      };
    }) as TableFingerprint;
  } catch {
    return { rowCount: 0, firstCellText: '', bodySnippet: '' };
  }
}

// ============================================
// FAST INPUT + SEARCH TRIGGER
// ============================================

async function fastSearchInput(
  page: Page,
  vehicleNumber: string
): Promise<{ inputClearMs: number; inputSetMs: number; searchTriggerMs: number }> {
  const input = await getCachedInput(page);

  const t0 = performance.now();

  await input.evaluate((el: HTMLInputElement, vn: string) => {
    el.focus();
    el.select();
    el.value = vn;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));

    const enterEvents = ['keydown', 'keypress', 'keyup'];
    for (const eventName of enterEvents) {
      el.dispatchEvent(new KeyboardEvent(eventName, {
        bubbles: true,
        cancelable: true,
        key: 'Enter',
        code: 'Enter',
        keyCode: 13,
        which: 13
      }));
    }
  }, vehicleNumber);

  const t1 = performance.now();

  return {
    inputClearMs: 0,
    inputSetMs: Math.round(t1 - t0),
    searchTriggerMs: 0
  };
}

// ============================================
// TWO-PHASE RESULT CHANGE DETECTION
// ============================================

async function waitForResultChange(
  page: Page,
  prevFingerprint: TableFingerprint,
  vehicleNumber: string
): Promise<{ firstMutationMs: number; tableStableMs: number }> {
  const t0 = performance.now();

  let mutationHappened = false;
  let mutationResolver: (() => void) | null = null;

  const state = pageStates.get(page) || {
    sequenceId: 0,
    expectedVehicle: vehicleNumber,
    lastMutationTime: 0,
    mutationsCount: 0
  };

  state.sequenceId++;
  state.expectedVehicle = vehicleNumber;
  state.lastMutationTime = 0;
  state.mutationsCount = 0;

  const mutationPromise = new Promise<void>((resolve) => {
    mutationResolver = resolve;
    state.onMutation = (bodySnippet: string) => {
      mutationHappened = true;
      resolve();
    };
  });

  pageStates.set(page, state);

  // Fast Path: Wait for a mutation event or 1500ms timeout
  const fastPathTimeout = FAST_TIMEOUT_MS;
  const tFirstMutationStart = performance.now();

  await Promise.race([
    mutationPromise,
    new Promise<void>(resolve => setTimeout(resolve, fastPathTimeout))
  ]);

  const tFirstMutationEnd = performance.now();
  const firstMutationMs = Math.round(tFirstMutationEnd - tFirstMutationStart);

  let tStableMs = 0;

  if (mutationHappened) {
    // Adaptive Stability Window
    const tStabilityStart = performance.now();
    let currentWindow = 50;
    const maxWindow = 250;
    let lastCount = state.mutationsCount;

    while (true) {
      await new Promise(resolve => setTimeout(resolve, currentWindow));
      if (state.mutationsCount === lastCount) {
        break;
      }
      lastCount = state.mutationsCount;
      currentWindow = Math.min(currentWindow + 50, maxWindow);
    }
    tStableMs = Math.round(performance.now() - tStabilityStart);
  } else {
    // Fallback Path: Poll table fingerprint
    logger.warn(`[Fallback Path] No mutation detected for ${vehicleNumber} within ${fastPathTimeout}ms. Starting lightweight targeted polling...`);
    const tFallbackStart = performance.now();
    await pollTableFallback(page, prevFingerprint, vehicleNumber);
    tStableMs = Math.round(performance.now() - tFallbackStart);
  }

  // Clean up callback
  state.onMutation = undefined;

  return {
    firstMutationMs: mutationHappened ? firstMutationMs : 0,
    tableStableMs: tStableMs
  };
}

async function pollTableFallback(page: Page, prevFingerprint: TableFingerprint, vehicleNumber: string): Promise<void> {
  const startTime = performance.now();
  const timeout = config.queue.searchTimeout;
  const pollInterval = POLL_INTERVAL_MS;

  while (performance.now() - startTime < timeout) {
    const currentFingerprint = await getTableFingerprint(page);
    if (currentFingerprint.rowCount !== prevFingerprint.rowCount ||
        currentFingerprint.firstCellText !== prevFingerprint.firstCellText ||
        currentFingerprint.bodySnippet !== prevFingerprint.bodySnippet) {
      break;
    }
    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }
}

// ============================================
// SINGLE DOM EXTRACTION
// ============================================

async function extractTableRows(
  page: Page,
  vehicleNumber: string
): Promise<{ rows: LookerRow[], currentInputValue: string }> {
  try {
    const result = await page.evaluate((vn) => {
      // 1. Capture current input value
      const inputEl = document.querySelector('input[type="text"]') as HTMLInputElement;
      const currentInputValue = inputEl ? inputEl.value : '';

      // 2. Extract rows using Strategies B, C, D
      let rows: any[] = [];

      // Strategy B: HTML table
      const tables = document.querySelectorAll('table');
      if (tables.length > 0) {
        const allRows: string[][] = [];
        for (const table of tables) {
          const trs = table.querySelectorAll('tr');
          const parsed: string[][] = [];
          for (const tr of trs) {
            const cells = tr.querySelectorAll('td, th');
            const row: string[] = [];
            for (const cell of cells) {
              const el = cell as HTMLElement;
              row.push((el.innerText || el.textContent || '').trim());
            }
            if (row.length > 0) parsed.push(row);
          }
          if (parsed.length > 0) allRows.push(...parsed);
        }
        if (allRows.length > 0) {
          let headers: string[] | null = null;
          let dataStart = 0;
          for (let i = 0; i < allRows.length; i++) {
            const hasHeaderKeyword = allRows[i].some(c => {
              const l = c.toLowerCase();
              return l.includes('email') || l.includes('days') || l.includes('trip') || l.includes('vehicle') || l.includes('tag') || l.includes('creation');
            });
            if (hasHeaderKeyword) {
              headers = allRows[i];
              dataStart = i + 1;
              break;
            }
          }
          if (headers) {
            for (let i = dataStart; i < allRows.length; i++) {
              const row = allRows[i];
              if (row.length === 0) continue;
              const obj: any = {};
              for (let j = 0; j < headers.length && j < row.length; j++) {
                obj[headers[j]] = row[j];
              }
              if (Object.values(obj).some(v => v !== '')) {
                rows.push(obj);
              }
            }
          }
        }
      }

      // Strategy C: ARIA roles
      if (rows.length === 0) {
        const roleRows = document.querySelectorAll('[role="row"]');
        if (roleRows.length > 0) {
          const parsed: string[][] = [];
          for (const row of roleRows) {
            const cells = row.querySelectorAll('[role="cell"], [role="gridcell"], [role="columnheader"], [role="rowheader"]');
            const rowData: string[] = [];
            for (const cell of cells) {
              const el = cell as HTMLElement;
              rowData.push((el.innerText || el.textContent || '').trim());
            }
            if (rowData.length > 0) parsed.push(rowData);
          }
          if (parsed.length > 0) {
            let headers: string[] | null = null;
            let dataStart = 0;
            for (let i = 0; i < parsed.length; i++) {
              const hasHeaderKeyword = parsed[i].some(c => {
                const l = c.toLowerCase();
                return l.includes('email') || l.includes('days') || l.includes('trip') || l.includes('vehicle') || l.includes('tag') || l.includes('creation');
              });
              if (hasHeaderKeyword) {
                headers = parsed[i];
                dataStart = i + 1;
                break;
              }
            }
            if (headers) {
              for (let i = dataStart; i < parsed.length; i++) {
                const row = parsed[i];
                if (row.length === 0) continue;
                const obj: any = {};
                for (let j = 0; j < headers.length && j < row.length; j++) {
                  obj[headers[j]] = row[j];
                }
                if (Object.values(obj).some(v => v !== '')) {
                  rows.push(obj);
                }
              }
            }
          }
        }
      }

      // Strategy D: Div grid spatial matching
      if (rows.length === 0) {
        const textElements: any[] = [];
        const allElements = document.querySelectorAll('div, span, td, th, p, a');
        for (const el of allElements) {
          const htmlEl = el as HTMLElement;
          const text = (htmlEl.innerText || htmlEl.textContent || '').trim();
          if (!text || text.length > 200) continue;
          if (el.children.length > 3) continue;
          const rect = el.getBoundingClientRect();
          if (rect.width === 0 || rect.height === 0) continue;
          if (rect.top < 0 || rect.left < 0) continue;
          textElements.push({
            text: text,
            x: Math.round(rect.left),
            y: Math.round(rect.top),
            w: Math.round(rect.width),
            h: Math.round(rect.height),
          });
        }
        if (textElements.length > 0) {
          textElements.sort((a: any, b: any) => a.y - b.y || a.x - b.x);
          const rowGroups: any[][] = [];
          let currentRow: any[] = [textElements[0]];
          for (let i = 1; i < textElements.length; i++) {
            const el = textElements[i];
            const prevY = currentRow[0].y;
            if (Math.abs(el.y - prevY) <= 8) {
              currentRow.push(el);
            } else {
              if (currentRow.length >= 2) rowGroups.push([...currentRow]);
              currentRow = [el];
            }
          }
          if (currentRow.length >= 2) rowGroups.push(currentRow);

          if (rowGroups.length > 0) {
            let headerIdx = -1;
            for (let i = 0; i < rowGroups.length; i++) {
              const combined = rowGroups[i].map(e => e.text.toLowerCase()).join(' ');
              if (combined.includes('email') && combined.includes('days')) {
                headerIdx = i;
                break;
              }
            }
            if (headerIdx === -1) {
              for (let i = 0; i < rowGroups.length; i++) {
                const combined = rowGroups[i].map(e => e.text.toLowerCase()).join(' ');
                if (combined.includes('email') || combined.includes('days')) {
                  headerIdx = i;
                  break;
                }
              }
            }
            if (headerIdx !== -1) {
              const headerCells = rowGroups[headerIdx].sort((a, b) => a.x - b.x);
              const headers = headerCells.map(c => c.text);
              for (let i = headerIdx + 1; i < rowGroups.length; i++) {
                const cells = rowGroups[i].sort((a, b) => a.x - b.x);
                if (cells.length < 2) continue;
                const obj: any = {};
                for (let hi = 0; hi < headers.length; hi++) {
                  const headerX = headerCells[hi].x;
                  let bestCell = cells[0];
                  let bestDist = Math.abs(cells[0].x - headerX);
                  for (let ci = 1; ci < cells.length; ci++) {
                    const dist = Math.abs(cells[ci].x - headerX);
                    if (dist < bestDist) {
                      bestDist = dist;
                      bestCell = cells[ci];
                    }
                  }
                  if (bestDist < 150) {
                    obj[headers[hi]] = bestCell.text;
                  }
                }
                if (Object.keys(obj).length >= 2) {
                  rows.push(obj);
                }
              }
            }
          }
        }
      }

      return {
        rows,
        currentInputValue,
        rawText: rows.length === 0 && document.body ? document.body.innerText : ''
      };
    }, vehicleNumber);

    if (result.rows && result.rows.length > 0) {
      return { rows: result.rows, currentInputValue: result.currentInputValue };
    }

    // Fallback: Strategy A
    if (result.rawText) {
      const rows = parseRawTextIntoRows(result.rawText, vehicleNumber);
      return { rows, currentInputValue: result.currentInputValue };
    }

    return { rows: [], currentInputValue: result.currentInputValue };
  } catch (e) {
    logger.debug('DOM extraction evaluate failed: ' + e);
    return { rows: [], currentInputValue: '' };
  }
}

/**
 * Strategy A Helper: Parse raw text split by lines
 */
function parseRawTextIntoRows(rawText: string, vehicleNumber: string): LookerRow[] {
  const lines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  logger.debug(`
========================================================
RAW PAGE TEXT DEBUG - Vehicle: ${vehicleNumber}
========================================================
- Total lines: ${lines.length}
- First 50 lines:
${lines.slice(0, 50).map((l, i) => `  [${i}]: "${l}"`).join('\n')}
========================================================
  `);

  const tabRows = parseTabSeparatedTable(lines, vehicleNumber);
  if (tabRows.length > 0) {
    logger.debug(`Text parsing approach 1 (tab-separated): found ${tabRows.length} rows`);
    return tabRows;
  }

  const columnRows = parseColumnLayout(lines, vehicleNumber);
  if (columnRows.length > 0) {
    logger.debug(`Text parsing approach 2 (column layout): found ${columnRows.length} rows`);
    return columnRows;
  }

  return [];
}

function parseTabSeparatedTable(lines: string[], vehicleNumber: string): LookerRow[] {
  let headerIdx = -1;
  let headers: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let parts = line.split('\t').map(p => p.trim()).filter(p => p);
    if (parts.length < 2) {
      parts = line.split(/\s{2,}/).map(p => p.trim()).filter(p => p);
    }
    if (parts.length < 3) continue;

    const lower = parts.map(p => p.toLowerCase());
    const hasEmail = lower.some(p => p.includes('email'));
    const hasDays = lower.some(p => p.includes('days'));

    if (hasEmail && hasDays) {
      headerIdx = i;
      headers = parts;
      break;
    }
  }

  if (headerIdx === -1 || headers.length < 2) return [];

  const rows: LookerRow[] = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.length < 3) continue;
    if (line.includes('Powered by') || line.includes('©')) break;

    let values = line.split('\t').map(v => v.trim());
    if (values.length < 2) {
      values = line.split(/\s{2,}/).map(v => v.trim()).filter(v => v);
    }
    if (values.length < 2) continue;

    const obj: LookerRow = {};
    for (let j = 0; j < headers.length && j < values.length; j++) {
      obj[headers[j]] = values[j];
    }
    if (Object.keys(obj).length >= 2) {
      rows.push(obj);
    }
  }

  return rows;
}

function parseColumnLayout(lines: string[], vehicleNumber: string): LookerRow[] {
  const knownHeaders = [
    'email', 'days from last trip', 'days', 'vehicle creation timestamp',
    'vehicle creation', 'last trip date', 'last trip', 'tag creation timestamp',
    'tag creation', 'tag addition check', 'tag addition', 'owner', 'phone', 'status'
  ];

  const headerPositions: { name: string; lineIdx: number }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const lower = lines[i].toLowerCase();
    for (const header of knownHeaders) {
      if (lower === header || lower.includes(header)) {
        const existing = headerPositions.find(h => h.name === header);
        if (!existing) {
          headerPositions.push({ name: lines[i], lineIdx: i });
        }
        break;
      }
    }
  }

  if (headerPositions.length < 2) return [];

  const headerLines = headerPositions.map(h => h.lineIdx);
  const headerSpread = Math.max(...headerLines) - Math.min(...headerLines);

  if (headerSpread > 20) return [];

  return [];
}

/**
 * Log raw extracted data for debugging
 */
function logRawRowData(rows: LookerRow[], vehicleNumber: string, strategy: string): void {
  const keys = rows.length > 0 ? Object.keys(rows[0]) : [];
  logger.debug(`
========================================================
RAW EXTRACTED DATA - Vehicle: ${vehicleNumber} (Strategy ${strategy})
========================================================
- Total rows: ${rows.length}
- Column keys: [${keys.join(' | ')}]
${rows.slice(0, 5).map((row, i) => {
  return `- Row ${i}: ${JSON.stringify(row)}`;
}).join('\n')}
========================================================
  `);
}

// ============================================
// MAIN ENTRY POINT — processVehicle
// ============================================

export async function processVehicle(
  page: Page,
  vehicleNumber: string,
  workerId: number
): Promise<SearchResult> {
  const tStart = performance.now();

  try {
    const currentUrl = page.url();
    if (!currentUrl.includes('google.com') || !currentUrl.includes('reporting')) {
      throw new Error(`Page is not on Looker Studio report (url: ${currentUrl}). Cannot process without page reload — this should not happen.`);
    }

    // ── Phase 1: Capture pre-search fingerprint ──
    const prevFingerprint = await getTableFingerprint(page);

    // ── Phase 2: Fast input ──
    logger.info(`[Worker ${workerId}] Searching for vehicle: ${vehicleNumber}`);
    const inputTimings = await fastSearchInput(page, vehicleNumber);

    // ── Phase 3: Wait for result change ──
    const changeTimings = await waitForResultChange(page, prevFingerprint, vehicleNumber);

    // ── Phase 4: Extract ──
    const tExtractStart = performance.now();

    const state = pageStates.get(page);
    const currentSeqId = state ? state.sequenceId : 0;

    const { rows, currentInputValue } = await extractTableRows(page, vehicleNumber);

    // Stale Data Verification
    const normalizedInput = currentInputValue.replace(/\s+/g, '').toLowerCase();
    const normalizedExpected = vehicleNumber.replace(/\s+/g, '').toLowerCase();

    if (normalizedInput !== normalizedExpected) {
      throw new Error(`Stale Data Guard Triggered: Input contained "${currentInputValue}" but expected "${vehicleNumber}".`);
    }

    if (state && state.sequenceId !== currentSeqId) {
      throw new Error(`Stale Data Guard Triggered: Active search sequence ID changed from ${currentSeqId} to ${state.sequenceId}.`);
    }

    const tExtractEnd = performance.now();
    const extractionMs = Math.round(tExtractEnd - tExtractStart);

    logger.info(`[Worker ${workerId}] Extracted ${rows.length} rows for vehicle: ${vehicleNumber}`);

    if (rows.length > 0) {
      logRawRowData(rows, vehicleNumber, 'FINAL');
    }

    // ── Phase 5: Filter ──
    const tFilterStart = performance.now();
    const filterResult = filterVehicleRows(rows, vehicleNumber);
    const tFilterEnd = performance.now();
    const filterMs = Math.round(tFilterEnd - tFilterStart);

    const totalMs = Math.round(performance.now() - tStart);

    // ── Phase 6: Log timing and bottlenecks ──
    const inputTotalMs = inputTimings.inputSetMs;
    logger.info(`
${vehicleNumber}
Input: ${inputTotalMs} ms
Trigger: 0 ms
First Mutation: ${changeTimings.firstMutationMs} ms
Stability: ${changeTimings.tableStableMs} ms
Extraction: ${extractionMs} ms
Total: ${totalMs} ms
`);

    if (totalMs > 1000) {
      let bottleneck = '';
      let maxVal = 0;

      if (inputTotalMs > maxVal) {
        maxVal = inputTotalMs;
        bottleneck = `Search Input = ${inputTotalMs} ms`;
      }
      if (changeTimings.firstMutationMs > maxVal) {
        maxVal = changeTimings.firstMutationMs;
        bottleneck = `Looker Studio result refresh = ${changeTimings.firstMutationMs} ms`;
      }
      if (changeTimings.tableStableMs > maxVal) {
        maxVal = changeTimings.tableStableMs;
        bottleneck = `Stability wait = ${changeTimings.tableStableMs} ms`;
      }
      if (extractionMs > maxVal) {
        maxVal = extractionMs;
        bottleneck = `Data Extraction = ${extractionMs} ms`;
      }

      logger.warn(`
SLOW SEARCH:
Vehicle: ${vehicleNumber}
Total: ${totalMs} ms
Bottleneck: ${bottleneck}
`);
    }

    return {
      vehicleNumber,
      status: filterResult.status === 'success' ? 'success' : 'no_eligible_record',
      data: filterResult,
      error: null,
      duration: totalMs,
      retries: 0,
      workerId,
      timestamp: now(),
    };
  } catch (error) {
    const totalMs = Math.round(performance.now() - tStart);
    const errMsg = error instanceof Error ? error.message : String(error);

    logger.error(`[Worker ${workerId}] Error processing vehicle ${vehicleNumber}: ${errMsg} (${totalMs}ms)`);

    invalidateLocatorCache();

    return {
      vehicleNumber,
      status: 'failed',
      data: null,
      error: errMsg,
      duration: totalMs,
      retries: 0,
      workerId,
      timestamp: now(),
    };
  }
}

export default processVehicle;
