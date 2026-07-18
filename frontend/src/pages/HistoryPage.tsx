import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';
import { Loader2 } from 'lucide-react';
import { RecentItem } from '../components/ui/EvalHelpers';

const formatRelativeTime = (isoString: string) => {
  if (!isoString) return '';
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.round(diffMs / 60000);
  const diffHours = Math.round(diffMs / 3600000);
  const diffDays = Math.round(diffMs / 86400000);

  if (diffMins < 60) {
    return `-${diffMins}m ago`;
  } else if (diffHours < 24) {
    return `-${diffHours}h ago`;
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else {
    return `${diffDays} days ago`;
  }
};

const HistoryPage = () => {
  const navigate = useNavigate();

  const { data: evaluations, isLoading } = useQuery<any[]>({
    queryKey: ['recent-evaluations-extended'],
    queryFn: async () => (await client.get('/api/evaluation/recent?limit=20')).data,
  });

  return (
    <div className="anim-in d1" style={{ maxWidth: 800, margin: '0 auto' }}>
      
      {/* Workspace Header */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--tx-1)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
          Evaluation History
        </h2>
        <p style={{ fontSize: 12, color: 'var(--tx-3)' }}>
          Traceability cockpit for all processed audio interactions, transcription audits, and evaluation metrics.
        </p>
      </div>

      {/* Main History Card */}
      <div className="ds-card" style={{ marginBottom: 14 }}>
        <div className="ds-card-header">
          <span className="ds-card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-file-headphone" aria-hidden="true">
              <path d="M4 6.835V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.706.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2h-.343"></path>
              <path d="M14 2v5a1 1 0 0 0 1 1h5"></path>
              <path d="M2 19a2 2 0 0 1 4 0v1a2 2 0 0 1-4 0v-4a6 6 0 0 1 12 0v4a2 2 0 0 1-4 0v-1a2 2 0 0 1 4 0"></path>
            </svg>
            Recent Evaluations
          </span>
          <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--accent)', background: 'var(--accent-m)', padding: '2px 8px', borderRadius: 'var(--r-xs)' }}>
            {evaluations?.length || 0} TOTAL RUNS
          </span>
        </div>

        <div style={{ padding: '12px 14px' }}>
          {isLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 0' }}>
              <Loader2 size={24} className="spin-anim" color="var(--accent)" />
            </div>
          ) : !evaluations || evaluations.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--tx-3)', fontSize: '12px' }}>
              No processed evaluations found in your history log.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {evaluations.map((r) => (
                <div 
                  key={r.id} 
                  onClick={() => navigate(`/evaluation?id=${r.id}`)} 
                  style={{ cursor: 'pointer' }}
                >
                  <RecentItem 
                    name={(r.eval_call_uid || r.call_id) + ".wav"} 
                    meta={`${r.lob_name} · ${formatRelativeTime(r.date)}`} 
                    score={r.score} 
                  />
                </div>
              ))}
            </div>
          )}
          
          <a href="/reports" style={{ display: 'block', textAlign: 'center', fontSize: '11px', color: 'var(--accent)', textDecoration: 'none', fontWeight: 700, padding: '16px 0 4px', borderTop: '1px solid var(--border)', marginTop: 12 }}>
            View Full Analytical Reports
          </a>
        </div>
      </div>
    </div>
  );
};

export default HistoryPage;
