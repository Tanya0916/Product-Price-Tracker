import React, { useState } from 'react';
import { Search, Plus, Check, Clock, DollarSign, Tag, ShoppingBag, ExternalLink } from 'lucide-react';

export default function ProductSearch({
  products,
  trackedProducts,
  onTrackProduct,
  isLoading
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [trackingLoadingId, setTrackingLoadingId] = useState(null);
  const [showConfigModal, setShowConfigModal] = useState(null);
  const [frequencyHours, setFrequencyHours] = useState(2);
  const [targetPrice, setTargetPrice] = useState('');

  // Extract unique categories
  const categories = ['ALL', ...new Set(products.map(p => p.category).filter(Boolean))];

  // Filter products by search term and category
  const filtered = products.filter(p => {
    const matchesQuery = !searchTerm ||
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.brand && p.brand.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (p.sku && p.sku.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesCategory = selectedCategory === 'ALL' || p.category === selectedCategory;

    return matchesQuery && matchesCategory;
  });

  const isTracked = (productId) => {
    return trackedProducts.some(tp => tp.product_id === productId && tp.active);
  };

  const handleOpenTrackModal = (product) => {
    setShowConfigModal(product);
    setFrequencyHours(2);
    setTargetPrice('');
  };

  const handleConfirmTrack = async () => {
    if (!showConfigModal) return;
    const prodId = showConfigModal.id;
    setTrackingLoadingId(prodId);
    try {
      await onTrackProduct(prodId, frequencyHours, targetPrice ? parseFloat(targetPrice) : null);
      setShowConfigModal(null);
    } finally {
      setTrackingLoadingId(null);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm mb-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-blue-600" />
            <span>Discover & Track Products</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Search INE mock store catalog by partial or full name, then pick products to monitor on a schedule.
          </p>
        </div>

        {/* Search Bar */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search products, brands, SKU..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400"
          />
        </div>
      </div>

      {/* Category Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-4 scrollbar-none text-xs">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-3 py-1.5 rounded-lg font-medium whitespace-nowrap transition-colors ${
              selectedCategory === cat
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Product Results Grid */}
      {isLoading ? (
        <div className="py-12 text-center text-slate-400 text-sm">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          Querying INE mock store catalog...
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center text-slate-500 text-sm bg-slate-50 rounded-xl border border-dashed border-slate-200">
          No products found matching "{searchTerm}". Try a different search keyword.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((product) => {
            const tracked = isTracked(product.id);
            const isSubmitting = trackingLoadingId === product.id;

            return (
              <div
                key={product.id}
                className="group relative bg-white border border-slate-200 rounded-xl p-4 hover:border-blue-300 hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                      {product.category || 'General'}
                    </span>
                    <span className="text-[11px] font-mono text-slate-400">
                      {product.sku || `#${product.id}`}
                    </span>
                  </div>

                  <h3 className="font-semibold text-slate-900 text-sm leading-snug line-clamp-2 group-hover:text-blue-600 transition-colors">
                    {product.name}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">
                    {product.brand}
                  </p>
                </div>

                <div className="pt-4 mt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <a
                    href={product.url || `https://demo.inelabteamdev.com/product/${product.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-slate-400 hover:text-slate-700 flex items-center gap-1"
                    title="View live page on mock store"
                  >
                    <span>Store Page</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>

                  {tracked ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                      <Check className="w-3.5 h-3.5" />
                      Tracked
                    </span>
                  ) : (
                    <button
                      onClick={() => handleOpenTrackModal(product)}
                      disabled={isSubmitting}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:scale-95 px-3 py-1.5 rounded-lg shadow-sm shadow-blue-500/20 transition-all"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Track
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Track Product Configuration Modal */}
      {showConfigModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-1">
              Track "{showConfigModal.name}"
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Configure scraping frequency and optional target price threshold.
            </p>

            <div className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-blue-600" />
                  Scraping Frequency (Assignment default: 2 Hours)
                </label>
                <select
                  value={frequencyHours}
                  onChange={(e) => setFrequencyHours(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm"
                >
                  <option value={1}>Every 1 Hour (High Frequency)</option>
                  <option value={2}>Every 2 Hours (Standard Assignment Schedule)</option>
                  <option value={6}>Every 6 Hours</option>
                  <option value={12}>Every 12 Hours</option>
                  <option value={24}>Once Daily (24 Hours)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                  Target Price for Alerts (Optional ₹)
                </label>
                <input
                  type="number"
                  placeholder="e.g. 2500"
                  value={targetPrice}
                  onChange={(e) => setTargetPrice(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm placeholder:text-slate-400"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowConfigModal(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmTrack}
                disabled={trackingLoadingId !== null}
                className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md shadow-blue-500/25 active:scale-95 transition-all"
              >
                {trackingLoadingId !== null ? 'Setting up...' : 'Start Tracking & Scrape Now'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
