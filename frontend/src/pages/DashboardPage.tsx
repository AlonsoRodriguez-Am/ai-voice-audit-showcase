import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import client from '../api/client';
import type {
  DashboardMetrics, TrendDataPoint, CTQDistributionResponse,
  TopicTrendsResponse, DashboardFilters
} from '../types';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar
} from 'recharts';
import { Loader2, RefreshCw, Download, Filter, TrendingUp } from 'lucide-react';

// Components
import MetricsCards from '../components/MetricsCards';
import DashboardFiltersComponent from '../components/DashboardFilters';
import TrendLineChart from '../components/charts/TrendLineChart';
import DistributionPieChart from '../components/charts/DistributionPieChart';
import CTQBarChart from '../components/charts/CTQBarChart';
import TopicAreaChart from '../components/charts/TopicAreaChart';
import PageHeader from '../components/ui/PageHeader';


const DashboardPage = () => {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<DashboardFilters>({
    dateFrom: '',
    dateTo: '',
    lobId: null,
    period: 'week',
  });

  // Build query params from filters
  const filterParams = useMemo(() => {
    const params = new URLSearchParams();
    if (filters.dateFrom) params.set('date_from', filters.dateFrom);
    if (filters.dateTo) params.set('date_to', filters.dateTo);
    if (filters.lobId) params.set('lob_id', String(filters.lobId));
    params.set('period', filters.period);
    return params.toString();
  }, [filters]);

  // ── Queries ────────────────────────────────────────────────────────────────

  const { data: metrics, isLoading: metricsLoading } = useQuery<DashboardMetrics>({
    queryKey: ['dashboard-metrics', filterParams],
    queryFn: async () => {
      const response = await client.get(`/api/dashboard/metrics?${filterParams}`);
      return response.data;
    },
  });

  const { data: trends, isLoading: trendsLoading } = useQuery<TrendDataPoint[]>({
    queryKey: ['dashboard-trends', filterParams],
    queryFn: async () => {
      const response = await client.get(`/api/dashboard/trends?${filterParams}`);
      return response.data;
    },
  });

  const { data: ctqDist, isLoading: ctqLoading } = useQuery<CTQDistributionResponse>({
    queryKey: ['dashboard-ctq', filterParams],
    queryFn: async () => {
      const response = await client.get(`/api/dashboard/ctq-distribution?${filterParams}`);
      return response.data;
    },
  });

  const { data: topicTrends, isLoading: topicsLoading } = useQuery<TopicTrendsResponse>({
    queryKey: ['dashboard-topics', filterParams],
    queryFn: async () => {
      const response = await client.get(`/api/dashboard/topic-trends?${filterParams}`);
      return response.data;
    },
  });

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['dashboard-metrics'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard-trends'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard-ctq'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard-topics'] });
  };

  if (metricsLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            <div className="w-12 h-12 border-4 border-[var(--border)] border-t-[var(--accent)] rounded-full animate-spin"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="animate-pulse text-[var(--accent)]" size={20} />
            </div>
          </div>
          <p className="text-xs text-[var(--tx-3)] font-bold uppercase tracking-widest">Initialising Dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }} className="animate-page">
      {/* Header */}
      <PageHeader 
        title="Executive Dashboard" 
        subtitle="Advanced analytics and performance insights from AI auditing."
        actions={
          <div style={{ display: 'flex', gap: 12 }}>
            <button style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px',
              background: 'var(--bg-s2)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)',
              color: 'var(--tx-1)', fontSize: 11, fontWeight: 700, cursor: 'pointer', transition: 'all 150ms'
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
            onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-s2)'}
            >
              <Download size={14} color="var(--accent)" />
              Export Report
            </button>
            <button 
              onClick={handleRefresh}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px',
                background: 'linear-gradient(135deg, var(--accent), #D9BC7A)', border: 'none',
                borderRadius: 'var(--r-sm)', color: '#090C12', fontSize: 11, fontWeight: 800,
                cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.5px', transition: 'all 150ms'
              }}
              onMouseEnter={e => e.currentTarget.style.boxShadow = '0 0 16px rgba(201,169,98,0.35)'}
              onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
            >
              <RefreshCw size={14} className={metricsLoading ? 'spin-anim' : ''} />
              Refresh Analytics
            </button>
          </div>
        }
      />

      {/* Filters Bar */}
      <DashboardFiltersComponent filters={filters} onChange={setFilters} onRefresh={handleRefresh} />

      {/* Metrics Cards */}
      <MetricsCards
        totalEvaluations={metrics?.total_evaluations || 0}
        averageScore={metrics?.average_score || 0}
        criticalAlerts={metrics?.critical_alerts || 0}
        ctqSuccessRate={metrics?.ctq_success_rate || 0}
        averageTTCA={metrics?.average_ttca || 0}
        processingErrorRate={metrics?.processing_error_rate || 0}
      />

      {/* Charts Row 1: Score Trend + LOB Distribution */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, alignItems: 'start' }}>
        {/* Score Trend */}
        <div className="ds-card">
          <div className="ds-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span className="ds-card-title">Quality Score Trend</span>
              <p style={{ fontSize: 9, color: 'var(--tx-3)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px', marginTop: 2 }}>
                Average score per {filters.period === 'week' ? 'week' : 'month'}
              </p>
            </div>
            <div style={{ padding: 6, background: 'var(--bg-s2)', borderRadius: 'var(--r-sm)', color: 'var(--accent)' }}>
              <TrendingUp size={16} />
            </div>
          </div>
          <div className="ds-card-body" style={{ height: 320, padding: '24px' }}>
            {trendsLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                <Loader2 size={24} className="spin-anim" color="var(--accent)" />
              </div>
            ) : (
              <TrendLineChart data={trends || []} />
            )}
          </div>
        </div>

        {/* LOB Distribution */}
        <div className="ds-card">
          <div className="ds-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span className="ds-card-title">LOB Distribution</span>
              <p style={{ fontSize: 9, color: 'var(--tx-3)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px', marginTop: 2 }}>
                Evaluations per Line of Business
              </p>
            </div>
            <div style={{ padding: 6, background: 'var(--bg-s2)', borderRadius: 'var(--r-sm)', color: 'var(--accent)' }}>
              <Filter size={16} />
            </div>
          </div>
          <div className="ds-card-body" style={{ height: 320, padding: '24px' }}>
            <DistributionPieChart data={metrics?.lob_distribution || []} />
          </div>
        </div>
      </div>

      {/* Charts Row 2: CTQ Distribution + Score Over Time (daily) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>
        {/* CTQ Bar Chart */}
        <div className="ds-card">
          <div className="ds-card-header">
            <span className="ds-card-title">CTQ Compliance by Criterion</span>
            <p style={{ fontSize: 9, color: 'var(--tx-3)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px', marginTop: 2 }}>
              Pass rate and AI agreement per CTQ criterion
            </p>
          </div>
          <div className="ds-card-body" style={{ height: 350, padding: '24px' }}>
            {ctqLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                <Loader2 size={24} className="spin-anim" color="var(--accent)" />
              </div>
            ) : (
              <CTQBarChart data={ctqDist?.distribution || []} />
            )}
          </div>
        </div>

        {/* Daily Score Overview */}
        <div className="ds-card">
          <div className="ds-card-header">
            <span className="ds-card-title">Daily Score Overview</span>
            <p style={{ fontSize: 9, color: 'var(--tx-3)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px', marginTop: 2 }}>
              Daily average quality scores
            </p>
          </div>
          <div className="ds-card-body" style={{ height: 350, padding: '24px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={metrics?.score_over_time || []}>
                <defs>
                  <linearGradient id="colorScoreDaily" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                <XAxis
                  dataKey="date"
                  stroke="var(--tx-3)"
                  fontSize={10}
                  fontWeight={700}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val: string) => {
                    const d = new Date(val);
                    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                  }}
                />
                <YAxis stroke="var(--tx-3)" fontSize={10} fontWeight={700} tickLine={false} axisLine={false} domain={[0, 100]} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--bg-s2)',
                    borderRadius: '12px',
                    border: '1px solid rgba(201,169,98,0.3)',
                    color: 'var(--tx-1)',
                    boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.4)',
                  }}
                  itemStyle={{ color: 'var(--accent)', fontWeight: 700 }}
                  labelStyle={{ color: 'var(--tx-3)', marginBottom: '4px', fontSize: '10px', textTransform: 'uppercase' }}
                />
                <Area
                  type="monotone"
                  dataKey="score"
                  stroke="var(--accent)"
                  strokeWidth={4}
                  fillOpacity={1}
                  fill="url(#colorScoreDaily)"
                  animationDuration={1500}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Charts Row 3: Topic Trends + Top Issues */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>
        {/* Topic Trends Area Chart */}
        <div className="ds-card">
          <div className="ds-card-header">
            <span className="ds-card-title">Topic Trends</span>
            <p style={{ fontSize: 9, color: 'var(--tx-3)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px', marginTop: 2 }}>
              Most frequent call topics over time
            </p>
          </div>
          <div className="ds-card-body" style={{ height: 320, padding: '24px' }}>
            {topicsLoading ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                <Loader2 size={24} className="spin-anim" color="var(--accent)" />
              </div>
            ) : (
              <TopicAreaChart data={topicTrends || { topics: [], data: [] }} />
            )}
          </div>
        </div>

        {/* Top Issues Bar Chart */}
        <div className="ds-card">
          <div className="ds-card-header">
            <span className="ds-card-title">Frequent Issues</span>
            <p style={{ fontSize: 9, color: 'var(--tx-3)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px', marginTop: 2 }}>
              Top detected infractions and topics
            </p>
          </div>
          <div className="ds-card-body" style={{ height: 320, padding: '24px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics?.top_issues || []} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(255,255,255,0.05)" />
                <XAxis type="number" hide />
                <YAxis
                  dataKey="label"
                  type="category"
                  stroke="var(--tx-2)"
                  fontSize={11}
                  fontWeight={600}
                  tickLine={false}
                  axisLine={false}
                  width={120}
                />
                <Tooltip
                  cursor={{ fill: 'var(--bg-s3)' }}
                  contentStyle={{
                    backgroundColor: 'var(--bg-s2)',
                    borderRadius: '12px',
                    border: '1px solid rgba(201,169,98,0.3)',
                    color: 'var(--tx-1)',
                  }}
                />
                <Bar dataKey="count" fill="var(--accent)" radius={[0, 8, 8, 0]} barSize={24} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
