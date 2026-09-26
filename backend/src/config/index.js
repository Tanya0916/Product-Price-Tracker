const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  mockStoreUrl: (process.env.MOCK_STORE_URL || 'https://demo.inelabteamdev.com').replace(/\/+$/, ''),
  supabase: {
    url: process.env.SUPABASE_URL || '',
    key: process.env.SUPABASE_KEY || ''
  },
  scraper: {
    timeoutMs: parseInt(process.env.SCRAPER_TIMEOUT_MS || '25000', 10),
    maxRetries: parseInt(process.env.SCRAPER_MAX_RETRIES || '3', 10),
    retryDelayMs: parseInt(process.env.SCRAPER_RETRY_DELAY_MS || '1500', 10)
  },
  cronSecret: process.env.CRON_SECRET || 'mock-cron-secret-12345',
  emailAlerts: {
    enabled: process.env.ALERT_EMAIL_ENABLED === 'true',
    sendgridApiKey: process.env.SENDGRID_API_KEY || '',
    alertEmailTo: process.env.ALERT_EMAIL_TO || ''
  }
};

module.exports = config;
