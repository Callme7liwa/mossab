import React from 'react';

interface Props {
  town?: string;
  propertyType?: string;
  status?: string;
  timeframe?: string;
  towns?: string[];
  onChange?: (values: { town?: string; propertyType?: string; status?: string; timeframe?: string }) => void;
}

export default function StickyFilterBar({
  towns = [],
  town,
  propertyType,
  status,
  timeframe,
  onChange,
}: Props) {
  const handle = (k: string, v: string) => {
    onChange?.({ town: k === 'town' ? v : town, propertyType: k === 'propertyType' ? v : propertyType, status: k === 'status' ? v : status, timeframe: k === 'timeframe' ? v : timeframe });
  };

  return (
    <div className="sticky top-4 z-20 bg-background/95 backdrop-blur-sm border border-border rounded-md p-3 flex gap-3 items-center">
      <div className="flex items-center gap-2">
        <label className="text-sm text-muted-foreground">Town</label>
        <select value={town || 'All'} onChange={(e) => handle('town', e.target.value)} className="rounded-md border px-2 py-1 text-sm bg-background">
          <option>All</option>
          {towns.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-2">
        <label className="text-sm text-muted-foreground">Property Type</label>
        <select value={propertyType || 'All'} onChange={(e) => handle('propertyType', e.target.value)} className="rounded-md border px-2 py-1 text-sm bg-background">
          <option>All</option>
          <option value="Single Family Residence">Single Family</option>
          <option value="Condominium">Condo</option>
          <option value="Multi Family">Multi-Family</option>
          <option value="Land">Land</option>
        </select>
      </div>

      <div className="flex items-center gap-2">
        <label className="text-sm text-muted-foreground">Status</label>
        <select value={status || 'All'} onChange={(e) => handle('status', e.target.value)} className="rounded-md border px-2 py-1 text-sm bg-background">
          <option>All</option>
          <option value="Active">Active</option>
          <option value="Pending">Pending</option>
          <option value="Active Under Contract">Under Contract</option>
          <option value="Closed">Closed</option>
          <option value="Withdrawn">Withdrawn</option>
        </select>
      </div>

      <div className="flex items-center gap-2">
        <label className="text-sm text-muted-foreground">Timeframe</label>
        <select value={timeframe || '12m'} onChange={(e) => handle('timeframe', e.target.value)} className="rounded-md border px-2 py-1 text-sm bg-background">
          <option value="3m">Last 3 months</option>
          <option value="6m">Last 6 months</option>
          <option value="12m">Last 12 months</option>
          <option value="24m">Last 24 months</option>
        </select>
      </div>
    </div>
  );
}
