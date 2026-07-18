import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import client from '../api/client';
import type { LOB } from '../types';
import {
  FileText, Download, Filter, Calendar, FileSpreadsheet, FileType,
  CheckCircle2, Loader2, AlertCircle, ChevronDown
} from 'lucide-react';

type ExportFormat = 'csv' | 'xlsx' | 'pdf';

interface ReportConfig {
  id: string;
  name: string;
  description: string;
  endpoint: string;
  icon: React.ReactNode;
  supportsFormat: ExportFormat[];
}

const REPORTS: ReportConfig[] = [
  {
    id: 'full',
    name: 'Full Database Report',
    description: 'Complete export of all evaluation records with all fields.',
    endpoint: '/api/reports/full-report',
    icon: <FileText size={20} color="#818cf8" />,
    supportsFormat: ['csv', 'xlsx', 'pdf'],
  },
  {
    id: 'summary',
    name: 'Summary Report',
    description: 'Scored evaluations with CTQ comparisons (AI vs Human).',
    endpoint: '/api/reports/summary-report',
    icon: <FileSpreadsheet size={20} color="#34d399" />,
    supportsFormat: ['csv', 'xlsx', 'pdf'],
  },
  {
    id: 'ai-analysis',
    name: 'Detailed AI Analysis',
    description: 'In-depth analysis of AI evaluation predictions.',
    endpoint: '/api/reports/detailed-ai-analysis',
    icon: <FileType size={20} color="#a78bfa" />,
    supportsFormat: ['csv'],
  },
  {
    id: 'ai-perf',
    name: 'AI Performance Report',
    description: 'Cases where AI and human evaluations diverged.',
    endpoint: '/api/reports/ai-performance',
    icon: <AlertCircle size={20} color="#fbbf24" />,
    supportsFormat: ['csv'],
  },
];

const FORMAT_LABELS: Record<ExportFormat, { label: string; ext: string; color: string; bg: string }> = {
  csv: { label: 'CSV', ext: 'csv', color: '#34d399', bg: 'rgba(52,211,153,0.08)' },
  xlsx: { label: 'Excel', ext: 'xlsx', color: '#60a5fa', bg: 'rgba(59,130,246,0.08)' },
  pdf: { label: 'PDF', ext: 'pdf', color: '#f87171', bg: 'rgba(239,68,68,0.08)' },
};

const ReportsPage = () => {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [lobId, setLobId] = useState<number | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  const { data: lobs } = useQuery<LOB[]>({
    queryKey: ['lobs'],
    queryFn: async () => {
      const response = await client.get('/api/lobs');
      return response.data;
    },
  });

  const handleDownload = useCallback(async (report: ReportConfig, format: ExportFormat) => {
    const downloadKey = `${report.id}-${format}`;
    setDownloading(downloadKey);
    try {
      const params = new URLSearchParams();
      params.set('format', format);
      if (dateFrom) params.set('date_from', dateFrom);
      if (dateTo) params.set('date_to', dateTo);
      if (lobId) params.set('lob_id', String(lobId));

      const response = await client.get(`${report.endpoint}?${params.toString()}`, {
        responseType: 'blob',
      });

      const ext = FORMAT_LABELS[format].ext;
      const filename = `${report.id}_report_${new Date().toISOString().split('T')[0]}.${ext}`;

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error downloading report', err);
    } finally {
      setDownloading(null);
    }
  }, [dateFrom, dateTo, lobId]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }} className="animate-page">
      {/* Header */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--tx-1)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <FileText size={24} color="var(--accent)" /> Reports
        </h1>
        <p style={{ fontSize: 13, color: 'var(--tx-3)' }}>
          Generate, filter, and download audit reports in multiple formats.
        </p>
      </div>

      {/* Filters */}
      <div style={{ background: 'var(--bg-s1)', borderRadius: '16px', border: '1px solid var(--border)', padding: '20px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--tx-2)' }}>
            <Filter size={16} color="var(--accent)" />
            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--tx-1)' }}>Report Filters</span>
          </div>

          {/* Date Range */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calendar size={14} color="var(--tx-3)" />
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              style={{
                colorScheme: 'dark', padding: '6px 12px', background: 'var(--bg-s2)',
                border: '1px solid var(--border)', borderRadius: '8px', fontSize: '12px',
                color: 'var(--tx-1)', outline: 'none'
              }}
            />
            <span style={{ fontSize: '12px', color: 'var(--tx-3)' }}>to</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              style={{
                colorScheme: 'dark', padding: '6px 12px', background: 'var(--bg-s2)',
                border: '1px solid var(--border)', borderRadius: '8px', fontSize: '12px',
                color: 'var(--tx-1)', outline: 'none'
              }}
            />
          </div>

          {/* LOB Selector */}
          <div style={{ position: 'relative', minWidth: '160px' }}>
            <select
              value={lobId || ''}
              onChange={(e) => setLobId(e.target.value ? Number(e.target.value) : null)}
              style={{
                width: '100%', appearance: 'none', padding: '8px 32px 8px 12px',
                background: 'var(--bg-s2)', border: '1px solid var(--border)', borderRadius: '8px',
                fontSize: '12px', color: 'var(--tx-1)', outline: 'none'
              }}
            >
              <option value="" style={{ background: 'var(--bg-s1)' }}>All LOBs</option>
              {lobs?.map((lob) => (
                <option key={lob.id} value={lob.id} style={{ background: 'var(--bg-s1)' }}>{lob.name}</option>
              ))}
            </select>
            <ChevronDown size={14} color="var(--tx-3)" style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
          </div>

          {/* Reset */}
          {(dateFrom || dateTo || lobId) && (
            <button
              onClick={() => { setDateFrom(''); setDateTo(''); setLobId(null); }}
              style={{
                fontSize: '11px', fontWeight: 700, color: 'var(--accent)', background: 'none',
                border: 'none', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.5px'
              }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--accent-h)'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--accent)'}
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Report Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '24px' }}>
        {REPORTS.map((report) => (
          <div
            key={report.id}
            className="ds-card"
            style={{ transition: 'transform 200ms', cursor: 'default' }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.borderColor = 'var(--border-h)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = 'none';
              e.currentTarget.style.borderColor = 'var(--border)';
            }}
          >
            <div style={{ padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                <div style={{ padding: '12px', background: 'var(--bg-s2)', border: '1px solid var(--border)', borderRadius: '12px' }}>
                  {report.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--tx-1)' }}>{report.name}</h3>
                  <p style={{ fontSize: '12px', color: 'var(--tx-2)', marginTop: '4px', lineHeight: 1.5 }}>{report.description}</p>
                </div>
              </div>
            </div>

            <div style={{ padding: '0 24px 24px' }}>
              <p style={{ fontSize: '10px', fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>
                Export As
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {report.supportsFormat.map((format) => {
                  const downloadKey = `${report.id}-${format}`;
                  const isDownloading = downloading === downloadKey;
                  const formatInfo = FORMAT_LABELS[format];

                  return (
                    <button
                      key={format}
                      onClick={() => handleDownload(report, format)}
                      disabled={isDownloading}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px',
                        borderRadius: '8px', border: `1px solid ${formatInfo.color}33`,
                        background: formatInfo.bg, color: formatInfo.color,
                        fontSize: '11px', fontWeight: 700, cursor: isDownloading ? 'not-allowed' : 'pointer',
                        opacity: isDownloading ? 0.5 : 1, transition: 'all 150ms'
                      }}
                      onMouseEnter={e => {
                        if (!isDownloading) {
                          e.currentTarget.style.background = `${formatInfo.bg.replace('0.08', '0.15')}`;
                        }
                      }}
                      onMouseLeave={e => {
                        if (!isDownloading) {
                          e.currentTarget.style.background = formatInfo.bg;
                        }
                      }}
                    >
                      {isDownloading ? (
                        <Loader2 size={14} className="spin-anim" />
                      ) : (
                        <Download size={14} />
                      )}
                      {formatInfo.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Info */}
      <div style={{
        background: 'var(--accent-m-bg)', border: '1px solid var(--accent-border)',
        borderRadius: '16px', padding: '20px', display: 'flex', alignItems: 'flex-start', gap: '12px'
      }}>
        <CheckCircle2 size={20} color="var(--accent)" style={{ marginTop: '2px' }} />
        <div>
          <p style={{ fontSize: '13px', fontWeight: 800, color: 'var(--accent-h)' }}>Report Generation</p>
          <p style={{ fontSize: '12px', color: 'var(--tx-2)', marginTop: '4px', lineHeight: 1.5 }}>
            Reports are generated server-side. Date and LOB filters apply to all report types.
            Excel and PDF exports include styled formatting for easy reading.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ReportsPage;
