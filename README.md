# INE Product Price Tracker (Web Scraping)

A resilient full-stack web application that tracks products from the INE hosted mock store ([https://demo.inelabteamdev.com](https://demo.inelabteamdev.com)), scrapes live prices and stock on a 2-hour schedule, and provides honest attempt logging and time-series visualization.

---

## 🏛️ Architecture Overview

The application is structured into four decoupled layers:

```
                         ┌─────────────────────┐
                         │   React Frontend    │
                         │ (Vite, Tailwind,    │
                         │    Recharts UI)     │
                         └──────────┬──────────┘
                                    │ REST APIs
                                    ▼
                         ┌─────────────────────┐
                         │ Node/Express Backend│
                         │  (Controllers and   │
                         │     Services)       │
                         └──────────┬──────────┘
                                    │
                 ┌──────────────────┼──────────────────┐
                 ▼                  ▼                  ▼
          ┌─────────────┐   ┌──────────────┐   ┌──────────────┐
          │ PostgreSQL  │   │ Scraper      │   │ Scheduler    │
          │  Supabase   │   │ Service      │   │ cron-job.org │
          └─────────────┘   └──────┬───────┘   └──────┬───────┘
                                   │                  │
                              ┌────┴────┐             │
                              ▼         ▼             │
                           HTTP     Playwright        │
                              │         │             │
                              └────┬────┘             │
                                   ▼                  │
                             INE Mock Store ◄─────────┘
```

1. **Product Management Layer**: Allows users to search INE mock store items by partial/full name or SKU, configure scraping frequency, and track products.
2. **Scraping Engine Layer**: Hybrid scraper that attempts fast HTTP fetching first, falling back to Playwright browser automation when dynamic client-side challenges (interaction gates, mouse dwell, obfuscated tokens) are detected.
3. **Reliability Layer**: Request timeouts, exponential backoff with jitter, error recovery, anti-obfuscation parser (evading decoy DOM prices and cleaning zero-width spaces), and strict data validation before any persistence.
4. **Data & Visualization Layer**: Segregated database schema separating verified observations (`price_history`) from scrape attempt outcomes (`scrape_logs`), with price drop alerts and interactive charts.

---

## 🚀 Quick Start (Local Setup)

### Prerequisites
- Node.js >= 18.x
- npm >= 9.x

### 1. Clone & Navigate
```bash
git clone <your-repo-url>
cd product-price-tracker
```

### 2. Backend Setup
```bash
cd backend
npm install

# (Optional) Install Playwright browsers for browser-based scraping & headed runs:
npx playwright install chromium

# Copy environment template
cp .env.example .env
```

Start the backend:
```bash
npm start
# Backend runs at http://localhost:5000
```
> **Note on Database**: If you haven't configured Supabase yet, the backend automatically runs in local file repository mode (`backend/data/local_db.json`). Once you provide your `SUPABASE_URL` and `SUPABASE_KEY` in `.env`, it seamlessly switches to Supabase PostgreSQL.

### 3. Frontend Setup
In a new terminal window:
```bash
cd frontend
npm install
npm run dev
# Frontend runs at http://localhost:3000
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🎥 Running the Observable (Headed) Scraper

Per the assignment instructions, to record the **2 to 4 minute headed run video**:

```bash
cd backend
npm run scrape:headed -- 1
```
*(Replace `1` with any product ID from the mock store)*

### What Happens in Headed Mode:
1. Spawns Chromium in visible window mode with `slowMo: 250ms`.
2. Navigates to `https://demo.inelabteamdev.com/product/1`.
3. Automatically detects and dismisses the random cookie consent overlay.
4. Simulates human mouse movement over the price area to satisfy `minMoves: 8` and `minDwellMs: 600`.
5. Clicks the **"Reveal price"** button.
6. Observes mock store responses, handling transient delays and simulated store retries.
7. Filters out decoy hidden DOM price tags (`display: none`, `aria-hidden="true"`).
8. Extracts genuine price and stock, logs verified results in green, updates the database, and pauses 5 seconds before closing.

---

## ⏱️ 2-Hour Scheduling Architecture (Free-Tier Friendly)

Because Render free-tier instances sleep when inactive, using `setInterval()` inside Node.js is unreliable for unattended background schedules.

### How it works:
1. The backend exposes an external endpoint: `POST /api/scrape/run`.
2. Setup a free cron job on [cron-job.org](https://cron-job.org):
   - **URL**: `https://your-backend-on-render.com/api/scrape/run`
   - **Schedule**: Every 2 hours (`0 */2 * * *`)
   - **Request Method**: `POST`
   - **Headers**: `x-cron-secret: your-cron-secret` (configured in `CRON_SECRET`)
3. When `cron-job.org` sends the HTTP POST request, it wakes up the Render backend and triggers a batch scrape of all active tracked products.
4. You can also trigger an immediate scrape at any time from the dashboard via the **"Run Scraper Now"** button.

---

## 🗄️ Database Setup (Supabase PostgreSQL)

1. Create a free project on [Supabase](https://supabase.com).
2. Go to the **SQL Editor** in your Supabase dashboard.
3. Paste and execute the contents of [`backend/src/database/schema.sql`](file:///backend/src/database/schema.sql).
4. Retrieve your **Project URL** and **Service Role or Anon API Key** from Project Settings -> API.
5. Add them to `backend/.env`:
   ```env
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_KEY=your-supabase-key
   ```

### Schema Highlights:
- `products`: Product catalog cache from INE store.
- `tracked_products`: Tracked product configurations (frequency, target price).
- `price_history`: Only stores verified, valid price and stock observations.
- `scrape_logs`: Records every single attempt (`SUCCESS`, `RETRIED`, `FAILED`), execution time in ms, scraper engine (`HTTP` vs `Playwright`), and error messages.
- `alerts`: Price-drop and back-in-stock alerts.
- `structure_health`: Page shift and selector status monitoring.

---

## ☁️ Production Deployment

### Backend on Render.com:
1. Create a **New Web Service** connected to your GitHub repository.
2. Root Directory: `backend`
3. Build Command: `npm install && npx playwright install --with-deps chromium`
4. Start Command: `npm start`
5. Set Environment Variables:
   - `PORT`: `5000`
   - `NODE_ENV`: `production`
   - `SUPABASE_URL`: `https://your-project.supabase.co`
   - `SUPABASE_KEY`: `your-supabase-key`
   - `CRON_SECRET`: `<your-random-secret>`

### Frontend on Vercel:
1. Import the repository into **Vercel**.
2. Root Directory: `frontend`
3. Framework Preset: `Vite`
4. Environment Variables:
   - `VITE_API_URL`: `https://your-backend.onrender.com`
5. Deploy.

---

## 🧪 Running Automated Tests

```bash
cd backend
npm test
```
Tests cover:
- Price validator (positive numbers, rejecting empty/zero/fake prices).
- Stock status normalizer (`IN_STOCK`, `LOW_STOCK`, `OUT_OF_STOCK`).
- Anti-obfuscation parser (zero-width spaces `\u200B`, decoy tag removal).
- Retry mechanism with exponential backoff & jitter.
- Database separation of `price_history` and `scrape_logs`.
