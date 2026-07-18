import React from 'react';
import { TrendingUp, Users, AlertCircle, Clock, Shield, Activity, TrendingDown } from 'lucide-react';

interface MetricCard {
  name: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  trend?: string;
  trendType?: 'positive' | 'negative' | 'neutral';
}

interface MetricsCardsProps {
  totalEvaluations: number;
  averageScore: number;
  criticalAlerts: number;
  ctqSuccessRate: number;
  averageTTCA: number;
  processingErrorRate: number;
}

const MetricsCards = ({
  totalEvaluations,
  averageScore,
  criticalAlerts,
  ctqSuccessRate,
  averageTTCA,
  processingErrorRate,
}: MetricsCardsProps) => {
  const cards: MetricCard[] = [
    {
      name: 'Total Audits',
      value: totalEvaluations.toLocaleString(),
      icon: Users,
      color: 'var(--accent)',
      bgColor: 'rgba(201,169,98,0.09)',
      trend: '+12%',
      trendType: 'positive'
    },
    {
      name: 'Avg Quality Score',
      value: `${averageScore}%`,
      icon: TrendingUp,
      color: 'var(--accent)',
      bgColor: 'rgba(201,169,98,0.09)',
      trend: '+2.4%',
      trendType: 'positive'
    },
    {
      name: 'CTQ Compliance',
      value: `${ctqSuccessRate}%`,
      icon: Shield,
      color: 'var(--green)',
      bgColor: 'rgba(52,211,153,0.09)',
      trend: '+5.1%',
      trendType: 'positive'
    },
    {
      name: 'Critical Alerts',
      value: criticalAlerts,
      icon: AlertCircle,
      color: 'var(--red)',
      bgColor: 'rgba(239,68,68,0.09)',
      trend: '-2',
      trendType: 'positive'
    },
    {
      name: 'Avg Response Time',
      value: `${averageTTCA}s`,
      icon: Clock,
      color: 'var(--amber)',
      bgColor: 'rgba(251,191,36,0.09)',
      trend: '-0.3s',
      trendType: 'positive'
    },
    {
      name: 'Error Rate',
      value: `${processingErrorRate}%`,
      icon: Activity,
      color: processingErrorRate > 5 ? 'var(--red)' : 'var(--accent)',
      bgColor: processingErrorRate > 5 ? 'rgba(239,68,68,0.09)' : 'rgba(201,169,98,0.09)',
      trend: 'Stable',
      trendType: 'neutral'
    },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 0 }}>
      {cards.map((card) => (
        <div
          key={card.name}
          className="ds-card"
          style={{ position: 'relative', overflow: 'hidden', transition: 'all 300ms', cursor: 'default' }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = 'var(--border-h)';
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 12px 24px -8px rgba(0,0,0,0.5), 0 0 20px rgba(201,169,98,0.05)';
            const dec = e.currentTarget.querySelector('.card-dec') as HTMLElement;
            if (dec) dec.style.opacity = '0.08';
            const iconWrap = e.currentTarget.querySelector('.icon-wrap') as HTMLElement;
            if (iconWrap) iconWrap.style.transform = 'scale(1.1)';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = 'var(--border)';
            e.currentTarget.style.transform = 'none';
            e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.2)';
            const dec = e.currentTarget.querySelector('.card-dec') as HTMLElement;
            if (dec) dec.style.opacity = '0.03';
            const iconWrap = e.currentTarget.querySelector('.icon-wrap') as HTMLElement;
            if (iconWrap) iconWrap.style.transform = 'none';
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between', padding: 20 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
              <div
                className="icon-wrap"
                style={{
                  padding: 10, borderRadius: 'var(--r-md)', backgroundColor: card.bgColor, color: card.color,
                  transition: 'transform 300ms ease-out'
                }}
              >
                <card.icon size={20} />
              </div>
              {card.trend && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700,
                  padding: '2px 6px', borderRadius: 20, border: '1px solid',
                  backgroundColor: card.trendType === 'positive' ? 'rgba(52,211,153,0.08)' :
                                   card.trendType === 'negative' ? 'rgba(239,68,68,0.08)' : 'var(--bg-s3)',
                  borderColor: card.trendType === 'positive' ? 'rgba(52,211,153,0.2)' :
                               card.trendType === 'negative' ? 'rgba(239,68,68,0.2)' : 'var(--border)',
                  color: card.trendType === 'positive' ? 'var(--green)' :
                         card.trendType === 'negative' ? 'var(--red)' : 'var(--tx-2)'
                }}>
                  {card.trendType === 'positive' && <TrendingUp size={10} />}
                  {card.trendType === 'negative' && <TrendingDown size={10} />}
                  {card.trend}
                </div>
              )}
            </div>
            
            <div>
              <p style={{ fontSize: 9, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>
                {card.name}
              </p>
              <p style={{ fontSize: 24, fontWeight: 800, color: 'var(--tx-1)', letterSpacing: '-0.5px' }}>
                {card.value}
              </p>
            </div>
          </div>
          
          {/* Subtle decoration */}
          <div
            className="card-dec"
            style={{
              position: 'absolute', right: -8, bottom: -8, width: 48, height: 48, borderRadius: '50%',
              backgroundColor: card.color, opacity: 0.03, transition: 'opacity 500ms ease-out'
            }}
          />
        </div>
      ))}
    </div>
  );
};

export default MetricsCards;
