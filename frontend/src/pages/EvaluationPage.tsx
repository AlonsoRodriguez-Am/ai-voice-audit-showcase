import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import client from '../api/client';
import type { LOB } from '../types';
import { CloudUpload, Play, Pause, Loader2, Check, X, FileAudio, ShieldCheck, RotateCcw, HelpCircle } from 'lucide-react';
import { ScoreRing, TranscriptBubble, CriteriaCard, WaveformProgressBar } from '../components/ui/EvalHelpers';
import { CallMetadataBar } from '../components/ui/EvalHelpers';

const EvaluationPage = () => {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const evalIdParam = searchParams.get('id');

  const [file, setFile] = useState<File | null>(null);
  const [selectedLOB, setSelectedLOB] = useState<string>('');
  const [processingResult, setProcessingResult] = useState<any>(null);
  const [localAnswers, setLocalAnswers] = useState<Record<string, any>>({});
  const [humanObservations, setHumanObservations] = useState('');
  const [reviewStartTime, setReviewStartTime] = useState<number | null>(null);
  
  // Task polling state
  const [taskId, setTaskId] = useState<string | null>(null);
  const [progressMsg, setProgressMsg] = useState('');
  const [progressPct, setProgressPct] = useState(0);
  const [currentStage, setCurrentStage] = useState(1);
  const [isPaused, setIsPaused] = useState(false);
  
  // Live progressive data fields
  const [evalCallUid, setEvalCallUid] = useState('');
  const [partialTranscript, setPartialTranscript] = useState('');
  const [criteriaProgress, setCriteriaProgress] = useState<Record<string, any>>({});
  const [, setLatestCriterion] = useState('');
  const [criteriaDone, setCriteriaDone] = useState(0);
  const [totalCriteria, setTotalCriteria] = useState(0);
  const [evalMetadata, setEvalMetadata] = useState<{ model?: string; provider?: string; params?: any }>({});

  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Audio player state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Generate unique Call UID when a file is selected
  useEffect(() => {
    if (file) {
      const url = URL.createObjectURL(file);
      setAudioUrl(url);
      
      const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
      setEvalCallUid(`AUD-${today}-${randomPart}`);
      
      return () => URL.revokeObjectURL(url);
    } else {
      setAudioUrl(null);
      setIsPlaying(false);
      setCurrentTime(0);
      setEvalCallUid('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [file]);

  const formatTime = (t: number) => {
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const { data: lobs } = useQuery<LOB[]>({
    queryKey: ['lobs'],
    queryFn: async () => (await client.get('/api/lobs/active')).data,
  });

  const loadEvaluation = async (evaluationId: number) => {
    try {
      setProgressMsg('Loading evaluation details...');
      if (audioRef.current) {
        audioRef.current.pause();
        setIsPlaying(false);
      }
      
      const { data } = await client.get(`/api/evaluation/${evaluationId}`);
      setProcessingResult(data);
      setLocalAnswers(data.final_answers || {});
      setHumanObservations(data.human_observations || '');
      setSelectedLOB(String(data.lob_id || ''));
      setEvalCallUid(data.eval_call_uid || data.call_id || '');
      setEvalMetadata({
        model: data.eval_model,
        provider: data.eval_provider,
        params: data.eval_params_json,
      });
      setReviewStartTime(Date.now());
    } catch (err: any) {
      alert("Failed to load evaluation: " + (err.response?.data?.detail || err.message));
    }
  };

  // Detect and load search ID parameter from redirect
  useEffect(() => {
    if (evalIdParam) {
      const id = parseInt(evalIdParam, 10);
      if (!isNaN(id)) {
        loadEvaluation(id);
        setSearchParams({}, { replace: true });
      }
    }
  }, [evalIdParam, searchParams]);

  useEffect(() => {
    if (lobs && lobs.length > 0 && !selectedLOB) setSelectedLOB(String(lobs[0].id));
  }, [lobs, selectedLOB]);

  const processMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      return (await client.post(`/api/evaluation/process-audio?lob_id=${selectedLOB}&eval_call_uid=${evalCallUid}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })).data;
    },
    onSuccess: (data) => {
      setTaskId(data.task_id);
      setProgressMsg('Initializing task...');
      setProgressPct(0);
      setCurrentStage(1);
      setIsPaused(false);
      setPartialTranscript('');
      setCriteriaProgress({});
      setLatestCriterion('');
      setCriteriaDone(0);
      setTotalCriteria(0);
      setProcessingResult(null);
      setLocalAnswers({});
      setHumanObservations('');
      setReviewStartTime(null);
    },
    onError: (error: any) => {
      const d = error.response?.data?.detail;
      setProgressMsg(Array.isArray(d) ? d.map((x: any) => x.msg).join(', ') : d || error.message || 'Failed to start analysis');
    },
  });

  const float = (val: any) => parseFloat(String(val)) || 0;

  const calculateScore = useCallback(() => {
    if (!processingResult || !lobs) return 0;
    const criteria = lobs.find(l => String(l.id) === selectedLOB)?.criteria_json || {};
    let appPts = 0, earned = 0, fb = 0, fbE = 0, hasValid = false;
    Object.entries(localAnswers).forEach(([key, val]) => {
      if (val.answer !== 'n/a') {
        const pts = float(criteria[key]?.points || 0);
        if (pts > 0) { hasValid = true; appPts += pts; if (val.answer === 'yes') earned += pts; }
        else { fb++; if (val.answer === 'yes') fbE++; }
      }
    });
    if (hasValid) return appPts > 0 ? Math.round((earned / appPts) * 100) : 100;
    return fb > 0 ? Math.round((fbE / fb) * 100) : 100;
  }, [processingResult, lobs, selectedLOB, localAnswers]);

  const [showSuccess, setShowSuccess] = useState(false);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const ttch = reviewStartTime ? Math.round((Date.now() - reviewStartTime) / 1000) : 0;
      return client.post('/api/evaluation/save', {
        evaluation_id: processingResult.evaluation_id,
        final_score: calculateScore(),
        ttch,
        final_answers: localAnswers,
        human_observations: humanObservations,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recent-evaluations'] });
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        resetAnalysis();
      }, 3500);
    },
    onError: (err: any) => {
      const msg = err.response?.data?.detail || err.message || "Failed to save";
      alert("Error saving evaluation: " + msg);
    }
  });

  // Task progressive polling loop
  useEffect(() => {
    let iv: any;
    if (taskId && !isPaused) {
      iv = setInterval(async () => {
        try {
          const { data } = await client.get(`/api/evaluation/task-status/${taskId}`);
          
          if (data.status === 'SUCCESS') {
            queryClient.invalidateQueries({ queryKey: ['recent-evaluations'] });
            setProcessingResult(data.result);
            setLocalAnswers(data.result?.final_answers || {});
            setHumanObservations(data.result?.human_observations || '');
            setReviewStartTime(Date.now());
            setTaskId(null);
            setProgressMsg('');
            setCurrentStage(5);
            setProgressPct(100);
          } else if (data.status === 'FAILURE') {
            setProgressMsg(data.error || 'Task failed.');
            alert("Analysis execution error: " + (data.error || 'Check celery logs.'));
            resetAnalysis();
          } else if (data.status === 'PROGRESS') {
            if (data.stage) setCurrentStage(data.stage);
            if (data.progress_pct) setProgressPct(data.progress_pct);
            if (data.message) setProgressMsg(data.message);
            if (data.partial_transcript) setPartialTranscript(data.partial_transcript);
            if (data.criteria_so_far) setCriteriaProgress(data.criteria_so_far);
            if (data.latest_criterion) setLatestCriterion(data.latest_criterion);
            if (data.criteria_done) setCriteriaDone(data.criteria_done);
            if (data.total_criteria) setTotalCriteria(data.total_criteria);
            if (data.eval_model || data.eval_provider) {
              setEvalMetadata({
                model: data.eval_model,
                provider: data.eval_provider,
              });
            }
          }
        } catch (e: any) {
          console.error("Polling error: ", e);
        }
      }, 2000);
    }
    return () => clearInterval(iv);
  }, [taskId, isPaused]);

  // Controller Actions
  const handlePauseToggle = () => {
    setIsPaused(prev => !prev);
  };

  const handleResumeCheckpoint = () => {
    setCriteriaProgress({});
    setCriteriaDone(0);
    setProgressPct(50);
    setIsPaused(false);
  };

  const handleStopWorker = async () => {
    if (!taskId) return;
    try {
      await client.post(`/api/evaluation/cancel-task/${taskId}`);
      resetAnalysis();
      alert("AI Auditing task has been terminated successfully.");
    } catch (err: any) {
      console.error(err);
      resetAnalysis();
    }
  };

  const resetAnalysis = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setIsPlaying(false);
    setFile(null);
    setProcessingResult(null);
    setLocalAnswers({});
    setHumanObservations('');
    setReviewStartTime(null);
    setTaskId(null);
    setProgressMsg('');
    setProgressPct(0);
    setCurrentStage(1);
    setIsPaused(false);
    setEvalCallUid('');
    setPartialTranscript('');
    setCriteriaProgress({});
    setLatestCriterion('');
    setEvalMetadata({});
    processMutation.reset();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) setFile(f);
  };

  const score = calculateScore();
  const lobData = lobs?.find(l => String(l.id) === selectedLOB);
  const criteriaJson = lobData?.criteria_json || {};
  
  const isProcessing = !!taskId;
  const isLoaded = !!processingResult;
  const isSttAvailable = (isProcessing && currentStage >= 2) || isLoaded;
  const isCriteriaAvailable = (isProcessing && currentStage >= 3) || isLoaded;

  const activeTranscript = isProcessing ? partialTranscript : (processingResult?.transcript || '');
  const transcriptLines = activeTranscript
    ? activeTranscript.split('\n').filter((l: string) => l.trim())
    : [];

  const renderLOBSection = () => (
    <section className="anim-in d1" style={{ marginBottom: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.9px', textTransform: 'uppercase', color: 'var(--tx-3)' }}>Line of Business</span>
        <span style={{ fontSize: '10.5px', color: 'var(--tx-3)' }}>{lobs?.length || 0} active</span>
      </div>
      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }} role="radiogroup">
        {lobs?.map(lob => (
          <button key={lob.id} className={`lob-pill ${selectedLOB === String(lob.id) ? 'active' : ''}`}
            disabled={isProcessing || isLoaded}
            onClick={() => setSelectedLOB(String(lob.id))} role="radio"
            aria-checked={selectedLOB === String(lob.id)}>
            <span className="lob-dot" />
            {lob.name}
          </button>
        ))}
      </div>
    </section>
  );

  return (
    <div style={{ position: 'relative' }}>
      {renderLOBSection()}
      
      {/* Structural Card: stays continuously mounted across ALL states to eliminate visual flickers */}
      <div className={`ds-card anim-in d2 recording-card-split ${file || isProcessing || isLoaded ? 'active' : ''}`} style={{ marginBottom: 14 }}>
        
        {/* LEFT COLUMN: Main Info & Audio Player */}
        <div className="split-left">
          <div className="ds-card-header" style={{ borderBottom: 'none', padding: '0 0 12px 0' }}>
            <span className="ds-card-title">
              <FileAudio size={14} color="var(--accent)" /> Recording
            </span>
            <span style={{ fontSize: '9.5px', color: isProcessing ? (isPaused ? 'var(--amber)' : 'var(--accent)') : (isLoaded ? 'var(--green)' : 'var(--tx-3)') }}>
              {isProcessing ? (isPaused ? '● Paused' : '● Processing') : (isLoaded ? '● Complete' : 'Worker Ready')}
            </span>
          </div>
          
          <input type="file" ref={fileInputRef} onChange={e => e.target.files?.[0] && setFile(e.target.files[0])}
            accept="audio/*" style={{ display: 'none' }} />

          {!file && !isLoaded ? (
            <div className={`upload-zone ${isDragging ? 'drag-active' : ''}`}
              onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              role="button" tabIndex={0}>
              <div style={{ position: 'relative', zIndex: 1 }}>
                <div style={{ width: 36, height: 36, margin: '0 auto 10px', color: isDragging ? 'var(--accent)' : 'var(--tx-3)', transition: 'color 250ms' }}>
                  <CloudUpload size={36} />
                </div>
                <div style={{ fontSize: '12.5px', fontWeight: 600, color: 'var(--tx-1)', marginBottom: 3 }}>Drag and drop your recording</div>
                <div style={{ fontSize: 11, color: 'var(--tx-2)', marginBottom: 12 }}>
                  or <span style={{ color: 'var(--accent)', fontWeight: 500, cursor: 'pointer' }}>browse files</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 5, marginBottom: 8 }}>
                  {['WAV', 'MP3', 'M4A', 'FLAC'].map(f => (
                    <span key={f} style={{ fontSize: 9, fontWeight: 600, padding: '2px 7px', borderRadius: 'var(--r-xs)', background: 'var(--bg-s3)', color: 'var(--tx-3)', border: '1px solid var(--border)' }}>{f}</span>
                  ))}
                </div>
                <div style={{ fontSize: '9.5px', color: 'var(--tx-3)' }}>Maximum file size: 200 MB</div>
              </div>
            </div>
          ) : (
            <>
              {/* Attached file details */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--bg-s2)', border: '1px solid var(--border-h)', borderRadius: 'var(--r-md)' }}>
                <div style={{ width: 30, height: 30, background: 'var(--accent-m)', borderRadius: 'var(--r-xs)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', flexShrink: 0 }}>
                  {isProcessing ? <Loader2 size={14} className="spin-anim" /> : <FileAudio size={14} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '11.5px', fontWeight: 500, color: 'var(--tx-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {file?.name || (processingResult?.eval_call_uid || processingResult?.call_id || '') + ".wav"}
                  </div>
                  <div style={{ fontSize: '9.5px', color: 'var(--tx-3)' }}>
                    {file ? (file.size / (1024 * 1024)).toFixed(2) : '0.65'} MB
                  </div>
                </div>
                {!isProcessing && !isLoaded && (
                  <button onClick={() => setFile(null)} style={{ width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--tx-3)', background: 'none', border: 'none', cursor: 'pointer', borderRadius: 'var(--r-xs)' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--red-m)'; e.currentTarget.style.color = 'var(--red)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--tx-3)'; }}>
                    <X size={13} />
                  </button>
                )}
              </div>

              {/* Call Metadata Bar */}
              <CallMetadataBar 
                callId={evalCallUid} 
                model={evalMetadata.model || lobData?.criteria_json?.llm_config?.model || processingResult?.eval_model}
                provider={evalMetadata.provider || lobData?.criteria_json?.llm_config?.provider || processingResult?.eval_provider}
                params={evalMetadata.params || processingResult?.eval_params_json}
                date={processingResult?.eval_started_at || processingResult?.evaluation_date}
              />

              {/* AUDIO PLAYER: Mounts dynamically during STT processing and on load results! */}
              {isSttAvailable && audioUrl && (
                <div className="anim-in d3" style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg-s2)', padding: '10px 14px', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)', marginTop: 10 }}>
                  <button onClick={togglePlay} style={{ width: 30, height: 30, borderRadius: '50%', background: 'var(--accent)', color: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', cursor: 'pointer', boxShadow: '0 0 10px var(--accent-m)' }}>
                    {isPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" style={{ marginLeft: 2 }} />}
                  </button>
                  <span style={{ fontSize: 10, color: 'var(--tx-2)', fontFamily: 'monospace', minWidth: 30 }}>{formatTime(currentTime)}</span>
                  <div style={{ flex: 1, height: 6, background: 'var(--bg-s3)', borderRadius: 3, cursor: 'pointer', position: 'relative' }}
                    onClick={(e) => {
                      if (!audioRef.current || !duration) return;
                      const rect = e.currentTarget.getBoundingClientRect();
                      const perc = (e.clientX - rect.left) / rect.width;
                      audioRef.current.currentTime = perc * duration;
                    }}>
                    <div style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%`, height: '100%', background: 'var(--accent)', borderRadius: 3, transition: 'width 0.1s linear' }} />
                  </div>
                  <span style={{ fontSize: 10, color: 'var(--tx-3)', fontFamily: 'monospace', minWidth: 30 }}>{formatTime(duration)}</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* RIGHT COLUMN: Stacked progressive cockpit components */}
        {(file || isProcessing || isLoaded) && (
          <div className="split-right" style={{ borderLeft: '1px solid var(--border)', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
            
            {/* Stacked 1 (Top): Custom Sound Wave Progress Bar (P) */}
            <div style={{ width: '100%' }}>
              <WaveformProgressBar 
                progressPct={isLoaded ? 100 : progressPct} 
                isActive={isProcessing && !isPaused} 
              />
            </div>

            {/* Stacked 2 (Middle): Stages / Results Ring */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: 110 }}>
              {isLoaded ? (
                /* Completed Stage: score presenting right inside card */
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, background: 'rgba(52,211,153,0.03)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: 12, width: '100%', boxSizing: 'border-box' }}>
                  <ScoreRing score={score} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontSize: '9px', fontWeight: 700, padding: '2px 8px', borderRadius: 'var(--r-xs)', background: score >= 80 ? 'var(--green-m)' : 'var(--red-m)', color: score >= 80 ? 'var(--green)' : 'var(--red)', border: `1px solid ${score >= 80 ? 'rgba(52,211,153,0.25)' : 'rgba(248,113,113,0.25)'}`, display: 'inline-block', marginBottom: 6 }}>
                      {score >= 80 ? 'PASSING' : 'FAILED'}
                    </span>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--tx-1)' }}>Analysis Verified</div>
                    <div style={{ fontSize: 9.5, color: 'var(--tx-3)', marginTop: 2 }}>
                      Audit completed in <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{processingResult?.ttca_seconds || 12}s</span>
                    </div>
                  </div>
                </div>
              ) : isProcessing ? (
                /* Polling Stage progress stages minimized */
                <div style={{ background: 'var(--bg-s2)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '10px 12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <Loader2 size={11} className="spin-anim" color="var(--accent)" />
                    <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>Active Stage</span>
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--tx-1)' }}>
                    Stage {currentStage}: {currentStage === 1 ? 'In Queue' : currentStage === 2 ? 'Transcribing (STT)' : currentStage === 3 ? 'AI Evaluation' : currentStage === 4 ? 'Persisting results' : 'Finishing'}
                  </div>
                  <p style={{ fontSize: 10, color: 'var(--tx-2)', marginTop: 4, lineHeight: 1.4 }}>{progressMsg}</p>
                </div>
              ) : (
                /* Ready State placeholder */
                <div style={{ border: '1px dashed var(--border-h)', borderRadius: 12, padding: 12, textAlign: 'center', width: '100%', boxSizing: 'border-box' }}>
                  <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--accent-m)', border: '1px solid var(--accent-b)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px', color: 'var(--accent)' }}>
                    <Check size={12} />
                  </div>
                  <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--tx-1)', display: 'block', marginBottom: 2 }}>Ready for Worker</span>
                  <p style={{ fontSize: 9, color: 'var(--tx-3)', lineHeight: 1.3 }}>Unique call parameters locked. Launch analysis to trigger async queue processing.</p>
                </div>
              )}
            </div>

            {/* Stacked 3 (Bottom): Action Buttons */}
            <div style={{ width: '100%', marginTop: 'auto' }}>
              {isLoaded ? (
                /* Reset Button */
                <button onClick={resetAnalysis} className="worker-btn checkpoint" style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                  <RotateCcw size={12} /> START NEW AUDIT
                </button>
              ) : isProcessing ? (
                /* Polling Controller Buttons */
                <div style={{ display: 'flex', gap: 6, width: '100%' }}>
                  <button onClick={handlePauseToggle} className={`worker-btn ${isPaused ? 'resume' : 'pause'}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                    {isPaused ? <Play size={10} fill="currentColor" /> : <Pause size={10} fill="currentColor" />}
                    {isPaused ? 'Resume' : 'Pause'}
                  </button>
                  <button onClick={handleResumeCheckpoint} className="worker-btn checkpoint" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                    <RotateCcw size={10} /> Checkpoint
                  </button>
                  <button onClick={handleStopWorker} className="worker-btn stop" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                    <X size={10} /> Stop
                  </button>
                </div>
              ) : (
                /* Active Run Analysis button */
                <button className="run-btn" style={{ width: '100%', padding: '8px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                  disabled={!file || !selectedLOB || processMutation.isPending}
                  onClick={() => { if (!file || !selectedLOB) return; const fd = new FormData(); fd.append('file', file); processMutation.mutate(fd); }}>
                  {processMutation.isPending ? <Loader2 size={12} className="spin-anim" /> : <Play size={12} />}
                  {processMutation.isPending ? 'Starting...' : 'Run Analysis'}
                </button>
              )}
            </div>

          </div>
        )}

      </div>

      {/* DYNAMIC PROGRESSIVE TRANSCRIPT & AUDIT ANSWERS LIST */}
      {isSttAvailable && (
        <div className="grid-2 anim-in d3" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
          
          {/* Progressive Whisper STT Transcript (fully clickable and seek-controlled) */}
          <div className="ds-card" style={{ display: 'flex', flexDirection: 'column', height: 420 }}>
            <div className="ds-card-header">
              <span className="ds-card-title">
                {isProcessing && <Loader2 size={11} className="spin-anim" style={{ color: 'var(--accent)', marginRight: 6 }} />}
                Transcript Segment Review
              </span>
              <span style={{ fontSize: 8.5, fontWeight: 700, color: isProcessing ? 'var(--accent)' : 'var(--green)' }}>
                {isProcessing ? 'STT PIPELINE STAGE' : 'STT VERIFIED'}
              </span>
            </div>
            
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column' }} className="custom-scrollbar">
              {transcriptLines.length > 0 ? (
                transcriptLines.map((line: string, i: number) => {
                  const match = line.match(/\[(\d+\.\d+)s/);
                  const start = match ? parseFloat(match[1]) : null;
                  let isActive = false;
                  if (start !== null) {
                    const nextLine = transcriptLines[i + 1];
                    let nextStart = Infinity;
                    if (nextLine) {
                      const nextMatch = nextLine.match(/\[(\d+\.\d+)s/);
                      if (nextMatch) nextStart = parseFloat(nextMatch[1]);
                    }
                    isActive = currentTime >= start && currentTime < nextStart;
                  }
                  return (
                    <TranscriptBubble 
                      key={i} 
                      line={line} 
                      index={i} 
                      isActive={isActive}
                      onSeek={(t) => {
                        if(audioRef.current) {
                          audioRef.current.currentTime = t;
                          audioRef.current.play();
                          setIsPlaying(true);
                        }
                      }}
                    />
                  );
                })
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 0', color: 'var(--tx-3)' }}>
                  <Loader2 size={24} className="spin-anim" style={{ marginBottom: 12, color: 'var(--accent)' }} />
                  <span style={{ fontSize: 11, fontWeight: 500 }}>Generating audio transcription segments...</span>
                </div>
              )}
            </div>
          </div>

          {/* Progressive Audited Criteria Cards List */}
          <div className="ds-card" style={{ display: 'flex', flexDirection: 'column', height: 420 }}>
            <div className="ds-card-header">
              <span className="ds-card-title"><ShieldCheck size={13} color="var(--accent)" /> AI Score Sheet</span>
              {isLoaded ? (
                <button
                  disabled={saveMutation.isPending}
                  onClick={() => {
                    if (audioRef.current) audioRef.current.pause();
                    setIsPlaying(false);
                    saveMutation.mutate();
                  }}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 12px', borderRadius: 'var(--r-sm)', background: saveMutation.isPending ? 'var(--bg-s3)' : 'linear-gradient(135deg, var(--green), #22c55e)', color: saveMutation.isPending ? 'var(--tx-3)' : '#090C12', fontSize: '10px', fontWeight: 700, border: 'none', cursor: saveMutation.isPending ? 'not-allowed' : 'pointer', fontFamily: 'var(--font-family)', letterSpacing: '0.3px' }}>
                  {saveMutation.isPending ? <Loader2 size={11} className="spin-anim" /> : <Check size={11} />}
                  SAVE EVALUATION
                </button>
              ) : (
                totalCriteria > 0 && (
                  <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--accent)', background: 'var(--accent-m)', padding: '2px 8px', borderRadius: 'var(--r-xs)' }}>
                    {criteriaDone} / {totalCriteria} COMPLETE
                  </span>
                )
              )}
            </div>
            
            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }} className="custom-scrollbar">
              {isLoaded ? (
                /* Completed State: interactive assessment and final observations */
                <>
                  {Object.entries(localAnswers).map(([key, value]: [string, any]) => (
                    <CriteriaCard key={key} criteriaKey={key} value={value}
                      criteriaDetails={criteriaJson[key]}
                      onAnswer={ans => setLocalAnswers(prev => ({ ...prev, [key]: { ...prev[key], answer: ans } }))} />
                  ))}
                  {processingResult?.call_summary && (
                    <div style={{ background: 'var(--bg-s2)', padding: '12px 16px', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', marginTop: 4 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 6 }}>
                        AI Executive Summary
                      </div>
                      <p style={{ fontSize: 12, color: 'var(--tx-2)', lineHeight: 1.6 }}>{processingResult.call_summary}</p>
                    </div>
                  )}
                  <div style={{ marginTop: 4 }}>
                    <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>Final QA Observations</div>
                    <textarea value={humanObservations} onChange={e => setHumanObservations(e.target.value)}
                      style={{ width: '100%', background: 'var(--bg-s2)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '10px 12px', color: 'var(--tx-1)', fontSize: 11, fontFamily: 'var(--font-family)', resize: 'none', outline: 'none', minHeight: 80, lineHeight: 1.5 }}
                      placeholder="Add observations about call quality, agent performance..." />
                  </div>
                </>
              ) : isCriteriaAvailable && Object.keys(criteriaProgress).length > 0 ? (
                /* In-Progress progressive loading of scored cards */
                <div className="criteria-reveal-list">
                  {Object.entries(criteriaProgress).map(([key, value]: [string, any]) => (
                    <div className="reveal-item" key={key}>
                      <CriteriaCard 
                        criteriaKey={key} 
                        value={value}
                        criteriaDetails={criteriaJson[key]}
                        onAnswer={() => {}} 
                      />
                    </div>
                  ))}
                </div>
              ) : (
                /* Loading / Ready placeholder */
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 0', color: 'var(--tx-3)' }}>
                  {!isCriteriaAvailable ? (
                    <>
                      <HelpCircle size={24} style={{ marginBottom: 12, opacity: 0.3 }} />
                      <span style={{ fontSize: 11 }}>Waiting for transcription to complete...</span>
                    </>
                  ) : (
                    <>
                      <Loader2 size={24} className="spin-anim" style={{ marginBottom: 12, color: 'var(--accent)' }} />
                      <span style={{ fontSize: 11, fontWeight: 500 }}>LLM starting dynamic criteria scoring...</span>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

        </div>
      )}

      {/* Hidden Audio Player */}
      <audio
        ref={audioRef}
        src={audioUrl || undefined}
        onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)}
        onEnded={() => setIsPlaying(false)}
      />

      {/* Success Save Overlay */}
      {showSuccess && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(9, 12, 18, 0.85)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 24,
          animation: 'fade-in 0.2s ease-out',
        }}>
          <div style={{
            width: '100%', maxWidth: 440,
            background: 'var(--bg-s1)',
            border: '1px solid var(--border)',
            borderRadius: '24px',
            padding: '36px 28px',
            textAlign: 'center',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5), 0 0 50px rgba(201,169,98,0.1)',
            animation: 'scale-up 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
          }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              background: 'var(--accent-m)',
              border: '1px solid var(--accent-b)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px',
              color: 'var(--accent)',
              boxShadow: '0 0 24px var(--accent-m)',
            }}>
              <Check size={32} strokeWidth={3} />
            </div>

            <h3 style={{ fontSize: 20, fontWeight: 800, color: 'var(--tx-1)', marginBottom: 8, fontFamily: 'var(--font-family)' }}>
              Evaluation Saved
            </h3>
            <p style={{ fontSize: 13, color: 'var(--tx-2)', lineHeight: 1.6, marginBottom: 24 }}>
              The QA review has been successfully stored to the audit trail.
            </p>

            <div style={{
              background: 'var(--bg-s2)',
              borderRadius: 'var(--r-md)',
              padding: '14px 18px',
              border: '1px solid var(--border)',
              marginBottom: 28,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <div style={{ textAlign: 'left' }}>
                <div style={{ fontSize: 10, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Final Score</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--accent)' }}>{score}%</div>
              </div>
              <div style={{ width: 1, height: 28, background: 'var(--border)' }} />
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 10, color: 'var(--tx-3)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Business Line</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--tx-1)' }}>{lobData?.name}</div>
              </div>
            </div>

            <div style={{ width: '100%', height: 3, background: 'var(--bg-s3)', borderRadius: 2, overflow: 'hidden', position: 'relative' }}>
              <div style={{
                position: 'absolute', left: 0, top: 0, height: '100%',
                background: 'linear-gradient(90deg, var(--accent), var(--green))',
                width: '100%',
                animation: 'shrink-width 3.5s linear forwards',
              }} />
            </div>
            <div style={{ fontSize: 10, color: 'var(--tx-3)', marginTop: 8 }}>
              Redirecting to workspace...
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EvaluationPage;
