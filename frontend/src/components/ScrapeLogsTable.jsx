import React from 'react';
import { CheckCircle2, AlertCircle, RefreshCw, Clock, Cpu, ShieldAlert } from 'lucide-react';

export default function ScrapeLogsTable({
  productData,
  logs,
  isLoading
}) {
  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-slate-400">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        Loading scrape logs...
      </div>
    );
  }

  const getStatusBadge = (status) => {
    switch (status) {
      case 'SUCCESS':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            SUCCESS
          </span>
        );
      case 'RETRIED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800">
            <RefreshCw className="w-3.5 h-3.5 text-amber-600" />
            RETRIED
          </span>
        );
      case 'FAILED':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800">
            <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
            FAILED
          </span>
        );
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm mb-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-slate-900 text-base">
              Scrape Audit Logs: {productData?.name}
            </h3>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-semibold">
              {logs.length} attempts
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Honest logging of every scheduled and manual run. Failures and retries are explicitly recorded.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="flex items-center gap-1 text-slate-500">
            <span className="w-2 h-2 rounded-full bg-emerald-500" /> Success
          </span>
          <span className="flex items-center gap-1 text-slate-500">
            <span className="w-2 h-2 rounded-full bg-amber-500" /> Retried
          </span>
          <span className="flex items-center gap-1 text-slate-500">
            <span className="w-2 h-2 rounded-full bg-rose-500" /> Failed
          </span>
        </div>
      </div>

      {logs.length === 0 ? (
        <div className="py-8 text-center text-slate-400 text-xs italic">
          No scrape attempts logged yet.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 font-semibold bg-slate-50/50">
                <th className="py-2.5 px-3">Timestamp</th>
                <th className="py-2.5 px-3">Outcome</th>
                <th className="py-2.5 px-3">Attempt #</th>
                <th className="py-2.5 px-3">Scraper Engine</th>
                <th className="py-2.5 px-3">Duration</th>
                <th className="py-2.5 px-3">Error / Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.map((log, idx) => (
                <tr key={log.id || idx} className="hover:bg-slate-50/80 transition-colors">
                  <td className="py-3 px-3 font-mono text-slate-600 whitespace-nowrap">
                    {new Date(log.started_at).toLocaleString()}
                  </td>
                  <td className="py-3 px-3 whitespace-nowrap">
                    {getStatusBadge(log.status)}
                  </td>
                  <td className="py-3 px-3 font-semibold text-slate-700">
                    Attempt {log.attempt}
                  </td>
                  <td className="py-3 px-3">
                    <span className="inline-flex items-center gap-1 font-mono text-[11px] px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                      <Cpu className="w-3 h-3 text-slate-400" />
                      {log.scraper_type || 'HTTP'}
                    </span>
                  </td>
                  <td className="py-3 px-3 font-mono text-slate-600 whitespace-nowrap">
                    {log.duration_ms ? `${log.duration_ms} ms` : '—'}
                  </td>
                  <td className="py-3 px-3 max-w-xs truncate text-slate-600">
                    {log.error_message ? (
                      <span className="text-rose-600 font-mono text-[11px] bg-rose-50 px-2 py-0.5 rounded" title={log.error_message}>
                        {log.error_message}
                      </span>
                    ) : (
                      <span className="text-slate-400">Scrape completed normally</span>
                    )}
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
