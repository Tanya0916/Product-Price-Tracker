/**
 * Seed Catalog Script
 * Fetches real product catalog directly from https://demo.inelabteamdev.com/api/catalog
 * and populates local_db.json with genuine product data.
 *
 * Run: node scripts/seed-catalog.js
 */
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const LOCAL_DB_PATH = path.resolve(__dirname, '../data/local_db.json');
const STORE_URL = 'https://demo.inelabteamdev.com';

function saveLocalDb(data) {
  fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(data, null, 2), 'utf8');
}

async function main() {
  console.log('\n🔍 Fetching INE Mock Store catalog from /api/catalog...\n');

  try {
    const response = await axios.get(`${STORE_URL}/api/catalog?page=1&pageSize=20`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    });

    const items = response.data?.items || response.data?.products || response.data?.data || [];
    console.log(`✅ Received ${items.length} products from store API.`);

    if (items.length === 0) {
      console.error('❌ No products returned from store API.');
      process.exit(1);
    }

    const products = items.map(item => ({
      id: item.id,
      slug: item.slug,
      name: item.name,
      brand: item.brand || 'INE Brand',
      category: item.category || 'General',
      sku: item.sku || `SKU-${item.id}`,
      description: item.description || '',
      url: `${STORE_URL}/product/${item.id}`,
      image_url: item.image || item.image_url || null,
      updated_at: new Date().toISOString()
    }));

    // Fresh database state
    const freshDb = {
      products,
      tracked_products: [],
      price_history: [],
      scrape_logs: [],
      alerts: [],
      structure_health: []
    };

    saveLocalDb(freshDb);

    console.log(`\n✅ local_db.json successfully populated with ${products.length} real products.`);
    console.log('📦 Catalog Sample:');
    for (const p of products.slice(0, 5)) {
      console.log(`   #${p.id} — ${p.name} [${p.brand}] (${p.category})`);
    }
  } catch (err) {
    console.error('❌ Error fetching store catalog:', err.message);
    process.exit(1);
  }
}

main();
