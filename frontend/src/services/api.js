const API_BASE = import.meta.env.VITE_API_URL 
  ? `${import.meta.env.VITE_API_URL.replace(/\/+$/, '')}/api`
  : '/api';

async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    },
    ...options
  };

  try {
    const res = await fetch(url, config);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || `HTTP error ${res.status}: ${res.statusText}`);
    }
    return data;
  } catch (err) {
    console.error(`API Error on ${endpoint}:`, err);
    throw err;
  }
}

export const api = {
  // Products
  searchProducts: (search = '') => request(`/products?search=${encodeURIComponent(search)}`),
  getProduct: (id) => request(`/products/${id}`),

  // Tracked Products
  getTrackedProducts: () => request('/tracked-products'),
  trackProduct: (id, frequencyHours = 2, targetPrice = null) => 
    request(`/products/${id}/track`, {
      method: 'POST',
      body: JSON.stringify({ frequencyHours, targetPrice })
    }),
  untrackProduct: (id) => 
    request(`/products/${id}/track`, { method: 'DELETE' }),

  // History & Scrape Logs
  getPriceHistory: (id) => request(`/products/${id}/history`),
  getScrapeLogs: (id, limit = 50) => request(`/products/${id}/scrape-logs?limit=${limit}`),

  // Scraper Triggers
  triggerBatchScrape: () => request('/scrape/run', { method: 'POST' }),
  triggerSingleScrape: (id, headed = false) => 
    request(`/scrape/${id}`, {
      method: 'POST',
      body: JSON.stringify({ headed })
    }),

  // Alerts
  getAlerts: (unreadOnly = false) => request(`/alerts?unread=${unreadOnly}`),
  markAlertRead: (id) => request(`/alerts/${id}/read`, { method: 'PATCH' }),
  getStructureHealth: () => request('/alerts/structure/health'),

  // Backend Health
  getHealth: () => request('/health')
};
