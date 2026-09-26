const httpScraper = require('C:/Users/HP/.gemini/antigravity/scratch/product-price-tracker/backend/src/scraper/httpScraper');

async function test() {
  try {
    console.log('Testing httpScraper.fetchCatalog(1, 50)...');
    const res = await httpScraper.fetchCatalog(1, 50);
    console.log('Catalog res keys:', Object.keys(res));
    console.log('Result data:', JSON.stringify(res.result, null, 2).slice(0, 1000));
  } catch (e) {
    console.error('Catalog fetch error:', e.message);
    if (e.response) {
      console.error('HTTP status:', e.response.status, e.response.data);
    }
  }
}

test();
