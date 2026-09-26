import React, { useState } from 'react';
import { 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine 
} from 'recharts';
import { TrendingDown, TrendingUp, DollarSign, Calendar, Table as TableIcon, Activity } from 'lucide-react';

export default function PriceHistoryChart({
  productData,
  historyData,
  stats,
  isLoading
}) {
  const [viewMode, setViewMode] = useState('chart'); // 'chart' | 'table'

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-400">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        Loading price history...
      </div>
    );
  }

  if (!historyData || historyData.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-500">
        <Activity className="w-10 h-10 text-slate-300 mx-auto mb-3" />
        <h4 className="font-semibold text-slate-800 text-sm">No Price History Yet</h4>
        <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
          Scrape data will appear here once the scheduled scraper runs or when you click "Scrape Now".
        </p>
      </div>
    );
  }

  // Format data for Recharts
  const chartData = historyData.map((item) => {
    const d = new Date(item.scraped_at);
    return {
      timestamp: item.scraped_at,
      label: d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + 
             d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      price: Number(item.price),
      mrp: item.mrp ? Number(item.mrp) : null,
      stockStatus: item.stock_status,
      stockCount: item.stock_count,
      discountPct: item.discount_pct
    };
  });

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-900 text-white text-xs rounded-xl p-3 shadow-xl border border-slate-800">
          <p className="text-slate-400 text-[10px] mb-1">{data.label}</p>
          <p className="text-lg font-bold text-emerald-400">
            ₹{data.price.toLocaleString('en-IN')}
          </p>
          {data.mrp && (
            <p className="text-slate-400 line-through text-[11px]">
              MRP: ₹{data.mrp.toLocaleString('en-IN')} ({data.discountPct}% off)
            </p>
          )}
          <p className="text-slate-300 text-[11px] mt-1 flex items-center gap-1">
            <span className={`w-1.5 h-1.5 rounded-full ${data.stockStatus === 'OUT_OF_STOCK' ? 'bg-rose-400' : 'bg-emerald-400'}`} />
            {data.stockStatus} {data.stockCount !== null ? `(${data.stockCount} left)` : ''}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm mb-6">
      {/* Chart Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-slate-900 text-base">
              Price History: {productData?.name}
            </h3>
            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-semibold">
              {historyData.length} observations
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Verified prices recorded by scheduled and on-demand scrapes.
          </p>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-semibold">
          <button
            onClick={() => setViewMode('chart')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              viewMode === 'chart' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Chart View
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              viewMode === 'table' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Table View
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
          <span className="text-[11px] font-medium text-slate-500 block">Current Price</span>
          <span className="text-lg font-bold text-slate-900">
            ₹{stats?.currentPrice?.toLocaleString('en-IN') ?? '—'}
          </span>
        </div>
        <div className="bg-emerald-50/60 border border-emerald-100 rounded-xl p-3">
          <span className="text-[11px] font-medium text-emerald-700 block">Lowest Price</span>
          <span className="text-lg font-bold text-emerald-700">
            ₹{stats?.minPrice?.toLocaleString('en-IN') ?? '—'}
          </span>
        </div>
        <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
          <span className="text-[11px] font-medium text-slate-500 block">Highest Price</span>
          <span className="text-lg font-bold text-slate-900">
            ₹{stats?.maxPrice?.toLocaleString('en-IN') ?? '—'}
          </span>
        </div>
        <div className="bg-slate-50 border border-slate-100 rounded-xl p-3">
          <span className="text-[11px] font-medium text-slate-500 block">Average Price</span>
          <span className="text-lg font-bold text-slate-900">
            ₹{stats?.averagePrice?.toLocaleString('en-IN') ?? '—'}
          </span>
        </div>
      </div>

      {/* View Content */}
      {viewMode === 'chart' ? (
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis 
                dataKey="label" 
                tick={{ fontSize: 11, fill: '#64748b' }} 
                stroke="#cbd5e1" 
              />
              <YAxis 
                tick={{ fontSize: 11, fill: '#64748b' }} 
                stroke="#cbd5e1"
                domain={['auto', 'auto']}
                tickFormatter={(val) => `₹${val}`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area 
                type="monotone" 
                dataKey="price" 
                stroke="#2563eb" 
                strokeWidth={2.5} 
                fillOpacity={1} 
                fill="url(#priceGradient)" 
                dot={{ r: 3.5, fill: '#2563eb', strokeWidth: 1, stroke: '#ffffff' }}
                activeDot={{ r: 6, fill: '#1d4ed8' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      ) : (
        /* Table View */
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 font-semibold">
                <th className="py-2.5 px-3">Date & Time</th>
                <th className="py-2.5 px-3">Price</th>
                <th className="py-2.5 px-3">MRP</th>
                <th className="py-2.5 px-3">Discount</th>
                <th className="py-2.5 px-3">Stock Status</th>
                <th className="py-2.5 px-3">Units Left</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {historyData.slice().reverse().map((row, idx) => (
                <tr key={row.id || idx} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-2.5 px-3 font-mono text-slate-600">
                    {new Date(row.scraped_at).toLocaleString()}
                  </td>
                  <td className="py-2.5 px-3 font-bold text-slate-900">
                    ₹{Number(row.price).toLocaleString('en-IN')}
                  </td>
                  <td className="py-2.5 px-3 text-slate-400 line-through">
                    {row.mrp ? `₹${Number(row.mrp).toLocaleString('en-IN')}` : '—'}
                  </td>
                  <td className="py-2.5 px-3 font-semibold text-emerald-600">
                    {row.discount_pct ? `${row.discount_pct}% off` : '—'}
                  </td>
                  <td className="py-2.5 px-3">
                    <span className={`inline-flex items-center gap-1 font-semibold ${
                      row.stock_status === 'OUT_OF_STOCK' ? 'text-rose-600' : 'text-emerald-700'
                    }`}>
                      {row.stock_status}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 font-mono text-slate-600">
                    {row.stock_count ?? 'N/A'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
