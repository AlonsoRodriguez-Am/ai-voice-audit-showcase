import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Calendar, Filter, ChevronDown } from 'lucide-react';
import client from '../api/client';
import type { LOB, DashboardFilters as FiltersType } from '../types';

interface DashboardFiltersProps {
  filters: FiltersType;
  onChange: (filters: FiltersType) => void;
  onRefresh?: () => void;
}

const PRESET_RANGES = [
  { label: '7D', fullLabel: 'Last 7 Days', days: 7 },
  { label: '30D', fullLabel: 'Last 30 Days', days: 30 },
  { label: '90D', fullLabel: 'Last 90 Days', days: 90 },
  { label: 'YTD', fullLabel: 'Year to Date', days: -1 },
  { label: 'ALL', fullLabel: 'All Time', days: 0 },
];

const DashboardFiltersComponent = ({ filters, onChange }: DashboardFiltersProps) => {
  const [activePreset, setActivePreset] = useState<number | null>(0);

  const { data: lobs } = useQuery<LOB[]>({
    queryKey: ['lobs'],
    queryFn: async () => {
      const response = await client.get('/api/lobs');
      return response.data;
    },
  });

  const handlePresetClick = (days: number, index: number) => {
    setActivePreset(index);
    if (days === 0) {
      onChange({ ...filters, dateFrom: '', dateTo: '' });
    } else if (days === -1) {
      const ytd = new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0];
      onChange({ ...filters, dateFrom: ytd, dateTo: new Date().toISOString().split('T')[0] });
    } else {
      const from = new Date();
      from.setDate(from.getDate() - days);
      onChange({
        ...filters,
        dateFrom: from.toISOString().split('T')[0],
        dateTo: new Date().toISOString().split('T')[0],
      });
    }
  };

  return (
    <div style={{ background: 'var(--bg-s1)', borderRadius: 'var(--r-lg)', border: '1px solid var(--border)', padding: '12px 16px', marginBottom: 0 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '16px' }}>
        {/* Presets */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ padding: '6px', background: 'var(--bg-s2)', borderRadius: 'var(--r-sm)', color: 'var(--tx-3)', display: 'flex', alignItems: 'center' }}>
            <Filter size={14} />
          </div>
          <div style={{ display: 'flex', background: 'var(--bg-s2)', padding: '3px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)' }}>
            {PRESET_RANGES.map((preset, idx) => (
              <button
                key={preset.label}
                onClick={() => handlePresetClick(preset.days, idx)}
                title={preset.fullLabel}
                style={{
                  padding: '4px 10px', borderRadius: 'var(--r-sm)', fontSize: '10px', fontWeight: 800,
                  transition: 'all 200ms', textTransform: 'uppercase', letterSpacing: '0.5px',
                  border: 'none', cursor: 'pointer',
                  background: activePreset === idx ? 'var(--bg-s3)' : 'transparent',
                  color: activePreset === idx ? 'var(--accent)' : 'var(--tx-3)',
                  boxShadow: activePreset === idx ? '0 1px 2px rgba(0,0,0,0.1)' : 'none'
                }}
                onMouseEnter={e => {
                  if (activePreset !== idx) e.currentTarget.style.color = 'var(--tx-1)';
                }}
                onMouseLeave={e => {
                  if (activePreset !== idx) e.currentTarget.style.color = 'var(--tx-3)';
                }}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ height: '24px', width: '1px', background: 'var(--border)' }} />

        {/* Custom Range */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 10px',
            background: 'var(--bg-s2)', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', transition: 'all 200ms'
          }}>
            <Calendar size={14} color="var(--tx-3)" />
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => {
                setActivePreset(null);
                onChange({ ...filters, dateFrom: e.target.value });
              }}
              style={{
                colorScheme: 'dark', background: 'transparent', border: 'none', padding: 0,
                fontSize: '11px', fontWeight: 700, color: 'var(--tx-1)', outline: 'none', width: '106px'
              }}
            />
            <span style={{ color: 'var(--tx-3)', fontWeight: 700, fontSize: '9px' }}>TO</span>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => {
                setActivePreset(null);
                onChange({ ...filters, dateTo: e.target.value });
              }}
              style={{
                colorScheme: 'dark', background: 'transparent', border: 'none', padding: 0,
                fontSize: '11px', fontWeight: 700, color: 'var(--tx-1)', outline: 'none', width: '106px'
              }}
            />
          </div>
        </div>

        {/* LOB Selector */}
        <div style={{ position: 'relative', flex: 1, minWidth: '150px', maxWidth: '220px' }}>
          <select
            value={filters.lobId || ''}
            onChange={(e) => onChange({ ...filters, lobId: e.target.value ? Number(e.target.value) : null })}
            style={{
              width: '100%', appearance: 'none', padding: '8px 32px 8px 12px',
              background: 'var(--bg-s2)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)',
              fontSize: '11px', fontWeight: 700, color: 'var(--tx-1)', outline: 'none', transition: 'all 200ms'
            }}
          >
            <option value="" style={{ background: 'var(--bg-s1)' }}>All Lines of Business</option>
            {lobs?.map((lob) => (
              <option key={lob.id} value={lob.id} style={{ background: 'var(--bg-s1)' }}>{lob.name}</option>
            ))}
          </select>
          <ChevronDown size={14} color="var(--tx-3)" style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
        </div>

        {/* Period Toggle */}
        <div style={{ display: 'flex', background: 'var(--bg-s2)', padding: '3px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', marginLeft: 'auto' }}>
          <button
            onClick={() => onChange({ ...filters, period: 'week' })}
            style={{
              padding: '4px 12px', borderRadius: 'var(--r-sm)', fontSize: '10px', fontWeight: 800,
              transition: 'all 200ms', textTransform: 'uppercase', letterSpacing: '0.5px', border: 'none', cursor: 'pointer',
              background: filters.period === 'week' ? 'var(--bg-s3)' : 'transparent',
              color: filters.period === 'week' ? 'var(--accent)' : 'var(--tx-3)',
              boxShadow: filters.period === 'week' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none'
            }}
          >
            Weekly
          </button>
          <button
            onClick={() => onChange({ ...filters, period: 'month' })}
            style={{
              padding: '4px 12px', borderRadius: 'var(--r-sm)', fontSize: '10px', fontWeight: 800,
              transition: 'all 200ms', textTransform: 'uppercase', letterSpacing: '0.5px', border: 'none', cursor: 'pointer',
              background: filters.period === 'month' ? 'var(--bg-s3)' : 'transparent',
              color: filters.period === 'month' ? 'var(--accent)' : 'var(--tx-3)',
              boxShadow: filters.period === 'month' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none'
            }}
          >
            Monthly
          </button>
        </div>
      </div>
    </div>
  );
};

export default DashboardFiltersComponent;
