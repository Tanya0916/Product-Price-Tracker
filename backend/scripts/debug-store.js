/**
 * Intercept: find the real API endpoints the INE store uses
 */
const { chromium } = require('playwright');

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  
  const requests = [];
  const responses = [];

  // Listen to all network requests
  page.on('request', req => {
    if (!req.url().includes('favicon') && !req.url().includes('.css') && !req.url().includes('.js')) {
      requests.push({ url: req.url(), method: req.method() });
    }
  });

  page.on('response', async res => {
    if (!res.url().includes('favicon') && !res.url().includes('.css') && !res.url().includes('.js')) {
      try {
        const body = await res.text().catch(() => '');
        responses.push({ url: res.url(), status: res.status(), body: body.slice(0, 500) });
      } catch {}
    }
  });

  try {
    // First accept cookies by going to homepage with proper wait
    await page.goto('https://demo.inelabteamdev.com', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2000);
    
    // Accept cookies
    const acceptBtn = await page.$('button:has-text("ACCEPT"), button:has-text("Accept")');
    if (acceptBtn) {
      await acceptBtn.click();
      console.log('✔ Accepted cookies');
      await page.waitForTimeout(1000);
    }

    // Wait for network to settle  
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(3000);

    console.log('\n📡 All network requests:');
    for (const r of requests) {
      console.log(`  ${r.method} ${r.url}`);
    }

    console.log('\n📥 All responses:');
    for (const r of responses) {
      console.log(`  [${r.status}] ${r.url}`);
      if (r.body && r.body.length > 2) {
        console.log(`    Body: ${r.body.slice(0, 200)}`);
      }
    }

    const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 3000));
    console.log('\n📄 Page body text:', bodyText);

  } finally {
    await browser.close();
  }
}

main().catch(console.error);
