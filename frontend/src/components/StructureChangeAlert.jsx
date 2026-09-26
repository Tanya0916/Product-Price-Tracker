import React from 'react';
import { ShieldAlert, AlertCircle } from 'lucide-react';

export default function StructureChangeAlert({ healthEvents }) {
  const shifted = (healthEvents || []).filter(h => h.status === 'SHIFTED' || h.status === 'BROKEN');
  if (shifted.length === 0) return null;

  return (
    <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 shadow-xs">
      <div className="flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="text-xs">
          <p className="font-bold text-amber-950">Store Page Structure Change Detected</p>
          <p className="text-amber-800 mt-0.5">
            The scraper noticed changes in mock store DOM selectors:
          </p>
          <ul className="list-disc list-inside mt-1.5 space-y-0.5 font-mono text-[11px] text-amber-900">
            {shifted.map((item, idx) => (
              <li key={idx}>
                {item.selector_name}: {item.notes || 'Selector shifted or missing'}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
