import React, { useState, useEffect } from 'react';
import { 
    testLlmConnection, 
    testSttTranscription, 
    fetchOllamaModels, 
    fetchHealthStatus, 
    fetchSystemStats,
    exportAuditLogs,
    releaseWorkers
} from '../api/diagnostics';
import { fetchAnalyticsUsage, fetchGpuTelemetry } from '../api/diagnostics';
import toast from 'react-hot-toast';
import { 
    Trash2, 
    RefreshCcw, 
    Cpu, 
    Key, 
    Globe, 
    Upload, 
    Activity, 
    CheckCircle2, 
    XCircle, 
    Play, 
    Square, 
    Loader2,
    BarChart2
} from 'lucide-react';

type SubView = 'diagnostics' | 'analytics';

const SystemHealthPage: React.FC = () => {
    const [subView, setSubView] = useState<SubView>('diagnostics');

    // ─── Diagnostics Page State ───
    const [provider, setProvider] = useState('ollama');
    const [model, setModel] = useState('llama3.1:8b');
    const [apiKey, setApiKey] = useState('');
    const [apiBase, setApiBase] = useState('');
    const [llmResult, setLlmResult] = useState<any>(null);
    const [llmLoading, setLlmLoading] = useState(false);

    const [sttFile, setSttFile] = useState<File | null>(null);
    const [sttModelSize, setSttModelSize] = useState('tiny');
    const [sttResult, setSttResult] = useState<any>(null);
    const [sttLoading, setSttLoading] = useState(false);

    const [localModels, setLocalModels] = useState<string[]>([]);
    const [isLoadingModels, setIsLoadingModels] = useState(false);

    const [healthStatus, setHealthStatus] = useState<any>(null);
    const [systemStats, setSystemStats] = useState<any>(null);
    const [isPolling] = useState(true);

    const [isRecording, setIsRecording] = useState(false);
    const [recordingStartTime, setRecordingStartTime] = useState<string | null>(null);
    const [elapsedTime, setElapsedTime] = useState(0);

    // ─── Analytics Page State ───
    const [period, setPeriod] = useState('today');
    const [providerFilter, setProviderFilter] = useState('global');
    const [analytics, setAnalytics] = useState<any[]>([]);
    const [telemetry, setTelemetry] = useState<any>(null);
    const [loadingAnalytics, setLoadingAnalytics] = useState(true);

    // ─── Diagnostics Lifecycles ───
    useEffect(() => {
        let timer: any;
        if (isRecording) {
            timer = setInterval(() => {
                setElapsedTime(prev => prev + 1);
            }, 1000);
        } else {
            setElapsedTime(0);
        }
        return () => clearInterval(timer);
    }, [isRecording]);

    useEffect(() => {
        let pollInterval: any;
        if (isPolling) {
            const fetchHealthData = async () => {
                try {
                    const health = await fetchHealthStatus();
                    setHealthStatus(health);
                } catch (error) {
                    console.error('Failed to fetch health status:', error);
                    setHealthStatus({ overall: 'error', database: 'error', redis: 'error', celery_workers: 0 });
                }

                try {
                    const stats = await fetchSystemStats();
                    setSystemStats(stats);
                } catch (error) {
                    console.error('Failed to fetch system stats:', error);
                    setSystemStats(null);
                }
            };

            fetchHealthData();
            pollInterval = setInterval(fetchHealthData, 5000);
        }
        return () => clearInterval(pollInterval);
    }, [isPolling]);

    useEffect(() => {
        if (provider === 'ollama') {
            const loadModels = async () => {
                setIsLoadingModels(true);
                try {
                    const data = await fetchOllamaModels();
                    if (data.status === 'success') {
                        setLocalModels(data.models || []);
                        if (data.models && data.models.length > 0 && (!model || model === 'llama3.1:8b')) {
                            setModel(data.models[0]);
                        }
                    }
                } catch (error) {
                    console.error('Failed to load Ollama models:', error);
                } finally {
                    setIsLoadingModels(false);
                }
            };
            loadModels();
        }
    }, [provider]);

    // ─── Analytics Lifecycles ───
    const loadAnalytics = async () => {
        setLoadingAnalytics(true);
        try {
            const data = await fetchAnalyticsUsage(period);
            setAnalytics(data);
        } catch (error) {
            console.error("Error loading analytics", error);
        } finally {
            setLoadingAnalytics(false);
        }
    };

    const loadTelemetry = async () => {
        try {
            const data = await fetchGpuTelemetry();
            setTelemetry(data);
        } catch (error) {
            console.error("Error loading telemetry", error);
        }
    };

    useEffect(() => {
        if (subView === 'analytics') {
            loadAnalytics();
        }
    }, [period, subView]);

    useEffect(() => {
        if (subView === 'analytics') {
            loadTelemetry();
            const interval = setInterval(loadTelemetry, 5000); // refresh every 5s
            return () => clearInterval(interval);
        }
    }, [subView]);

    // ─── Event Handlers ───
    const handleTestLlm = async () => {
        setLlmLoading(true);
        setLlmResult(null);
        try {
            const result = await testLlmConnection({ provider, model, api_key: apiKey, api_base: apiBase });
            setLlmResult(result);
        } catch (error: any) {
            setLlmResult({ status: 'error', message: error.response?.data?.detail || error.message });
        } finally {
            setLlmLoading(false);
        }
    };

    const handleTestStt = async () => {
        if (!sttFile) return;
        setSttLoading(true);
        setSttResult(null);
        try {
            const result = await testSttTranscription(sttFile, sttModelSize);
            setSttResult(result);
        } catch (error: any) {
            setSttResult({ status: 'error', message: error.response?.data?.detail || error.message });
        } finally {
            setSttLoading(false);
        }
    };

    const handleToggleRecording = async () => {
        if (!isRecording) {
            setIsRecording(true);
            setRecordingStartTime(new Date().toISOString());
        } else {
            const endTime = new Date().toISOString();
            if (recordingStartTime) {
                try {
                    await exportAuditLogs(recordingStartTime, endTime);
                    toast.success("Audit logs exported successfully!");
                } catch (error) {
                    console.error('Failed to export logs:', error);
                    alert('Failed to generate audit logs.');
                }
            }
            setIsRecording(false);
            setRecordingStartTime(null);
        }
    };

    const handleReleaseWorkers = async () => {
        if (!window.confirm("This will purge ALL pending tasks in the queue. Are you sure?")) return;
        try {
            const result = await releaseWorkers();
            if (result.status === 'success') {
                toast.success(result.message);
            } else {
                toast.error(result.message);
            }
        } catch (error: any) {
            toast.error("Failed to release workers: " + error.message);
        }
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    // ─── Analytics Calculated Values ───
    const filteredAnalytics = analytics.filter(row => {
        if (providerFilter === 'global') return true;
        if (providerFilter === 'local') return row.provider.toLowerCase() === 'ollama';
        if (providerFilter === 'external') return ['google', 'openai', 'claude', 'grok', 'gemini'].includes(row.provider.toLowerCase());
        return true;
    });

    const totalTokens = filteredAnalytics.reduce((sum, r) => sum + r.total_tokens, 0);
    const totalRequests = filteredAnalytics.reduce((sum, r) => sum + r.requests, 0);
    const totalCost = filteredAnalytics.reduce((sum, r) => sum + (r.estimated_cost || 0), 0);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }} className="animate-page">
            
            {/* Header section with unified page title */}
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--tx-1)', display: 'flex', alignItems: 'center', gap: 10, margin: 0 }}>
                        <Activity size={24} color="var(--accent)" /> System Health & Telemetry
                    </h1>
                    <p style={{ fontSize: 13, color: 'var(--tx-3)', margin: 0 }}>
                        Monitor health metrics, test LLM connections, audit local Faster-Whisper resources, and check token API costs.
                    </p>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 10.5, color: 'var(--tx-3)', fontFamily: 'monospace', padding: '4px 8px', background: 'var(--bg-s2)', borderRadius: '4px', border: '1px solid var(--border)' }}>
                        API Status: ONLINE
                    </span>
                    <button 
                        onClick={() => window.location.reload()}
                        style={{
                            fontSize: 10, fontWeight: 700, padding: '6px 12px', borderRadius: 'var(--r-sm)',
                            background: 'var(--bg-s3)', border: '1px solid var(--border-h)', color: 'var(--tx-2)',
                            cursor: 'pointer', transition: 'all 150ms', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 4,
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--tx-1)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg-s3)'; e.currentTarget.style.color = 'var(--tx-2)'; }}
                    >
                        <RefreshCcw size={12} /> Refresh Page
                    </button>
                </div>
            </div>

            {/* Horizontal Sub-view Toggles */}
            <div style={{
                display: 'flex',
                gap: 8,
                padding: 4,
                background: 'var(--bg-s2)',
                borderRadius: 'var(--r-md)',
                border: '1px solid var(--border)',
                width: 'fit-content'
            }}>
                <button
                    onClick={() => setSubView('diagnostics')}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '8px 16px',
                        borderRadius: 'var(--r-sm)',
                        border: 'none',
                        background: subView === 'diagnostics' ? 'linear-gradient(135deg, var(--bg-s3) 0%, rgba(201, 169, 98, 0.08) 100%)' : 'transparent',
                        color: subView === 'diagnostics' ? 'var(--accent)' : 'var(--tx-3)',
                        boxShadow: subView === 'diagnostics' ? '0 0 0 1px var(--accent-b) inset' : 'none',
                        cursor: 'pointer',
                        transition: 'all 200ms ease',
                        fontSize: 12,
                        fontWeight: 700,
                        fontFamily: 'var(--font-family)',
                    }}
                >
                    <Activity size={13} />
                    <span>Real-time Diagnostics</span>
                </button>
                
                <button
                    onClick={() => setSubView('analytics')}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '8px 16px',
                        borderRadius: 'var(--r-sm)',
                        border: 'none',
                        background: subView === 'analytics' ? 'linear-gradient(135deg, var(--bg-s3) 0%, rgba(201, 169, 98, 0.08) 100%)' : 'transparent',
                        color: subView === 'analytics' ? 'var(--accent)' : 'var(--tx-3)',
                        boxShadow: subView === 'analytics' ? '0 0 0 1px var(--accent-b) inset' : 'none',
                        cursor: 'pointer',
                        transition: 'all 200ms ease',
                        fontSize: 12,
                        fontWeight: 700,
                        fontFamily: 'var(--font-family)',
                    }}
                >
                    <BarChart2 size={13} />
                    <span>Token Analytics & Hardware</span>
                </button>
            </div>

            {/* Sub-view Content panels */}
            {subView === 'diagnostics' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }} className="animate-page">
                    
                    {/* Live Server Telemetry overall indicators */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
                        
                        {/* 1. Overall Status */}
                        <div className="ds-card">
                            <div style={{ padding: 16 }}>
                                <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 8 }}>
                                    Overall Status
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <div className="pii-dot" style={{
                                        width: 8, height: 8, borderRadius: '50%',
                                        background: healthStatus?.overall === 'healthy' ? 'var(--green)' : 
                                                    healthStatus?.overall === 'error' ? 'var(--amber)' : 'var(--red)',
                                        animation: healthStatus?.overall === 'healthy' ? 'pii-pulse 2.5s ease-in-out infinite' : 'none',
                                    }} />
                                    <span style={{
                                        fontSize: 16, fontWeight: 800, textTransform: 'capitalize',
                                        color: healthStatus?.overall === 'healthy' ? 'var(--green)' : 
                                               healthStatus?.overall === 'error' ? 'var(--amber)' : 'var(--red)',
                                    }}>
                                        {healthStatus?.overall || 'Checking...'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* 2. Database Status */}
                        <div className="ds-card">
                            <div style={{ padding: 16 }}>
                                <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 8 }}>
                                    Database (PostgreSQL)
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span style={{
                                        width: 6, height: 6, borderRadius: '50%',
                                        background: healthStatus?.database === 'online' ? 'var(--green)' : 'var(--red)',
                                    }} />
                                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--tx-1)', textTransform: 'capitalize' }}>
                                        {healthStatus?.database || 'Checking...'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* 3. Cache & Queue Status */}
                        <div className="ds-card">
                            <div style={{ padding: 16 }}>
                                <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 8 }}>
                                    Cache & Queue (Redis)
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span style={{
                                        width: 6, height: 6, borderRadius: '50%',
                                        background: healthStatus?.redis === 'online' ? 'var(--green)' : 'var(--red)',
                                    }} />
                                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--tx-1)', textTransform: 'capitalize' }}>
                                        {healthStatus?.redis || 'Checking...'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* 4. Active Workers Status */}
                        <div className="ds-card">
                            <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                                <div>
                                    <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 4 }}>
                                        Active Workers (Celery)
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span style={{
                                            width: 6, height: 6, borderRadius: '50%',
                                            background: healthStatus?.celery_workers > 0 ? 'var(--green)' : 'var(--tx-3)',
                                        }} />
                                        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--tx-1)' }}>
                                            {healthStatus?.celery_workers ?? 0} Online
                                        </span>
                                    </div>
                                </div>
                                <button 
                                    onClick={handleReleaseWorkers}
                                    style={{
                                        padding: 6, background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--r-xs)',
                                        color: 'var(--red)', cursor: 'pointer', transition: 'all 150ms', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--red-m)'; e.currentTarget.style.borderColor = 'rgba(248,113,113,0.2)'; }}
                                    onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.borderColor = 'var(--border)'; }}
                                    title="Purge Queue & Reset Workers"
                                >
                                    <Trash2 size={13} />
                                </button>
                            </div>
                        </div>

                    </div>

                    {/* Audit Log Session Recording card */}
                    <div className="ds-card" style={{
                        background: 'linear-gradient(135deg, var(--bg-s1) 0%, rgba(201,169,98,0.02) 100%)',
                        border: isRecording ? '1px solid rgba(248,113,113,0.2)' : '1px solid var(--border)',
                    }}>
                        <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
                            <div>
                                <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--tx-1)', margin: '0 0 2px' }}>Audit Log Session captures</h3>
                                <p style={{ fontSize: 11, color: 'var(--tx-3)', margin: 0 }}>
                                    Capture a temporary diagnostic session to export exact inference costs, timing metrics, and PII redaction data.
                                </p>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <div className="pii-dot" style={{
                                        width: 8, height: 8, borderRadius: '50%',
                                        background: isRecording ? 'var(--red)' : 'var(--tx-3)',
                                    }} />
                                    <span style={{ fontSize: 10, fontWeight: 800, color: isRecording ? 'var(--red)' : 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                        {isRecording ? `RECORDING SESSION (${formatTime(elapsedTime)})` : 'READY TO BENCHMARK'}
                                    </span>
                                </div>
                                <button 
                                    onClick={handleToggleRecording}
                                    style={{
                                        padding: '10px 24px', borderRadius: 'var(--r-sm)', border: 'none',
                                        background: isRecording ? 'linear-gradient(135deg, var(--red), #ef4444)' : 'linear-gradient(135deg, var(--accent), #D9BC7A)',
                                        color: '#090C12', fontSize: 11, fontWeight: 800, cursor: 'pointer',
                                        display: 'flex', alignItems: 'center', gap: 6, textTransform: 'uppercase', letterSpacing: '0.5px',
                                        boxShadow: isRecording ? '0 4px 16px rgba(239,68,68,0.2)' : 'none',
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; }}
                                    onMouseLeave={e => { e.currentTarget.style.transform = 'none'; }}
                                >
                                    {isRecording ? <Square size={12} fill="#090C12" /> : <Play size={12} fill="#090C12" />}
                                    {isRecording ? 'Stop & Export ZIP' : 'Start Session'}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Bottom Diagnostic Columns (LLM & STT connection tests) */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                        
                        {/* 1. LLM Diagnostics form panel */}
                        <div className="ds-card">
                            <div className="ds-card-header">
                                <span className="ds-card-title"><Activity size={14} color="var(--accent)" /> LLM Provider Diagnostics</span>
                            </div>
                            <div className="ds-card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    <label style={{ fontSize: 9, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>AI Provider</label>
                                    <select 
                                        value={provider} 
                                        onChange={(e) => setProvider(e.target.value)} 
                                        style={{
                                            padding: '10px 14px', background: 'var(--bg-s2)', border: '1px solid var(--border)',
                                            borderRadius: 'var(--r-sm)', color: 'var(--tx-1)', fontSize: 12, outline: 'none',
                                        }}
                                    >
                                        <option value="ollama">Local (vLLM)</option>
                                        <option value="openai">OpenAI</option>
                                        <option value="gemini">Google Gemini</option>
                                        <option value="claude">Anthropic Claude</option>
                                        <option value="grok">xAI Grok</option>
                                    </select>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    <label style={{ fontSize: 9, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Model Name</label>
                                    {provider === 'ollama' ? (
                                        <select 
                                            value={model} 
                                            onChange={(e) => setModel(e.target.value)} 
                                            style={{
                                                padding: '10px 14px', background: 'var(--bg-s2)', border: '1px solid var(--border)',
                                                borderRadius: 'var(--r-sm)', color: 'var(--tx-1)', fontSize: 12, outline: 'none',
                                            }}
                                            disabled={isLoadingModels}
                                        >
                                            {isLoadingModels ? (
                                                <option value="">Scanning vLLM...</option>
                                            ) : localModels.length > 0 ? (
                                                localModels.map((m) => (
                                                    <option key={m} value={m}>{m}</option>
                                                ))
                                            ) : (
                                                <option value="">No local models scanned</option>
                                            )}
                                        </select>
                                    ) : (
                                        <div style={{
                                            display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px',
                                            background: 'var(--bg-s2)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)',
                                        }}>
                                            <Cpu size={14} color="var(--tx-3)" />
                                            <input 
                                                type="text" value={model} onChange={(e) => setModel(e.target.value)} 
                                                style={{ background: 'none', border: 'none', outline: 'none', color: 'var(--tx-1)', fontSize: 12, width: '100%' }}
                                                placeholder="e.g. gpt-4o" 
                                            />
                                        </div>
                                    )}
                                </div>

                                {provider !== 'ollama' && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        <label style={{ fontSize: 9, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>API Override Key</label>
                                        <div style={{
                                            display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px',
                                            background: 'var(--bg-s2)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)',
                                        }}>
                                            <Key size={14} color="var(--tx-3)" />
                                            <input 
                                                type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} 
                                                style={{ background: 'none', border: 'none', outline: 'none', color: 'var(--tx-1)', fontSize: 12, width: '100%' }}
                                                placeholder="Enter key to override settings"
                                            />
                                        </div>
                                    </div>
                                )}

                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    <label style={{ fontSize: 9, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Base Endpoint (Optional)</label>
                                    <div style={{
                                        display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px',
                                        background: 'var(--bg-s2)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)',
                                    }}>
                                        <Globe size={14} color="var(--tx-3)" />
                                        <input 
                                            type="text" value={apiBase} onChange={(e) => setApiBase(e.target.value)} 
                                            style={{ background: 'none', border: 'none', outline: 'none', color: 'var(--tx-1)', fontSize: 12, width: '100%' }}
                                            placeholder="e.g. http://localhost:8899/v1" 
                                        />
                                    </div>
                                </div>

                                <button 
                                    onClick={handleTestLlm} 
                                    disabled={llmLoading}
                                    style={{
                                        padding: '10px 24px', borderRadius: 'var(--r-sm)', border: 'none',
                                        background: 'linear-gradient(135deg, var(--accent), #D9BC7A)', color: '#090C12',
                                        fontSize: 11, fontWeight: 800, cursor: llmLoading ? 'not-allowed' : 'pointer',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                                        textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: 6,
                                    }}
                                >
                                    {llmLoading ? <Loader2 size={13} className="spin-anim" /> : <Activity size={13} />}
                                    {llmLoading ? 'Testing API...' : 'Test Connection'}
                                </button>

                                {llmResult && (
                                    <div style={{
                                        padding: '12px 14px', borderRadius: 'var(--r-md)',
                                        background: llmResult.status === 'success' ? 'var(--green-m)' : 'var(--red-m)',
                                        border: `1px solid ${llmResult.status === 'success' ? 'rgba(52,211,153,0.15)' : 'rgba(248,113,113,0.15)'}`,
                                        color: llmResult.status === 'success' ? 'var(--green)' : 'var(--red)',
                                        display: 'flex', alignItems: 'start', gap: 10, animation: 'fade-in 150ms ease-out',
                                    }}>
                                        {llmResult.status === 'success' ? <CheckCircle2 size={15} style={{ flexShrink: 0, marginTop: 1 }} /> : <XCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />}
                                        <div>
                                            <div style={{ fontSize: 11.5, fontWeight: 800, textTransform: 'uppercase' }}>
                                                {llmResult.status === 'success' ? 'Verification Passed' : 'Verification Failed'}
                                            </div>
                                            <div style={{ fontSize: 10.5, marginTop: 2, opacity: 0.85 }}>{llmResult.message}</div>
                                            {llmResult.latency_seconds && (
                                                <div style={{ fontSize: 9, color: 'var(--tx-3)', marginTop: 4, fontFamily: 'monospace' }}>
                                                    Latency: {llmResult.latency_seconds}s
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* 2. FastWhisper STT Diagnostics form panel */}
                        <div className="ds-card">
                            <div className="ds-card-header">
                                <span className="ds-card-title"><Activity size={14} color="var(--accent)" /> Faster-Whisper STT Diagnostics</span>
                            </div>
                            <div className="ds-card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                                
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    <label style={{ fontSize: 9, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>STT Model Size</label>
                                    <select 
                                        value={sttModelSize} 
                                        onChange={(e) => setSttModelSize(e.target.value)} 
                                        style={{
                                            padding: '10px 14px', background: 'var(--bg-s2)', border: '1px solid var(--border)',
                                            borderRadius: 'var(--r-sm)', color: 'var(--tx-1)', fontSize: 12, outline: 'none',
                                        }}
                                    >
                                        <option value="tiny">Tiny (Fastest, low accuracy)</option>
                                        <option value="base">Base</option>
                                        <option value="small">Small</option>
                                        <option value="medium">Medium</option>
                                        <option value="large-v3">Large-v3 (Slowest, high accuracy)</option>
                                    </select>
                                </div>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    <label style={{ fontSize: 9, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Audio file (.wav, .mp3, .m4a)</label>
                                    <div style={{
                                        position: 'relative', border: '1px dashed var(--border-h)',
                                        borderRadius: 'var(--r-sm)', padding: '24px 16px', background: 'var(--bg-s2)',
                                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                                        cursor: 'pointer', textAlign: 'center', transition: 'all 200ms',
                                    }}
                                    onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent-b)'}
                                    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-h)'}
                                    >
                                        <input 
                                            type="file" accept="audio/*" 
                                            onChange={(e) => setSttFile(e.target.files ? e.target.files[0] : null)} 
                                            style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}
                                        />
                                        <Upload size={20} color="var(--tx-3)" style={{ marginBottom: 6 }} />
                                        <div style={{ fontSize: 11, fontWeight: 600, color: sttFile ? 'var(--tx-1)' : 'var(--tx-2)' }}>
                                            {sttFile ? sttFile.name : 'Choose audio...'}
                                        </div>
                                        <div style={{ fontSize: 9.5, color: 'var(--tx-3)', marginTop: 2 }}>
                                            {sttFile ? `${(sttFile.size / (1024 * 1024)).toFixed(2)} MB` : 'Drag & drop or browse'}
                                        </div>
                                    </div>
                                </div>

                                <button 
                                    onClick={handleTestStt} 
                                    disabled={sttLoading || !sttFile}
                                    style={{
                                        padding: '10px 24px', borderRadius: 'var(--r-sm)', border: 'none',
                                        background: sttLoading || !sttFile ? 'var(--bg-s3)' : 'linear-gradient(135deg, var(--accent), #D9BC7A)',
                                        color: sttLoading || !sttFile ? 'var(--tx-3)' : '#090C12',
                                        fontSize: 11, fontWeight: 800, cursor: sttLoading || !sttFile ? 'not-allowed' : 'pointer',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                                        textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: 6,
                                    }}
                                >
                                    {sttLoading ? <Loader2 size={13} className="spin-anim" /> : <Activity size={13} />}
                                    {sttLoading ? 'Processing Audio...' : 'Run STT Analysis'}
                                </button>

                                {sttResult && (
                                    <div style={{
                                        padding: '12px 14px', borderRadius: 'var(--r-md)',
                                        background: sttResult.status === 'success' ? 'var(--green-m)' : 'var(--red-m)',
                                        border: `1px solid ${sttResult.status === 'success' ? 'rgba(52,211,153,0.15)' : 'rgba(248,113,113,0.15)'}`,
                                        color: sttResult.status === 'success' ? 'var(--green)' : 'var(--red)',
                                        display: 'flex', alignItems: 'start', gap: 10, animation: 'fade-in 150ms ease-out',
                                    }}>
                                        {sttResult.status === 'success' ? <CheckCircle2 size={15} style={{ flexShrink: 0, marginTop: 1 }} /> : <XCircle size={15} style={{ flexShrink: 0, marginTop: 1 }} />}
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ fontSize: 11.5, fontWeight: 800, textTransform: 'uppercase' }}>
                                                {sttResult.status === 'success' ? 'Transcription OK' : 'Transcription Failed'}
                                            </div>
                                            {sttResult.status === 'success' ? (
                                                <>
                                                    <div style={{ fontSize: 10, color: 'var(--tx-2)', marginTop: 4 }}>
                                                        Language: <span style={{ color: 'var(--tx-1)', fontWeight: 600 }}>{sttResult.language}</span> · 
                                                        TTCA: <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{sttResult.ttca_seconds}s</span>
                                                    </div>
                                                    <div style={{
                                                        marginTop: 8, maxHeight: 100, overflowY: 'auto',
                                                        fontSize: 10, background: 'var(--bg-s3)', border: '1px solid var(--border)',
                                                        borderRadius: '4px', padding: '6px 8px', color: 'var(--tx-2)',
                                                        fontFamily: 'var(--font-family)', lineHeight: 1.45, whiteSpace: 'pre-wrap',
                                                    }} className="custom-scrollbar">
                                                        {sttResult.transcript}
                                                    </div>
                                                </>
                                            ) : (
                                                <div style={{ fontSize: 10.5, marginTop: 2, opacity: 0.85 }}>{sttResult.message}</div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                    </div>

                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }} className="animate-page">
                    
                    {/* GPU Real-time telemetry banner */}
                    <div className="mb-4">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                            <h3 style={{ fontSize: 13, fontWeight: 800, color: 'var(--tx-1)', display: 'flex', alignItems: 'center', gap: 6, margin: 0 }}>
                                <Cpu size={14} color="var(--accent)" /> Local Server Hardware Telemetry
                            </h3>
                            <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--green)', background: 'var(--green-m)', border: '1px solid var(--green-b)', padding: '2px 8px', borderRadius: '4px', textTransform: 'uppercase' }}>
                                CUDA Enabled
                            </span>
                        </div>
                        {telemetry ? (
                            telemetry.available ? (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                                    {telemetry.gpus.map((gpu: any) => (
                                        <div key={gpu.id} className="ds-card" style={{ padding: 14 }}>
                                            <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--tx-1)' }}>{gpu.name}</span>
                                            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--tx-2)' }}>
                                                        <span>GPU Utilization</span>
                                                        <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{gpu.gpu_utilization_percent}%</span>
                                                    </div>
                                                    <div style={{ width: '100%', height: 4, background: 'var(--bg-s3)', borderRadius: 2, overflow: 'hidden' }}>
                                                        <div style={{ width: `${gpu.gpu_utilization_percent}%`, height: '100%', background: 'linear-gradient(90deg, var(--accent), var(--accent-h))', borderRadius: 2 }} />
                                                    </div>
                                                </div>
                                                
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--tx-2)' }}>
                                                        <span>VRAM Memory allocation</span>
                                                        <span style={{ color: '#a855f7', fontWeight: 700 }}>{gpu.memory_used_mb}MB / {gpu.memory_total_mb}MB</span>
                                                    </div>
                                                    <div style={{ width: '100%', height: 4, background: 'var(--bg-s3)', borderRadius: 2, overflow: 'hidden' }}>
                                                        <div style={{ width: `${gpu.memory_utilization_percent}%`, height: '100%', background: '#a855f7', borderRadius: 2 }} />
                                                    </div>
                                                </div>

                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 10, color: 'var(--tx-2)', marginTop: 2 }}>
                                                    <span>Core Temperature</span>
                                                    <span style={{ color: gpu.temperature_c > 80 ? 'var(--red)' : 'var(--green)', fontWeight: 700 }}>{gpu.temperature_c}°C</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    <div className="ds-card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                                        <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--tx-1)' }}>System Resources</span>
                                        <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 8, fontSize: 11, color: 'var(--tx-2)' }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <span>CPU Core Usage:</span>
                                                <span style={{ color: 'var(--tx-1)', fontWeight: 700 }}>{telemetry.system.cpu_percent}%</span>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <span>RAM Memory Total:</span>
                                                <span style={{ color: 'var(--tx-1)', fontWeight: 700 }}>{telemetry.system.ram_used_mb}MB / {telemetry.system.ram_total_mb}MB</span>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <span>RAM Percentage:</span>
                                                <span style={{ color: 'var(--tx-1)', fontWeight: 700 }}>{telemetry.system.ram_percent}%</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div style={{ padding: '12px 16px', background: 'var(--amber-m)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: '8px', color: 'var(--amber)', fontSize: 12 }}>
                                    {telemetry.message || "Hardware CUDA/GPU telemetry is not available."}
                                </div>
                            )
                        ) : (
                            <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--tx-3)', fontSize: 12 }}>
                                <Loader2 size={20} className="spin-anim" style={{ margin: '0 auto 8px' }} />
                                Retrieving active hardware metrics...
                            </div>
                        )}
                    </div>

                    {/* Standard System Resource Bars from systemStats */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                        <div className="ds-card" style={{ padding: 14 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase' }}>CPU Load</span>
                                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', fontFamily: 'monospace' }}>{systemStats?.cpu_percent || 0}%</span>
                            </div>
                            <div style={{ width: '100%', height: 5, background: 'var(--bg-s3)', borderRadius: 3, overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${systemStats?.cpu_percent || 0}%`, background: 'var(--green)', borderRadius: 3 }} />
                            </div>
                        </div>

                        <div className="ds-card" style={{ padding: 14 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase' }}>System RAM</span>
                                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', fontFamily: 'monospace' }}>{systemStats?.memory?.used_gb || 0} / {systemStats?.memory?.total_gb || 0} GB</span>
                            </div>
                            <div style={{ width: '100%', height: 5, background: 'var(--bg-s3)', borderRadius: 3, overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${systemStats?.memory?.percent || 0}%`, background: 'linear-gradient(90deg, var(--accent), var(--accent-h))', borderRadius: 3 }} />
                            </div>
                        </div>

                        <div className="ds-card" style={{ padding: 14 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase' }}>Disk Storage</span>
                                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', fontFamily: 'monospace' }}>{systemStats?.disk?.used_gb || 0} / {systemStats?.disk?.total_gb || 0} GB</span>
                            </div>
                            <div style={{ width: '100%', height: 5, background: 'var(--bg-s3)', borderRadius: 3, overflow: 'hidden' }}>
                                <div style={{ height: '100%', width: `${systemStats?.disk?.percent || 0}%`, background: '#3b82f6', borderRadius: 3 }} />
                            </div>
                        </div>
                    </div>

                    {/* Analytics Filtering Controls */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 10 }}>
                        <h3 style={{ fontSize: 14, fontWeight: 800, color: 'var(--tx-1)', display: 'flex', alignItems: 'center', gap: 6, margin: 0 }}>
                            <BarChart2 size={15} color="var(--accent)" /> LLM Token usage & API Costs
                        </h3>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <select value={providerFilter} onChange={(e) => setProviderFilter(e.target.value)} style={{ padding: '6px 12px', background: 'var(--bg-s2)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', color: 'var(--tx-1)', fontSize: 11.5, outline: 'none' }}>
                                <option value="global">All Providers</option>
                                <option value="local">Local Only (vLLM)</option>
                                <option value="external">External Only</option>
                            </select>
                            <select value={period} onChange={(e) => setPeriod(e.target.value)} style={{ padding: '6px 12px', background: 'var(--bg-s2)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', color: 'var(--tx-1)', fontSize: 11.5, outline: 'none' }}>
                                <option value="today">Today</option>
                                <option value="week">Last 7 Days</option>
                                <option value="month">Last 30 Days</option>
                                <option value="30plus">All Time</option>
                            </select>
                        </div>
                    </div>

                    {/* KPI Metric cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                        <div className="ds-card" style={{ padding: 16, textAlign: 'center' }}>
                            <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0 }}>Total Tokens Consumed</p>
                            <p style={{ fontSize: 24, fontWeight: 800, color: 'var(--tx-1)', margin: '10px 0 0' }}>{totalTokens.toLocaleString()}</p>
                        </div>
                        <div className="ds-card" style={{ padding: 16, textAlign: 'center' }}>
                            <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0 }}>Total Audited Requests</p>
                            <p style={{ fontSize: 24, fontWeight: 800, color: '#3b82f6', margin: '10px 0 0' }}>{totalRequests.toLocaleString()}</p>
                        </div>
                        <div className="ds-card" style={{ padding: 16, textAlign: 'center' }}>
                            <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0 }}>Estimated API Cost</p>
                            <p style={{ fontSize: 24, fontWeight: 800, color: 'var(--green)', margin: '10px 0 0' }}>${totalCost.toFixed(4)}</p>
                        </div>
                    </div>

                    {/* Data Usage Table */}
                    <div className="ds-card" style={{ overflow: 'hidden' }}>
                        {loadingAnalytics ? (
                            <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--tx-3)' }}>
                                <Loader2 className="spin-anim" size={24} style={{ margin: '0 auto 8px' }} />
                                Loading telemetry data...
                            </div>
                        ) : (
                            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                                <thead>
                                    <tr style={{ background: 'var(--bg-s2)', borderBottom: '1px solid var(--border)' }}>
                                        <th style={{ padding: '12px 20px', fontSize: 10, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase' }}>Model Name</th>
                                        <th style={{ padding: '12px 20px', fontSize: 10, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase' }}>Provider</th>
                                        <th style={{ padding: '12px 20px', fontSize: 10, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase', textAlign: 'right' }}>Prompt Tokens</th>
                                        <th style={{ padding: '12px 20px', fontSize: 10, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase', textAlign: 'right' }}>Completion Tokens</th>
                                        <th style={{ padding: '12px 20px', fontSize: 10, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase', textAlign: 'right' }}>Total Tokens</th>
                                        <th style={{ padding: '12px 20px', fontSize: 10, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase', textAlign: 'right' }}>Requests</th>
                                        <th style={{ padding: '12px 20px', fontSize: 10, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase', textAlign: 'right' }}>Est. Cost</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredAnalytics.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} style={{ padding: '24px', textAlign: 'center', fontSize: 12, color: 'var(--tx-3)' }}>
                                                No token telemetry recorded in the selected period.
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredAnalytics.map((row, idx) => (
                                            <tr key={idx} style={{ borderBottom: '1px solid var(--border)', transition: 'background 150ms' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-s2)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                                                <td style={{ padding: '14px 20px', fontSize: 12.5, fontWeight: 700, color: 'var(--tx-1)' }}>{row.model}</td>
                                                <td style={{ padding: '14px 20px', fontSize: 12, color: 'var(--tx-2)', textTransform: 'capitalize' }}>{row.provider === 'ollama' ? 'Local (vLLM)' : row.provider}</td>
                                                <td style={{ padding: '14px 20px', fontSize: 12, color: 'var(--tx-3)', textAlign: 'right', fontFamily: 'monospace' }}>{row.prompt_tokens.toLocaleString()}</td>
                                                <td style={{ padding: '14px 20px', fontSize: 12, color: 'var(--tx-3)', textAlign: 'right', fontFamily: 'monospace' }}>{row.completion_tokens.toLocaleString()}</td>
                                                <td style={{ padding: '14px 20px', fontSize: 12, color: 'var(--tx-1)', fontWeight: 700, textAlign: 'right', fontFamily: 'monospace' }}>{row.total_tokens.toLocaleString()}</td>
                                                <td style={{ padding: '14px 20px', fontSize: 12, color: 'var(--tx-2)', textAlign: 'right' }}>{row.requests.toLocaleString()}</td>
                                                <td style={{ padding: '14px 20px', fontSize: 12, color: 'var(--green)', fontWeight: 700, textAlign: 'right', fontFamily: 'monospace' }}>${(row.estimated_cost || 0).toFixed(4)}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        )}
                    </div>

                </div>
            )}

        </div>
    );
};

export default SystemHealthPage;
