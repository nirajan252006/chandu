// ============================================
// Browser Manager - Playwright Persistent Context
// ============================================

import { chromium, BrowserContext, Page } from 'playwright';
import { BrowserConfig } from '../types';
import logger from '../utils/logger';
import { sleep } from '../utils/helpers';
import path from 'path';
import fs from 'fs';
import config from '../config';

class BrowserManager {
  private context: BrowserContext | null = null;
  private tabPool: Page[] = [];
  private availableTabs: Page[] = [];
  private busyTabs: Set<Page> = new Set();
  private config: BrowserConfig | null = null;
  private isInitialized = false;
  private isShuttingDown = false;
  private healthCheckInterval: ReturnType<typeof setInterval> | null = null;

  /**
   * Initialize the browser with persistent context (uses Chrome profile)
   */
  async initialize(config: BrowserConfig, tabCount: number): Promise<void> {
    this.config = config;
    this.isShuttingDown = false;

    if (this.isInitialized) {
      logger.info(`Browser already initialized. Adjusting tab pool count to ${tabCount}...`);
      await this.adjustTabPoolCount(tabCount);
      return;
    }

    // Use a separate user data dir for Playwright to avoid locking the main Chrome profile
    const playwrightDataDir = path.resolve(__dirname, '../../../playwright/user-data');
    if (!fs.existsSync(playwrightDataDir)) {
      fs.mkdirSync(playwrightDataDir, { recursive: true });
    }

    logger.info(`Launching browser with persistent context...`);
    logger.info(`Chrome profile: ${config.userDataDir} (profile: ${config.profile})`);

    try {
      const isRender = process.env.RENDER === 'true' || process.env.NODE_ENV === 'production';
      const headlessMode = isRender ? true : config.headless;

      const launchArgs = [
        `--profile-directory=${config.profile}`,
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-blink-features=AutomationControlled',
        '--disable-infobars',
        '--start-maximized',
        '--enable-gpu-rasterization',
        '--enable-zero-copy',
        '--disable-extensions',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-ipc-flooding-protection',
        '--disable-dev-shm-usage',
        '--disable-hang-monitor',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-gpu',
        '--disable-software-rasterizer',
      ];

      const launchOptions: any = {
        headless: headlessMode,
        slowMo: config.slowMo,
        args: launchArgs,
        viewport: { width: 1920, height: 1080 },
        ignoreHTTPSErrors: true,
        bypassCSP: true,
      };

      // Only request Google Chrome channel in local dev environment
      if (!isRender) {
        launchOptions.channel = 'chrome';
      }

      logger.info(`Launching browser with headless=${headlessMode}, channel=${launchOptions.channel || 'default-chromium'}`);

      // Launch with persistent context
      this.context = await chromium.launchPersistentContext(playwrightDataDir, launchOptions);

      logger.info('Browser context created successfully');

      // Create the tab pool
      await this.createTabPool(tabCount);

      this.isInitialized = true;

      // Start health check
      this.startHealthCheck();

      logger.info(`Browser initialized with ${tabCount} tabs`);
    } catch (error) {
      logger.error(`Failed to initialize browser: ${error}`);
      throw error;
    }
  }

  /**
   * Create a pool of reusable tabs
   */
  private async createTabPool(count: number): Promise<void> {
    if (!this.context) throw new Error('Browser context not initialized');

    // Close any default pages
    const existingPages = this.context.pages();
    for (const page of existingPages) {
      if (page.url() === 'about:blank') {
        // Keep one, close the rest
      }
    }

    for (let i = 0; i < count; i++) {
      const page = existingPages[i] || await this.context.newPage();

      // Set default timeouts
      page.setDefaultTimeout(30000);
      page.setDefaultNavigationTimeout(30000);

      // Register exposed MutationObserver function
      const { registerPageMutationObserver } = require('./looker-scraper');
      await registerPageMutationObserver(page);

      // Speed Optimization: Block images, fonts, media, and analytics
      await page.route('**/*', (route) => {
        const url = route.request().url();
        const resourceType = route.request().resourceType();
        if (
          resourceType === 'image' ||
          resourceType === 'font' ||
          resourceType === 'media' ||
          url.includes('google-analytics.com') ||
          url.includes('analytics') ||
          url.includes('doubleclick') ||
          url.includes('bat.bing.com') ||
          url.includes('googletagmanager.com') ||
          url.includes('facebook.net') ||
          url.includes('hotjar.com')
        ) {
          route.abort();
        } else {
          route.continue();
        }
      });

      // Pre-navigate to Looker Studio report immediately so the page is ready before searching starts
      try {
        await navigateToReport(page);
      } catch (err) {
        logger.error(`Failed to pre-navigate tab ${i + 1} to report: ${err}`);
      }

      this.tabPool.push(page);
      this.availableTabs.push(page);

      logger.debug(`Tab ${i + 1} created and pre-navigated`);
    }
  }

  /**
   * Dynamically adjust the number of tabs in the pool without restarting Chrome
   */
  private async adjustTabPoolCount(targetCount: number): Promise<void> {
    if (!this.context) throw new Error('Browser context not initialized');

    const currentCount = this.tabPool.length;
    if (currentCount === targetCount) {
      logger.info(`Tab pool already matches target count of ${targetCount}`);
      return;
    }

    if (targetCount > currentCount) {
      const needed = targetCount - currentCount;
      logger.info(`Opening ${needed} new tabs in the existing Chrome process...`);
      for (let i = 0; i < needed; i++) {
        const page = await this.context.newPage();
        page.setDefaultTimeout(30000);
        page.setDefaultNavigationTimeout(30000);

        // Register exposed MutationObserver function
        const { registerPageMutationObserver } = require('./looker-scraper');
        await registerPageMutationObserver(page);

        // Speed Optimization: Block images, fonts, media, and analytics
        await page.route('**/*', (route) => {
          const url = route.request().url();
          const resourceType = route.request().resourceType();
          if (
            resourceType === 'image' ||
            resourceType === 'font' ||
            resourceType === 'media' ||
            url.includes('google-analytics.com') ||
            url.includes('analytics') ||
            url.includes('doubleclick') ||
            url.includes('bat.bing.com') ||
            url.includes('googletagmanager.com') ||
            url.includes('facebook.net') ||
            url.includes('hotjar.com')
          ) {
            route.abort();
          } else {
            route.continue();
          }
        });

        try {
          await navigateToReport(page);
        } catch (err) {
          logger.error(`Failed to pre-navigate new tab to report: ${err}`);
        }

        this.tabPool.push(page);
        this.availableTabs.push(page);
        logger.debug(`Tab ${currentCount + i + 1} added and pre-navigated`);
      }
    } else {
      const removeCount = currentCount - targetCount;
      logger.info(`Removing ${removeCount} excess tabs from the pool...`);
      for (let i = 0; i < removeCount; i++) {
        const pageIndex = this.availableTabs.length - 1;
        if (pageIndex >= 0) {
          const page = this.availableTabs.splice(pageIndex, 1)[0];
          this.tabPool = this.tabPool.filter(p => p !== page);
          this.busyTabs.delete(page);
          try {
            await page.close();
          } catch { /* ignore */ }
        } else {
          const page = this.tabPool.pop();
          if (page) {
            this.busyTabs.delete(page);
            try {
              await page.close();
            } catch { /* ignore */ }
          }
        }
      }
    }
    logger.info(`Tab pool adjusted. Total: ${this.tabPool.length}, Available: ${this.availableTabs.length}`);
  }

  /**
   * Get an available tab from the pool (blocks until one is free)
   */
  async getAvailableTab(): Promise<{ page: Page; workerId: number }> {
    // Wait for an available tab
    while (this.availableTabs.length === 0) {
      if (this.isShuttingDown) throw new Error('Browser is shutting down');
      await sleep(100);
    }

    const page = this.availableTabs.shift()!;
    this.busyTabs.add(page);

    const workerId = this.tabPool.indexOf(page) + 1;
    return { page, workerId };
  }

  /**
   * Release a tab back to the pool
   */
  releaseTab(page: Page): void {
    this.busyTabs.delete(page);
    if (!this.isShuttingDown && this.tabPool.includes(page)) {
      this.availableTabs.push(page);
    }
  }

  /**
   * Check if a page is still valid
   */
  async isPageValid(page: Page): Promise<boolean> {
    try {
      await page.evaluate('document.readyState');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Replace a crashed tab with a new one
   */
  async replaceTab(oldPage: Page): Promise<Page> {
    if (!this.context) throw new Error('Browser context not initialized');

    const index = this.tabPool.indexOf(oldPage);
    this.busyTabs.delete(oldPage);
    this.availableTabs = this.availableTabs.filter(p => p !== oldPage);

    try {
      await oldPage.close();
    } catch { /* ignore */ }

    const newPage = await this.context.newPage();
    newPage.setDefaultTimeout(30000);
    newPage.setDefaultNavigationTimeout(30000);

    // Register exposed MutationObserver function
    const { registerPageMutationObserver } = require('./looker-scraper');
    await registerPageMutationObserver(newPage);

    // Speed Optimization: Block images, fonts, media, and analytics
    await newPage.route('**/*', (route) => {
      const url = route.request().url();
      const resourceType = route.request().resourceType();
      if (
        resourceType === 'image' ||
        resourceType === 'font' ||
        resourceType === 'media' ||
        url.includes('google-analytics.com') ||
        url.includes('analytics') ||
        url.includes('doubleclick') ||
        url.includes('bat.bing.com') ||
        url.includes('googletagmanager.com') ||
        url.includes('facebook.net') ||
        url.includes('hotjar.com')
      ) {
        route.abort();
      } else {
        route.continue();
      }
    });

    if (index >= 0) {
      this.tabPool[index] = newPage;
    } else {
      this.tabPool.push(newPage);
    }

    try {
      await navigateToReport(newPage);
    } catch (err) {
      logger.error(`Failed to navigate replaced tab to report: ${err}`);
    }

    logger.info(`Tab ${index + 1} replaced with new tab`);
    return newPage;
  }

  /**
   * Health check: verify browser and tabs are alive
   */
  private startHealthCheck(): void {
    this.healthCheckInterval = setInterval(async () => {
      if (!this.context || this.isShuttingDown) return;

      try {
        // Check if context is still connected
        const pages = this.context.pages();
        if (pages.length === 0 && this.tabPool.length > 0) {
          logger.warn('All tabs lost! Recreating tab pool...');
          this.tabPool = [];
          this.availableTabs = [];
          this.busyTabs.clear();
          await this.createTabPool(this.config?.slowMo ? 1 : 3);
        }
      } catch (error) {
        logger.error(`Browser health check failed: ${error}`);
      }
    }, 10000);
  }

  /**
   * Get browser status
   */
  getStatus(): { isInitialized: boolean; totalTabs: number; availableTabs: number; busyTabs: number } {
    return {
      isInitialized: this.isInitialized,
      totalTabs: this.tabPool.length,
      availableTabs: this.availableTabs.length,
      busyTabs: this.busyTabs.size,
    };
  }

  /**
   * Shutdown the browser gracefully
   */
  async shutdown(): Promise<void> {
    this.isShuttingDown = true;

    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    // Wait for busy tabs to finish (max 30s)
    const start = Date.now();
    while (this.busyTabs.size > 0 && Date.now() - start < 30000) {
      await sleep(500);
    }

    if (this.context) {
      try {
        await this.context.close();
      } catch (error) {
        logger.warn(`Error closing browser context: ${error}`);
      }
      this.context = null;
    }

    this.tabPool = [];
    this.availableTabs = [];
    this.busyTabs.clear();
    this.isInitialized = false;

    logger.info('Browser shut down');
  }

  /**
   * Restart the browser (for recovery from crashes)
   */
  async restart(): Promise<void> {
    if (!this.config) throw new Error('Browser was never initialized');

    const tabCount = this.tabPool.length || 3;
    await this.shutdown();
    await sleep(2000);
    await this.initialize(this.config, tabCount);
  }
}

/**
 * Wait for the Looker Studio report to fully load
 */
export async function waitForReportLoad(page: Page): Promise<void> {
  await page.waitForLoadState('domcontentloaded');

  const reportSelectors = [
    '[data-explore-id]',
    '.lk-report-page',
    'lk-report-page',
    '[class*="report"]',
    'canvas',
    'table',
    '[role="table"]',
    '[role="grid"]',
    '[class*="filter"]',
    'input[type="text"]',
    '[class*="cell"]',
    '[class*="row"]',
  ];

  let found = false;
  for (const selector of reportSelectors) {
    try {
      await page.waitForSelector(selector, { timeout: 5000 });
      found = true;
      break;
    } catch {
      continue;
    }
  }

  if (!found) {
    logger.warn('Could not find specific report elements, checking innerText fallback...');
  }

  try {
    await page.waitForFunction(() => {
      const el = document.body;
      return el && el.innerText && el.innerText.length > 500;
    }, { timeout: 15000 });
  } catch (e) {
    logger.warn('Wait for body text content fallback timed out');
  }

  // Small micro-settle for canvas/rendering components
  await sleep(500);
}

/**
 * Navigate to Looker Studio report and wait for it to load
 */
export async function navigateToReport(page: Page): Promise<void> {
  const currentUrl = page.url();

  // If already on the report, don't re-navigate
  if (currentUrl.includes('lookerstudio.google.com') && currentUrl.includes('reporting')) {
    logger.debug('Already on Looker Studio report, skipping navigation');
    // Ensure mutation observer is initialized even if skipping navigation (in case page refreshed/changed internally)
    const { initMutationObserverInPage } = require('./looker-scraper');
    await initMutationObserverInPage(page);
    return;
  }

  logger.info(`Navigating to Looker Studio report...`);
  await page.goto(config.lookerReportUrl, {
    waitUntil: 'domcontentloaded',
    timeout: config.queue.pageLoadTimeout,
  });

  // Wait for the report to fully render
  await waitForReportLoad(page);

  // Set up the persistent MutationObserver inside the browser DOM context
  const { initMutationObserverInPage } = require('./looker-scraper');
  await initMutationObserverInPage(page);

  logger.info('Looker Studio report loaded successfully');
}

// Singleton instance
export const browserManager = new BrowserManager();
export default browserManager;
