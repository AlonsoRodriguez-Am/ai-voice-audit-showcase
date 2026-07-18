import { useState } from 'react';
import LOBPage from './LOBPage';
import LOBSettingsPage from './LOBSettingsPage';
import PIIConfigPage from './PIIConfigPage';
import { 
  Settings, 
  Cpu, 
  Shield, 
  Puzzle, 
  Users, 
  SlidersHorizontal, 
  UserPlus,
  Key,
  Database,
  Globe,
  BellRing
} from 'lucide-react';
import toast from 'react-hot-toast';

type ActiveTab = 'lobs' | 'llm' | 'pii' | 'integrations' | 'team';

const SettingsPage = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('lobs');

  // Integrations state (interactive)
  const [integrations, setIntegrations] = useState([
    { id: 'salesforce', name: 'Salesforce Call Sync', desc: 'Sync customer calls and CTQ audit scores with CRM accounts automatically.', icon: Database, connected: true, status: 'Active (Sync Rate: 100%)', badge: 'CRM' },
    { id: 'zendesk', name: 'Zendesk Support Desk', desc: 'Create support tickets automatically when a critical QA metric fails.', icon: Globe, connected: false, status: 'Available', badge: 'HELDESK' },
    { id: 'hubspot', name: 'HubSpot Marketing', desc: 'Correlate call conversion rates with marketing campaigns and sales funnels.', icon: Key, connected: false, status: 'Available', badge: 'CRM' },
    { id: 'slack', name: 'Slack QA Alerts', desc: 'Push real-time notifications to team channels on low call quality flags.', icon: BellRing, connected: true, status: 'Active (Channel: #qa-alerts)', badge: 'CHAT' },
  ]);

  const handleToggleIntegration = (id: string) => {
    setIntegrations(prev => prev.map(item => {
      if (item.id === id) {
        const nextConnected = !item.connected;
        if (nextConnected) {
          toast.success(`${item.name} connected successfully!`);
        } else {
          toast.error(`${item.name} disconnected.`);
        }
        return {
          ...item,
          connected: nextConnected,
          status: nextConnected ? 'Active' : 'Available'
        };
      }
      return item;
    }));
  };

  // Team management state
  const [teamMembers, setTeamMembers] = useState([
    { name: 'Alonso Rodriguez', email: 'alonso@aiaudit.pro', role: 'Super Admin', status: 'Active', avatar: 'AR' },
    { name: 'Luisa Fernanda', email: 'luisa@aiaudit.pro', role: 'QA Manager', status: 'Active', avatar: 'LF' },
    { name: 'Carlos Gomez', email: 'carlos@aiaudit.pro', role: 'Analyst', status: 'Active', avatar: 'CG' },
  ]);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('Analyst');

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteName || !inviteEmail) {
      toast.error('Please fill out all fields');
      return;
    }
    const initials = inviteName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
    setTeamMembers(prev => [
      ...prev,
      { name: inviteName, email: inviteEmail, role: inviteRole, status: 'Pending Invite', avatar: initials }
    ]);
    toast.success(`Invite sent successfully to ${inviteEmail}!`);
    setShowInviteModal(false);
    setInviteName('');
    setInviteEmail('');
  };

  const tabs = [
    { id: 'lobs' as const, label: 'LOB Management', desc: 'Create business units and criteria', icon: SlidersHorizontal },
    { id: 'llm' as const, label: 'LLM Settings', desc: 'Configure LLMs, API endpoints & expert params', icon: Cpu },
    { id: 'pii' as const, label: 'PII Redaction', desc: 'Enable SSN, credit cards & custom rules', icon: Shield },
    { id: 'integrations' as const, label: 'Integrations', desc: 'Connect Salesforce, Zendesk & custom APIs', icon: Puzzle },
    { id: 'team' as const, label: 'Team & Members', desc: 'Manage access levels & invite users', icon: Users },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }} className="animate-page">
      
      {/* Unified Main Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--tx-1)', display: 'flex', alignItems: 'center', gap: 10, margin: 0 }}>
            <Settings size={24} color="var(--accent)" /> System Settings
          </h1>
          <p style={{ fontSize: 13, color: 'var(--tx-3)', margin: 0 }}>
            Configure LOB evaluation templates, LLM model connections, custom PII filters, and CRM systems.
          </p>
        </div>
      </div>

      {/* Modern Gold/Slate Horizontal Pill Tabs */}
      <div style={{
        display: 'flex',
        gap: 8,
        padding: 4,
        background: 'var(--bg-s2)',
        borderRadius: 'var(--r-md)',
        border: '1px solid var(--border)',
        overflowX: 'auto'
      }} className="custom-scrollbar">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 18px',
                borderRadius: 'var(--r-sm)',
                border: 'none',
                background: isActive ? 'linear-gradient(135deg, var(--bg-s3) 0%, rgba(201, 169, 98, 0.08) 100%)' : 'transparent',
                color: isActive ? 'var(--accent)' : 'var(--tx-3)',
                boxShadow: isActive ? '0 0 0 1px var(--accent-b) inset' : 'none',
                cursor: 'pointer',
                transition: 'all 200ms ease',
                whiteSpace: 'nowrap',
                fontFamily: 'var(--font-family)',
              }}
              onMouseEnter={e => {
                if (!isActive) {
                  e.currentTarget.style.color = 'var(--tx-1)';
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)';
                }
              }}
              onMouseLeave={e => {
                if (!isActive) {
                  e.currentTarget.style.color = 'var(--tx-3)';
                  e.currentTarget.style.background = 'transparent';
                }
              }}
            >
              <Icon size={14} style={{ color: isActive ? 'var(--accent)' : 'inherit' }} />
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                <span style={{ fontSize: 12, fontWeight: 700 }}>{tab.label}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* Render active setting panel */}
      <div style={{ minHeight: '60vh', transition: 'all 200ms ease' }}>
        {activeTab === 'lobs' && <LOBPage embedded={true} />}
        
        {activeTab === 'llm' && <LOBSettingsPage embedded={true} />}
        
        {activeTab === 'pii' && <PIIConfigPage embedded={true} />}

        {activeTab === 'integrations' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }} className="animate-page">
            <div className="ds-card" style={{ padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ fontSize: 14, fontWeight: 800, color: 'var(--tx-1)', margin: 0 }}>Active Integration Connections</h3>
                <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--accent)', background: 'var(--accent-m)', border: '1px solid var(--accent-b)', padding: '2px 8px', borderRadius: 'var(--r-xs)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Webhooks Enabled
                </span>
              </div>
              <p style={{ fontSize: 12, color: 'var(--tx-3)', margin: '0 0 20px', lineHeight: 1.5 }}>
                Sync call recording archives, transcripts, and CTQ performance evaluations automatically with your enterprise CRM platforms and helpdesks.
              </p>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {integrations.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div 
                      key={item.id} 
                      className="ds-card" 
                      style={{ 
                        padding: 16, 
                        border: item.connected ? '1px solid var(--accent-b)' : '1px solid var(--border)',
                        background: item.connected ? 'var(--accent-m)' : 'var(--bg-s2)',
                        transition: 'all 200ms ease',
                      }}
                    >
                      <div style={{ display: 'flex', gap: 12 }}>
                        <div style={{ 
                          width: 36, height: 36, borderRadius: 'var(--r-sm)', 
                          background: item.connected ? 'var(--bg-s1)' : 'var(--bg-s3)', 
                          display: 'flex', alignItems: 'center', justifyContent: 'center', 
                          color: item.connected ? 'var(--accent)' : 'var(--tx-3)',
                          border: item.connected ? '1px solid var(--accent-b)' : '1px solid var(--border)'
                        }}>
                          <Icon size={18} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--tx-1)' }}>{item.name}</span>
                            <span style={{ fontSize: 8, fontWeight: 800, padding: '1px 6px', borderRadius: '4px', background: 'var(--bg-s3)', color: 'var(--tx-2)', textTransform: 'uppercase', border: '1px solid var(--border)' }}>
                              {item.badge}
                            </span>
                          </div>
                          <p style={{ fontSize: 10.5, color: 'var(--tx-3)', marginTop: 4, lineHeight: 1.45 }}>{item.desc}</p>
                          
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.03)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ width: 6, height: 6, borderRadius: '50%', background: item.connected ? 'var(--green)' : 'var(--tx-3)', boxShadow: item.connected ? '0 0 6px var(--green)' : 'none' }} />
                              <span style={{ fontSize: 9.5, fontWeight: 700, color: item.connected ? 'var(--green)' : 'var(--tx-3)', textTransform: 'uppercase' }}>{item.status}</span>
                            </div>
                            <button
                              onClick={() => handleToggleIntegration(item.id)}
                              style={{
                                padding: '4px 10px',
                                fontSize: 9,
                                fontWeight: 800,
                                textTransform: 'uppercase',
                                letterSpacing: '0.5px',
                                border: 'none',
                                borderRadius: 'var(--r-xs)',
                                background: item.connected ? 'rgba(239, 68, 68, 0.12)' : 'linear-gradient(135deg, var(--accent), #D9BC7A)',
                                color: item.connected ? '#f87171' : '#090C12',
                                cursor: 'pointer',
                                transition: 'all 150ms',
                              }}
                            >
                              {item.connected ? 'Disconnect' : 'Connect'}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Custom Webhook Card */}
            <div className="ds-card" style={{ padding: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 800, color: 'var(--tx-1)', margin: '0 0 4px' }}>Custom Webhook Audits</h3>
              <p style={{ fontSize: 12, color: 'var(--tx-3)', margin: '0 0 16px' }}>Configure custom POST requests to your own API endpoint every time a call evaluation completes.</p>
              
              <div style={{ display: 'flex', gap: 8, maxWidth: 640 }}>
                <input 
                  type="text" 
                  defaultValue="https://api.yourcompany.com/v1/voice-audit/webhook" 
                  placeholder="Enter custom webhook URL..."
                  style={{
                    flex: 1, padding: '10px 14px', background: 'var(--bg-s2)', border: '1px solid var(--border)',
                    borderRadius: 'var(--r-sm)', color: 'var(--tx-1)', fontSize: 12, outline: 'none'
                  }}
                />
                <button
                  onClick={() => toast.success('Webhook saved successfully!')}
                  className="run-btn"
                  style={{ padding: '0 20px', borderRadius: 'var(--r-sm)', fontSize: 10, fontWeight: 800 }}
                >
                  SAVE ENDPOINT
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'team' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }} className="animate-page">
            <div className="ds-card" style={{ padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                  <h3 style={{ fontSize: 14, fontWeight: 800, color: 'var(--tx-1)', margin: 0 }}>Team & Role Directory</h3>
                  <p style={{ fontSize: 12, color: 'var(--tx-3)', margin: '4px 0 0' }}>Manage access roles, view team activity, and invite QA analysts to the tenant.</p>
                </div>
                <button
                  onClick={() => setShowInviteModal(true)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
                    background: 'linear-gradient(135deg, var(--accent), #D9BC7A)', border: 'none',
                    borderRadius: 'var(--r-sm)', color: '#090C12', fontSize: 10, fontWeight: 800,
                    cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.5px'
                  }}
                >
                  <UserPlus size={12} /> Invite Member
                </button>
              </div>

              {/* Members List Table */}
              <div className="ds-card" style={{ overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: 'var(--bg-s2)', borderBottom: '1px solid var(--border)' }}>
                      <th style={{ padding: '12px 16px', fontSize: 10, color: 'var(--tx-3)', textTransform: 'uppercase', fontWeight: 700 }}>Team Member</th>
                      <th style={{ padding: '12px 16px', fontSize: 10, color: 'var(--tx-3)', textTransform: 'uppercase', fontWeight: 700 }}>Email Address</th>
                      <th style={{ padding: '12px 16px', fontSize: 10, color: 'var(--tx-3)', textTransform: 'uppercase', fontWeight: 700 }}>Access Role</th>
                      <th style={{ padding: '12px 16px', fontSize: 10, color: 'var(--tx-3)', textTransform: 'uppercase', fontWeight: 700, textAlign: 'center' }}>System Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teamMembers.map((member, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid var(--border)', transition: 'background 150ms' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-s2)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg, #3B4A65, #2A3548)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: 'var(--accent)' }}>
                              {member.avatar}
                            </div>
                            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--tx-1)' }}>{member.name}</span>
                          </div>
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--tx-2)', fontFamily: 'monospace' }}>{member.email}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ fontSize: 9.5, fontWeight: 800, padding: '2px 8px', borderRadius: '4px', background: 'var(--bg-s3)', color: 'var(--accent)', border: '1px solid var(--border)' }}>
                            {member.role}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          <span style={{
                            fontSize: 8.5, fontWeight: 800, padding: '2px 8px', borderRadius: '20px',
                            background: member.status === 'Active' ? 'var(--green-m)' : 'var(--amber-m)',
                            color: member.status === 'Active' ? 'var(--green)' : 'var(--amber)',
                            border: `1px solid ${member.status === 'Active' ? 'rgba(52,211,153,0.15)' : 'rgba(251,191,36,0.15)'}`,
                            letterSpacing: '0.5px', textTransform: 'uppercase'
                          }}>
                            {member.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Invite Modal Dialog Overlay */}
            {showInviteModal && (
              <div style={{
                position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(5, 6, 8, 0.85)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
                animation: 'fade-in 200ms ease-out'
              }}>
                <form onSubmit={handleInvite} className="ds-card" style={{ padding: 24, maxWidth: 420, width: '100%', display: 'flex', flexDirection: 'column', gap: 16, border: '1px solid var(--accent-b)', boxShadow: '0 20px 50px rgba(0,0,0,0.6)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ fontSize: 15, fontWeight: 800, color: 'var(--tx-1)', margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <UserPlus size={16} color="var(--accent)" /> Invite QA Member
                    </h3>
                    <button type="button" onClick={() => setShowInviteModal(false)} style={{ background: 'none', border: 'none', color: 'var(--tx-3)', fontSize: 18, cursor: 'pointer' }}>&times;</button>
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <label style={{ fontSize: 9.5, color: 'var(--tx-3)', textTransform: 'uppercase', fontWeight: 700 }}>Full Name</label>
                    <input 
                      type="text" 
                      required 
                      value={inviteName} 
                      onChange={(e) => setInviteName(e.target.value)} 
                      placeholder="e.g. John Doe"
                      style={{ padding: '10px 12px', background: 'var(--bg-s2)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', color: 'var(--tx-1)', fontSize: 12, outline: 'none' }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <label style={{ fontSize: 9.5, color: 'var(--tx-3)', textTransform: 'uppercase', fontWeight: 700 }}>Email Address</label>
                    <input 
                      type="email" 
                      required 
                      value={inviteEmail} 
                      onChange={(e) => setInviteEmail(e.target.value)} 
                      placeholder="e.g. john@yourcompany.com"
                      style={{ padding: '10px 12px', background: 'var(--bg-s2)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', color: 'var(--tx-1)', fontSize: 12, outline: 'none' }}
                    />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <label style={{ fontSize: 9.5, color: 'var(--tx-3)', textTransform: 'uppercase', fontWeight: 700 }}>Access Role</label>
                    <select 
                      value={inviteRole} 
                      onChange={(e) => setInviteRole(e.target.value)} 
                      style={{ padding: '10px 12px', background: 'var(--bg-s2)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', color: 'var(--tx-1)', fontSize: 12, outline: 'none' }}
                    >
                      <option value="Analyst">QA Analyst</option>
                      <option value="QA Manager">QA Manager</option>
                      <option value="Admin">Administrator</option>
                    </select>
                  </div>

                  <button
                    type="submit"
                    style={{
                      marginTop: 8, padding: '12px 0', border: 'none', borderRadius: 'var(--r-sm)',
                      background: 'linear-gradient(135deg, var(--accent), #D9BC7A)', color: '#090C12',
                      fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', cursor: 'pointer'
                    }}
                  >
                    SEND SYSTEM INVITATION
                  </button>
                </form>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SettingsPage;
