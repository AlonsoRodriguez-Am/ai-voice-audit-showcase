import React from 'react';
import { Cpu, Mic2, Brain, CheckCircle2, Loader2, Hourglass } from 'lucide-react';

type StageStatus = 'pending' | 'active' | 'done';

interface Stage {
  id: number;
  label: string;
  sub: string;
  icon: React.ElementType;
  status: StageStatus;
}

interface ProcessingStagesProps {
  currentStage: number; // 1-5
  progressMsg?: string;
  progressPct?: number;
  criteriaDone?: number;
  totalCriteria?: number;
  latestCriterion?: string;
  isPaused?: boolean;
  onPauseToggle?: () => void;
  onStop?: () => void;
  onResumeCheckpoint?: () => void;
}

const STAGES: Omit<Stage, 'status'>[] = [
  { id: 1, label: 'In Queue',          sub: 'Waiting for AI worker',        icon: Hourglass },
  { id: 2, label: 'STT Transcript',     sub: 'Whisper transcribing audio',   icon: Mic2      },
  { id: 3, label: 'AI Evaluation',      sub: 'Evaluating audit criteria',    icon: Brain     },
  { id: 4, label: 'Finalizing',         sub: 'Persisting audit logs',        icon: Cpu       },
  { id: 5, label: 'Complete',           sub: 'Evaluation finalized',         icon: CheckCircle2 },
];

const ProcessingStages = ({
  currentStage,
  progressMsg,
  progressPct = 0,
  criteriaDone = 0,
  totalCriteria = 0,
  latestCriterion = '',
  isPaused = false,
  onPauseToggle,
  onStop,
  onResumeCheckpoint,
}: ProcessingStagesProps) => {
  const stages: Stage[] = STAGES.map(s => ({
    ...s,
    status: s.id < currentStage ? 'done'
          : s.id === currentStage ? 'active'
          : 'pending',
  }));

  return (
    <div className="processing-container anim-in d2">
      {/* Orb Visual Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="progress-orb-container">
            <div className="progress-orb-pulse" style={{ animationPlayState: isPaused ? 'paused' : 'running' }} />
            <div className="progress-orb-inner">
              {currentStage === 5 ? (
                <CheckCircle2 size={18} color="var(--green)" />
              ) : isPaused ? (
                <Loader2 size={16} color="var(--amber)" style={{ transform: 'rotate(45deg)' }} />
              ) : (
                <Loader2 size={16} color="var(--accent)" className="spin-anim" />
              )}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--tx-1)', display: 'flex', alignItems: 'center', gap: 6 }}>
              {isPaused ? 'Analysis Paused' : currentStage === 5 ? 'Analysis Complete' : 'AI Auditing Call'}
              <span className="live-badge">LIVE</span>
            </div>
            <div style={{ fontSize: '10.5px', color: 'var(--tx-3)', marginTop: 1 }}>
              {progressPct}% completed · Stage {currentStage}/5
            </div>
          </div>
        </div>

        {/* Dynamic score projection */}
        {currentStage === 3 && totalCriteria > 0 && (
          <div className="audit-progression-badge">
            {criteriaDone}/{totalCriteria} Criteria
          </div>
        )}
      </div>

      {/* Progress Fills */}
      <div className="progress-line-container">
        <div className="progress-line-fill" style={{ width: `${progressPct}%` }} />
      </div>

      {/* Stage Items */}
      <div className="stage-list">
        {stages.map(stage => {
          const isActive = stage.status === 'active';
          const isDone = stage.status === 'done';
          
          return (
            <div key={stage.id} className={`stage-item-new ${stage.status} ${isActive && isPaused ? 'paused' : ''}`}>
              <div className="stage-icon-wrap">
                {isDone ? (
                  <CheckCircle2 size={14} className="done-icon" />
                ) : isActive && !isPaused ? (
                  <Loader2 size={14} className="spin-anim active-icon" />
                ) : (
                  <stage.icon size={14} className="pending-icon" />
                )}
              </div>
              
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="stage-label-text">
                  {stage.label}
                  {isActive && <span className="active-dot" />}
                </div>
                <div className="stage-sub-text">
                  {isActive && progressMsg ? progressMsg : stage.sub}
                </div>
                
                {/* Specific stage custom detail reveal */}
                {isActive && stage.id === 3 && latestCriterion && (
                  <div className="latest-reveal-banner anim-in">
                    <span className="reveal-label">CURRENTLY EVALUATING</span>
                    <div className="reveal-val">{latestCriterion.replace(/_/g, ' ')}</div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Interactive Worker Controller Buttons */}
      <div className="worker-controller-section">
        {currentStage < 5 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', marginTop: 16 }}>
            <div style={{ display: 'flex', gap: 6 }}>
              {isPaused ? (
                <>
                  <button className="worker-btn resume" onClick={onPauseToggle}>
                    Resume task
                  </button>
                  {currentStage >= 3 && onResumeCheckpoint && (
                    <button className="worker-btn checkpoint" onClick={onResumeCheckpoint}>
                      From step 3
                    </button>
                  )}
                </>
              ) : (
                <button className="worker-btn pause" onClick={onPauseToggle}>
                  Pause Analysis
                </button>
              )}
              
              <button className="worker-btn stop" onClick={onStop}>
                Stop Worker
              </button>
            </div>
            
            <div style={{ fontSize: '9px', color: 'var(--tx-3)', textAlign: 'center', marginTop: 2 }}>
              Paused state offers checkpoint restore or standard task resumption.
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProcessingStages;
