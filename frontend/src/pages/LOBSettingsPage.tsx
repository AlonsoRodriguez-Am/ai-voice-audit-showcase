// frontend/src/pages/LOBSettingsPage.tsx
import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import client from '../api/client';
import type { LOB } from '../types';
import {
  Settings,
  Cpu,
  Key,
  Plug,
  Save,
  Loader2,
  CheckCircle2,
  XCircle,
  ChevronDown,
  Zap,
  Globe,
  ArrowLeft,
  BrainCircuit,
  Sparkles,
  MessageSquare,
  Server,
  Check,
  Upload,
  Activity,
  ArrowRight,
  Sliders,
  AlertTriangle
} from 'lucide-react';
import toast from 'react-hot-toast';
import { fetchOllamaModels, fetchActiveModelStatus, applyActiveModel } from '../api/diagnostics';

// Helper to determine if a configured legacy model is equivalent to a loaded HuggingFace quant model
const isModelAligned = (configModel: string, activeModel: string): boolean => {
  if (!configModel || !activeModel) return true;
  if (configModel === activeModel) return true;
  
  const c = configModel.toLowerCase();
  const a = activeModel.toLowerCase();
  
  // Llama 3.1 8B equivalence
  if (c.includes('llama3.1') || c.includes('llama-3.1-8b') || c.includes('llama3.1:8b')) {
    if (a.includes('llama-3.1-8b') || a.includes('llama3.1:8b')) return true;
  }
  
  // Llama 3.2 3B equivalence
  if (c.includes('llama3.2') || c.includes('llama-3.2-3b') || c.includes('llama3.2:3b')) {
    if (a.includes('llama-3.2-3b') || a.includes('llama3.2:3b')) return true;
  }
  
  return false;
};

// ─── Types ──────────────────────────────────────────────────────────────────────

type LLMProvider = 'ollama' | 'openai' | 'grok' | 'gemini' | 'claude';

interface OllamaAdvancedSettings {
  temperature: number;
  top_p: number;
  top_k: number;
  repeat_penalty: number;
  num_ctx: number;
  seed: number | null;
  num_predict: number;
  auto_context: boolean;
}

interface LLMConfig {
  provider: LLMProvider;
  model: string;
  api_key: string;
  api_base: string;
  stt_model: string;
  advanced_settings?: OllamaAdvancedSettings;
}

interface TestResult {
  status: 'success' | 'error';
  message: string;
}

// ─── Provider Metadata ──────────────────────────────────────────────────────────

const DEFAULT_ADVANCED_SETTINGS: OllamaAdvancedSettings = {
  temperature: 0.0,
  top_p: 0.9,
  top_k: 40,
  repeat_penalty: 1.15,
  num_ctx: 8192,
  seed: 42,
  num_predict: 2048,
  auto_context: false,
};

const PROVIDERS: Record<LLMProvider, {
  label: string;
  description: string;
  icon: React.ElementType;
  paid: boolean;
  models: Array<{
    id: string;
    label: string;
    context: string;
    speed: 'Fast' | 'Very Fast' | 'Medium' | 'Slow';
  }>;
  defaultModel: string;
  defaultBase: string;
  color: string;
}> = {
  openai: {
    label: 'OpenAI GPT',
    description: 'GPT-4o / GPT-4o-mini',
    icon: BrainCircuit,
    paid: true,
    models: [
      { id: 'gpt-4o', label: 'GPT-4o', context: '128k', speed: 'Fast' },
      { id: 'gpt-4o-mini', label: 'GPT-4o Mini', context: '128k', speed: 'Very Fast' },
    ],
    defaultModel: 'gpt-4o-mini',
    defaultBase: 'https://api.openai.com/v1',
    color: '#34D399',
  },
  gemini: {
    label: 'Google Gemini',
    description: 'Gemini 3.1 Flash / Pro',
    icon: Sparkles,
    paid: true,
    models: [
      { id: 'gemini-3-flash-preview', label: 'Gemini 3 Flash (Preview)', context: '1M', speed: 'Very Fast' },
      { id: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash Lite', context: '1M', speed: 'Very Fast' },
      { id: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro (Preview)', context: '2M', speed: 'Fast' },
      { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', context: '1M', speed: 'Very Fast' },
      { id: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash Lite', context: '1M', speed: 'Very Fast' },
      { id: 'gemini-2.0-flash-lite', label: 'Gemini 2.0 Flash Lite', context: '1M', speed: 'Very Fast' },
    ],
    defaultModel: 'gemini-3.1-flash-lite',
    defaultBase: '',
    color: '#60A5FA',
  },
  grok: {
    label: 'xAI Grok',
    description: 'Grok-2 / Grok-beta',
    icon: Zap,
    paid: true,
    models: [
      { id: 'grok-2-1212', label: 'Grok-2', context: '128k', speed: 'Fast' },
      { id: 'grok-beta', label: 'Grok Beta', context: '128k', speed: 'Very Fast' },
    ],
    defaultModel: 'grok-beta',
    defaultBase: 'https://api.x.ai/v1',
    color: '#FBBF24',
  },
  claude: {
    label: 'Anthropic Claude',
    description: 'Claude 3.5 Sonnet / Haiku',
    icon: MessageSquare,
    paid: true,
    models: [
      { id: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet', context: '200k', speed: 'Fast' },
      { id: 'claude-3-haiku-20240307', label: 'Claude 3 Haiku', context: '200k', speed: 'Very Fast' },
    ],
    defaultModel: 'claude-3-5-sonnet-20241022',
    defaultBase: '',
    color: '#F97316',
  },
  ollama: {
    label: 'vLLM Local',
    description: 'Enterprise Continuous Batching local AI.',
    icon: Server,
    paid: false,
    models: [
      { id: 'hugging-quants/Meta-Llama-3.1-8B-Instruct-AWQ-INT4', label: 'Llama 3.1 8B AWQ', context: '128k', speed: 'Very Fast' },
      { id: 'neuralmagic/Llama-3.2-3B-Instruct-FP8', label: 'Llama 3.2 3B FP8', context: '128k', speed: 'Very Fast' },
    ],
    defaultModel: 'hugging-quants/Meta-Llama-3.1-8B-Instruct-AWQ-INT4',
    defaultBase: 'http://localhost:8899/v1',
    color: '#C9A962',
  },
};

// ─── Component ──────────────────────────────────────────────────────────────────

const LOBSettingsPage = ({ embedded = false }: { embedded?: boolean }) => {
  const queryClient = useQueryClient();

  // ─── State
  const [selectedLOBId, setSelectedLOBId] = useState<number | null>(null);
  const [llmConfig, setLlmConfig] = useState<LLMConfig>({
    provider: 'ollama',
    model: 'hugging-quants/Meta-Llama-3.1-8B-Instruct-AWQ-INT4',
    api_key: '',
    api_base: '',
    stt_model: 'tiny',
    advanced_settings: DEFAULT_ADVANCED_SETTINGS,
  });
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [sttTestResult, setSttTestResult] = useState<TestResult | null>(null);
  const [sttFile, setSttFile] = useState<File | null>(null);
  const [isTestingStt, setIsTestingStt] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  const [modelSelectorOpen, setModelSelectorOpen] = useState(false);
  const [isCustomModel, setIsCustomModel] = useState(false);
  const [localModels, setLocalModels] = useState<string[]>([]);
  const [isLoadingLocalModels, setIsLoadingLocalModels] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [activeGpuModel, setActiveGpuModel] = useState<string | null>(null);
  const [isModelTransitioning, setIsModelTransitioning] = useState<boolean>(false);
  const [vllmStatus, setVllmStatus] = useState<any>(null);

  // ─── Data
  const { data: lobs, isLoading: lobsLoading } = useQuery<LOB[]>({
    queryKey: ['lobs'],
    queryFn: async () => {
      const response = await client.get('/api/lobs/');
      return response.data;
    },
  });

  // ─── Load LLM config when LOB selection changes
  useEffect(() => {
    if (!selectedLOBId) return;

    const loadConfig = async () => {
      try {
        const response = await client.get(`/api/lobs/${selectedLOBId}/llm-config`);
        const config = response.data;
        const provider = (config.provider || 'ollama') as LLMProvider;
        const model = config.model || PROVIDERS[provider]?.defaultModel || 'hugging-quants/Meta-Llama-3.1-8B-Instruct-AWQ-INT4';
        
        // Check if model is a preset
        const isPreset = PROVIDERS[provider]?.models.some(m => m.id === model);
        
        setLlmConfig({
          provider,
          model,
          api_key: '',
          api_base: config.api_base || '',
          stt_model: config.stt_model || 'tiny',
          advanced_settings: config.advanced_settings || DEFAULT_ADVANCED_SETTINGS,
        });
        setIsCustomModel(!isPreset);
        setTestResult(null);
        setHasUnsavedChanges(false);
      } catch {
        // Default config if none saved
        setLlmConfig({
          provider: 'ollama',
          model: 'hugging-quants/Meta-Llama-3.1-8B-Instruct-AWQ-INT4',
          api_key: '',
          api_base: '',
          stt_model: 'tiny',
          advanced_settings: DEFAULT_ADVANCED_SETTINGS,
        });
      }
    };

    loadConfig();
  }, [selectedLOBId]);

  // Auto-select first LOB
  useEffect(() => {
    if (lobs && lobs.length > 0 && !selectedLOBId) {
      setSelectedLOBId(lobs[0].id);
    }
  }, [lobs, selectedLOBId]);
  
  // Fetch local Ollama models
  useEffect(() => {
    if (llmConfig.provider === 'ollama') {
      const loadLocalModels = async () => {
        setIsLoadingLocalModels(true);
        try {
          const data = await fetchOllamaModels();
          if (data.status === 'success') {
            setLocalModels(data.models || []);
          }
        } catch (error) {
          console.error('Failed to fetch Ollama models:', error);
        } finally {
          setIsLoadingLocalModels(false);
        }
      };
      loadLocalModels();
    }
  }, [llmConfig.provider]);

  // Fetch currently running GPU model and poll during transition
  useEffect(() => {
    const getGpuModelStatus = async () => {
      try {
        const data = await fetchActiveModelStatus();
        setActiveGpuModel(data.active_model);
        setVllmStatus(data);
        
        if (isModelTransitioning && data.status === 'healthy' && data.active_model === data.target_model) {
          setIsModelTransitioning(false);
          toast.success(`Successfully loaded ${data.target_model} to GPU!`);
        }
      } catch (error) {
        console.error('Failed to fetch active model status:', error);
      }
    };

    getGpuModelStatus();
    const interval = setInterval(getGpuModelStatus, isModelTransitioning ? 2000 : 8000);
    return () => clearInterval(interval);
  }, [isModelTransitioning]);

  // ─── Handlers

  const handleProviderChange = (provider: LLMProvider) => {
    const meta = PROVIDERS[provider];
    setLlmConfig((prev) => ({
      ...prev,
      provider,
      model: meta.defaultModel,
      api_key: '',
      api_base: meta.defaultBase,
      advanced_settings: provider === 'ollama' ? DEFAULT_ADVANCED_SETTINGS : prev.advanced_settings,
    }));
    setIsCustomModel(false);
    setTestResult(null);
    setHasUnsavedChanges(true);
  };

  const handleConfigChange = (field: keyof LLMConfig, value: any) => {
    setLlmConfig((prev) => ({ ...prev, [field]: value }));
    setTestResult(null);
    setHasUnsavedChanges(true);
  };

  const handleAdvancedSettingChange = (field: keyof OllamaAdvancedSettings, value: any) => {
    setLlmConfig((prev) => ({
      ...prev,
      advanced_settings: {
        ...prev.advanced_settings!,
        [field]: value
      }
    }));
    setHasUnsavedChanges(true);
  };

  const handleTestConnection = async () => {
    if (!selectedLOBId) return;

    setIsTesting(true);
    setTestResult(null);

    try {
      const payload: any = {
        provider: llmConfig.provider,
        model: llmConfig.model,
        advanced_settings: llmConfig.advanced_settings
      };
      if (llmConfig.api_key) payload.api_key = llmConfig.api_key;
      if (llmConfig.api_base) payload.api_base = llmConfig.api_base;

      const response = await client.post(
        `/api/lobs/${selectedLOBId}/test-llm`,
        payload
      );

      setTestResult({
        status: response.data.status,
        message: response.data.message,
      });

      if (response.data.status === 'success') {
        toast.success('Connection test passed!');
      } else {
        toast.error(response.data.message || 'Connection test failed');
      }
    } catch (error: any) {
      const msg = error.response?.data?.detail || error.response?.data?.message || error.message;
      setTestResult({ status: 'error', message: msg });
      toast.error('Connection test failed');
    } finally {
      setIsTesting(false);
    }
  };

  const handleTestStt = async () => {
    if (!sttFile) {
      toast.error('Please select an audio file to test');
      return;
    }

    setIsTestingStt(true);
    setSttTestResult(null);

    try {
      const formData = new FormData();
      formData.append('file', sttFile);
      formData.append('model_size', llmConfig.stt_model);

      const response = await client.post('/api/diagnostics/test-stt', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (response.data.status === 'success') {
        setSttTestResult({
          status: 'success',
          message: `Transcription successful! (TTCA: ${response.data.ttca_seconds}s)`,
        });
        toast.success('STT test passed!');
      } else {
        setSttTestResult({ status: 'error', message: response.data.message });
        toast.error('STT test failed');
      }
    } catch (error: any) {
      const msg = error.response?.data?.detail || error.message;
      setSttTestResult({ status: 'error', message: msg });
      toast.error('STT test failed');
    } finally {
      setIsTestingStt(false);
    }
  };

  const handleSaveConfig = async () => {
    if (!selectedLOBId) return;

    setIsSaving(true);
    try {
      const payload: any = {
        provider: llmConfig.provider,
        model: llmConfig.model,
        advanced_settings: llmConfig.advanced_settings
      };
      if (llmConfig.api_key) payload.api_key = llmConfig.api_key;
      if (llmConfig.api_base) payload.api_base = llmConfig.api_base;
      payload.stt_model = llmConfig.stt_model;

      await client.put(`/api/lobs/${selectedLOBId}/llm-config`, payload);

      toast.success('LLM configuration saved successfully!');
      setHasUnsavedChanges(false);
      queryClient.invalidateQueries({ queryKey: ['lobs'] });
    } catch (error: any) {
      const msg = error.response?.data?.detail || error.message;
      toast.error(`Failed to save: ${msg}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleLoadModelToGpu = async () => {
    setIsModelTransitioning(true);
    try {
      const res = await applyActiveModel(llmConfig.model);
      if (res.status === 'success') {
        toast.success(`Triggered transition to ${llmConfig.model}. Starting container restart...`);
      } else {
        toast.error(`Transition error: ${res.message}`);
        setIsModelTransitioning(false);
      }
    } catch (error: any) {
      toast.error(`Failed to trigger transition: ${error.message}`);
      setIsModelTransitioning(false);
    }
  };

  // ─── Derived
  const selectedLOB = lobs?.find((l) => l.id === selectedLOBId);
  const currentProvider = PROVIDERS[llmConfig.provider];
  
  const displayModels = (llmConfig.provider === 'ollama' && localModels.length > 0)
    ? localModels.map(m => ({ id: m, label: m, context: 'Local', speed: 'Variable' as const }))
    : currentProvider?.models || [];

  const isPaid = currentProvider?.paid;
  const canTest = llmConfig.provider === 'ollama' || !!llmConfig.api_key;

  if (lobsLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '64px 0' }}>
        <Loader2 className="spin-anim" size={32} color="var(--accent)" />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: embedded ? 0 : 24 }} className="animate-page">
      
      {/* Custom Title to fit dark theme */}
      {!embedded && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--tx-1)', display: 'flex', alignItems: 'center', gap: 10 }}>
            <Cpu size={24} color="var(--accent)" /> LLM Settings
          </h1>
          <p style={{ fontSize: 13, color: 'var(--tx-3)' }}>
            Configure artificial intelligence models and transcription parameters per Line of Business.
          </p>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20, alignItems: 'start' }}>
        
        {/* ─── LOB Selector (left panel) ─── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="ds-card">
            <div className="ds-card-header">
              <span className="ds-card-title">Business Lines</span>
            </div>
            <div className="ds-card-body" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {lobs?.map((lob) => {
                const isActive = selectedLOBId === lob.id;
                return (
                  <button
                    key={lob.id}
                    onClick={() => setSelectedLOBId(lob.id)}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '10px 12px', borderRadius: 'var(--r-sm)',
                      background: isActive ? 'var(--accent-m)' : 'var(--bg-s2)',
                      border: `1px solid ${isActive ? 'var(--accent-b)' : 'var(--border)'}`,
                      color: isActive ? 'var(--accent)' : 'var(--tx-2)',
                      textAlign: 'left', cursor: 'pointer', transition: 'all 150ms',
                    }}
                    onMouseEnter={e => {
                      if (!isActive) {
                        e.currentTarget.style.background = 'var(--bg-hover)';
                        e.currentTarget.style.color = 'var(--tx-1)';
                      }
                    }}
                    onMouseLeave={e => {
                      if (!isActive) {
                        e.currentTarget.style.background = 'var(--bg-s2)';
                        e.currentTarget.style.color = 'var(--tx-2)';
                      }
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {lob.name}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                        <span style={{
                          width: 5, height: 5, borderRadius: '50%',
                          background: lob.is_active ? 'var(--green)' : 'var(--tx-3)',
                        }} />
                        <span style={{ fontSize: 8, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                          {lob.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </div>
                    {isActive && <Check size={12} color="var(--accent)" strokeWidth={3} />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Secure indicator */}
          <div className="ds-card" style={{ background: 'linear-gradient(135deg, var(--bg-s1) 0%, rgba(201,169,98,0.02) 100%)' }}>
            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 'var(--r-sm)',
                background: 'var(--accent-m)', border: '1px solid var(--accent-b)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)',
              }}>
                <Key size={15} />
              </div>
              <h4 style={{ fontSize: 12, fontWeight: 700, color: 'var(--tx-1)' }}>Secure Storage</h4>
              <p style={{ fontSize: 10, color: 'var(--tx-3)', lineHeight: 1.4 }}>
                All API keys and credentials are encrypted at rest with AES-256 before storage.
              </p>
            </div>
          </div>
        </div>

        {/* ─── Config Panel (right) ─── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {!selectedLOB ? (
            <div className="ds-card" style={{ padding: '48px 0', textAlign: 'center' }}>
              <div style={{ width: 48, height: 48, margin: '0 auto 16px', color: 'var(--tx-3)' }}>
                <Cpu size={48} />
              </div>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--tx-1)' }}>No LOB Selected</h3>
              <p style={{ fontSize: 11, color: 'var(--tx-3)' }}>Select a line of business from the left to configure.</p>
            </div>
          ) : (
            <>
              {/* Provider Selection */}
              <div className="ds-card">
                <div className="ds-card-header">
                  <span className="ds-card-title">AI Infrastructure for {selectedLOB.name}</span>
                </div>
                <div className="ds-card-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  
                  {/* Select provider buttons */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
                    {(Object.keys(PROVIDERS) as LLMProvider[]).map((key) => {
                      const p = PROVIDERS[key];
                      const isActive = llmConfig.provider === key;
                      const Icon = p.icon;
                      return (
                        <button
                          key={key}
                          onClick={() => handleProviderChange(key)}
                          style={{
                            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                            padding: '12px 6px', borderRadius: 'var(--r-sm)',
                            background: isActive ? 'var(--accent-m)' : 'var(--bg-s2)',
                            border: `1px solid ${isActive ? 'var(--accent-b)' : 'var(--border)'}`,
                            color: isActive ? 'var(--accent)' : 'var(--tx-2)',
                            cursor: 'pointer', transition: 'all 150ms', gap: 6,
                          }}
                          onMouseEnter={e => {
                            if (!isActive) {
                              e.currentTarget.style.background = 'var(--bg-hover)';
                              e.currentTarget.style.color = 'var(--tx-1)';
                            }
                          }}
                          onMouseLeave={e => {
                            if (!isActive) {
                              e.currentTarget.style.background = 'var(--bg-s2)';
                              e.currentTarget.style.color = 'var(--tx-2)';
                            }
                          }}
                        >
                          <Icon size={16} color={isActive ? 'var(--accent)' : p.color} />
                          <span style={{ fontSize: 10, fontWeight: 700 }}>{p.label.split(' ')[0]}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Active provider detail banner */}
                  <div style={{
                    padding: '12px 14px', background: 'var(--bg-s2)', border: '1px solid var(--border)',
                    borderRadius: 'var(--r-md)', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{
                        width: 36, height: 36, borderRadius: 'var(--r-sm)',
                        background: 'var(--bg-s3)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: currentProvider.color,
                      }}>
                        <currentProvider.icon size={20} />
                      </div>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--tx-1)' }}>{currentProvider.label}</div>
                        <div style={{ fontSize: 10, color: 'var(--tx-3)' }}>{currentProvider.description}</div>
                      </div>
                    </div>
                    <span style={{
                      fontSize: 8, fontWeight: 800, padding: '2px 8px', borderRadius: '20px',
                      background: currentProvider.paid ? 'var(--amber-m)' : 'var(--green-m)',
                      color: currentProvider.paid ? 'var(--amber)' : 'var(--green)',
                      border: `1px solid ${currentProvider.paid ? 'rgba(251,191,36,0.15)' : 'rgba(52,211,153,0.15)'}`,
                      letterSpacing: '0.8px', textTransform: 'uppercase',
                    }}>
                      {currentProvider.paid ? 'API Keys Active' : 'Self-hosted'}
                    </span>
                  </div>

                  {/* Model input field */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <label style={{ fontSize: 9, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Model Name
                    </label>

                    {!isCustomModel ? (
                      <div style={{ position: 'relative' }}>
                        <button
                          type="button"
                          onClick={() => setModelSelectorOpen(!modelSelectorOpen)}
                          style={{
                            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '10px 14px', border: '1px solid var(--border)',
                            borderRadius: 'var(--r-sm)', color: 'var(--tx-1)', fontSize: 12, fontWeight: 600,
                            cursor: 'pointer', outline: 'none', background: 'var(--bg-s2)',
                          }}
                          onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--border-h)'}
                          onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Cpu size={14} color="var(--accent)" />
                            <span>{llmConfig.model}</span>
                          </div>
                          <ChevronDown size={14} color="var(--tx-3)" style={{ transition: 'transform 150ms', transform: modelSelectorOpen ? 'rotate(180deg)' : 'none' }} />
                        </button>

                        {modelSelectorOpen && (
                          <div style={{
                            position: 'absolute', zIndex: 10, width: '100%',
                            background: 'var(--bg-s1)', border: '1px solid var(--border-h)',
                            borderRadius: 'var(--r-sm)', marginTop: 4, overflow: 'hidden',
                            boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
                          }}>
                            <div style={{ maxHeight: 200, overflowY: 'auto' }} className="custom-scrollbar">
                              {isLoadingLocalModels && llmConfig.provider === 'ollama' ? (
                                <div style={{ padding: '16px 0', textAlign: 'center', color: 'var(--tx-3)', fontSize: 11 }}>
                                  <Loader2 size={16} className="spin-anim" style={{ margin: '0 auto 6px' }} />
                                  Scanning local models...
                                </div>
                              ) : displayModels.map((model) => (
                                <button
                                  key={model.id}
                                  type="button"
                                  onClick={() => {
                                    handleConfigChange('model', model.id);
                                    setModelSelectorOpen(false);
                                  }}
                                  style={{
                                    width: '100%', padding: '10px 12px', display: 'flex', alignItems: 'center',
                                    justifyContent: 'space-between', background: 'none', border: 'none',
                                    color: llmConfig.model === model.id ? 'var(--accent)' : 'var(--tx-2)',
                                    cursor: 'pointer', textAlign: 'left', fontSize: 11.5,
                                    borderBottom: '1px solid var(--border)',
                                  }}
                                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                                  onMouseLeave={e => e.currentTarget.style.background = 'none'}
                                >
                                  <div>
                                    <div style={{ fontWeight: 600 }}>{model.label}</div>
                                    <div style={{ fontSize: 9, color: 'var(--tx-3)', marginTop: 2 }}>{model.context} ctx · {model.speed}</div>
                                  </div>
                                  {llmConfig.model === model.id && <Check size={12} color="var(--accent)" strokeWidth={3} />}
                                </button>
                              ))}
                              <div style={{ borderTop: '1px solid var(--border)' }}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setIsCustomModel(true);
                                    setModelSelectorOpen(false);
                                  }}
                                  style={{
                                    width: '100%', padding: '10px 12px', display: 'flex', alignItems: 'center',
                                    gap: 6, background: 'none', border: 'none', color: 'var(--accent)',
                                    cursor: 'pointer', textTransform: 'uppercase', fontSize: 9.5, fontWeight: 700,
                                    letterSpacing: '0.5px',
                                  }}
                                >
                                  <Settings size={12} /> Use custom model...
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <div style={{
                          flex: 1, display: 'flex', alignItems: 'center', gap: 8,
                          padding: '10px 14px', background: 'var(--bg-s2)', border: '1px solid var(--accent-b)',
                          borderRadius: 'var(--r-sm)',
                        }}>
                          <Cpu size={14} color="var(--accent)" />
                          <input
                            type="text"
                            value={llmConfig.model}
                            onChange={(e) => handleConfigChange('model', e.target.value)}
                            style={{
                              background: 'none', border: 'none', outline: 'none',
                              color: 'var(--tx-1)', fontSize: 12, fontWeight: 600, width: '100%',
                            }}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setIsCustomModel(false);
                            handleConfigChange('model', currentProvider.defaultModel);
                          }}
                          style={{
                            padding: '10px 14px', background: 'var(--bg-s3)', border: '1px solid var(--border)',
                            borderRadius: 'var(--r-sm)', color: 'var(--tx-2)', cursor: 'pointer',
                          }}
                        >
                          <ArrowLeft size={14} />
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Dynamic GPU Model Alignment Warning Banner */}
                  {llmConfig.provider === 'ollama' && activeGpuModel && !isModelAligned(llmConfig.model, activeGpuModel) && (
                    <div style={{
                      padding: '12px 14px', borderRadius: 'var(--r-md)',
                      background: 'rgba(251,191,36,0.04)',
                      border: '1px solid rgba(251,191,36,0.15)',
                      color: 'var(--amber)',
                      display: 'flex', flexDirection: 'column', gap: 10,
                      animation: 'fade-in 200ms ease-out',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'start', gap: 8 }}>
                        <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                        <div style={{ fontSize: 11, lineHeight: 1.45 }}>
                          <span style={{ fontWeight: 800, textTransform: 'uppercase', display: 'block', marginBottom: 2 }}>
                            Inference Engine Mismatch
                          </span>
                          This LOB is configured to use <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{llmConfig.model}</span>, but the GPU is currently running <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--tx-1)' }}>{activeGpuModel}</span>. 
                        </div>
                      </div>
                      
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
                        {isModelTransitioning ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, fontFamily: 'monospace', color: 'var(--tx-2)' }}>
                            <Loader2 size={12} className="spin-anim" /> 
                            Rebooting GPU Engine ({vllmStatus?.container_state || 'loading'})...
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={handleLoadModelToGpu}
                            style={{
                              padding: '5px 10px', background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.25)',
                              borderRadius: 'var(--r-xs)', color: 'var(--amber)', fontSize: 9.5, fontWeight: 800,
                              cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.5px', transition: 'all 150ms'
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(251,191,36,0.15)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'rgba(251,191,36,0.1)'}
                          >
                            Load config to GPU Now
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Advanced settings */}
                  <div style={{ marginTop: 4 }}>
                    <button
                      type="button"
                      onClick={() => setAdvancedOpen(!advancedOpen)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none',
                        color: 'var(--accent)', fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase',
                        letterSpacing: '0.8px', cursor: 'pointer',
                      }}
                    >
                      <Sliders size={12} />
                      {advancedOpen ? 'Hide Advanced Settings' : 'Advanced Inference Settings (Expert Mode)'}
                      <ChevronDown size={12} style={{ transition: 'transform 150ms', transform: advancedOpen ? 'rotate(180deg)' : 'none' }} />
                    </button>

                    {advancedOpen && (
                      <div style={{
                        marginTop: 12, padding: 16, background: 'var(--bg-s2)', border: '1px solid var(--border)',
                        borderRadius: 'var(--r-md)', display: 'flex', flexDirection: 'column', gap: 16,
                        animation: 'fade-in 200ms ease-out',
                      }}>
                        {/* Temperature & Top P sliders */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <label style={{ fontSize: 9, color: 'var(--tx-3)', textTransform: 'uppercase', fontWeight: 600 }}>Temperature</label>
                              <span style={{ fontSize: 9.5, color: 'var(--accent)', fontWeight: 700 }}>
                                {llmConfig.advanced_settings?.temperature.toFixed(2)}
                              </span>
                            </div>
                            <input
                              type="range"
                              min="0" max="1.5" step="0.05"
                              value={llmConfig.advanced_settings?.temperature}
                              onChange={(e) => handleAdvancedSettingChange('temperature', parseFloat(e.target.value))}
                              style={{ accentColor: 'var(--accent)', width: '100%' }}
                            />
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <label style={{ fontSize: 9, color: 'var(--tx-3)', textTransform: 'uppercase', fontWeight: 600 }}>Top P</label>
                              <span style={{ fontSize: 9.5, color: 'var(--accent)', fontWeight: 700 }}>
                                {llmConfig.advanced_settings?.top_p.toFixed(2)}
                              </span>
                            </div>
                            <input
                              type="range"
                              min="0" max="1" step="0.05"
                              value={llmConfig.advanced_settings?.top_p}
                              onChange={(e) => handleAdvancedSettingChange('top_p', parseFloat(e.target.value))}
                              style={{ accentColor: 'var(--accent)', width: '100%' }}
                            />
                          </div>
                        </div>

                        {/* Top K & Repeat Penalty sliders */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <label style={{ fontSize: 9, color: 'var(--tx-3)', textTransform: 'uppercase', fontWeight: 600 }}>Top K</label>
                              <span style={{ fontSize: 9.5, color: 'var(--accent)', fontWeight: 700 }}>
                                {llmConfig.advanced_settings?.top_k}
                              </span>
                            </div>
                            <input
                              type="number"
                              min="0" max="100" step="1"
                              value={llmConfig.advanced_settings?.top_k}
                              onChange={(e) => handleAdvancedSettingChange('top_k', parseInt(e.target.value))}
                              style={{
                                padding: '8px 10px', background: 'var(--bg-s1)', border: '1px solid var(--border)',
                                borderRadius: 'var(--r-sm)', color: 'var(--tx-1)', fontSize: 11, outline: 'none',
                              }}
                            />
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <label style={{ fontSize: 9, color: 'var(--tx-3)', textTransform: 'uppercase', fontWeight: 600 }}>Repeat Penalty</label>
                              <span style={{ fontSize: 9.5, color: 'var(--accent)', fontWeight: 700 }}>
                                {llmConfig.advanced_settings?.repeat_penalty.toFixed(2)}
                              </span>
                            </div>
                            <input
                              type="range"
                              min="1" max="2" step="0.05"
                              value={llmConfig.advanced_settings?.repeat_penalty}
                              onChange={(e) => handleAdvancedSettingChange('repeat_penalty', parseFloat(e.target.value))}
                              style={{ accentColor: 'var(--accent)', width: '100%' }}
                            />
                          </div>
                        </div>

                        {/* Seed & Auto Context */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <label style={{ fontSize: 9, color: 'var(--tx-3)', textTransform: 'uppercase', fontWeight: 600 }}>Random Seed (0 = Default)</label>
                            <input
                              type="number"
                              value={llmConfig.advanced_settings?.seed ?? 0}
                              onChange={(e) => {
                                const val = parseInt(e.target.value);
                                handleAdvancedSettingChange('seed', val === 0 ? null : val);
                              }}
                              style={{
                                padding: '8px 10px', background: 'var(--bg-s1)', border: '1px solid var(--border)',
                                borderRadius: 'var(--r-sm)', color: 'var(--tx-1)', fontSize: 11, outline: 'none',
                              }}
                            />
                          </div>
                          
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, justifyContent: 'center' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginTop: 14 }}>
                              <input
                                type="checkbox"
                                checked={llmConfig.advanced_settings?.auto_context || false}
                                onChange={(e) => handleAdvancedSettingChange('auto_context', e.target.checked)}
                                style={{ accentColor: 'var(--accent)', width: 14, height: 14 }}
                              />
                              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--tx-1)' }}>Auto Context Scaling</span>
                            </label>
                          </div>
                        </div>

                        {/* Context Window & Max Tokens */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <label style={{ fontSize: 9, color: 'var(--tx-3)', textTransform: 'uppercase', fontWeight: 600 }}>Context Window</label>
                            <select
                              value={llmConfig.advanced_settings?.num_ctx}
                              onChange={(e) => handleAdvancedSettingChange('num_ctx', parseInt(e.target.value))}
                              style={{
                                padding: '8px 10px', background: 'var(--bg-s1)', border: '1px solid var(--border)',
                                borderRadius: 'var(--r-sm)', color: 'var(--tx-1)', fontSize: 11, outline: 'none',
                              }}
                            >
                              <option value={2048}>2,048 (Short Calls)</option>
                              <option value={4096}>4,096 (Standard)</option>
                              <option value={8192}>8,192 (Long Calls)</option>
                              <option value={16384}>16,384 (X-Large)</option>
                              <option value={32768}>32,768 (Turbo)</option>
                            </select>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <label style={{ fontSize: 9, color: 'var(--tx-3)', textTransform: 'uppercase', fontWeight: 600 }}>Max Predict Tokens</label>
                            <input
                              type="number"
                              value={llmConfig.advanced_settings?.num_predict}
                              onChange={(e) => handleAdvancedSettingChange('num_predict', parseInt(e.target.value))}
                              style={{
                                padding: '8px 10px', background: 'var(--bg-s1)', border: '1px solid var(--border)',
                                borderRadius: 'var(--r-sm)', color: 'var(--tx-1)', fontSize: 11, outline: 'none',
                              }}
                            />
                          </div>
                        </div>

                        {/* Warning for high Num_CTX */}
                        {llmConfig.advanced_settings && llmConfig.advanced_settings.num_ctx > 8192 && (
                          <div style={{
                            display: 'flex', gap: 8, padding: '8px 10px', background: 'var(--red-m)',
                            border: '1px solid rgba(248,113,113,0.15)', borderRadius: 'var(--r-sm)',
                          }}>
                            <AlertTriangle size={14} color="var(--red)" style={{ flexShrink: 0 }} />
                            <p style={{ fontSize: 9, fontWeight: 600, color: 'var(--red)', lineHeight: 1.4, margin: 0, textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                              Warning: High context size dramatically increases GPU VRAM consumption. Ensure hardware compliance.
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* API Secret Key (Paid Only) */}
                  {isPaid && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <label style={{ fontSize: 9, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        API Secret Key
                      </label>
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px',
                        background: 'var(--bg-s2)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)',
                      }}>
                        <Key size={14} color="var(--tx-3)" />
                        <input
                          type="password"
                          value={llmConfig.api_key}
                          onChange={(e) => handleConfigChange('api_key', e.target.value)}
                          placeholder="••••••••••••••••••••••••"
                          style={{
                            background: 'none', border: 'none', outline: 'none',
                            color: 'var(--tx-1)', fontSize: 12, width: '100%',
                          }}
                        />
                      </div>
                    </div>
                  )}

                  {/* API Base URL */}
                  {isPaid && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <label style={{ fontSize: 9, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Endpoint Base URL (Optional)
                      </label>
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px',
                        background: 'var(--bg-s2)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)',
                      }}>
                        <Globe size={14} color="var(--tx-3)" />
                        <input
                          type="text"
                          value={llmConfig.api_base}
                          onChange={(e) => handleConfigChange('api_base', e.target.value)}
                          placeholder={currentProvider.defaultBase || 'Default cloud endpoint'}
                          style={{
                            background: 'none', border: 'none', outline: 'none',
                            color: 'var(--tx-1)', fontSize: 12, width: '100%',
                          }}
                        />
                      </div>
                    </div>
                  )}

                </div>
              </div>

              {/* STT Configuration */}
              <div className="ds-card">
                <div className="ds-card-header">
                  <span className="ds-card-title">Transcription (STT) Engine</span>
                </div>
                <div className="ds-card-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <label style={{ fontSize: 9, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Whisper Model Size
                    </label>
                    <select
                      value={llmConfig.stt_model}
                      onChange={(e) => handleConfigChange('stt_model', e.target.value)}
                      style={{
                        padding: '10px 14px', background: 'var(--bg-s2)', border: '1px solid var(--border)',
                        borderRadius: 'var(--r-sm)', color: 'var(--tx-1)', fontSize: 12, outline: 'none',
                      }}
                    >
                      <option value="tiny">Tiny (Ultra-Fast)</option>
                      <option value="base">Base (Fast)</option>
                      <option value="small">Small (Balanced)</option>
                      <option value="medium">Medium (Accurate)</option>
                      <option value="large-v3">Large-V3 (Professional)</option>
                    </select>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <label style={{ fontSize: 9, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Test Audio Diagnostic
                    </label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <div style={{
                        flex: 1, position: 'relative', border: '1px dashed var(--border-h)',
                        borderRadius: 'var(--r-sm)', padding: '6px 10px', background: 'var(--bg-s2)',
                        display: 'flex', alignItems: 'center', minWidth: 0,
                      }}>
                        <input
                          type="file" accept="audio/*"
                          onChange={(e) => setSttFile(e.target.files?.[0] || null)}
                          style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}
                        />
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, width: '100%' }}>
                          <Upload size={12} color="var(--tx-3)" />
                          <span style={{ fontSize: 11, color: sttFile ? 'var(--tx-1)' : 'var(--tx-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {sttFile ? sttFile.name : 'Select file...'}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={handleTestStt}
                        disabled={isTestingStt || !sttFile}
                        style={{
                          padding: '0 16px', borderRadius: 'var(--r-sm)',
                          background: isTestingStt || !sttFile ? 'var(--bg-s3)' : 'var(--accent-m)',
                          border: `1px solid ${isTestingStt || !sttFile ? 'var(--border)' : 'var(--accent-b)'}`,
                          color: isTestingStt || !sttFile ? 'var(--tx-3)' : 'var(--accent)',
                          fontSize: 10, fontWeight: 700, cursor: isTestingStt || !sttFile ? 'not-allowed' : 'pointer',
                          display: 'flex', alignItems: 'center', gap: 4, textTransform: 'uppercase',
                        }}
                      >
                        {isTestingStt ? <Loader2 size={12} className="spin-anim" /> : <Activity size={12} />}
                        TEST
                      </button>
                    </div>
                  </div>
                </div>

                {sttTestResult && (
                  <div style={{
                    margin: '16px', marginTop: 0, padding: '10px 12px', borderRadius: 'var(--r-sm)',
                    background: sttTestResult.status === 'success' ? 'var(--green-m)' : 'var(--red-m)',
                    border: `1px solid ${sttTestResult.status === 'success' ? 'rgba(52,211,153,0.15)' : 'rgba(248,113,113,0.15)'}`,
                    color: sttTestResult.status === 'success' ? 'var(--green)' : 'var(--red)',
                    display: 'flex', alignItems: 'center', gap: 6, fontSize: 11,
                  }}>
                    {sttTestResult.status === 'success' ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                    <span>{sttTestResult.message}</span>
                  </div>
                )}
              </div>

              {/* Action Save/Test bottom block */}
              <div className="ds-card" style={{ background: 'var(--bg-s1)', border: '1px solid var(--border)' }}>
                <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <button
                      onClick={handleTestConnection}
                      disabled={isTesting || !canTest}
                      style={{
                        padding: '10px 20px', borderRadius: 'var(--r-sm)',
                        background: isTesting || !canTest ? 'var(--bg-s3)' : 'var(--bg-s2)',
                        border: `1px solid ${isTesting || !canTest ? 'var(--border)' : 'var(--accent)'}`,
                        color: isTesting || !canTest ? 'var(--tx-3)' : 'var(--accent)',
                        fontSize: 11, fontWeight: 700, cursor: isTesting || !canTest ? 'not-allowed' : 'pointer',
                        display: 'flex', alignItems: 'center', gap: 6, textTransform: 'uppercase', letterSpacing: '0.5px',
                        transition: 'all 150ms',
                      }}
                      onMouseEnter={e => {
                        if (!isTesting && canTest) {
                          e.currentTarget.style.background = 'var(--accent-m)';
                        }
                      }}
                      onMouseLeave={e => {
                        if (!isTesting && canTest) {
                          e.currentTarget.style.background = 'var(--bg-s2)';
                        }
                      }}
                    >
                      {isTesting ? <Loader2 size={13} className="spin-anim" /> : <Plug size={13} />}
                      {isTesting ? 'Testing...' : 'Test Connection'}
                    </button>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: testResult?.status === 'success' ? 'var(--green)' : 'var(--tx-3)' }} />
                        <span style={{ fontSize: 8, color: 'var(--tx-3)', fontWeight: 700 }}>LLM</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: sttTestResult?.status === 'success' ? 'var(--green)' : 'var(--tx-3)' }} />
                        <span style={{ fontSize: 8, color: 'var(--tx-3)', fontWeight: 700 }}>STT</span>
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {hasUnsavedChanges && (
                      <span style={{
                        fontSize: 8.5, fontWeight: 800, padding: '2px 8px', borderRadius: '4px',
                        background: 'var(--amber-m)', color: 'var(--amber)', border: '1px solid rgba(251,191,36,0.15)',
                        letterSpacing: '0.5px', textTransform: 'uppercase',
                      }}>
                        Unsaved Changes
                      </span>
                    )}
                    <button
                      onClick={handleSaveConfig}
                      disabled={isSaving}
                      style={{
                        padding: '10px 24px', borderRadius: 'var(--r-sm)',
                        background: 'linear-gradient(135deg, var(--accent), #D9BC7A)',
                        border: 'none', color: '#090C12', fontSize: 11, fontWeight: 800,
                        cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                        textTransform: 'uppercase', letterSpacing: '0.5px', transition: 'all 150ms',
                      }}
                      onMouseEnter={e => e.currentTarget.style.boxShadow = '0 0 16px rgba(201,169,98,0.35)'}
                      onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
                    >
                      {isSaving ? <Loader2 size={13} className="spin-anim" /> : <Save size={13} />}
                      {isSaving ? 'Saving...' : 'Save Config'}
                      <ArrowRight size={13} />
                    </button>
                  </div>
                </div>
              </div>

              {/* LLM test message banner */}
              {testResult && (
                <div style={{
                  padding: '14px 16px', borderRadius: 'var(--r-md)',
                  background: testResult.status === 'success' ? 'var(--green-m)' : 'var(--red-m)',
                  border: `1px solid ${testResult.status === 'success' ? 'rgba(52,211,153,0.15)' : 'rgba(248,113,113,0.15)'}`,
                  color: testResult.status === 'success' ? 'var(--green)' : 'var(--red)',
                  display: 'flex', alignItems: 'start', gap: 10, animation: 'fade-in 200ms ease-out',
                }}>
                  {testResult.status === 'success' ? <CheckCircle2 size={16} style={{ flexShrink: 0 }} /> : <XCircle size={16} style={{ flexShrink: 0 }} />}
                  <div>
                    <div style={{ fontSize: 11.5, fontWeight: 800, textTransform: 'uppercase' }}>
                      {testResult.status === 'success' ? 'Connection Verified' : 'Connection Error'}
                    </div>
                    <div style={{ fontSize: 10.5, marginTop: 2, opacity: 0.85 }}>{testResult.message}</div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default LOBSettingsPage;
