import React, { useState, useEffect } from 'react';
import { 
    testLlmConnection, 
    testSttTranscription, 
    fetchOllamaModels, 
    fetchHealthStatus, 
    fetchSystemStats,
    exportAuditLogs,
    releaseWorkers,
    applyActiveModel,
    fetchActiveModelStatus
} from '../api/diagnostics';
import toast from 'react-hot-toast';
import { Trash2, RefreshCcw, Cpu, Key, Globe, Upload, Activity, CheckCircle2, XCircle, Play, Square, Loader2 } from 'lucide-react';

const SystemDiagnosticsPage: React.FC = () => {
    const [provider, setProvider] = useState('ollama');
    const [model, setModel] = useState('hugging-quants/Meta-Llama-3.1-8B-Instruct-AWQ-INT4');
    const [apiKey, setApiKey] = useState('');
    const [apiBase, setApiBase] = useState('');
    const [llmResult, setLlmResult] = useState<any>(null);
    const [llmLoading, setLlmLoading] = useState(false);

    const [vllmStatus, setVllmStatus] = useState<any>(null);
    const [isTransitioning, setIsTransitioning] = useState(false);
    const [selectedOrchestrationModel, setSelectedOrchestrationModel] = useState('');

    const [sttFile, setSttFile] = useState<File | null>(null);
    const [sttModelSize, setSttModelSize] = useState('tiny');
    const [sttResult, setSttResult] = useState<any>(null);
    const [sttLoading, setSttLoading] = useState(false);

    const [localModels, setLocalModels] = useState<string[]>([]);
    const [isLoadingModels, setIsLoadingModels] = useState(false);

    const [healthStatus, setHealthStatus] = useState<any>(null);
    const [systemStats, setSystemStats] = useState<any>(null);
    const [isPolling, setIsPolling] = useState(true);

    const [isRecording, setIsRecording] = useState(false);
    const [recordingStartTime, setRecordingStartTime] = useState<string | null>(null);
    const [elapsedTime, setElapsedTime] = useState(0);

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
                        if (data.models && data.models.length > 0 && (!model || model === 'llama3.1:8b' || model === 'hugging-quants/Meta-Llama-3.1-8B-Instruct-AWQ-INT4')) {
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

    useEffect(() => {
        const checkModelStatus = async () => {
            try {
                const data = await fetchActiveModelStatus();
                setVllmStatus(data);
                
                if (data.target_model && !selectedOrchestrationModel) {
                    setSelectedOrchestrationModel(data.target_model);
                }

                if (isTransitioning && data.status === 'healthy' && data.active_model === data.target_model) {
                    setIsTransitioning(false);
                    toast.success(`Successfully loaded ${data.target_model} to GPU!`);
                }
            } catch (error) {
                console.error('Failed to fetch vLLM status:', error);
            }
        };

        checkModelStatus();
        const interval = setInterval(checkModelStatus, isTransitioning ? 2000 : 5000);
        return () => clearInterval(interval);
    }, [isTransitioning, selectedOrchestrationModel]);

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

    const handleApplyModel = async () => {
        if (!selectedOrchestrationModel) return;
        setIsTransitioning(true);
        try {
            const res = await applyActiveModel(selectedOrchestrationModel);
            if (res.status === 'success') {
                toast.success(`Applying ${selectedOrchestrationModel}. Starting container...`);
            } else {
                toast.error(`Transition error: ${res.message}`);
                setIsTransitioning(false);
            }
        } catch (error: any) {
            toast.error(`Failed to trigger transition: ${error.message}`);
            setIsTransitioning(false);
        }
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }} className="animate-page">
            
            {/* Header section with title and buttons */}
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--tx-1)', display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Activity size={24} color="var(--accent)" /> System Diagnostics
                    </h1>
                    <p style={{ fontSize: 13, color: 'var(--tx-3)' }}>
                        Monitor health metrics, test LLM APIs, benchmark Whisper models, and analyze system queues.
                    </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 10.5, color: 'var(--tx-3)', fontFamily: 'monospace', padding: '4px 8px', background: 'var(--bg-s2)', borderRadius: '4px', border: '1px solid var(--border)' }}>
                        API: {(() => {
                            let url = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001';
                            if (typeof window !== 'undefined' && url.includes('localhost') && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
                                url = `${window.location.protocol}//${window.location.hostname}:5001`;
                            }
                            return url;
                        })()}
                    </span>
                    <button 
                        onClick={() => setIsPolling(!isPolling)}
                        style={{
                            fontSize: 10, fontWeight: 700, padding: '6px 12px', borderRadius: 'var(--r-sm)',
                            background: isPolling ? 'var(--green-m)' : 'var(--bg-s3)',
                            border: `1px solid ${isPolling ? 'var(--green-b)' : 'var(--border)'}`,
                            color: isPolling ? 'var(--green)' : 'var(--tx-3)',
                            cursor: 'pointer', transition: 'all 150ms', textTransform: 'uppercase',
                        }}
                    >
                        {isPolling ? '● Polling On' : '○ Polling Off'}
                    </button>
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

            {/* Health Dashboard grid cards */}
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
                        <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--tx-1)', margin: '0 0 2px' }}>Audit Log Recording</h3>
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

            {/* Active GPU Model Orchestration Card */}
            <div className="ds-card" style={{
                background: 'linear-gradient(135deg, var(--bg-s1) 0%, rgba(201,169,98,0.02) 100%)',
                border: '1px solid var(--border)',
            }}>
                <div style={{ padding: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
                        <div style={{ display: 'flex', flex: '1', minWidth: '300px', flexDirection: 'column', gap: 4 }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                                GPU Model Orchestration
                            </div>
                            <h3 style={{ fontSize: 13, fontWeight: 800, color: 'var(--tx-1)', margin: '4px 0 2px' }}>
                                Active GPU Inference Engine (vLLM)
                            </h3>
                            <p style={{ fontSize: 11, color: 'var(--tx-3)', margin: 0 }}>
                                vLLM runs a highly optimized inference server directly on your GPU VRAM. Swap models dynamically below.
                            </p>
                        </div>
                        
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase' }}>Loaded Model</span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg-s3)', padding: '6px 12px', borderRadius: '4px', border: '1px solid var(--border)' }}>
                                    <span style={{
                                        width: 6, height: 6, borderRadius: '50%',
                                        background: vllmStatus?.status === 'healthy' ? 'var(--green)' : 
                                                    vllmStatus?.status === 'loading' ? 'var(--amber)' : 'var(--red)',
                                        animation: vllmStatus?.status === 'loading' ? 'pii-pulse 1.5s ease-in-out infinite' : 'none'
                                    }} />
                                    <span style={{ fontSize: 11, fontFamily: 'monospace', fontWeight: 700, color: 'var(--tx-1)' }}>
                                        {vllmStatus?.status === 'healthy' ? vllmStatus.active_model : 
                                         vllmStatus?.status === 'loading' ? `Loading: ${vllmStatus.target_model}` : 'Offline'}
                                    </span>
                                </div>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase' }}>Available Offline Models</span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <select 
                                        value={selectedOrchestrationModel || (vllmStatus?.target_model || '')}
                                        onChange={(e) => setSelectedOrchestrationModel(e.target.value)}
                                        style={{
                                            padding: '7px 14px', background: 'var(--bg-s2)', border: '1px solid var(--border)',
                                            borderRadius: 'var(--r-sm)', color: 'var(--tx-1)', fontSize: 11, outline: 'none',
                                            minWidth: '220px', cursor: 'pointer'
                                        }}
                                        disabled={isTransitioning}
                                    >
                                        {localModels.map((m) => (
                                            <option key={m} value={m}>{m}</option>
                                        ))}
                                    </select>
                                    <button
                                        onClick={handleApplyModel}
                                        disabled={isTransitioning || !selectedOrchestrationModel || selectedOrchestrationModel === vllmStatus?.active_model}
                                        style={{
                                            padding: '8px 16px', borderRadius: 'var(--r-sm)', border: 'none',
                                            background: isTransitioning || selectedOrchestrationModel === vllmStatus?.active_model ? 'var(--bg-s3)' : 'linear-gradient(135deg, var(--accent), #D9BC7A)',
                                            color: isTransitioning || selectedOrchestrationModel === vllmStatus?.active_model ? 'var(--tx-3)' : '#090C12',
                                            fontSize: 10, fontWeight: 800, cursor: (isTransitioning || selectedOrchestrationModel === vllmStatus?.active_model) ? 'not-allowed' : 'pointer',
                                            textTransform: 'uppercase', letterSpacing: '0.5px'
                                        }}
                                    >
                                        {isTransitioning ? 'Rebooting...' : 'Load to GPU'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Transition Progress Overlay */}
                    {isTransitioning && (
                        <div style={{
                            marginTop: 16, padding: '16px 20px', borderRadius: 'var(--r-md)',
                            background: 'var(--bg-s2)', border: '1px solid var(--border-h)',
                            animation: 'fade-in 200ms ease-out', display: 'flex', flexDirection: 'column', gap: 12
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <Loader2 size={16} className="spin-anim" color="var(--accent)" />
                                    <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--tx-1)' }}>
                                        Transitioning GPU weights to <span style={{ color: 'var(--accent)', fontFamily: 'monospace' }}>{selectedOrchestrationModel}</span>...
                                    </span>
                                </div>
                                <span style={{ fontSize: 9.5, fontFamily: 'monospace', color: 'var(--tx-3)' }}>
                                    Estimated time: ~45 seconds
                                </span>
                            </div>
                            
                            {/* Step Checklist */}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                                <div style={{
                                    padding: '8px 12px', borderRadius: 4, border: '1px solid var(--border)',
                                    background: vllmStatus?.container_state === 'restarting' || vllmStatus?.container_state === 'unknown' ? 'rgba(217,188,122,0.05)' : 'var(--bg-s3)',
                                    borderColor: vllmStatus?.container_state === 'restarting' ? 'var(--accent)' : 'var(--border)'
                                }}>
                                    <div style={{ fontSize: 8.5, fontWeight: 700, color: 'var(--tx-3)' }}>STEP 1</div>
                                    <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--tx-1)', marginTop: 2 }}>Stopping Engine</div>
                                </div>
                                
                                <div style={{
                                    padding: '8px 12px', borderRadius: 4, border: '1px solid var(--border)',
                                    background: vllmStatus?.container_state === 'running' && vllmStatus?.status === 'loading' ? 'rgba(217,188,122,0.05)' : 'var(--bg-s3)',
                                    borderColor: vllmStatus?.container_state === 'running' && vllmStatus?.status === 'loading' ? 'var(--accent)' : 'var(--border)'
                                }}>
                                    <div style={{ fontSize: 8.5, fontWeight: 700, color: 'var(--tx-3)' }}>STEP 2</div>
                                    <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--tx-1)', marginTop: 2 }}>Starting Instance</div>
                                </div>

                                <div style={{
                                    padding: '8px 12px', borderRadius: 4, border: '1px solid var(--border)',
                                    background: vllmStatus?.status === 'loading' ? 'rgba(217,188,122,0.05)' : 'var(--bg-s3)',
                                    borderColor: vllmStatus?.status === 'loading' ? 'var(--accent)' : 'var(--border)'
                                }}>
                                    <div style={{ fontSize: 8.5, fontWeight: 700, color: 'var(--tx-3)' }}>STEP 3</div>
                                    <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--tx-1)', marginTop: 2 }}>Loading VRAM Weights</div>
                                </div>

                                <div style={{
                                    padding: '8px 12px', borderRadius: 4, border: '1px solid var(--border)',
                                    background: vllmStatus?.status === 'healthy' ? 'rgba(52,211,153,0.05)' : 'var(--bg-s3)',
                                    borderColor: vllmStatus?.status === 'healthy' ? 'var(--green)' : 'var(--border)'
                                }}>
                                    <div style={{ fontSize: 8.5, fontWeight: 700, color: 'var(--tx-3)' }}>STEP 4</div>
                                    <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--tx-1)', marginTop: 2 }}>Handshake Complete</div>
                                </div>
                            </div>

                            {/* Animated progress bar */}
                            <div style={{ width: '100%', height: 4, background: 'var(--bg-s3)', borderRadius: 2, overflow: 'hidden' }}>
                                <div style={{
                                    height: '100%',
                                    width: vllmStatus?.status === 'healthy' ? '100%' : 
                                           vllmStatus?.status === 'loading' ? '75%' : 
                                           vllmStatus?.container_state === 'running' ? '50%' : '25%',
                                    background: 'linear-gradient(90deg, var(--accent), var(--accent-h))',
                                    transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
                                }} />
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Hardware System resource bars */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                
                {/* CPU usage progress gauge */}
                <div className="ds-card">
                    <div style={{ padding: 16 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>CPU Usage</span>
                            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', fontFamily: 'monospace' }}>{systemStats?.cpu_percent || 0}%</span>
                        </div>
                        <div style={{ width: '100%', height: 6, background: 'var(--bg-s3)', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{
                                height: '100%', borderRadius: 3, transition: 'width 1s ease-in-out',
                                width: `${systemStats?.cpu_percent || 0}%`,
                                background: systemStats?.cpu_percent > 80 ? 'var(--red)' : systemStats?.cpu_percent > 50 ? 'var(--amber)' : 'var(--green)',
                            }} />
                        </div>
                    </div>
                </div>

                {/* RAM Memory usage progress gauge */}
                <div className="ds-card">
                    <div style={{ padding: 16 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>RAM Memory</span>
                            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', fontFamily: 'monospace' }}>
                                {systemStats?.memory?.used_gb || 0} / {systemStats?.memory?.total_gb || 0} GB
                            </span>
                        </div>
                        <div style={{ width: '100%', height: 6, background: 'var(--bg-s3)', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{
                                height: '100%', borderRadius: 3, transition: 'width 1s ease-in-out',
                                width: `${systemStats?.memory?.percent || 0}%`,
                                background: 'linear-gradient(90deg, var(--accent), var(--accent-h))',
                            }} />
                        </div>
                    </div>
                </div>

                {/* Local Disk Storage usage progress gauge */}
                <div className="ds-card">
                    <div style={{ padding: 16 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Disk Storage</span>
                            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', fontFamily: 'monospace' }}>
                                {systemStats?.disk?.used_gb || 0} / {systemStats?.disk?.total_gb || 0} GB
                            </span>
                        </div>
                        <div style={{ width: '100%', height: 6, background: 'var(--bg-s3)', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{
                                height: '100%', borderRadius: 3, transition: 'width 1s ease-in-out',
                                width: `${systemStats?.disk?.percent || 0}%`,
                                background: 'linear-gradient(90deg, #3b82f6, #60a5fa)',
                            }} />
                        </div>
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

                        {/* Connection results message card */}
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

                        {/* STT connections/transcriptions result card */}
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
    );
};

export default SystemDiagnosticsPage;
