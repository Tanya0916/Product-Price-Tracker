const { chromium } = require('playwright');
const config = require('../config');
const logger = require('../utils/logger');
const { sleep } = require('../utils/sleep');
const { cleanText, extractNumericPrice, parseStockString } = require('./parser');
const { validateScrapedData } = require('./validator');
const { executeWithRetry } = require('./retry');

/**
 * Playwright Browser Scraper Engine
 * Handles dynamic JavaScript rendering, human-like mouse dwell gates,
 * cookie overlays, and anti-scraping decoy evasion.
 */
class PlaywrightScraper {
  constructor() {
    this.browser = null;
  }

  /**
   * Scrapes product page using Playwright
   * @param {number} productId
   * @param {Object} options
   * @param {boolean} options.headed Run in headed mode
   * @param {number} options.slowMo Slow down actions in ms for observation
   * @param {Function} options.onStatus Callback for UI or headed logging
   * @returns {Promise<Object>} Validated scraped data
   */
  async scrapeProduct(productId, options = {}) {
    const isHeaded = Boolean(options.headed);
    const slowMo = options.slowMo || (isHeaded ? 150 : 0);
    const onStatus = options.onStatus || (() => {});
    const targetUrl = `${config.mockStoreUrl}/product/${productId}`;

    return executeWithRetry(async (attempt) => {
      onStatus(`Attempt ${attempt}: Launching browser engine (${isHeaded ? 'HEADED' : 'HEADLESS'})...`);
      let browser = null;
      let context = null;
      let page = null;

      try {
        browser = await chromium.launch({
          headless: !isHeaded,
          slowMo,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-blink-features=AutomationControlled',
            '--disable-web-security'
          ]
        });

        context = await browser.newContext({
          viewport: { width: 1280, height: 800 },
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
        });

        page = await context.newPage();
        page.setDefaultTimeout(config.scraper.timeoutMs);

        onStatus(`Navigating to ${targetUrl}...`);
        await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: config.scraper.timeoutMs });

        // -------------------------------------------------------------
        // Step 1: Check and dismiss cookie overlay if present
        // -------------------------------------------------------------
        try {
          const cookieBanner = await page.$('.cookie-banner, .cookie-overlay');
          if (cookieBanner) {
            onStatus('Detected cookie overlay dialog. Dismissing...');
            const acceptBtn = await page.$('.cookie-banner button:has-text("Accept"), button:has-text("Accept cookies")');
            if (acceptBtn) {
              await acceptBtn.click();
              await sleep(300);
              onStatus('Cookie overlay dismissed.');
            }
          }
        } catch {
          // Cookie banner might not appear; ignore
        }

        // Wait for product title to ensure page loaded
        await page.waitForSelector('h1', { timeout: 10000 });
        const productTitle = await page.locator('h1').first().innerText();
        onStatus(`Loaded product page: "${productTitle}"`);

        // -------------------------------------------------------------
        // Step 2: Handle Price Interaction / Mouse Dwell Gate
        // -------------------------------------------------------------
        const priceBlock = page.locator('.price-block, .detail-info');
        await priceBlock.first().waitFor({ state: 'visible', timeout: 8000 });

        const revealBtn = page.locator('button:has-text("Reveal price"), button[aria-label="Reveal price"]');
        const hasRevealBtn = (await revealBtn.count()) > 0;

        if (hasRevealBtn) {
          onStatus('Found "Reveal price" gate. Satisfying mouse dwell requirements...');
          const btnLocator = revealBtn.first();
          
          try {
            await btnLocator.scrollIntoViewIfNeeded();
            await btnLocator.hover();
          } catch (e) {
            // Ignore scroll error
          }

          const box = await btnLocator.boundingBox() || await priceBlock.first().boundingBox();
          if (box) {
            // Perform simulated human-like mouse movements over price area & button
            const startX = box.x + 5;
            const startY = box.y + 5;
            await page.mouse.move(startX, startY);

            for (let i = 0; i < 12; i++) {
              await page.mouse.move(startX + (i * 8), startY + (i % 2 === 0 ? 6 : 2));
              await sleep(80);
            }
            // Dwell over the button to satisfy dwell requirement
            await sleep(800);
          }

          // Wait until button is enabled or click force/JS fallback
          onStatus('Clicking "Reveal price" button...');
          try {
            await page.waitForFunction(() => {
              const btn = document.querySelector('button[aria-label="Reveal price"]') || 
                          Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Reveal price'));
              return btn && !btn.disabled;
            }, { timeout: 4000 });
            await btnLocator.click();
          } catch (e) {
            onStatus(`Attempting direct button click dispatch...`);
            await page.evaluate(() => {
              const btn = document.querySelector('button[aria-label="Reveal price"]') || 
                          Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Reveal price'));
              if (btn) {
                btn.removeAttribute('disabled');
                btn.disabled = false;
                btn.click();
              }
            });
          }
        }

        // -------------------------------------------------------------
        // Step 3: Wait for price loading / store response
        // -------------------------------------------------------------
        onStatus('Waiting for mock store price resolution (handling delays/retries)...');

        // Poll for either .price-success or .price-error
        const maxWaitTime = 20000;
        const pollInterval = 400;
        let waited = 0;
        let isSuccess = false;
        let isError = false;

        while (waited < maxWaitTime) {
          const successCount = await page.locator('.price-success').count();
          if (successCount > 0) {
            isSuccess = true;
            break;
          }

          const errorCount = await page.locator('.price-error').count();
          if (errorCount > 0) {
            // Check if there is a "Try again" button
            const tryAgainBtn = page.locator('.price-error button:has-text("Try again")');
            if (await tryAgainBtn.count() > 0) {
              onStatus('Mock store returned simulated error. Clicking "Try again"...');
              await tryAgainBtn.first().click();
              await sleep(1000);
            } else {
              isError = true;
              break;
            }
          }

          // Check for retrying indicator text
          const substatus = page.locator('.price-substatus');
          if (await substatus.count() > 0) {
            const subtext = await substatus.first().innerText().catch(() => '');
            if (subtext.includes('Store responded with')) {
              onStatus(`Mock store internal retry: ${subtext}`);
            }
          }

          await sleep(pollInterval);
          waited += pollInterval;
        }

        if (!isSuccess) {
          const errMsg = await page.locator('.price-error .price-substatus').innerText().catch(() => 'Price failed to reveal');
          throw new Error(`Store price could not be resolved: ${errMsg}`);
        }

        // -------------------------------------------------------------
        // Step 4: Extract Authentic Price, MRP, and Stock
        // -------------------------------------------------------------
        onStatus('Price resolved successfully! Extracting DOM values with decoy filtering...');

        const extracted = await page.evaluate(() => {
          // Helper to remove zero width spaces
          const clean = (t) => t ? t.replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/\u00A0/g, ' ').trim() : '';

          const priceSuccess = document.querySelector('.price-success');
          if (!priceSuccess) return null;

          const priceMain = priceSuccess.querySelector('.price-main');
          if (!priceMain) return null;

          // 1. Extract MRP
          let mrpText = '';
          const mrpEl = priceMain.querySelector('span[style*="line-through"]');
          if (mrpEl) mrpText = clean(mrpEl.innerText);

          // 2. Extract discount badge
          let badgeText = '';
          const badgeEl = Array.from(priceMain.querySelectorAll('span')).find(s => s.innerText.includes('% off'));
          if (badgeEl) badgeText = clean(badgeEl.innerText);

          // 3. Extract genuine price while ignoring hidden decoys
          // Clone priceMain to strip decoy and irrelevant elements
          const clone = priceMain.cloneNode(true);
          
          // Remove hidden decoys
          const decoys = clone.querySelectorAll('[aria-hidden="true"], [style*="display: none"], [style*="display:none"], .price-value, .amount');
          decoys.forEach(el => el.remove());

          // Remove MRP and badges
          if (clone.querySelector('span[style*="line-through"]')) {
            clone.querySelector('span[style*="line-through"]').remove();
          }
          Array.from(clone.querySelectorAll('span')).forEach(s => {
            if (s.innerText.includes('% off') || s.innerText.includes('Deal price') || s.innerText.includes('Updating')) {
              s.remove();
            }
          });

          const rawPriceText = clean(clone.innerText);

          // 4. Extract Stock
          let stockText = '';
          const stockEl = document.querySelector('.stock-badge');
          if (stockEl) stockText = clean(stockEl.innerText);

          return {
            rawPriceText,
            mrpText,
            badgeText,
            stockText
          };
        });

        if (!extracted || !extracted.rawPriceText) {
          throw new Error('Failed to extract visible price text from DOM');
        }

        const price = extractNumericPrice(extracted.rawPriceText);
        const mrp = extracted.mrpText ? extractNumericPrice(extracted.mrpText) : null;
        const stockParsed = parseStockString(extracted.stockText);

        let discountPct = null;
        if (extracted.badgeText) {
          const match = extracted.badgeText.match(/([0-9]+)%/);
          if (match) discountPct = parseInt(match[1], 10);
        }

        // Validate strictly before returning
        const validated = validateScrapedData({
          productId,
          price,
          currency: 'INR',
          mrp,
          discountPct,
          stockCount: stockParsed.count,
          stockStatus: stockParsed.status
        });

        onStatus(`Extracted verified data: Price=₹${validated.price}, Stock=${validated.stockStatus} (${validated.stockCount ?? 'N/A'})`);

        return validated;
      } finally {
        if (page) await page.close().catch(() => {});
        if (context) await context.close().catch(() => {});
        if (browser) await browser.close().catch(() => {});
      }
    }, {
      maxRetries: config.scraper.maxRetries,
      baseDelayMs: config.scraper.retryDelayMs,
      onAttempt: (info) => {
        logger.scraper('PLAYWRIGHT', info.phase, `Attempt ${info.attempt}/${info.maxRetries} (Duration: ${info.duration}ms)`);
      }
    });
  }
}

module.exports = new PlaywrightScraper();
