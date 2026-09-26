# Design Note: Scraper Reliability, Trade-Offs, and Failure Recovery

**Author**: Software Engineer Intern Candidate  
**Target Site**: INE Hosted Mock Store (`https://demo.inelabteamdev.com`)  
**Assignment**: Product Price Tracker (Web Scraping)

---

## 1. How Scraping Was Made Reliable

The INE mock storefront is deliberately designed with multiple hurdles common to real-world e-commerce scraping:
- Prices load asynchronously and are initially masked behind an interaction gate ("Price hidden" requiring mouse dwell time and clicking "Reveal price").
- The mock store intermittently returns slow responses, simulated 500 errors, or rate limits.
- Zero-width spaces (`\u200B`) and invisible characters are interleaved between price digits to break naive regex patterns.
- Decoy DOM elements (`<span class="price-value" aria-hidden="true" style="display: none">`) with fake values are placed adjacent to real prices.
- A random cookie consent modal (`.cookie-banner`) periodically intercepts clicks.

To make the scraper resilient across unattended runs, we implemented a layered reliability architecture:

### A. Intelligent Hybrid Scraper & Client Interaction
- **HTTP First**: The scraper initially attempts fast HTTP fetching via `axios` against the mock store API (`/api/products`, `/api/product/:id`).
- **Playwright Fallback**: If the price requires dynamic client-side rendering or interactive challenges, the scraper seamlessly delegates execution to Playwright Chromium.
- **Mouse Dwell Simulation**: Playwright simulates human mouse movements over `.price-block` (satisfying `minMoves: 8` and dwelling for > 600ms) before clicking "Reveal price".
- **Cookie Banner Bypass**: Before clicking the reveal gate, the scraper checks for `.cookie-banner` or `.cookie-overlay` and dismisses it cleanly.

### B. Anti-Obfuscation & Decoy Evasion Parser
- Clones the price container and strips all nodes with `aria-hidden="true"` or `style="display: none"` before extracting text.
- Replaces zero-width spaces (`[\u200B-\u200D\uFEFF]`), non-breaking spaces (`\u00A0`), and fullwidth unicode digits.
- Accurately isolates genuine selling price from strike-through MRP and discount percentage badges.

### C. Exponential Backoff with Jitter
- When transient network drops, 429 rate limits, or 5xx server errors occur, the scraper retries with exponential backoff:
  $$\text{Delay} = \min(\text{maxDelay}, \text{baseDelay} \times 2^{\text{attempt}-1}) + \text{jitter}$$
- Jitter prevents the "thundering herd" problem when retrying multiple tracked products simultaneously.

### D. Strict Data Validation Before Storage
- Extracted values pass through `validator.js`. Prices must be positive finite numbers ($> 0$), and stock counts must be valid integers.
- If validation fails or max retries are exhausted, the scraper **aborts without saving fake data**.

### E. Honest Logging & Separation of Concerns
- `price_history` only receives verified valid observations.
- `scrape_logs` honestly logs **every attempt** with its timestamp, attempt number, duration in milliseconds, scraper engine used (`HTTP` vs `Playwright`), and outcome (`SUCCESS`, `RETRIED`, or `FAILED`).

---

## 2. Trade-Offs Made

| Architectural Decision | Chosen Approach | Alternative Considered | Rationale & Trade-off |
| :--- | :--- | :--- | :--- |
| **HTTP vs Browser Automation** | **Hybrid Fallback** (Try HTTP first, switch to Playwright on dynamic gate) | Playwright for every product | Spawning Chromium for every scrape consumes 150MB+ RAM and 3-5 seconds per request. Hybrid keeps resource usage low while retaining browser capability when needed. |
| **Scheduling Mechanism** | **External Cron** (`cron-job.org` calling `POST /api/scrape/run`) | In-memory `setInterval` | Render free instances sleep after 15 minutes of inactivity, pausing `setInterval`. An external cron service wakes the sleeping backend reliably every 2 hours. |
| **Database Architecture** | **Segregated Tables** (`price_history` & `scrape_logs`) | Single combined table with status column | Combining logs and prices creates gaps or forces null/fake price placeholders. Segregated tables keep historical price series clean for analytics and charts. |
| **Database Adapter** | **Dual Repository** (Supabase PostgreSQL + local fallback) | Supabase-only strict connection | Allows local evaluation and automated test suites to run immediately without requiring third-party credentials. |

---

## 3. What AI Tools Got Wrong on the First Attempt and How We Corrected It

During initial architectural prototyping, generative AI coding assistants made four critical errors when dealing with the mock store:

### 1. The "Static HTML" Assumption
- **What AI Got Wrong**: The AI initially wrote an `axios` + `cheerio` scraper targeting `#price` or `.price`. It assumed the price was rendered in the initial HTML response.
- **Why It Failed**: The mock store is a Single Page Application (SPA). The initial HTML is just an empty `<div id="root"></div>`. Even after loading, the price component is in an idle state showing `"Price hidden"`.
- **How We Corrected It**: We inspected the production JavaScript bundle (`assets/index-B9UiQq4X.js`), identified the `Ur` price component and `Ar` dwell gate, and implemented the Playwright fallback engine with mouse hover simulation and the "Reveal price" click action.

### 2. Falling for Hidden Decoy Price Elements
- **What AI Got Wrong**: When prompted to parse the price with Playwright, the AI generated:
  ```javascript
  const priceText = await page.locator('.price-value').innerText();
  ```
- **Why It Failed**: The mock store deliberately injects decoy elements:
  ```html
  <span class="price-value" aria-hidden="true" style="display: none">₹9999</span>
  ```
  The AI grabbed the hidden fake price instead of the real price, or concatenated both numbers together.
- **How We Corrected It**: We created `parser.js`, which strips zero-width spaces (`\u200B`) and explicitly ignores elements with `aria-hidden="true"`, `display: none`, or classes designated as decoys.

### 3. Silently Storing Null / Zero on Scrape Failure
- **What AI Got Wrong**: In error catch blocks, the AI wrote:
  ```javascript
  catch (err) {
    await db.savePrice({ price: 0, status: 'FAILED' });
  }
  ```
- **Why It Failed**: Storing `0` or null in the price history distorts historical price charts and violates the core assignment requirement: *"never silently stop or store incorrect data."*
- **How We Corrected It**: We strictly separated `price_history` from `scrape_logs`. On failure, the scraper logs the failure reason and attempt count into `scrape_logs` and never writes a corrupt or zero-value row to `price_history`.

### 4. Relying on In-Memory Timers on Free-Tier Hosting
- **What AI Got Wrong**: The AI suggested placing:
  ```javascript
  setInterval(scrapeTrackedProducts, 2 * 60 * 60 * 1000);
  ```
  directly inside Express `server.js`.
- **Why It Failed**: Render free-tier web services spin down (sleep) after 15 minutes of inactivity. When the server is asleep, in-memory Node.js timers halt completely, causing missed scrapes.
- **How We Corrected It**: We exposed an authenticated HTTP endpoint `POST /api/scrape/run` designed for external web cron services like `cron-job.org`, which issue HTTP requests that wake the instance up and trigger the 2-hour schedule predictably.
