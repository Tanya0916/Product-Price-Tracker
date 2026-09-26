import React from 'react';
import { Activity, Bell, ExternalLink, Play, RefreshCw, ShieldCheck, Database } from 'lucide-react';

export default function Navbar({
  backendHealth,
  isScrapingBatch,
  onTriggerBatchScrape,
  unreadAlertsCount,
  onOpenAlerts,
  onRefreshData
}) {
  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Brand */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold shadow-md shadow-blue-500/20">
            <span className="text-xl">◧</span>
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-slate-900 tracking-tight text-lg">INE Price Tracker</span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                Reliable Scraper
              </span>
            </div>
            <p className="text-xs text-slate-500 hidden sm:block">
              2-Hour Unattended Scraping & Failure Audit
            </p>
          </div>
        </div>

        {/* Status & Actions */}
        <div className="flex items-center space-x-3 sm:space-x-4">
          {/* Health Status Indicator */}
          <div className="hidden md:flex items-center space-x-2 px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-xs">
            <span className={`w-2 h-2 rounded-full ${backendHealth?.status === 'UP' ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
            <span className="font-medium text-slate-600">
              {backendHealth?.status === 'UP' ? 'Backend Live' : 'Connecting...'}
            </span>
            <span className="text-slate-300">|</span>
            <Database className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-slate-500 font-mono text-[11px]">
              {backendHealth?.database === 'SUPABASE_POSTGRES' ? 'Supabase' : 'Local DB'}
            </span>
          </div>

          {/* Refresh Dashboard Button */}
          <button
            onClick={onRefreshData}
            title="Refresh dashboard data"
            className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {/* Trigger Scheduled Scrape Button */}
          <button
            onClick={onTriggerBatchScrape}
            disabled={isScrapingBatch}
            className={`inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold shadow-sm transition-all ${
              isScrapingBatch
                ? 'bg-blue-100 text-blue-700 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/20 active:scale-95'
            }`}
          >
            {isScrapingBatch ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Scraping Active...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Run Scraper Now</span>
              </>
            )}
          </button>

          {/* Alerts Button */}
          <button
            onClick={onOpenAlerts}
            className="relative p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            title="Price & System Alerts"
          >
            <Bell className="w-5 h-5" />
            {unreadAlertsCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center">
                {unreadAlertsCount > 9 ? '9+' : unreadAlertsCount}
              </span>
            )}
          </button>

          {/* External Mock Store Link */}
          <a
            href="https://demo.inelabteamdev.com"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            title="Open INE Mock Store in new tab"
          >
            <span>Target Store</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>

        </div>

      </div>
    </header>
  );
}
