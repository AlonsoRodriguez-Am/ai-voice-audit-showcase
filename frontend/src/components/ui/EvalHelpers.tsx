import { FileAudio, CheckCircle2, AlertCircle } from 'lucide-react';

/* ── Waveform bars (decorative) ── */
export const WaveformBars = () => {
  const bars = Array.from({ length: 48 }, (_, i) => ({
    h: Math.max(3, Math.random() * 18),
    delay: i * 0.05,
  }));
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2, justifyContent: 'center', padding: '8px 0' }}>
      {bars.map((b, i) => (
        <div key={i} className="waveform-bar" style={{ height: b.h, animationDelay: `${b.delay}s` }} />
      ))}
    </div>
  );
};

/* ── Score ring ── */
export const ScoreRing = ({ score }: { score: number }) => {
  const r = 34; const circ = 2 * Math.PI * r;
  const color = score >= 80 ? 'var(--green)' : score >= 60 ? 'var(--amber)' : 'var(--red)';
  return (
    <div className="score-ring-wrap" style={{ width: 80, height: 80 }}>
      <svg width={80} height={80} viewBox="0 0 80 80" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={40} cy={40} r={r} stroke="var(--bg-s3)" strokeWidth={6} fill="none" />
        <circle cx={40} cy={40} r={r} stroke={color} strokeWidth={6} fill="none"
          strokeDasharray={circ}
          strokeDashoffset={circ - (circ * score) / 100}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s ease-out' }}
        />
      </svg>
      <div className="score-ring-inner">
        <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--tx-1)' }}>{score}%</span>
        <span style={{ fontSize: 8, fontWeight: 600, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Score</span>
      </div>
    </div>
  );
};

/* ── Transcript bubble ── */
export const TranscriptBubble = ({ line, index, onSeek, isActive }: { line: string; index: number; onSeek?: (t: number) => void; isActive?: boolean }) => {
  const isCustomer = index % 2 !== 0;
  const timeMatch = line.match(/\[(\d+\.\d+)s/);
  const startTime = timeMatch ? parseFloat(timeMatch[1]) : null;
  return (
    <div style={{ display: 'flex', justifyContent: isCustomer ? 'flex-end' : 'flex-start', marginBottom: 6 }}>
      <div
        className={`transcript-bubble ${isCustomer ? 'customer' : 'agent'}`}
        data-time={startTime ?? undefined}
        onClick={() => startTime != null && onSeek?.(startTime)}
        style={{
          cursor: startTime != null && onSeek ? 'pointer' : 'default',
          border: isActive ? '1px solid var(--accent)' : undefined,
          boxShadow: isActive ? '0 0 15px rgba(201,169,98,0.15)' : undefined,
          opacity: isActive ? 1 : 0.85,
          transition: 'all 0.2s ease-in-out'
        }}
      >
        {startTime != null && (
          <div className="transcript-time">{line.match(/\[([^\]]+)\]/)?.[1]}</div>
        )}
        <div>{line.replace(/\[[^\]]+\]\s*/, '')}</div>
      </div>
    </div>
  );
};

/* ── Criteria card ── */
export const CriteriaCard = ({
  criteriaKey, value, criteriaDetails, onAnswer,
}: {
  criteriaKey: string; value: any; criteriaDetails: any; onAnswer: (ans: string) => void;
}) => {
  const ans = value?.answer ?? 'n/a';
  return (
    <div className={`criteria-card ${ans === 'yes' ? 'ans-yes' : ans === 'no' ? 'ans-no' : ''}`}>
      <div style={{ marginBottom: 10 }}>
        <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--tx-3)', display: 'block', marginBottom: 3 }}>
          {criteriaKey.replace(/_/g, ' ')}
        </span>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--tx-1)', flex: 1 }}>
            {criteriaDetails?.question || criteriaKey}
          </span>
          <div style={{
            width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: ans === 'yes' ? 'var(--green-m)' : ans === 'no' ? 'var(--red-m)' : 'var(--bg-s3)',
            color: ans === 'yes' ? 'var(--green)' : ans === 'no' ? 'var(--red)' : 'var(--tx-3)',
          }}>
            {ans === 'yes' ? <CheckCircle2 size={12} /> : ans === 'no' ? <AlertCircle size={12} /> :
              <span style={{ fontSize: 8, fontWeight: 700 }}>N/A</span>}
          </div>
        </div>
      </div>
      {value?.justification && (
        <div style={{ background: 'var(--bg-s2)', borderRadius: 'var(--r-sm)', padding: '8px 10px', marginBottom: 10, border: '1px solid var(--border)' }}>
          <div style={{ fontSize: 9, fontWeight: 600, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 4 }}>AI Observation</div>
          <p style={{ fontSize: 11, color: 'var(--tx-2)', fontStyle: 'italic', lineHeight: 1.5 }}>"{value.justification}"</p>
        </div>
      )}
      <div style={{ display: 'flex', gap: 5 }}>
        {(['yes', 'no', 'n/a'] as const).map(opt => (
          <button key={opt} onClick={() => onAnswer(opt)}
            className={`criteria-toggle ${ans === opt ? opt === 'yes' ? 'active-yes' : opt === 'no' ? 'active-no' : 'active-na' : ''}`}>
            {opt.toUpperCase()}
          </button>
        ))}
      </div>
    </div>
  );
};

/* ── Recent item ── */
export const RecentItem = ({ name, meta, score }: { name: string; meta: string; score: number }) => {
  const cls = score >= 80 ? 'score-high' : score >= 60 ? 'score-mid' : 'score-low';
  return (
    <div className="recent-item">
      <div className="recent-item-icon"><FileAudio size={12} /></div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--tx-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
        <div style={{ fontSize: '9.5px', color: 'var(--tx-3)' }}>{meta}</div>
      </div>
      <span className={`score-badge ${cls}`}>{score}</span>
    </div>
  );
};

/* ── PII bar ── */
export const PIIBar = () => (
  <div className="pii-bar anim-in d5">
    <span className="pii-dot" />
    <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--green)' }}>PII Redaction Active</span>
    <span style={{ fontSize: '9.5px', color: 'var(--tx-3)', marginLeft: 'auto' }}>
      Sensitive data is automatically detected and redacted before processing
    </span>
  </div>
);

/* ── Call Metadata Bar (Addictive, elegant UX tooltips) ── */
import { Hash, Brain, Zap, Calendar, Sliders } from 'lucide-react';

export const CallMetadataBar = ({
  callId,
  model,
  provider,
  params,
  date,
}: {
  callId: string;
  model?: string;
  provider?: string;
  params?: any;
  date?: string;
}) => {
  const formattedDate = date ? new Date(date).toLocaleDateString() : new Date().toLocaleDateString();
  const displayModel = model || 'Tiny Whisper / llama3.2';
  const displayProvider = provider === 'ollama' ? 'Local (vLLM)' : (provider || 'Local (vLLM)');
  
  return (
    <div className="call-meta-bar anim-in d2">
      <div className="meta-pill">
        <Hash size={10} className="pill-icon" />
        <span className="pill-label">Call ID:</span>
        <span className="pill-val">{callId}</span>
      </div>
      <div className="meta-pill">
        <Brain size={10} className="pill-icon" />
        <span className="pill-label">Model:</span>
        <span className="pill-val">{displayModel}</span>
      </div>
      <div className="meta-pill">
        <Zap size={10} className="pill-icon text-accent" />
        <span className="pill-label">Provider:</span>
        <span className="pill-val">{displayProvider}</span>
      </div>
      {params && Object.keys(params).length > 0 && (
        <div className="meta-pill">
          <Sliders size={10} className="pill-icon" />
          <span className="pill-label">Params:</span>
          <span className="pill-val">
            {Object.entries(params)
              .map(([k, v]) => `${k}:${v}`)
              .join(' · ')}
          </span>
        </div>
      )}
      <div className="meta-pill select-none">
        <Calendar size={10} className="pill-icon text-muted" />
        <span className="pill-val">{formattedDate}</span>
      </div>
    </div>
  );
};

/* ── Waveform Progress Bar (Interactive loader made of sound wave elements) ── */
export const WaveformProgressBar = ({ progressPct, isActive }: { progressPct: number; isActive: boolean }) => {
  const waveHeights = [4, 8, 12, 16, 20, 24, 18, 12, 8, 14, 20, 26, 18, 10, 6, 12, 18, 22, 28, 20, 14, 8, 10, 16, 22, 12, 6, 4, 10, 18, 24, 16, 10, 6, 8, 12, 6, 4];
  const activeCount = Math.round((progressPct / 100) * waveHeights.length);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%', padding: '12px 16px', background: 'rgba(15,18,25,0.25)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', color: 'var(--accent)' }}>
          {isActive ? 'AI Worker Auditing progress' : 'Waveform Progress Loader'}
        </span>
        <span style={{ fontSize: 10, fontWeight: 800, fontFamily: 'monospace', color: 'var(--tx-1)' }}>
          {progressPct}%
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 3, justifyContent: 'center', height: 32 }}>
        {waveHeights.map((h, i) => {
          const isHighlighted = i < activeCount;
          return (
            <div
              key={i}
              style={{
                width: 3,
                height: h,
                borderRadius: 1.5,
                background: isHighlighted ? 'linear-gradient(180deg, var(--accent) 0%, #A88B3D 100%)' : 'var(--bg-s3)',
                transition: 'background 0.3s ease, transform 0.2s ease',
                animation: isHighlighted && isActive ? `wave-idle 1.2s ease-in-out infinite` : undefined,
                animationDelay: `${i * 0.03}s`,
                boxShadow: isHighlighted ? '0 0 6px rgba(201,169,98,0.25)' : 'none',
              }}
            />
          );
        })}
      </div>
    </div>
  );
};

