import React, { useState } from 'react';
import { X, TrendingDown, PackageCheck, AlertTriangle, ShieldAlert, Check } from 'lucide-react';

export default function AlertsPanel({
  isOpen,
  onClose,
  alerts,
  onMarkRead,
  onRefresh
}) {
  const [filterUnread, setFilterUnread] = useState(false);

  if (!isOpen) return null;

  const filtered = filterUnread ? alerts.filter(a => !a.read) : alerts;

  const getAlertIcon = (type) => {
    switch (type) {
      case 'PRICE_DROP':
        return <TrendingDown className="w-5 h-5 text-emerald-600" />;
      case 'BACK_IN_STOCK':
        return <PackageCheck className="w-5 h-5 text-blue-600" />;
      case 'STRUCTURE_CHANGE':
        return <ShieldAlert className="w-5 h-5 text-amber-600" />;
      case 'SCRAPE_FAILURE':
      default:
        return <AlertTriangle className="w-5 h-5 text-rose-600" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-sm flex justify-end">
      <div className="bg-white w-full max-w-md h-full shadow-2xl flex flex-col animate-slide-left border-l border-slate-200">
        
        {/* Panel Header */}
        <div className="p-5 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">Notifications & Alerts</h3>
            <p className="text-xs text-slate-500">Price drops, restocks, and scraper health events</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Bar */}
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-xs">
          <span className="font-medium text-slate-600">
            {filtered.length} {filterUnread ? 'Unread' : 'Total'} Events
          </span>
          <button
            onClick={() => setFilterUnread(!filterUnread)}
            className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
              filterUnread ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
            }`}
          >
            {filterUnread ? 'Show All' : 'Only Unread'}
          </button>
        </div>

        {/* Alerts List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {filtered.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-xs">
              No alerts to display. Everything is running smoothly.
            </div>
          ) : (
            filtered.map((alert) => (
              <div
                key={alert.id}
                className={`p-3.5 rounded-xl border transition-all ${
                  alert.read 
                    ? 'bg-white border-slate-200 opacity-75' 
                    : 'bg-blue-50/50 border-blue-200 shadow-sm'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 p-1.5 rounded-lg bg-white border border-slate-100 shadow-xs">
                    {getAlertIcon(alert.type)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                        {alert.type.replace(/_/g, ' ')}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {new Date(alert.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-xs font-medium text-slate-800 leading-snug">
                      {alert.message}
                    </p>

                    {!alert.read && (
                      <button
                        onClick={() => onMarkRead(alert.id)}
                        className="mt-2 text-[11px] font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1"
                      >
                        <Check className="w-3 h-3" />
                        Mark as read
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

      </div>
    </div>
  );
}
