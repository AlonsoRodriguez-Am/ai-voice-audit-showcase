import { useState, useEffect } from 'react';
import { X, Save, Plus, AlertCircle } from 'lucide-react';
import type { LOB, CriterionItem } from '../types';
import CriterionCard from './CriterionCard';

interface LOBModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: Partial<LOB>) => void;
  lob?: LOB | null;
  isLoading?: boolean;
}

const LOBModal = ({ isOpen, onClose, onSave, lob, isLoading }: LOBModalProps) => {
  const [formData, setFormData] = useState({
    name: '',
    system_prompt: '',
    is_active: false,
  });

  const [criteria, setCriteria] = useState<CriterionItem[]>([]);
  const [llmConfig, setLlmConfig] = useState<any>(null);
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    if (lob) {
      setFormData({
        name: lob.name,
        system_prompt: lob.system_prompt,
        is_active: lob.is_active,
      });

      if (lob.criteria_json && typeof lob.criteria_json === 'object') {
        const criteriaArray: CriterionItem[] = [];
        let config = null;

        Object.entries(lob.criteria_json).forEach(([key, value]: [string, any]) => {
          if (key === 'llm_config') {
            config = value;
          } else {
            criteriaArray.push({
              key,
              question: value.question || '',
              points: value.points || 0,
              mandatory: value.mandatory || false,
              context: value.context || '',
              manual_score_required: value.manual_score_required || false,
            });
          }
        });
        
        setCriteria(criteriaArray);
        setLlmConfig(config);
      } else {
        setCriteria([]);
        setLlmConfig(null);
      }
    } else {
      setFormData({
        name: '',
        system_prompt: '',
        is_active: false,
      });
      setCriteria([]);
      setLlmConfig(null);
    }
    setErrors([]);
  }, [lob, isOpen]);

  if (!isOpen) return null;

  const addCriterion = () => {
    const newCriterion: CriterionItem = {
      key: `criterion_${criteria.length + 1}`,
      question: '',
      points: 0,
      mandatory: false,
      context: '',
      manual_score_required: false,
    };
    setCriteria([...criteria, newCriterion]);
  };

  const updateCriterion = (index: number, field: keyof CriterionItem, value: any) => {
    const newCriteria = [...criteria];
    newCriteria[index] = { ...newCriteria[index], [field]: value };
    setCriteria(newCriteria);
  };

  const removeCriterion = (index: number) => {
    setCriteria(criteria.filter((_, i) => i !== index));
  };

  const validate = (): boolean => {
    const newErrors: string[] = [];
    const keys = criteria.map(c => c.key.trim());
    
    if (keys.some(k => k === '')) {
      newErrors.push('All criteria must have a key');
    }

    const forbiddenKeys = ['llm_config'];
    if (keys.some(k => forbiddenKeys.includes(k.toLowerCase()))) {
      newErrors.push(`Reserved keys cannot be used: ${forbiddenKeys.join(', ')}`);
    }

    const duplicateKeys = keys.filter((key, index) => keys.indexOf(key) !== index);
    if (duplicateKeys.length > 0) {
      newErrors.push(`Duplicate keys found: ${[...new Set(duplicateKeys)].join(', ')}`);
    }

    if (criteria.some(c => c.question.trim() === '')) {
      newErrors.push('All criteria must have a question');
    }

    setErrors(newErrors);
    return newErrors.length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validate()) return;

    const criteria_json: Record<string, any> = {};
    
    if (llmConfig) {
      criteria_json['llm_config'] = llmConfig;
    }

    criteria.forEach(c => {
      const { key, ...rest } = c;
      criteria_json[key.trim()] = rest;
    });

    onSave({
      ...formData,
      criteria_json,
    });
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center',
      justifyContent: 'center', padding: '16px', background: 'rgba(9, 12, 18, 0.75)',
      backdropFilter: 'blur(4px)', fontFamily: 'var(--font-family)'
    }} className="animate-page">
      <div 
        className="ds-card" 
        style={{
          width: '100%', maxWidth: '720px', height: '90vh', display: 'flex',
          flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-s1)',
          borderColor: 'var(--border-h)'
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <h2 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--tx-1)', margin: 0 }}>{lob ? 'Edit LOB Configuration' : 'Create New LOB'}</h2>
            <p style={{ fontSize: '11px', color: 'var(--tx-3)', margin: 0 }}>Configure Line of Business settings and evaluation criteria rules.</p>
          </div>
          <button 
            onClick={onClose} 
            style={{
              background: 'none', border: 'none', padding: 6, borderRadius: 'var(--r-sm)',
              cursor: 'pointer', color: 'var(--tx-3)', transition: 'all 150ms'
            }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--tx-1)'; e.currentTarget.style.background = 'var(--bg-s2)'; }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--tx-3)'; e.currentTarget.style.background = 'transparent'; }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', margin: 0 }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            {/* Info Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', alignItems: 'center' }}>
              <div>
                <label style={{ display: 'block', fontSize: '10px', fontWeight: 800, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>LOB Name</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  style={{
                    width: '100%', padding: '8px 12px', background: 'var(--bg-s2)', border: '1px solid var(--border)',
                    borderRadius: 'var(--r-sm)', color: 'var(--tx-1)', fontSize: '12px', outline: 'none',
                    fontFamily: 'var(--font-family)', transition: 'all 150ms'
                  }}
                  onFocus={e => e.currentTarget.style.borderColor = 'var(--accent-b)'}
                  onBlur={e => e.currentTarget.style.borderColor = 'var(--border)'}
                  placeholder="e.g. Healthcare, Retail"
                />
              </div>
              <div style={{ display: 'flex', height: '100%', alignItems: 'flex-end', paddingBottom: '8px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    style={{ width: '15px', height: '15px', accentColor: 'var(--accent)' }}
                  />
                  <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--tx-2)' }}>Active Status</span>
                </label>
              </div>
            </div>

            {/* System Prompt */}
            <div>
              <label style={{ display: 'block', fontSize: '10px', fontWeight: 800, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>System Prompt</label>
              <textarea
                required
                rows={3}
                value={formData.system_prompt}
                onChange={(e) => setFormData({ ...formData, system_prompt: e.target.value })}
                style={{
                  width: '100%', padding: '8px 12px', background: 'var(--bg-s2)', border: '1px solid var(--border)',
                  borderRadius: 'var(--r-sm)', color: 'var(--tx-1)', fontSize: '12px', outline: 'none',
                  fontFamily: 'var(--font-family)', transition: 'all 150ms', resize: 'none'
                }}
                onFocus={e => e.currentTarget.style.borderColor = 'var(--accent-b)'}
                onBlur={e => e.currentTarget.style.borderColor = 'var(--border)'}
                placeholder="Instructions and directives for the AI evaluator..."
              />
            </div>

            {/* Criteria header & list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '12px', fontWeight: 800, color: 'var(--tx-1)', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                  Evaluation Criteria
                  <span style={{
                    padding: '2px 8px', borderRadius: '10px', fontSize: '9px', fontWeight: 800,
                    background: 'var(--accent-m)', border: '1px solid var(--accent-b)', color: 'var(--accent)'
                  }}>
                    {criteria.length} Items
                  </span>
                </h3>
                <button
                  type="button"
                  onClick={addCriterion}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
                    background: 'var(--accent-m)', border: '1px solid var(--accent-b)',
                    borderRadius: 'var(--r-sm)', color: 'var(--accent)', fontSize: '10px', fontWeight: 800,
                    cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.5px', transition: 'all 150ms',
                    fontFamily: 'var(--font-family)'
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(201,169,98,0.15)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'var(--accent-m)'; }}
                >
                  <Plus size={12} /> Add Criterion
                </button>
              </div>

              {errors.length > 0 && (
                <div style={{
                  padding: '12px', background: 'var(--red-m)', border: '1px solid rgba(248, 113, 113, 0.25)',
                  borderRadius: 'var(--r-sm)', display: 'flex', flexDirection: 'column', gap: '6px'
                }}>
                  {errors.map((error, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '11px', fontWeight: 600, color: 'var(--red)' }}>
                      <AlertCircle size={14} />
                      {error}
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', paddingBottom: '16px' }}>
                {criteria.length === 0 ? (
                  <div style={{
                    textAlign: 'center', padding: '32px 16px', background: 'var(--bg-s2)',
                    border: '1.5px dashed var(--border)', borderRadius: 'var(--r-md)'
                  }}>
                    <p style={{ fontSize: '12px', color: 'var(--tx-3)', margin: 0 }}>No evaluation criteria defined yet.</p>
                    <button
                      type="button"
                      onClick={addCriterion}
                      style={{
                        marginTop: '8px', fontSize: '11px', fontWeight: 700, color: 'var(--accent)',
                        background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline'
                      }}
                    >
                      Click here to add the first one
                    </button>
                  </div>
                ) : (
                  criteria.map((criterion, index) => (
                    <CriterionCard
                      key={index}
                      criterion={criterion}
                      index={index}
                      onChange={updateCriterion}
                      onRemove={removeCriterion}
                    />
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border)', background: 'var(--bg-s2)', display: 'flex', gap: '12px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1, padding: '10px 16px', background: 'transparent', border: '1px solid var(--border)',
                borderRadius: 'var(--r-sm)', color: 'var(--tx-2)', fontSize: '11px', fontWeight: 800,
                textTransform: 'uppercase', letterSpacing: '0.5px', cursor: 'pointer', transition: 'all 150ms',
                fontFamily: 'var(--font-family)'
              }}
              onMouseEnter={e => { e.currentTarget.style.color = 'var(--tx-1)'; e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
              onMouseLeave={e => { e.currentTarget.style.color = 'var(--tx-2)'; e.currentTarget.style.background = 'transparent'; }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              style={{
                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: '10px 16px', background: 'linear-gradient(135deg, var(--accent), #D9BC7A)',
                border: 'none', borderRadius: 'var(--r-sm)', color: '#090C12', fontSize: '11px',
                fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px',
                cursor: isLoading ? 'not-allowed' : 'pointer', opacity: isLoading ? 0.5 : 1, transition: 'all 150ms',
                fontFamily: 'var(--font-family)'
              }}
              onMouseEnter={e => { if(!isLoading) e.currentTarget.style.boxShadow = '0 0 16px rgba(201,169,98,0.35)'; }}
              onMouseLeave={e => { if(!isLoading) e.currentTarget.style.boxShadow = 'none'; }}
            >
              {isLoading ? 'Saving...' : <><Save size={14} /> Save LOB Configuration</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LOBModal;
