import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import client from '../api/client';
import {
  Loader2, Lock, Mail,
  ShieldCheck, BarChart2, Cpu, AlertCircle,
} from 'lucide-react';

/* ─── tiny hook: focus ring on inputs ─────────────────────────── */
function useInputFocus() {
  const [focused, setFocused] = useState(false);
  return {
    focused,
    bind: {
      onFocus: () => setFocused(true),
      onBlur:  () => setFocused(false),
    },
  };
}

/* ─── Input row ────────────────────────────────────────────────── */
function InputRow({
  icon: Icon,
  type,
  placeholder,
  value,
  onChange,
  autoComplete,
}: {
  icon: React.ComponentType<any>;
  type: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
}) {
  const { focused, bind } = useInputFocus();
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '11px 14px',
      background: '#F8F9FC',
      border: `1.5px solid ${focused ? '#C9A962' : '#E2E6ED'}`,
      borderRadius: 10,
      transition: 'border-color 180ms ease, box-shadow 180ms ease',
      boxShadow: focused ? '0 0 0 3px rgba(201,169,98,0.12)' : 'none',
    }}>
      <Icon size={15} style={{ color: focused ? '#C9A962' : '#8B95A8', flexShrink: 0, transition: 'color 180ms' }} />
      <input
        type={type}
        required
        autoComplete={autoComplete}
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        {...bind}
        style={{
          flex: 1, border: 'none', outline: 'none',
          background: 'transparent',
          fontSize: 13.5, fontWeight: 500,
          color: '#0F1219',
          fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
        }}
      />
    </div>
  );
}

/* ─── Feature pill ─────────────────────────────────────────────── */
function Feature({ icon: Icon, label, desc }: { icon: React.ComponentType<any>; label: string; desc: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
      <div style={{
        width: 36, height: 36, flexShrink: 0,
        background: 'rgba(201,169,98,0.10)',
        border: '1px solid rgba(201,169,98,0.22)',
        borderRadius: 8,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#C9A962',
        marginTop: 2,
      }}>
        <Icon size={16} />
      </div>
      <div>
        <p style={{ fontSize: 13, fontWeight: 700, color: '#E2E6ED', marginBottom: 2 }}>{label}</p>
        <p style={{ fontSize: 11.5, color: '#515C6F', fontWeight: 500, lineHeight: 1.5 }}>{desc}</p>
      </div>
    </div>
  );
}

/* ─── Main component ───────────────────────────────────────────── */
const LoginPage = () => {
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const { login } = useAuth();
  const navigate   = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { data } = await client.post('/api/auth/login', { email, password });
      login(data.access_token, data.refresh_token, data.user);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Invalid credentials. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      display: 'flex', height: '100vh', overflow: 'hidden',
      fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
    }}>

      {/* ══════ LEFT — Light form panel ══════════════════════════ */}
      <div style={{
        flex: 1,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#FFFFFF',
        padding: '40px 48px',
        position: 'relative',
        zIndex: 1,
      }}>

        {/* Subtle top-left accent dot */}
        <div style={{
          position: 'absolute', top: 0, left: 0,
          width: 320, height: 320,
          background: 'radial-gradient(circle, rgba(201,169,98,0.06) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        <div style={{ width: '100%', maxWidth: 380, position: 'relative', zIndex: 1 }}>

          {/* Mobile logo — hidden on large screens via inline media isn't possible,
              so we always render it small and let the right panel handle branding */}
          <div style={{ marginBottom: 40 }}>
            {/* Logo mark */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 32 }}>
              <div style={{
                width: 36, height: 36,
                background: 'linear-gradient(135deg, #C9A962 0%, #A88B3D 100%)',
                borderRadius: 8,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 800, fontSize: 16, color: '#090C12',
                boxShadow: '0 4px 14px rgba(201,169,98,0.3)',
              }}>A</div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 15, color: '#0F1219', letterSpacing: '-0.3px' }}>AI Audit</div>
                <div style={{ fontSize: 9.5, fontWeight: 700, color: '#C9A962', letterSpacing: '1.2px', textTransform: 'uppercase' }}>Intelligence Platform</div>
              </div>
            </div>

            <h2 style={{
              fontSize: 28, fontWeight: 800, color: '#0F1219',
              letterSpacing: '-0.5px', lineHeight: 1.2, marginBottom: 8,
            }}>Welcome back</h2>
            <p style={{ fontSize: 13.5, color: '#8B95A8', fontWeight: 500 }}>
              Sign in to access your audit dashboard.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Error banner */}
            {error && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '11px 14px',
                background: 'rgba(248,113,113,0.06)',
                border: '1px solid rgba(248,113,113,0.25)',
                borderRadius: 10,
                animation: 'fadeSlideIn 0.25s ease',
              }}>
                <AlertCircle size={15} style={{ color: '#F87171', flexShrink: 0 }} />
                <span style={{ fontSize: 12.5, color: '#B91C1C', fontWeight: 500 }}>{error}</span>
              </div>
            )}

            {/* Email */}
            <div>
              <label style={{
                display: 'block', fontSize: 10, fontWeight: 700,
                color: '#515C6F', letterSpacing: '0.9px', textTransform: 'uppercase',
                marginBottom: 6,
              }}>Email Address</label>
              <InputRow
                icon={Mail} type="email" placeholder="you@company.com"
                value={email} onChange={setEmail} autoComplete="email"
              />
            </div>

            {/* Password */}
            <div>
              <label style={{
                display: 'block', fontSize: 10, fontWeight: 700,
                color: '#515C6F', letterSpacing: '0.9px', textTransform: 'uppercase',
                marginBottom: 6,
              }}>Password</label>
              <InputRow
                icon={Lock} type="password" placeholder="••••••••"
                value={password} onChange={setPassword} autoComplete="current-password"
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: 6,
                width: '100%', padding: '13px 0',
                background: loading
                  ? '#E2E6ED'
                  : 'linear-gradient(135deg, #C9A962 0%, #A88B3D 100%)',
                color: loading ? '#8B95A8' : '#090C12',
                fontWeight: 800, fontSize: 13,
                fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
                letterSpacing: '0.3px',
                border: 'none', borderRadius: 10,
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                transition: 'all 200ms ease',
                boxShadow: loading ? 'none' : '0 4px 20px rgba(201,169,98,0.28)',
              }}
              onMouseEnter={e => {
                if (!loading) {
                  (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)';
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 6px 24px rgba(201,169,98,0.38)';
                }
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)';
                (e.currentTarget as HTMLButtonElement).style.boxShadow = loading ? 'none' : '0 4px 20px rgba(201,169,98,0.28)';
              }}
            >
              {loading
                ? <><Loader2 size={16} className="spin-anim" /> Signing in...</>
                : 'Sign In to Dashboard'
              }
            </button>
          </form>

          {/* System status footer */}
          <div style={{
            marginTop: 36,
            paddingTop: 20,
            borderTop: '1px solid #E8EBF0',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <div style={{
              width: 7, height: 7, borderRadius: '50%',
              background: '#34D399',
              boxShadow: '0 0 6px rgba(52,211,153,0.6)',
              animation: 'pii-pulse 2.5s ease-in-out infinite',
            }} />
            <span style={{
              fontSize: 10.5, fontWeight: 700,
              color: '#8B95A8', letterSpacing: '0.8px', textTransform: 'uppercase',
            }}>All Systems Operational</span>
          </div>
        </div>
      </div>

      {/* ══════ RIGHT — Dark executive branding panel ════════════ */}
      <div style={{
        width: '46%',
        flexShrink: 0,
        background: '#090C12',
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        padding: '44px 52px',
        position: 'relative',
        overflow: 'hidden',
      }}>

        {/* Ambient glow blobs */}
        <div style={{
          position: 'absolute', top: '-15%', right: '-10%',
          width: 440, height: 440,
          background: 'radial-gradient(circle, rgba(201,169,98,0.07) 0%, transparent 65%)',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', bottom: '-10%', left: '-12%',
          width: 380, height: 380,
          background: 'radial-gradient(circle, rgba(52,211,153,0.04) 0%, transparent 65%)',
          pointerEvents: 'none',
        }} />

        {/* Subtle grid texture */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.015) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.015) 1px, transparent 1px)
          `,
          backgroundSize: '48px 48px',
          pointerEvents: 'none',
        }} />

        {/* Top gold accent line */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 2,
          background: 'linear-gradient(90deg, var(--accent, #C9A962), transparent 70%)',
        }} />

        {/* ── Brand mark (top) */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 38, height: 38,
              background: 'linear-gradient(135deg, #C9A962 0%, #A88B3D 100%)',
              borderRadius: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 800, fontSize: 18, color: '#090C12',
              boxShadow: '0 0 20px rgba(201,169,98,0.2)',
            }}>A</div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 16, color: '#E2E6ED', letterSpacing: '-0.3px' }}>AI Audit</div>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#515C6F', letterSpacing: '1.2px', textTransform: 'uppercase' }}>Intelligence Platform</div>
            </div>
          </div>
        </div>

        {/* ── Center headline + feature list */}
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: 36 }}>
          <div>
            {/* "PRO" tag */}
            <span style={{
              display: 'inline-block',
              fontSize: 9, fontWeight: 800, letterSpacing: '1.2px', textTransform: 'uppercase',
              color: '#C9A962', background: 'rgba(201,169,98,0.10)',
              border: '1px solid rgba(201,169,98,0.25)',
              padding: '3px 9px', borderRadius: 4,
              marginBottom: 16,
            }}>Enterprise QA Platform</span>

            <h1 style={{
              fontSize: 34, fontWeight: 800, color: '#E2E6ED',
              letterSpacing: '-0.8px', lineHeight: 1.15, marginBottom: 14,
            }}>
              AI-Powered<br />
              <span style={{
                background: 'linear-gradient(135deg, #C9A962, #D9BC7A)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}>Call Auditing</span>
            </h1>
            <p style={{
              fontSize: 13.5, color: '#515C6F', fontWeight: 500,
              lineHeight: 1.65, maxWidth: 340,
            }}>
              Automated transcription, compliance scoring, and PII redaction
              for every customer interaction — at enterprise scale.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
            <Feature
              icon={ShieldCheck}
              label="Automated PII Redaction"
              desc="GDPR & PCI-DSS compliance built in at every step"
            />
            <Feature
              icon={BarChart2}
              label="Real-time Analytics"
              desc="Track CTQ scores and agent performance across all LOBs"
            />
            <Feature
              icon={Cpu}
              label="AI-Driven Scoring"
              desc="Custom evaluation criteria per line of business"
            />
          </div>
        </div>

        {/* ── Footer */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          {/* Thin gold separator */}
          <div style={{
            width: 40, height: 1,
            background: 'linear-gradient(90deg, #C9A962, transparent)',
            marginBottom: 14,
          }} />
          <p style={{ fontSize: 11, color: '#2A3040', fontWeight: 500 }}>
            © 2026 AI Audit. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
