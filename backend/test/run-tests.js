const assert = require('assert');
const { validatePrice, validateStock, validateScrapedData, ValidationError } = require('../src/scraper/validator');
const { cleanText, extractNumericPrice, parseStockString, parseProductHtml } = require('../src/scraper/parser');
const { executeWithRetry, isRetryableError } = require('../src/scraper/retry');
const db = require('../src/database/supabase');

let passedCount = 0;
let failedCount = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✔ PASS: ${name}`);
    passedCount++;
  } catch (err) {
    console.error(`  ✖ FAIL: ${name}`);
    console.error(`    ${err.message}`);
    failedCount++;
  }
}

async function testAsync(name, fn) {
  try {
    await fn();
    console.log(`  ✔ PASS: ${name}`);
    passedCount++;
  } catch (err) {
    console.error(`  ✖ FAIL: ${name}`);
    console.error(`    ${err.message}`);
    failedCount++;
  }
}

async function runAllTests() {
  console.log('\n========================================================');
  console.log('       RUNNING BACKEND TEST SUITE & VALIDATIONS         ');
  console.log('========================================================\n');

  console.log('--- 1. Validator Tests ---');
  test('Validates positive finite price', () => {
    assert.strictEqual(validatePrice(2999), 2999);
    assert.strictEqual(validatePrice('₹ 2,999.50'), 2999.5);
    assert.strictEqual(validatePrice('42.9'), 42.9);
  });

  test('Rejects negative, zero, null, and non-numeric prices', () => {
    assert.throws(() => validatePrice(0), ValidationError);
    assert.throws(() => validatePrice(-150), ValidationError);
    assert.throws(() => validatePrice(null), ValidationError);
    assert.throws(() => validatePrice('invalid-price'), ValidationError);
    assert.throws(() => validatePrice(''), ValidationError);
  });

  test('Validates stock status correctly', () => {
    const s1 = validateStock(14, 'In stock · 14 left');
    assert.strictEqual(s1.stockStatus, 'IN_STOCK');
    assert.strictEqual(s1.stockCount, 14);

    const s2 = validateStock(3, 'Only 3 left');
    assert.strictEqual(s2.stockStatus, 'LOW_STOCK');
    assert.strictEqual(s2.stockCount, 3);

    const s3 = validateStock(0, 'Out of stock');
    assert.strictEqual(s3.stockStatus, 'OUT_OF_STOCK');
    assert.strictEqual(s3.stockCount, 0);
  });

  test('Validates complete payload with discount calculation', () => {
    const payload = validateScrapedData({
      productId: 1,
      price: 2499,
      mrp: 4999,
      stockCount: 8,
      stockStatus: 'In stock'
    });
    assert.strictEqual(payload.productId, 1);
    assert.strictEqual(payload.price, 2499);
    assert.strictEqual(payload.mrp, 4999);
    assert.strictEqual(payload.discountPct, 50);
    assert.strictEqual(payload.stockStatus, 'IN_STOCK');
  });

  console.log('\n--- 2. Parser & Anti-Obfuscation Tests ---');
  test('Strips zero-width spaces, NBSP, and normalizes unicode', () => {
    const dirty = '₹\u200B2\u200B,\u200B9\u200B9\u200B9\u00A0/-';
    const cleaned = cleanText(dirty);
    assert.strictEqual(cleaned, '₹2,999 /-');
    assert.strictEqual(extractNumericPrice(dirty), 2999);
  });

  test('Extracts stock count and status strings', () => {
    const res = parseStockString('Hurry, just 4 left');
    assert.strictEqual(res.count, 4);
    assert.strictEqual(res.status, 'LOW_STOCK');

    const res2 = parseStockString('Out of stock');
    assert.strictEqual(res2.count, 0);
    assert.strictEqual(res2.status, 'OUT_OF_STOCK');
  });

  test('Discards decoy hidden prices from HTML', () => {
    const sampleHtml = `
      <div class="price-main">
        <span class="price-value" aria-hidden="true" style="display: none">₹9999</span>
        <span class="mrp" style="text-decoration: line-through">₹4,999</span>
        <span class="v123">₹2,499</span>
        <span class="badge">50% off</span>
        <span class="amount" data-price="true" aria-hidden="true" style="display:none">₹8888</span>
      </div>
      <div class="stock"><span class="stock-badge">In stock · 12 left</span></div>
    `;
    const parsed = parseProductHtml(sampleHtml);
    assert.strictEqual(parsed.price, 2499);
    assert.strictEqual(parsed.mrp, 4999);
    assert.strictEqual(parsed.stockCount, 12);
  });

  console.log('\n--- 3. Reliability & Retry Tests ---');
  await testAsync('Retries on transient errors and eventually succeeds', async () => {
    let calls = 0;
    const res = await executeWithRetry(async (attempt) => {
      calls++;
      if (attempt < 3) {
        throw new Error('Simulated 500 error');
      }
      return 'SUCCESSFUL_DATA';
    }, {
      maxRetries: 3,
      baseDelayMs: 20
    });

    assert.strictEqual(calls, 3);
    assert.strictEqual(res.result, 'SUCCESSFUL_DATA');
    assert.strictEqual(res.attempts, 3);
  });

  await testAsync('Fails honestly after exhausting max retries', async () => {
    let calls = 0;
    try {
      await executeWithRetry(async () => {
        calls++;
        throw new Error('Simulated persistent failure');
      }, {
        maxRetries: 2,
        baseDelayMs: 20
      });
      assert.fail('Should have thrown');
    } catch (err) {
      assert.strictEqual(calls, 2);
      assert.strictEqual(err.message, 'Simulated persistent failure');
    }
  });

  console.log('\n--- 4. Database & Logging Separation Tests ---');
  await testAsync('Separates price_history and scrape_logs correctly', async () => {
    const testProdId = 99900 + Math.floor(Math.random() * 1000);

    // Insert a product
    await db.upsertProduct({
      id: testProdId,
      name: 'Test Gizmo',
      brand: 'TestBrand',
      category: 'Gadgets',
      sku: 'TG-999',
      url: 'https://demo.inelabteamdev.com/product/999'
    });

    // Track product
    await db.trackProduct(testProdId);

    // Attempt 1: FAILED scrape log (e.g. timeout) - must NOT add price_history
    await db.addScrapeLog({
      product_id: testProdId,
      attempt: 1,
      status: 'FAILED',
      scraper_type: 'HTTP',
      error_message: 'Gateway Timeout 504'
    });

    let history = await db.getPriceHistory(testProdId);
    let logs = await db.getScrapeLogs(testProdId);

    assert.strictEqual(history.length, 0, 'Price history must remain empty on failed scrape!');
    assert.strictEqual(logs.length, 1, 'Scrape log must record the failure honestly.');
    assert.strictEqual(logs[0].status, 'FAILED');

    // Attempt 2: SUCCESS scrape log - now adds verified price
    await db.addScrapeLog({
      product_id: testProdId,
      attempt: 2,
      status: 'SUCCESS',
      scraper_type: 'PLAYWRIGHT',
      duration_ms: 2100
    });

    await db.addPriceHistory({
      product_id: testProdId,
      price: 1899,
      mrp: 2499,
      stock_status: 'IN_STOCK',
      stock_count: 5
    });

    history = await db.getPriceHistory(testProdId);
    logs = await db.getScrapeLogs(testProdId);

    assert.strictEqual(history.length, 1, 'Price history must now contain exactly 1 verified record.');
    assert.strictEqual(Number(history[0].price), 1899);
    assert.strictEqual(logs.length, 2, 'Scrape logs must contain both attempts (failed and succeeded).');
  });

  console.log('\n========================================================');
  console.log(`TOTAL TESTS: ${passedCount + failedCount} | PASSED: ${passedCount} | FAILED: ${failedCount}`);
  console.log('========================================================\n');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runAllTests().catch(err => {
  console.error('Test execution fatal error:', err);
  process.exit(1);
});
