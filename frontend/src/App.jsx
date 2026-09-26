import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import ProductSearch from './components/ProductSearch';
import TrackedProductCard from './components/TrackedProductCard';
import PriceHistoryChart from './components/PriceHistoryChart';
import ScrapeLogsTable from './components/ScrapeLogsTable';
import AlertsPanel from './components/AlertsPanel';
import StructureChangeAlert from './components/StructureChangeAlert';
import { api } from './services/api';
import { ShieldCheck, Clock, Zap, AlertTriangle, Layers, Database } from 'lucide-react';

export default function App() {
  const [products, setProducts] = useState([]);
  const [trackedProducts, setTrackedProducts] = useState([]);
  const [selectedProductId, setSelectedProductId] = useState(null);
  const [activeTab, setActiveTab] = useState('chart'); // 'chart' | 'logs'
  const [selectedHistory, setSelectedHistory] = useState([]);
  const [selectedStats, setSelectedStats] = useState(null);
  const [selectedLogs, setSelectedLogs] = useState([]);
  
  const [alerts, setAlerts] = useState([]);
  const [structureHealth, setStructureHealth] = useState([]);
  const [backendHealth, setBackendHealth] = useState(null);

  const [isLoadingCatalog, setIsLoadingCatalog] = useState(true);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [isScrapingBatch, setIsScrapingBatch] = useState(false);
  const [isAlertsOpen, setIsAlertsOpen] = useState(false);

  // Initial Data Load
  useEffect(() => {
    loadInitialData();
    const interval = setInterval(refreshHealthAndAlerts, 30000);
    return () => clearInterval(interval);
  }, []);

  // When selected product changes or tab switches, load its history & logs
  useEffect(() => {
    if (selectedProductId) {
      loadProductDetails(selectedProductId);
    }
  }, [selectedProductId]);

  const loadInitialData = async () => {
    setIsLoadingCatalog(true);
    try {
      const [healthRes, prodRes, trackedRes, alertsRes, healthEventsRes] = await Promise.allSettled([
        api.getHealth(),
        api.searchProducts(''),
        api.getTrackedProducts(),
        api.getAlerts(),
        api.getStructureHealth()
      ]);

      if (healthRes.status === 'fulfilled') setBackendHealth(healthRes.value);
      if (prodRes.status === 'fulfilled') setProducts(prodRes.value.products || []);
      if (trackedRes.status === 'fulfilled') {
        const list = trackedRes.value.tracked || [];
        setTrackedProducts(list);
        if (list.length > 0 && !selectedProductId) {
          setSelectedProductId(list[0].product_id);
        }
      }
      if (alertsRes.status === 'fulfilled') setAlerts(alertsRes.value.alerts || []);
      if (healthEventsRes.status === 'fulfilled') setStructureHealth(healthEventsRes.value.history || []);
    } finally {
      setIsLoadingCatalog(false);
    }
  };

  const refreshHealthAndAlerts = async () => {
    try {
      const [health, alertsRes] = await Promise.all([
        api.getHealth().catch(() => null),
        api.getAlerts().catch(() => ({ alerts: [] }))
      ]);
      if (health) setBackendHealth(health);
      if (alertsRes) setAlerts(alertsRes.alerts || []);
    } catch {
      // Quiet background refresh failure
    }
  };

  const loadProductDetails = async (productId) => {
    setIsLoadingDetails(true);
    try {
      const [histRes, logsRes] = await Promise.all([
        api.getPriceHistory(productId).catch(() => ({ history: [], stats: null })),
        api.getScrapeLogs(productId).catch(() => ({ logs: [] }))
      ]);
      setSelectedHistory(histRes.history || []);
      setSelectedStats(histRes.stats || null);
      setSelectedLogs(logsRes.logs || []);
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const handleTrackProduct = async (productId, frequencyHours, targetPrice) => {
    await api.trackProduct(productId, frequencyHours, targetPrice);
    const trackedRes = await api.getTrackedProducts();
    setTrackedProducts(trackedRes.tracked || []);
    setSelectedProductId(productId);
    setActiveTab('chart');
  };

  const handleUntrackProduct = async (productId) => {
    await api.untrackProduct(productId);
    const updated = trackedProducts.filter(t => t.product_id !== productId);
    setTrackedProducts(updated);
    if (selectedProductId === productId) {
      setSelectedProductId(updated.length > 0 ? updated[0].product_id : null);
    }
  };

  const handleScrapeSingle = async (productId) => {
    await api.triggerSingleScrape(productId);
    // Refresh tracked list and detail view
    const trackedRes = await api.getTrackedProducts();
    setTrackedProducts(trackedRes.tracked || []);
    if (selectedProductId === productId) {
      await loadProductDetails(productId);
    }
  };

  const handleTriggerBatchScrape = async () => {
    setIsScrapingBatch(true);
    try {
      await api.triggerBatchScrape();
      const trackedRes = await api.getTrackedProducts();
      setTrackedProducts(trackedRes.tracked || []);
      if (selectedProductId) {
        await loadProductDetails(selectedProductId);
      }
      refreshHealthAndAlerts();
    } finally {
      setIsScrapingBatch(false);
    }
  };

  const handleSelectTab = (productId, tab) => {
    setSelectedProductId(productId);
    setActiveTab(tab);
    // Smooth scroll to the details viewer
    const el = document.getElementById('details-section');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  const handleMarkAlertRead = async (alertId) => {
    await api.markAlertRead(alertId);
    setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, read: true } : a));
  };

  const selectedProduct = trackedProducts.find(t => t.product_id === selectedProductId)?.product;
  const unreadAlertsCount = alerts.filter(a => !a.read).length;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Navbar */}
      <Navbar
        backendHealth={backendHealth}
        isScrapingBatch={isScrapingBatch}
        onTriggerBatchScrape={handleTriggerBatchScrape}
        unreadAlertsCount={unreadAlertsCount}
        onOpenAlerts={() => setIsAlertsOpen(true)}
        onRefreshData={loadInitialData}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Architecture & Reliability Banner */}
        <div className="mb-8 p-6 rounded-2xl bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white shadow-xl">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="max-w-2xl">
              <span className="text-xs uppercase font-bold tracking-widest text-blue-300 mb-1.5 block">
                Production-Grade Scraping Engine
              </span>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight leading-tight">
                Product Price Tracker & Scrape Reliability Audit
              </h1>
              <p className="text-sm text-slate-300 mt-2 leading-relaxed">
                Automated 2-hour unattended price & stock scraping designed for sleeping free-tier backends.
                Features anti-obfuscation parsing, exponential backoff retries, and honest failure logging.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div className="bg-white/10 backdrop-blur rounded-xl p-3 border border-white/10">
                <div className="flex items-center gap-1.5 text-blue-300 font-semibold mb-1">
                  <Clock className="w-3.5 h-3.5" />
                  <span>2h Interval</span>
                </div>
                <p className="text-[11px] text-slate-300">cron-job.org HTTP trigger</p>
              </div>

              <div className="bg-white/10 backdrop-blur rounded-xl p-3 border border-white/10">
                <div className="flex items-center gap-1.5 text-emerald-300 font-semibold mb-1">
                  <Zap className="w-3.5 h-3.5" />
                  <span>Hybrid Scraper</span>
                </div>
                <p className="text-[11px] text-slate-300">HTTP + Playwright fallback</p>
              </div>

              <div className="bg-white/10 backdrop-blur rounded-xl p-3 border border-white/10 col-span-2 sm:col-span-1">
                <div className="flex items-center gap-1.5 text-amber-300 font-semibold mb-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Honest Audit</span>
                </div>
                <p className="text-[11px] text-slate-300">Zero fake data on failure</p>
              </div>
            </div>
          </div>
        </div>

        {/* Structure Change Alert Banner */}
        <StructureChangeAlert healthEvents={structureHealth} />

        {/* Section 1: Discover & Track Products */}
        <ProductSearch
          products={products}
          trackedProducts={trackedProducts}
          onTrackProduct={handleTrackProduct}
          isLoading={isLoadingCatalog}
        />

        {/* Section 2: Tracked Products Dashboard */}
        <div className="mb-10">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Layers className="w-5 h-5 text-blue-600" />
                <span>Tracked Products ({trackedProducts.length})</span>
              </h2>
              <p className="text-xs text-slate-500">
                Actively monitored items scraped every 2 hours via cron.
              </p>
            </div>
          </div>

          {trackedProducts.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-500 shadow-sm">
              <Database className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <h3 className="font-bold text-slate-800 text-sm">No Tracked Products Yet</h3>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                Search for products in the catalog above and click "Track" to begin monitoring price and stock history.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {trackedProducts.map((item) => (
                <TrackedProductCard
                  key={item.product_id}
                  trackedItem={item}
                  onScrapeNow={handleScrapeSingle}
                  onUntrack={handleUntrackProduct}
                  isSelected={selectedProductId === item.product_id}
                  onSelectTab={handleSelectTab}
                  activeTab={activeTab}
                />
              ))}
            </div>
          )}
        </div>

        {/* Section 3: Detailed History & Scrape Audit Section */}
        {selectedProductId && (
          <div id="details-section" className="scroll-mt-20">
            {/* View Switcher Tabs */}
            <div className="flex items-center gap-3 border-b border-slate-200 mb-6">
              <button
                onClick={() => setActiveTab('chart')}
                className={`pb-3 text-sm font-bold border-b-2 transition-colors ${
                  activeTab === 'chart'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                Price History Trend
              </button>
              <button
                onClick={() => setActiveTab('logs')}
                className={`pb-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${
                  activeTab === 'logs'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <span>Scrape Attempt Logs</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-mono">
                  {selectedLogs.length}
                </span>
              </button>
            </div>

            {activeTab === 'chart' ? (
              <PriceHistoryChart
                productData={selectedProduct}
                historyData={selectedHistory}
                stats={selectedStats}
                isLoading={isLoadingDetails}
              />
            ) : (
              <ScrapeLogsTable
                productData={selectedProduct}
                logs={selectedLogs}
                isLoading={isLoadingDetails}
              />
            )}
          </div>
        )}

      </main>

      {/* Alerts Slide-over */}
      <AlertsPanel
        isOpen={isAlertsOpen}
        onClose={() => setIsAlertsOpen(false)}
        alerts={alerts}
        onMarkRead={handleMarkAlertRead}
        onRefresh={refreshHealthAndAlerts}
      />

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-500">
        <p>INE Software Engineer Intern Assignment — Product Price Tracker</p>
        <p className="text-[11px] text-slate-400 mt-1">
          Scraping target: <a href="https://demo.inelabteamdev.com" target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-600">https://demo.inelabteamdev.com</a> · Unattended 2-Hour Scheduling · Supabase PostgreSQL
        </p>
      </footer>
    </div>
  );
}
