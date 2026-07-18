import { Trash2, AlertCircle } from 'lucide-react';
import type { CriterionItem } from '../types';

interface CriterionCardProps {
  criterion: CriterionItem;
  index: number;
  onChange: (index: number, field: keyof CriterionItem, value: any) => void;
  onRemove: (index: number) => void;
}

const CriterionCard = ({ criterion, index, onChange, onRemove }: CriterionCardProps) => {
  return (
    <div 
      style={{
        padding: '16px', background: 'var(--bg-s2)', border: '1px solid var(--border)',
        borderRadius: 'var(--r-md)', display: 'flex', flexDirection: 'column', gap: '12px',
        position: 'relative', transition: 'all 200ms', fontFamily: 'var(--font-family)'
      }}
      onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-h)'}
      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
    >
      <button
        type="button"
        onClick={() => onRemove(index)}
        style={{
          position: 'absolute', top: '12px', right: '12px', background: 'none', border: 'none',
          padding: 6, borderRadius: 'var(--r-sm)', cursor: 'pointer', color: 'var(--tx-3)',
          transition: 'all 150ms'
        }}
        onMouseEnter={e => { e.currentTarget.style.color = 'var(--red)'; e.currentTarget.style.background = 'rgba(248, 113, 113, 0.08)'; }}
        onMouseLeave={e => { e.currentTarget.style.color = 'var(--tx-3)'; e.currentTarget.style.background = 'transparent'; }}
      >
        <Trash2 size={14} />
      </button>

      <div style={{ display: 'grid', gridTemplateColumns: '8fr 4fr', gap: '12px' }}>
        <div>
          <label style={{ display: 'block', fontSize: '9px', fontWeight: 800, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
            Criterion Key (Unique ID)
          </label>
          <input
            type="text"
            value={criterion.key}
            onChange={(e) => onChange(index, 'key', e.target.value)}
            style={{
              width: '100%', padding: '6px 12px', background: 'var(--bg-s3)', border: '1px solid var(--border)',
              borderRadius: 'var(--r-sm)', color: 'var(--tx-1)', fontSize: '12px', outline: 'none',
              fontFamily: 'var(--font-family)', transition: 'all 150ms'
            }}
            onFocus={e => e.currentTarget.style.borderColor = 'var(--accent-b)'}
            onBlur={e => e.currentTarget.style.borderColor = 'var(--border)'}
            placeholder="e.g. greeting"
          />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: '9px', fontWeight: 800, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
            Points
          </label>
          <input
            type="number"
            step="0.01"
            value={criterion.points}
            onChange={(e) => onChange(index, 'points', parseFloat(e.target.value) || 0)}
            style={{
              width: '100%', padding: '6px 12px', background: 'var(--bg-s3)', border: '1px solid var(--border)',
              borderRadius: 'var(--r-sm)', color: 'var(--tx-1)', fontSize: '12px', outline: 'none',
              fontFamily: 'var(--font-family)', transition: 'all 150ms'
            }}
            onFocus={e => e.currentTarget.style.borderColor = 'var(--accent-b)'}
            onBlur={e => e.currentTarget.style.borderColor = 'var(--border)'}
          />
        </div>
      </div>

      <div>
        <label style={{ display: 'block', fontSize: '9px', fontWeight: 800, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
          Evaluation Question
        </label>
        <input
          type="text"
          value={criterion.question}
          onChange={(e) => onChange(index, 'question', e.target.value)}
          style={{
            width: '100%', padding: '6px 12px', background: 'var(--bg-s3)', border: '1px solid var(--border)',
            borderRadius: 'var(--r-sm)', color: 'var(--tx-1)', fontSize: '12px', outline: 'none',
            fontFamily: 'var(--font-family)', transition: 'all 150ms'
          }}
          onFocus={e => e.currentTarget.style.borderColor = 'var(--accent-b)'}
          onBlur={e => e.currentTarget.style.borderColor = 'var(--border)'}
          placeholder="Did the agent...?"
        />
      </div>

      <div>
        <label style={{ display: 'block', fontSize: '9px', fontWeight: 800, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
          Context / Rules for AI
        </label>
        <textarea
          rows={2}
          value={criterion.context}
          onChange={(e) => onChange(index, 'context', e.target.value)}
          style={{
            width: '100%', padding: '6px 12px', background: 'var(--bg-s3)', border: '1px solid var(--border)',
            borderRadius: 'var(--r-sm)', color: 'var(--tx-1)', fontSize: '12px', outline: 'none',
            fontFamily: 'var(--font-family)', transition: 'all 150ms', resize: 'none'
          }}
          onFocus={e => e.currentTarget.style.borderColor = 'var(--accent-b)'}
          onBlur={e => e.currentTarget.style.borderColor = 'var(--border)'}
          placeholder="Evaluate based on..."
        />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={criterion.mandatory}
            onChange={(e) => onChange(index, 'mandatory', e.target.checked)}
            style={{ width: '14px', height: '14px', accentColor: 'var(--accent)' }}
          />
          <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--tx-2)' }}>Mandatory</span>
        </label>

        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={criterion.manual_score_required}
            onChange={(e) => onChange(index, 'manual_score_required', e.target.checked)}
            style={{ width: '14px', height: '14px', accentColor: 'var(--accent)' }}
          />
          <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--tx-2)' }}>Manual Score Required</span>
        </label>
      </div>

      {criterion.manual_score_required && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px', fontSize: '10px', fontWeight: 600,
          color: 'var(--amber)', background: 'var(--amber-m)', padding: '8px 12px',
          borderRadius: 'var(--r-sm)', border: '1px solid var(--accent-b)'
        }}>
          <AlertCircle size={12} />
          <span>This criterion will be skipped by AI and flagged for human review.</span>
        </div>
      )}
    </div>
  );
};

export default CriterionCard;
