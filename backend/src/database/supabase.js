const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const config = require('../config');
const logger = require('../utils/logger');

let supabaseClient = null;
const isSupabaseConfigured = Boolean(
  config.supabase.url &&
  config.supabase.key &&
  !config.supabase.url.includes('your-project')
);

if (isSupabaseConfigured) {
  try {
    supabaseClient = createClient(config.supabase.url, config.supabase.key);
    logger.success('Connected to Supabase PostgreSQL database');
  } catch (err) {
    logger.error('Failed to initialize Supabase client, falling back to local store', err);
    supabaseClient = null;
  }
} else {
  logger.warn('Supabase URL or Key not set. Using local persistent repository mode (backend/data/local_db.json). Set SUPABASE_URL and SUPABASE_KEY in .env for production.');
}
// Helper for resilient database operations (falls back to local DB if Supabase tables are missing or query fails)
async function withSupabaseFallback(supabaseFn, localFn) {
  if (supabaseClient) {
    try {
      return await supabaseFn();
    } catch (err) {
      logger.warn(`Supabase operation failed (${err.message || err}). Falling back to local persistent store.`);
    }
  }
  return await localFn();
}
// --------------------------------------------------------------------------
// Local In-Memory / File Persistent Database Fallback
// --------------------------------------------------------------------------
const LOCAL_DB_PATH = path.resolve(__dirname, '../../data/local_db.json');

function ensureLocalDbFile() {
  const dir = path.dirname(LOCAL_DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(LOCAL_DB_PATH)) {
    const initialData = {
      products: [],
      tracked_products: [],
      price_history: [],
      scrape_logs: [],
      alerts: [],
      structure_health: []
    };
    fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(initialData, null, 2), 'utf8');
  }
}

function loadLocalDb() {
  ensureLocalDbFile();
  try {
    const raw = fs.readFileSync(LOCAL_DB_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return {
      products: [],
      tracked_products: [],
      price_history: [],
      scrape_logs: [],
      alerts: [],
      structure_health: []
    };
  }
}

function saveLocalDb(data) {
  ensureLocalDbFile();
  fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(data, null, 2), 'utf8');
}

// Unified repository adapter providing consistent API
const db = {
  isUsingSupabase: () => Boolean(supabaseClient),

  // Products
  async getProducts(searchQuery = '') {
    return withSupabaseFallback(
      async () => {
        let query = supabaseClient.from('products').select('*');
        if (searchQuery) {
          query = query.ilike('name', `%${searchQuery}%`);
        }
        const { data, error } = await query;
        if (error) throw error;
        return data || [];
      },
      async () => {
        const local = loadLocalDb();
        if (!searchQuery) return local.products;
        const q = searchQuery.toLowerCase();
        return local.products.filter(p => 
          (p.name && p.name.toLowerCase().includes(q)) ||
          (p.brand && p.brand.toLowerCase().includes(q)) ||
          (p.category && p.category.toLowerCase().includes(q))
        );
      }
    );
  },

  async getProductById(id) {
    const numId = Number(id);
    return withSupabaseFallback(
      async () => {
        const { data, error } = await supabaseClient
          .from('products')
          .select('*')
          .eq('id', numId)
          .single();
        if (error && error.code !== 'PGRST116') throw error;
        return data;
      },
      async () => {
        const local = loadLocalDb();
        return local.products.find(p => p.id === numId) || null;
      }
    );
  },

  async upsertProduct(product) {
    return withSupabaseFallback(
      async () => {
        const { data, error } = await supabaseClient
          .from('products')
          .upsert({
            id: product.id,
            name: product.name,
            brand: product.brand,
            category: product.category,
            sku: product.sku,
            url: product.url,
            image_url: product.image_url,
            updated_at: new Date().toISOString()
          })
          .select()
          .single();
        if (error) throw error;
        return data;
      },
      async () => {
        const local = loadLocalDb();
        const idx = local.products.findIndex(p => p.id === product.id);
        const item = { ...product, updated_at: new Date().toISOString() };
        if (idx >= 0) {
          local.products[idx] = item;
        } else {
          local.products.push(item);
        }
        saveLocalDb(local);
        return item;
      }
    );
  },

  // Tracked Products
  async getTrackedProducts() {
    return withSupabaseFallback(
      async () => {
        const { data, error } = await supabaseClient
          .from('tracked_products')
          .select(`
            id, product_id, frequency_hours, target_price, active, last_scraped_at, created_at,
            products ( id, name, brand, category, sku, url, image_url )
          `)
          .order('created_at', { ascending: false });
        if (error) throw error;
        return (data || []).map(row => ({
          ...row,
          product: row.products
        }));
      },
      async () => {
        const local = loadLocalDb();
        return local.tracked_products.map(tp => ({
          ...tp,
          product: local.products.find(p => p.id === tp.product_id) || null
        }));
      }
    );
  },

  async getTrackedProductByProductId(productId) {
    const numId = Number(productId);
    return withSupabaseFallback(
      async () => {
        const { data, error } = await supabaseClient
          .from('tracked_products')
          .select('*')
          .eq('product_id', numId)
          .single();
        if (error && error.code !== 'PGRST116') throw error;
        return data;
      },
      async () => {
        const local = loadLocalDb();
        return local.tracked_products.find(tp => tp.product_id === numId) || null;
      }
    );
  },

  async trackProduct(productId, frequencyHours = 2, targetPrice = null) {
    const numId = Number(productId);
    return withSupabaseFallback(
      async () => {
        const { data, error } = await supabaseClient
          .from('tracked_products')
          .upsert({
            product_id: numId,
            frequency_hours: frequencyHours,
            target_price: targetPrice,
            active: true,
            created_at: new Date().toISOString()
          }, { onConflict: 'product_id' })
          .select()
          .single();
        if (error) throw error;
        return data;
      },
      async () => {
        const local = loadLocalDb();
        let tp = local.tracked_products.find(t => t.product_id === numId);
        if (tp) {
          tp.active = true;
          tp.frequency_hours = frequencyHours;
          tp.target_price = targetPrice;
        } else {
          tp = {
            id: 'local-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
            product_id: numId,
            frequency_hours: frequencyHours,
            target_price: targetPrice,
            active: true,
            last_scraped_at: null,
            created_at: new Date().toISOString()
          };
          local.tracked_products.push(tp);
        }
        saveLocalDb(local);
        return tp;
      }
    );
  },

  async untrackProduct(productId) {
    const numId = Number(productId);
    return withSupabaseFallback(
      async () => {
        const { error } = await supabaseClient
          .from('tracked_products')
          .delete()
          .eq('product_id', numId);
        if (error) throw error;
        return true;
      },
      async () => {
        const local = loadLocalDb();
        local.tracked_products = local.tracked_products.filter(tp => tp.product_id !== numId);
        saveLocalDb(local);
        return true;
      }
    );
  },

  async updateTrackedProductLastScraped(productId, timestamp = new Date().toISOString()) {
    const numId = Number(productId);
    return withSupabaseFallback(
      async () => {
        await supabaseClient
          .from('tracked_products')
          .update({ last_scraped_at: timestamp })
          .eq('product_id', numId);
      },
      async () => {
        const local = loadLocalDb();
        const tp = local.tracked_products.find(t => t.product_id === numId);
        if (tp) {
          tp.last_scraped_at = timestamp;
          saveLocalDb(local);
        }
      }
    );
  },

  // Price History (Validated data only)
  async addPriceHistory(entry) {
    const row = {
      product_id: Number(entry.product_id),
      price: Number(entry.price),
      currency: entry.currency || 'INR',
      mrp: entry.mrp ? Number(entry.mrp) : null,
      discount_pct: entry.discount_pct ? Number(entry.discount_pct) : null,
      stock_count: entry.stock_count !== undefined && entry.stock_count !== null ? Number(entry.stock_count) : null,
      stock_status: entry.stock_status || 'IN_STOCK',
      scraped_at: entry.scraped_at || new Date().toISOString()
    };

    return withSupabaseFallback(
      async () => {
        const { data, error } = await supabaseClient
          .from('price_history')
          .insert(row)
          .select()
          .single();
        if (error) throw error;
        return data;
      },
      async () => {
        const local = loadLocalDb();
        const item = {
          id: 'ph-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
          ...row
        };
        local.price_history.push(item);
        saveLocalDb(local);
        return item;
      }
    );
  },

  async getPriceHistory(productId) {
    const numId = Number(productId);
    return withSupabaseFallback(
      async () => {
        const { data, error } = await supabaseClient
          .from('price_history')
          .select('*')
          .eq('product_id', numId)
          .order('scraped_at', { ascending: true });
        if (error) throw error;
        return data || [];
      },
      async () => {
        const local = loadLocalDb();
        return local.price_history
          .filter(ph => ph.product_id === numId)
          .sort((a, b) => new Date(a.scraped_at) - new Date(b.scraped_at));
      }
    );
  },

  // Scrape Logs (Every single attempt logged honestly)
  async addScrapeLog(entry) {
    const row = {
      product_id: Number(entry.product_id),
      attempt: Number(entry.attempt || 1),
      status: entry.status, // 'SUCCESS', 'RETRIED', 'FAILED'
      scraper_type: entry.scraper_type || 'HTTP',
      http_status: entry.http_status ? Number(entry.http_status) : null,
      duration_ms: entry.duration_ms ? Number(entry.duration_ms) : null,
      error_message: entry.error_message || null,
      started_at: entry.started_at || new Date().toISOString(),
      completed_at: entry.completed_at || new Date().toISOString()
    };

    return withSupabaseFallback(
      async () => {
        const { data, error } = await supabaseClient
          .from('scrape_logs')
          .insert(row)
          .select()
          .single();
        if (error) throw error;
        return data;
      },
      async () => {
        const local = loadLocalDb();
        const item = {
          id: 'log-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
          created_at: new Date().toISOString(),
          ...row
        };
        local.scrape_logs.push(item);
        saveLocalDb(local);
        return item;
      }
    );
  },

  async getScrapeLogs(productId = null, limit = 50) {
    return withSupabaseFallback(
      async () => {
        let query = supabaseClient
          .from('scrape_logs')
          .select('*')
          .order('started_at', { ascending: false })
          .limit(limit);
        if (productId) {
          query = query.eq('product_id', Number(productId));
        }
        const { data, error } = await query;
        if (error) throw error;
        return data || [];
      },
      async () => {
        const local = loadLocalDb();
        let logs = local.scrape_logs;
        if (productId) {
          const numId = Number(productId);
          logs = logs.filter(l => l.product_id === numId);
        }
        return logs
          .sort((a, b) => new Date(b.started_at) - new Date(a.started_at))
          .slice(0, limit);
      }
    );
  },

  // Alerts
  async addAlert(alert) {
    const row = {
      product_id: alert.product_id ? Number(alert.product_id) : null,
      type: alert.type,
      message: alert.message,
      read: false,
      created_at: new Date().toISOString()
    };

    return withSupabaseFallback(
      async () => {
        const { data, error } = await supabaseClient
          .from('alerts')
          .insert(row)
          .select()
          .single();
        if (error) throw error;
        return data;
      },
      async () => {
        const local = loadLocalDb();
        const item = {
          id: 'alert-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
          ...row
        };
        local.alerts.push(item);
        saveLocalDb(local);
        return item;
      }
    );
  },

  async getAlerts(unreadOnly = false) {
    return withSupabaseFallback(
      async () => {
        let query = supabaseClient
          .from('alerts')
          .select(`
            id, product_id, type, message, read, created_at,
            products ( id, name, sku )
          `)
          .order('created_at', { ascending: false })
          .limit(50);
        if (unreadOnly) {
          query = query.eq('read', false);
        }
        const { data, error } = await query;
        if (error) throw error;
        return (data || []).map(r => ({ ...r, product: r.products }));
      },
      async () => {
        const local = loadLocalDb();
        let alerts = local.alerts;
        if (unreadOnly) {
          alerts = alerts.filter(a => !a.read);
        }
        return alerts
          .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
          .map(a => ({
            ...a,
            product: local.products.find(p => p.id === a.product_id) || null
          }));
      }
    );
  },

  async markAlertRead(alertId) {
    return withSupabaseFallback(
      async () => {
        await supabaseClient
          .from('alerts')
          .update({ read: true })
          .eq('id', alertId);
        return true;
      },
      async () => {
        const local = loadLocalDb();
        const alert = local.alerts.find(a => a.id === alertId);
        if (alert) {
          alert.read = true;
          saveLocalDb(local);
        }
        return true;
      }
    );
  },

  // Structure Health Check
  async recordStructureHealth(selectorName, status, notes = '') {
    const row = {
      selector_name: selectorName,
      status: status, // 'HEALTHY', 'SHIFTED', 'BROKEN'
      last_checked_at: new Date().toISOString(),
      notes
    };

    return withSupabaseFallback(
      async () => {
        await supabaseClient.from('structure_health').insert(row);
      },
      async () => {
        const local = loadLocalDb();
        local.structure_health.push({
          id: 'sh-' + Date.now(),
          ...row
        });
        saveLocalDb(local);
      }
    );
  },

  async getStructureHealth() {
    return withSupabaseFallback(
      async () => {
        const { data, error } = await supabaseClient
          .from('structure_health')
          .select('*')
          .order('last_checked_at', { ascending: false })
          .limit(20);
        if (error) throw error;
        return data || [];
      },
      async () => {
        const local = loadLocalDb();
        return local.structure_health
          .sort((a, b) => new Date(b.last_checked_at) - new Date(a.last_checked_at))
          .slice(0, 20);
      }
    );
  }
};


module.exports = db;
