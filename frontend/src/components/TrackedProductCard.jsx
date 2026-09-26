import React, { useState } from 'react';
import { 
  TrendingDown, TrendingUp, RefreshCw, AlertCircle, CheckCircle2, 
  Clock, Package, Trash2, LineChart, FileText, ChevronDown, ChevronUp, ExternalLink 
} from 'lucide-react';

export default function TrackedProductCard({
  trackedItem,
  onScrapeNow,
  onUntrack,
  isSelected,
  onSelectTab,
  activeTab
}) {
  const [isScraping, setIsScraping] = useState(false);
  const { product, latestPrice, latestLog, frequency_hours, target_price } = trackedItem;

  const handleScrapeClick = async (e) => {
    e.stopPropagation();
    setIsScraping(true);
    try {
      await onScrapeNow(trackedItem.product_id);
    } finally {
      setIsScraping(false);
    }
  };

  const getStockBadge = (status, count) => {
    if (status === 'OUT_OF_STOCK') {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-700">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
          Out of Stock
        </span>
      );
    }
    if (status === 'LOW_STOCK') {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
          Low Stock {count !== null ? `(${count} left)` : ''}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        In Stock {count !== null ? `(${count} units)` : ''}
      </span>
    );
  };

  const formatScrapeTime = (isoString) => {
    if (!isoString) return 'Pending initial scrape';
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + 
           ' (' + date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ')';
  };

  return (
    <div className={`bg-white border rounded-2xl p-5 transition-all shadow-sm ${
      isSelected ? 'border-blue-500 ring-2 ring-blue-500/10 shadow-md' : 'border-slate-200 hover:border-slate-300'
    }`}>
      {/* Top Meta Header */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 text-slate-600">
            {product?.category || 'General'}
          </span>
          <span className="text-xs font-mono text-slate-400">
            {product?.sku || `#${trackedItem.product_id}`}
          </span>
        </div>

        <div className="flex items-center gap-1 text-slate-400">
          <button
            onClick={() => onUntrack(trackedItem.product_id)}
            title="Untrack this product"
            className="p-1.5 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Title & Brand */}
      <div className="mb-4">
        <h3 className="font-bold text-slate-900 text-base leading-snug line-clamp-1">
          {product?.name || `Product #${trackedItem.product_id}`}
        </h3>
        <p className="text-xs text-slate-500 mt-0.5">
          {product?.brand} · Scrapes every {frequency_hours || 2}h
        </p>
      </div>

      {/* Price & Stock Display Area */}
      <div className="bg-slate-50 border border-slate-100 rounded-xl p-3.5 mb-4">
        <div className="flex items-baseline justify-between mb-2">
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 tracking-tight">
              {latestPrice?.price ? `₹${Number(latestPrice.price).toLocaleString('en-IN')}` : '—'}
            </span>
            {latestPrice?.mrp && Number(latestPrice.mrp) > Number(latestPrice.price) && (
              <span className="text-xs text-slate-400 line-through">
                ₹{Number(latestPrice.mrp).toLocaleString('en-IN')}
              </span>
            )}
            {latestPrice?.discount_pct && (
              <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                {latestPrice.discount_pct}% off
              </span>
            )}
          </div>

          <div>
            {latestPrice ? (
              getStockBadge(latestPrice.stock_status, latestPrice.stock_count)
            ) : (
              <span className="text-xs text-slate-400 italic">No price data</span>
            )}
          </div>
        </div>

        {/* Audit Status line */}
        <div className="flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-200/60 pt-2.5 mt-2">
          <div className="flex items-center gap-1.5">
            <Clock className="w-3 h-3 text-slate-400" />
            <span>{formatScrapeTime(trackedItem.last_scraped_at || latestPrice?.scraped_at)}</span>
          </div>

          <div>
            {latestLog ? (
              <span className={`inline-flex items-center gap-1 font-semibold ${
                latestLog.status === 'SUCCESS' ? 'text-emerald-600' : 'text-rose-600'
              }`}>
                {latestLog.status === 'SUCCESS' ? (
                  <CheckCircle2 className="w-3 h-3" />
                ) : (
                  <AlertCircle className="w-3 h-3" />
                )}
                {latestLog.status} ({latestLog.scraper_type})
              </span>
            ) : (
              <span className="text-slate-400">No logs yet</span>
            )}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleScrapeClick}
          disabled={isScraping}
          className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-semibold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 active:scale-95 transition-all"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isScraping ? 'animate-spin text-blue-600' : ''}`} />
          <span>{isScraping ? 'Scraping...' : 'Scrape Now'}</span>
        </button>

        <button
          onClick={() => onSelectTab(trackedItem.product_id, 'chart')}
          className={`inline-flex items-center gap-1.5 py-2 px-3 text-xs font-semibold rounded-xl border transition-all ${
            isSelected && activeTab === 'chart'
              ? 'bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-500/20'
              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          <LineChart className="w-3.5 h-3.5" />
          <span>Price Chart</span>
        </button>

        <button
          onClick={() => onSelectTab(trackedItem.product_id, 'logs')}
          className={`inline-flex items-center gap-1.5 py-2 px-3 text-xs font-semibold rounded-xl border transition-all ${
            isSelected && activeTab === 'logs'
              ? 'bg-blue-600 text-white border-blue-600 shadow-sm shadow-blue-500/20'
              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Scrape Logs</span>
        </button>
      </div>
    </div>
  );
}
