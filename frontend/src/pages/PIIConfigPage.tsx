import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Loader2, Shield, Save, Play, CheckCircle2, AlertCircle, Activity } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface PIIConfig {
  enabled: boolean;
  enabled_types: string[];
  redaction_token: string;
  log_redactions: boolean;
  names_enabled: boolean;
}

const PII_TYPES = [
  { id: 'phone', label: 'Phone Numbers', description: 'Detects US and International formats' },
  { id: 'email', label: 'Email Addresses', description: 'Detects standard email patterns' },
  { id: 'ssn', label: 'SSN (Social Security)', description: 'Detects XXX-XX-XXXX formats' },
  { id: 'credit_card', label: 'Credit Cards', description: 'Detects 16-digit card numbers' },
  { id: 'address', label: 'Physical Addresses', description: 'Detects street addresses' },
  { id: 'dob', label: 'Date of Birth', description: 'Detects common date formats' },
];

const PIIConfigPage = ({ embedded = false }: { embedded?: boolean }) => {
  const { user, isLoading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const [testText, setTestText] = useState('');
  const [testResult, setTestResult] = useState<any>(null);
  const [isTesting, setIsTesting] = useState(false);

  const tenantId = user?.tenant_id;

  const { data: config, isLoading: configLoading, error: configError } = useQuery<PIIConfig>({
    queryKey: ['pii-config', tenantId],
    queryFn: async () => {
      const response = await client.get(`/api/tenants/${tenantId}/pii-config`);
      return response.data;
    },
    enabled: !!tenantId,
  });

  const updateMutation = useMutation({
    mutationFn: async (newConfig: PIIConfig) => {
      if (!tenantId) throw new Error('Tenant ID missing');
      const response = await client.put(`/api/tenants/${tenantId}/pii-config`, newConfig);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pii-config', tenantId] });
      toast.success('PII configuration updated successfully');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || 'Failed to update PII configuration');
    },
  });

  const [formState, setFormState] = useState<PIIConfig>({
    enabled: true,
    enabled_types: ['phone', 'email', 'ssn', 'credit_card'],
    redaction_token: '***REDACTED***',
    log_redactions: true,
    names_enabled: false,
  });

  useEffect(() => {
    if (config) {
      setFormState(config);
    }
  }, [config]);

  const handleToggleType = (typeId: string) => {
    setFormState((prev) => {
      const isEnabled = prev.enabled_types.includes(typeId);
      const newTypes = isEnabled
        ? prev.enabled_types.filter((t) => t !== typeId)
        : [...prev.enabled_types, typeId];
      return { ...prev, enabled_types: newTypes };
    });
  };

  const handleSave = () => {
    if (!tenantId) {
      toast.error('Cannot save: User session missing tenant information');
      return;
    }
    updateMutation.mutate(formState);
  };

  const handleTest = async () => {
    if (!testText) return;
    if (!tenantId) {
      toast.error('Cannot run test: User session missing tenant information');
      return;
    }

    setIsTesting(true);
    try {
      const response = await client.post(`/api/tenants/${tenantId}/pii-config/test`, { text: testText });
      setTestResult(response.data);
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Test failed');
    } finally {
      setIsTesting(false);
    }
  };

  if (authLoading || configLoading) {
    return (
      <div style={{ display: 'flex', height: '60vh', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <Loader2 className="spin-anim" style={{ color: 'var(--accent)', width: 36, height: 36 }} />
          <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '1px' }}>Loading configuration...</p>
        </div>
      </div>
    );
  }

  if (!tenantId) {
    return (
      <div style={{ display: 'flex', height: '60vh', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div className="ds-card" style={{ padding: '36px 28px', maxWidth: 400, width: '100%', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ width: 64, height: 64, background: 'var(--red-m)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--red)', margin: '0 auto', border: '1px solid rgba(248,113,113,0.2)' }}>
            <AlertCircle size={32} />
          </div>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--tx-1)' }}>Session Error</h2>
          <p style={{ color: 'var(--tx-2)', fontSize: 12, lineHeight: 1.6 }}>Your user session is missing tenant information. Please try logging out and back in.</p>
          <button 
            onClick={() => window.location.reload()}
            className="run-btn"
            style={{ width: '100%', justifyContent: 'center', padding: '12px 0' }}
          >
            REFRESH SESSION
          </button>
        </div>
      </div>
    );
  }

  if (configError) {
    return (
      <div style={{ display: 'flex', height: '60vh', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <div className="ds-card" style={{ padding: '36px 28px', maxWidth: 400, width: '100%', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ width: 64, height: 64, background: 'var(--red-m)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--red)', margin: '0 auto', border: '1px solid rgba(248,113,113,0.2)' }}>
            <AlertCircle size={32} />
          </div>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--tx-1)' }}>Load Error</h2>
          <p style={{ color: 'var(--tx-2)', fontSize: 12, lineHeight: 1.6 }}>Failed to retrieve PII configuration from server.</p>
          <button 
            onClick={() => queryClient.invalidateQueries({ queryKey: ['pii-config'] })}
            className="run-btn"
            style={{ width: '100%', justifyContent: 'center', padding: '12px 0' }}
          >
            RETRY
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1024px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: embedded ? 16 : 24 }} className="animate-page">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: embedded ? 'flex-end' : 'space-between', width: '100%', marginBottom: embedded ? -8 : 0 }}>
        {!embedded && (
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--tx-1)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ background: 'var(--accent-m)', borderRadius: 'var(--r-md)', display: 'flex', padding: 8, border: '1px solid var(--accent-b)' }}>
                <Shield style={{ color: 'var(--accent)', height: 24, width: 24 }} />
              </div>
              PII Redaction Settings
            </h1>
            <p style={{ color: 'var(--tx-2)', fontSize: 12, marginTop: 6 }}>Configure how sensitive information is handled in call transcripts.</p>
          </div>
        )}
        <button
          onClick={handleSave}
          disabled={updateMutation.isPending}
          className="run-btn"
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 'var(--r-sm)' }}
        >
          {updateMutation.isPending ? <Loader2 className="spin-anim h-4 w-4" /> : <Save className="h-4 w-4" />}
          SAVE CONFIGURATION
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20 }}>
        {/* Main Config */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="ds-card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 20, borderBottom: '1px solid var(--border)' }}>
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--tx-1)', marginBottom: 4 }}>General Status</h3>
                <p style={{ fontSize: 11, color: 'var(--tx-3)', fontWeight: 500 }}>Enable or disable the entire PII redaction system.</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={formState.enabled}
                  onChange={(e) => setFormState({ ...formState, enabled: e.target.checked })}
                />
                <div className="w-12 h-6 bg-[var(--bg-s3)] border border-[var(--border)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[#E2E6ED] after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--accent)] shadow-inner"></div>
              </label>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <h3 style={{ fontSize: 10, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Detection Rules</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
                {PII_TYPES.map((type) => {
                  const isActive = formState.enabled_types.includes(type.id);
                  return (
                    <div
                      key={type.id}
                      style={{
                        padding: 16,
                        borderRadius: 'var(--r-md)',
                        border: isActive ? '1px solid var(--accent-b)' : '1px solid var(--border)',
                        background: isActive ? 'var(--accent-m)' : 'var(--bg-s2)',
                        transition: 'all 200ms ease',
                        cursor: 'pointer',
                        position: 'relative',
                        opacity: isActive ? 1 : 0.65
                      }}
                      onClick={() => handleToggleType(type.id)}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--tx-1)' }}>{type.label}</span>
                        {isActive && (
                          <div style={{ padding: 2, background: 'var(--accent)', borderRadius: '50%', color: '#090C12', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <CheckCircle2 className="h-3 w-3" strokeWidth={3} />
                          </div>
                        )}
                      </div>
                      <p style={{ fontSize: 10, color: 'var(--tx-3)', lineHeight: 1.4 }}>{type.description}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 20, paddingTop: 20, borderTop: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label style={{ fontSize: 10, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Redaction Token</label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <input
                    type="text"
                    value={formState.redaction_token}
                    onChange={(e) => setFormState({ ...formState, redaction_token: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      background: 'var(--bg-s2)',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--r-md)',
                      outline: 'none',
                      fontWeight: 700,
                      color: 'var(--accent)',
                      fontSize: 12,
                      fontFamily: 'var(--font-family)',
                      transition: 'all 200ms'
                    }}
                    placeholder="***REDACTED***"
                  />
                  <Shield style={{ position: 'absolute', right: 16, color: 'var(--tx-3)', pointerEvents: 'none' }} size={16} />
                </div>
                <p style={{ fontSize: 9, color: 'var(--tx-3)', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase' }}>The placeholder text that will replace sensitive data.</p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 16, background: 'var(--bg-s2)', borderRadius: 'var(--r-md)', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ padding: 10, background: 'var(--bg-s3)', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', display: 'flex', color: 'var(--accent)' }}>
                    <Activity className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 style={{ fontSize: 12, fontWeight: 700, color: 'var(--tx-1)' }}>Log Redactions</h3>
                    <p style={{ fontSize: 9, color: 'var(--tx-3)', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase' }}>Maintain audit log of detection events.</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={formState.log_redactions}
                    onChange={(e) => setFormState({ ...formState, log_redactions: e.target.checked })}
                  />
                  <div className="w-10 h-5 bg-[var(--bg-s3)] border border-[var(--border)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[#E2E6ED] after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--accent)] shadow-inner"></div>
                </label>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 16, background: 'var(--bg-s2)', borderRadius: 'var(--r-md)', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ padding: 10, background: 'var(--bg-s3)', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', display: 'flex', color: 'var(--accent)' }}>
                    <Shield className="h-4 w-4" />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <h3 style={{ fontSize: 12, fontWeight: 700, color: 'var(--tx-1)' }}>Name Detection</h3>
                      <span style={{ fontSize: 8, fontWeight: 700, padding: '2px 6px', background: 'var(--accent-m)', border: '1px solid var(--accent-b)', color: 'var(--accent)', borderRadius: 'var(--r-xs)' }}>BETA</span>
                    </div>
                    <p style={{ fontSize: 9, color: 'var(--tx-3)', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase' }}>Advanced NLP pattern matching for people.</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={formState.names_enabled}
                    onChange={(e) => setFormState({ ...formState, names_enabled: e.target.checked })}
                  />
                  <div className="w-10 h-5 bg-[var(--bg-s3)] border border-[var(--border)] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-[#E2E6ED] after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[var(--accent)] shadow-inner"></div>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Test Panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="ds-card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--tx-1)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ padding: 6, background: 'var(--green-m)', borderRadius: 'var(--r-md)', display: 'flex', color: 'var(--green)', border: '1px solid rgba(52,211,153,0.15)' }}>
                <Play className="h-4 w-4" fill="currentColor" />
              </div>
              Redaction Lab
            </h3>
            <textarea
              value={testText}
              onChange={(e) => setTestText(e.target.value)}
              style={{
                width: '100%',
                height: 120,
                padding: '12px 14px',
                fontSize: 12,
                border: '1px solid var(--border)',
                background: 'var(--bg-s2)',
                borderRadius: 'var(--r-md)',
                outline: 'none',
                resize: 'none',
                color: 'var(--tx-1)',
                fontFamily: 'var(--font-family)',
                transition: 'all 200ms'
              }}
              placeholder="Paste sample text here... (e.g., Hello, my phone is 555-0199 and email is test@company.com)"
            />
            <button
              onClick={handleTest}
              disabled={isTesting || !testText}
              className="run-btn"
              style={{ width: '100%', justifyContent: 'center', background: 'linear-gradient(135deg, var(--bg-s3), var(--bg-active))', color: 'var(--tx-1)', border: '1px solid var(--border-h)', borderRadius: 'var(--r-sm)', padding: '12px 0' }}
            >
              {isTesting ? <Loader2 className="spin-anim h-4 w-4 mx-auto" /> : 'RUN DIAGNOSTIC TEST'}
            </button>

            {testResult && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 10 }}>
                <div style={{ padding: 14, background: 'var(--accent-m)', borderRadius: 'var(--r-md)', border: '1px solid var(--accent-b)' }}>
                  <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.8px', display: 'block', marginBottom: 6 }}>Redacted Output</span>
                  <p style={{ fontSize: 12, color: 'var(--tx-1)', fontWeight: 600, lineHeight: 1.5 }}>{testResult.redacted_text}</p>
                </div>
                
                {testResult.redaction_log.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Identified Entities</span>
                    <div style={{ maxHeight: 150, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }} className="custom-scrollbar">
                      {testResult.redaction_log.map((log: any, i: number) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--bg-s2)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)' }}>
                          <span style={{ fontSize: 8, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', color: 'var(--accent)', background: 'var(--accent-m)', border: '1px solid var(--accent-b)', padding: '2px 6px', borderRadius: 'var(--r-xs)' }}>{log.type}</span>
                          <span style={{ fontSize: 8, color: 'var(--tx-3)', fontFamily: 'monospace' }}>{log.hash.substring(0, 10)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'start', gap: 8, fontSize: 10, color: 'var(--amber)', background: 'var(--amber-m)', padding: 10, borderRadius: 'var(--r-md)', border: '1px solid rgba(251,191,36,0.15)' }}>
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <p style={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.3px' }}>No sensitive data detected.</p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div style={{
            background: 'linear-gradient(135deg, var(--bg-s2), var(--bg-s1))',
            border: '1px solid var(--accent-b)',
            padding: 24,
            borderRadius: 'var(--r-lg)',
            position: 'relative',
            overflow: 'hidden'
          }} className="group">
            <div style={{ position: 'relative', zIndex: 1 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--accent)', marginBottom: 8 }}>Security Protocol</h3>
              <p style={{ fontSize: 11, color: 'var(--tx-2)', lineHeight: 1.6, fontWeight: 500 }}>
                Redaction occurs in-memory at the worker level. Raw PII is never logged or stored. Audit logs only contain SHA-256 signatures for validation.
              </p>
            </div>
            <Shield style={{ position: 'absolute', right: -16, bottom: -16, width: 80, height: 80, color: 'rgba(201, 169, 98, 0.03)', transition: 'transform 500ms' }} className="group-hover:scale-110" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default PIIConfigPage;
