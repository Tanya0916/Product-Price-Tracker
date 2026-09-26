-- ==========================================================
-- INE Product Price Tracker - Supabase / PostgreSQL Schema
-- Run this in your Supabase SQL Editor to initialize tables
-- ==========================================================

-- 1. Products catalog table
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    brand VARCHAR(150),
    category VARCHAR(100),
    sku VARCHAR(100),
    url TEXT NOT NULL,
    image_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tracked products table
CREATE TABLE IF NOT EXISTS tracked_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    frequency_hours INTEGER DEFAULT 2,
    target_price NUMERIC(10, 2),
    active BOOLEAN DEFAULT TRUE,
    last_scraped_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_tracked_product UNIQUE (product_id)
);

-- 3. Price and Stock history table (ONLY stores valid scraped data)
CREATE TABLE IF NOT EXISTS price_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    price NUMERIC(10, 2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'INR',
    mrp NUMERIC(10, 2),
    discount_pct NUMERIC(5, 2),
    stock_count INTEGER,
    stock_status VARCHAR(50) NOT NULL, -- 'IN_STOCK', 'LOW_STOCK', 'OUT_OF_STOCK'
    scraped_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast time-series queries
CREATE INDEX IF NOT EXISTS idx_price_history_product_time 
ON price_history (product_id, scraped_at DESC);

-- 4. Scrape audit logs (Records every attempt honestly: SUCCESS, RETRIED, FAILED)
CREATE TABLE IF NOT EXISTS scrape_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    attempt INTEGER NOT NULL DEFAULT 1,
    status VARCHAR(20) NOT NULL, -- 'SUCCESS', 'RETRIED', 'FAILED'
    scraper_type VARCHAR(30) DEFAULT 'HTTP', -- 'HTTP', 'PLAYWRIGHT'
    http_status INTEGER,
    duration_ms INTEGER,
    error_message TEXT,
    started_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for querying logs by product and date
CREATE INDEX IF NOT EXISTS idx_scrape_logs_product_time 
ON scrape_logs (product_id, started_at DESC);

-- 5. Alerts table (Price drop, back in stock, selector shifts)
CREATE TABLE IF NOT EXISTS alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL, -- 'PRICE_DROP', 'BACK_IN_STOCK', 'STRUCTURE_CHANGE', 'SCRAPE_FAILURE'
    message TEXT NOT NULL,
    read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Page structure health table (bonus change detection)
CREATE TABLE IF NOT EXISTS structure_health (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    selector_name VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'HEALTHY', -- 'HEALTHY', 'SHIFTED', 'BROKEN'
    last_checked_at TIMESTAMPTZ DEFAULT NOW(),
    notes TEXT
);

-- Sample initial products seed (optional convenience for manual inspection)
INSERT INTO products (id, name, brand, category, sku, url)
VALUES 
(1, 'Studio Monitor Headphones', 'SoundCraft', 'Audio', 'SC-HP-01', 'https://demo.inelabteamdev.com/product/1'),
(2, 'UltraWide Gaming Monitor 34"', 'PixelPro', 'Monitors', 'PP-GM-34', 'https://demo.inelabteamdev.com/product/2'),
(3, 'Wireless Mechanical Keyboard', 'KeyFlow', 'Peripherals', 'KF-KB-88', 'https://demo.inelabteamdev.com/product/3')
ON CONFLICT (id) DO NOTHING;
