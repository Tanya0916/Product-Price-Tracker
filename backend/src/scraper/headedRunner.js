/**
 * Standalone Headed Runner for Demonstrating Scraper Behavior
 * Run with: npm run scrape:headed -- [productId]
 * Example: npm run scrape:headed -- 1
 * 
 * Perfect for capturing the required 2-4 minute screen recording of
 * observable browser interaction, slow load handling, and error recovery.
 */

const playwrightScraper = require('./playwrightScraper');
const logger = require('../utils/logger');
const { sleep } = require('../utils/sleep');
const db = require('../database/supabase');

async function main() {
  const args = process.argv.slice(2);
  let productId = 1;

  if (args.length > 0) {
    const raw = args[0].replace(/[^0-9]/g, '');
    if (raw) productId = parseInt(raw, 10);
  }

  console.log('\n================================================================');
  console.log('       INE PRODUCT PRICE TRACKER - OBSERVABLE HEADED RUN       ');
  console.log('================================================================');
  console.log(`Target Product ID : ${productId}`);
  console.log(`Target URL        : https://demo.inelabteamdev.com/product/${productId}`);
  console.log(`Mode              : HEADED (Visible browser with slow-motion actions)`);
  console.log(`Database Mode     : ${db.isUsingSupabase() ? 'Supabase PostgreSQL' : 'Local File Repository'}`);
  console.log('================================================================\n');

  const startTime = Date.now();
  let attemptNumber = 1;

  try {
    const result = await playwrightScraper.scrapeProduct(productId, {
      headed: true,
      slowMo: 250, // Slow down operations so screen recorder captures mouse movement & clicks
      onStatus: (msg) => {
        console.log(`[HEADED MONITOR] ${msg}`);
      }
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    const data = result.result;

    console.log('\n----------------------------------------------------------------');
    console.log('                    SCRAPE RUN SUCCEEDED!                      ');
    console.log('----------------------------------------------------------------');
    console.log(`Product ID   : ${data.productId}`);
    console.log(`Live Price   : ₹${data.price}`);
    console.log(`MRP          : ₹${data.mrp ?? 'N/A'}`);
    console.log(`Discount     : ${data.discountPct ? data.discountPct + '%' : 'None'}`);
    console.log(`Stock Status : ${data.stockStatus}`);
    console.log(`Stock Left   : ${data.stockCount ?? 'N/A'}`);
    console.log(`Attempts     : ${result.attempts}`);
    console.log(`Total Time   : ${elapsed}s`);
    console.log('----------------------------------------------------------------\n');

    // Save honest log and validated price to database
    await db.addScrapeLog({
      product_id: productId,
      attempt: result.attempts,
      status: 'SUCCESS',
      scraper_type: 'PLAYWRIGHT_HEADED',
      duration_ms: Date.now() - startTime,
      started_at: new Date(startTime).toISOString(),
      completed_at: new Date().toISOString()
    });

    await db.addPriceHistory({
      product_id: productId,
      price: data.price,
      currency: data.currency,
      mrp: data.mrp,
      discount_pct: data.discountPct,
      stock_count: data.stockCount,
      stock_status: data.stockStatus
    });

    logger.success('Saved verified price observation and attempt log to database.');
    console.log('\n[Screen Recording Tip] Headed run completed. Pausing for 5 seconds before exit...');
    await sleep(5000);
    process.exit(0);

  } catch (err) {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.error('\n----------------------------------------------------------------');
    console.error('                    SCRAPE RUN FAILED!                         ');
    console.error('----------------------------------------------------------------');
    console.error(`Error        : ${err.message}`);
    console.error(`Attempts     : ${err.attemptsCount || attemptNumber}`);
    console.error(`Total Time   : ${elapsed}s`);
    console.error('----------------------------------------------------------------\n');

    // Honest failure logging: NEVER save fake price data
    await db.addScrapeLog({
      product_id: productId,
      attempt: err.attemptsCount || 1,
      status: 'FAILED',
      scraper_type: 'PLAYWRIGHT_HEADED',
      duration_ms: Date.now() - startTime,
      error_message: err.message,
      started_at: new Date(startTime).toISOString(),
      completed_at: new Date().toISOString()
    });

    logger.warn('Logged failure honestly in scrape_logs. No invalid price data recorded.');
    process.exit(1);
  }
}

main();
