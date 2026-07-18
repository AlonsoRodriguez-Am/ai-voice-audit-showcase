import { useState, useEffect } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  FileAudio,
  Settings,
  FileText,
  LogOut,
  Activity,
  Bell,
  HelpCircle,
  SlidersHorizontal,
  History,
  Menu,
  X,
} from 'lucide-react';

interface NavItem {
  name: string;
  path: string;
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>;
  roles: string[];
  group: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// The key insight: ALWAYS render labels in the DOM.
// Control visibility exclusively through CSS opacity + max-width transitions.
// This prevents the jarring reflow/jump that happens when elements are
// conditionally mounted/unmounted mid-animation.
// ─────────────────────────────────────────────────────────────────────────────
function SidebarBody({
  navItems,
  isOpen,
  setIsOpen,
  forMobile = false,
  user,
  handleLogout,
}: {
  navItems: NavItem[];
  isOpen: boolean;
  setIsOpen: (v: boolean) => void;
  forMobile?: boolean;
  user: any;
  handleLogout: () => void;
}) {
  // On mobile the sidebar is always full-width, so always show labels.
  const expanded = forMobile || isOpen;
  const navGroups = ['Workspace', 'System'];

  const initials = user?.username
    ? user.username.split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2)
    : 'U';

  // CSS transition shared by every element that fades/slides with the sidebar.
  // opacity fades fast, max-width clips text without reflow.
  const labelTransition = 'opacity 200ms ease, max-width 300ms ease, width 300ms ease';
  const labelExpanded: React.CSSProperties = {
    opacity: 1,
    maxWidth: 200,
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    transition: labelTransition,
    pointerEvents: 'auto',
  };
  const labelCollapsed: React.CSSProperties = {
    opacity: 0,
    maxWidth: 0,
    overflow: 'hidden',
    whiteSpace: 'nowrap',
    transition: labelTransition,
    pointerEvents: 'none',
  };
  const label = (style?: React.CSSProperties): React.CSSProperties =>
    expanded ? { ...labelExpanded, ...style } : { ...labelCollapsed, ...style };

  // Transition for block containers (group labels, user info block, version string)
  const blockLabel = (extraOpen?: React.CSSProperties): React.CSSProperties =>
    expanded
      ? { maxHeight: 80, opacity: 1, overflow: 'hidden', transition: 'max-height 280ms ease, opacity 200ms ease', ...extraOpen }
      : { maxHeight: 0, opacity: 0, overflow: 'hidden', transition: 'max-height 280ms ease, opacity 150ms ease' };

  return (
    <>
      {/* Gold top accent */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 2,
        background: 'linear-gradient(90deg, var(--accent), transparent 80%)',
        pointerEvents: 'none',
      }} />

      {/* ── Header row: hamburger + logo ─────────────────────── */}
      <div style={{
        padding: '13px 10px 10px',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        flexShrink: 0,
        overflow: 'hidden',
        minHeight: 52,
      }}>
        {/* Hamburger — always visible, never transitions */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          aria-label={isOpen ? 'Colapsar panel' : 'Expandir panel'}
          title={isOpen ? 'Colapsar panel' : 'Expandir panel'}
          style={{
            width: 32, height: 32, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: 'var(--r-sm)',
            color: 'var(--tx-2)', background: 'none', border: 'none',
            cursor: 'pointer', transition: 'background 150ms, color 150ms',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--tx-1)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--tx-2)'; }}
        >
          <Menu size={17} />
        </button>

        {/* Logo square — always in DOM, never reflows */}
        <div style={{
          width: 24, height: 24, flexShrink: 0,
          background: 'linear-gradient(135deg, var(--accent) 0%, #A88B3D 100%)',
          borderRadius: 'var(--r-sm)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 800, fontSize: 12, color: '#090C12',
          fontFamily: 'var(--font-family)',
          // Fade logo icon with sidebar so collapsed rail looks intentional
          opacity: expanded ? 1 : 0,
          transition: 'opacity 200ms ease',
        }}>A</div>

        {/* Brand text — fades and clips inline */}
        <span style={{
          fontWeight: 700, fontSize: 14, letterSpacing: '-0.3px',
          color: 'var(--tx-1)', flex: 1,
          ...label(),
        }}>
          AI Audit
        </span>

        {/* PRO badge */}
        <span style={{
          fontSize: 8, fontWeight: 700, letterSpacing: '1px',
          textTransform: 'uppercase',
          color: 'var(--accent)', background: 'var(--accent-m)',
          border: '1px solid var(--accent-b)', padding: '1px 5px',
          borderRadius: 'var(--r-xs)', flexShrink: 0,
          ...label({ flex: 'none' }),
        }}>PRO</span>
      </div>

      <div style={{ height: 1, background: 'var(--border)', margin: '0 10px 6px', flexShrink: 0 }} />

      {/* ── Nav ──────────────────────────────────────────────── */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '4px 8px', overflowX: 'hidden' }} className="custom-scrollbar">
        {navGroups.map(group => {
          const groupItems = navItems.filter(item => item.group === group);
          if (groupItems.length === 0) return null;
          return (
            <div key={group} style={{ marginBottom: 4 }}>
              {/* Group label: always rendered, height-animated */}
              <div style={{
                fontSize: 9, fontWeight: 600, letterSpacing: '1.1px',
                textTransform: 'uppercase', color: 'var(--tx-3)',
                padding: '0 6px',
                ...blockLabel({ paddingBottom: 6 }),
              }}>{group}</div>

              {/* Spacer visible only when collapsed */}
              <div style={{
                height: expanded ? 0 : 6,
                transition: 'height 300ms ease',
                overflow: 'hidden',
              }} />

              {groupItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  title={!expanded ? item.name : undefined}
                  onClick={() => { if (forMobile) setIsOpen(false); }}
                  style={({ isActive }) => ({
                    display: 'flex', alignItems: 'center',
                    // Always left-align. Icon is always first. Gap animates with label.
                    gap: 9,
                    padding: '7px 9px',
                    marginBottom: 2,
                    borderRadius: 'var(--r-sm)',
                    color: isActive ? 'var(--accent)' : 'var(--tx-2)',
                    background: isActive ? 'var(--accent-m)' : 'transparent',
                    transition: 'background 150ms ease, color 150ms ease',
                    fontSize: 12.5, fontWeight: 500,
                    position: 'relative',
                    textDecoration: 'none', fontFamily: 'var(--font-family)',
                    overflow: 'hidden',
                    // Width clamps to icon-only size when collapsed
                    width: '100%',
                  })}
                  onMouseEnter={e => {
                    const el = e.currentTarget;
                    if (!el.classList.contains('active')) {
                      el.style.background = 'var(--bg-hover)';
                      el.style.color = 'var(--tx-1)';
                    }
                  }}
                  onMouseLeave={e => {
                    const el = e.currentTarget;
                    if (!el.classList.contains('active')) {
                      el.style.background = 'transparent';
                      el.style.color = 'var(--tx-2)';
                    }
                  }}
                >
                  {({ isActive }) => (
                    <>
                      {/* Active left-bar indicator */}
                      {isActive && (
                        <div style={{
                          position: 'absolute', left: -8, top: '50%',
                          transform: 'translateY(-50%)',
                          width: 3, height: 14,
                          background: 'var(--accent)', borderRadius: '0 2px 2px 0',
                        }} />
                      )}

                      {/* Icon — always visible, never wraps */}
                      <item.icon
                        size={15}
                        style={{ flexShrink: 0, color: isActive ? 'var(--accent)' : undefined }}
                      />

                      {/* Label text — opacity+maxWidth animated, no DOM removal */}
                      <span style={label({ fontSize: 12.5, fontWeight: 500 })}>
                        {item.name}
                      </span>
                    </>
                  )}
                </NavLink>
              ))}
              <div style={{ height: 6 }} />
            </div>
          );
        })}
      </nav>

      {/* ── User footer ──────────────────────────────────────── */}
      <div style={{
        padding: '10px', borderTop: '1px solid var(--border)',
        flexShrink: 0, overflow: 'hidden',
      }}>
        {/* Avatar row */}
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '6px 4px', borderRadius: 'var(--r-sm)', cursor: 'pointer',
            transition: 'background 150ms', marginBottom: 4, overflow: 'hidden',
          }}
          title={!expanded ? `${user?.username} · ${user?.role}` : undefined}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          {/* Avatar — always visible */}
          <div style={{
            width: 26, height: 26, flexShrink: 0, borderRadius: '50%',
            background: 'linear-gradient(135deg, #3B4A65, #2A3548)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10, fontWeight: 600, color: 'var(--tx-2)',
          }}>{initials}</div>

          {/* User info — fades with sidebar */}
          <div style={{ flex: 1, minWidth: 0, ...label() }}>
            <div style={{
              fontSize: 11, fontWeight: 600, color: 'var(--tx-1)',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{user?.username}</div>
            <div style={{ fontSize: 9, color: 'var(--tx-3)', textTransform: 'capitalize' }}>
              {user?.role}
            </div>
          </div>
        </div>

        {/* Logout button */}
        <button
          onClick={handleLogout}
          title={!expanded ? 'Logout' : undefined}
          style={{
            width: '100%', display: 'flex', alignItems: 'center',
            justifyContent: 'center',
            gap: 5, padding: '5px 0',
            color: 'var(--tx-3)', fontSize: 10, fontWeight: 600,
            background: 'none', border: 'none', cursor: 'pointer',
            transition: 'color 150ms', fontFamily: 'var(--font-family)',
            letterSpacing: '0.5px', textTransform: 'uppercase',
            overflow: 'hidden',
          }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--red)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--tx-3)')}
        >
          <LogOut size={12} style={{ flexShrink: 0 }} />
          <span style={label({ fontSize: 10, letterSpacing: '0.5px' })}>Logout</span>
        </button>

        {/* Version string */}
        <div style={{
          fontSize: 9, color: 'var(--tx-3)', padding: '3px 2px 0',
          letterSpacing: '0.3px',
          ...blockLabel(),
        }}>v2.5 · AI Audit</div>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
const SIDEBAR_OPEN_KEY = 'ai_audit_sidebar_open';

const Layout = ({ children }: { children: React.ReactNode }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(() => {
    try {
      const v = localStorage.getItem(SIDEBAR_OPEN_KEY);
      return v === null ? true : v === 'true';
    } catch { return true; }
  });

  useEffect(() => {
    try { localStorage.setItem(SIDEBAR_OPEN_KEY, String(isSidebarOpen)); } catch {}
  }, [isSidebarOpen]);

  // Escape → close mobile overlay
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isSidebarOpen && window.innerWidth < 768) setIsSidebarOpen(false);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [isSidebarOpen]);

  // Body scroll lock on mobile overlay
  useEffect(() => {
    if (isSidebarOpen && window.innerWidth < 768) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [isSidebarOpen]);

  const handleLogout = () => { logout(); navigate('/login'); };

  const allNavItems: NavItem[] = [
    { name: 'Dashboard',     path: '/',              icon: LayoutDashboard, roles: ['admin', 'qa_manager'],               group: 'Workspace' },
    { name: 'Evaluation',    path: '/evaluation',    icon: FileAudio,       roles: ['admin', 'qa_manager', 'analyst'],    group: 'Workspace' },
    { name: 'History',       path: '/history',       icon: History,         roles: ['admin', 'qa_manager', 'analyst'],    group: 'Workspace' },
    { name: 'Reports',       path: '/reports',       icon: FileText,        roles: ['admin', 'qa_manager'],               group: 'Workspace' },
    { name: 'Settings',      path: '/settings',      icon: Settings,        roles: ['admin', 'qa_manager'],               group: 'System'    },
    { name: 'System Health', path: '/system-health', icon: Activity,        roles: ['admin', 'super_admin', 'qa_manager'], group: 'System'    },
  ];

  const filteredNavItems = allNavItems.filter(item => {
    if (!item.roles || !user || !user.role) return true;
    const r = user.role.toLowerCase().replace(' ', '_');
    return r === 'super_admin' || item.roles.includes(r);
  });

  const currentItem  = allNavItems.find(i => i.path === location.pathname);
  const currentGroup = currentItem?.group || 'Workspace';
  const currentPage  = currentItem?.name  || 'Dashboard';

  const bodyProps = {
    navItems: filteredNavItems,
    isOpen: isSidebarOpen,
    setIsOpen: setIsSidebarOpen,
    user,
    handleLogout,
  };

  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--bg-base)', overflow: 'hidden' }}>

      {/* ══════════ DESKTOP SIDEBAR ══════════
          Width transitions between 250px (open) and 52px (collapsed).
          overflow:hidden ensures content is clipped during the transition.
          The inner SidebarBody uses opacity+maxWidth on text to avoid reflow. */}
      <aside
        id="sidebar-nav"
        className="sidebar-desktop"
        role="navigation"
        aria-label="Main navigation"
        style={{
          width: isSidebarOpen ? 250 : 52,
          minWidth: isSidebarOpen ? 250 : 52,
          background: 'linear-gradient(180deg, var(--bg-s1) 0%, #0D1017 100%)',
          borderRight: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          zIndex: 10,
          flexShrink: 0,
          overflow: 'hidden',
          // Single cubic-bezier for silky feel — same timing for width + minWidth
          transition: 'width 300ms cubic-bezier(0.4,0,0.2,1), min-width 300ms cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        <SidebarBody {...bodyProps} forMobile={false} />
      </aside>

      {/* ══════════ MOBILE BACKDROP ══════════ */}
      <div
        className="sidebar-mobile-backdrop"
        aria-hidden="true"
        onClick={() => setIsSidebarOpen(false)}
        style={{
          position: 'fixed', inset: 0, zIndex: 40,
          background: 'rgba(0,0,0,0.55)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
          opacity: isSidebarOpen ? 1 : 0,
          pointerEvents: isSidebarOpen ? 'auto' : 'none',
          transition: 'opacity 300ms ease',
        }}
      />

      {/* ══════════ MOBILE PANEL ══════════ */}
      <aside
        className="sidebar-mobile-panel"
        role="navigation"
        aria-label="Main navigation (mobile)"
        style={{
          position: 'fixed', top: 0, bottom: 0, left: 0,
          width: 252, zIndex: 50,
          background: 'linear-gradient(180deg, var(--bg-s1) 0%, #0D1017 100%)',
          borderRight: '1px solid var(--border)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
          transform: isSidebarOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 300ms cubic-bezier(0.4,0,0.2,1)',
        }}
      >
        <button
          aria-label="Cerrar panel"
          onClick={() => setIsSidebarOpen(false)}
          style={{
            position: 'absolute', top: 10, right: 10,
            width: 26, height: 26,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--tx-3)', background: 'none', border: 'none',
            cursor: 'pointer', borderRadius: 'var(--r-sm)',
            transition: 'background 150ms, color 150ms, transform 200ms',
            zIndex: 1,
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--tx-1)'; e.currentTarget.style.transform = 'rotate(90deg)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--tx-3)'; e.currentTarget.style.transform = 'rotate(0deg)'; }}
        >
          <X size={14} />
        </button>
        <SidebarBody {...bodyProps} forMobile={true} />
      </aside>

      {/* ══════════ MAIN CONTENT ══════════ */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

        {/* Topbar */}
        <header style={{
          height: 46,
          padding: '0 22px', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--border)',
          background: 'rgba(15,18,25,0.88)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          flexShrink: 0,
          zIndex: 4,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Mobile-only hamburger */}
            <button
              className="sidebar-mobile-hamburger"
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              aria-label="Abrir menú"
              style={{
                width: 28, height: 28,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--tx-2)', background: 'none', border: 'none',
                cursor: 'pointer', borderRadius: 'var(--r-sm)',
                transition: 'background 150ms, color 150ms',
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--tx-1)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--tx-2)'; }}
            >
              <Menu size={16} />
            </button>

            {/* Breadcrumb */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
              <span style={{ color: 'var(--tx-3)' }}>{currentGroup}</span>
              <span style={{ color: 'var(--tx-3)', fontSize: 10 }}>/</span>
              <span style={{ color: 'var(--tx-1)', fontWeight: 600 }}>{currentPage}</span>
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {([
              { icon: Bell,              title: 'Notifications', hasDot: true,  onClick: () => {} },
              { icon: HelpCircle,        title: 'Help',          hasDot: false, onClick: () => {} },
              { icon: SlidersHorizontal, title: 'Settings',      hasDot: false, onClick: () => navigate('/settings') },
            ] as const).map(({ icon: Icon, title, hasDot, onClick }) => (
              <button
                key={title} title={title} aria-label={title} onClick={onClick}
                style={{
                  width: 28, height: 28, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', borderRadius: 'var(--r-sm)',
                  color: 'var(--tx-2)', cursor: 'pointer',
                  position: 'relative', border: 'none', background: 'none',
                  transition: 'background 150ms, color 150ms',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--tx-1)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--tx-2)'; }}
              >
                <Icon size={14} />
                {hasDot && (
                  <span style={{
                    position: 'absolute', top: 5, right: 5,
                    width: 5, height: 5, background: 'var(--accent)',
                    borderRadius: '50%', border: '1.5px solid var(--bg-s1)',
                  }} />
                )}
              </button>
            ))}
          </div>
        </header>

        {/* Page content */}
        <main
          className="custom-scrollbar"
          style={{
            flex: 1, overflowY: 'auto',
            background: `
              radial-gradient(ellipse at 5% 0%, rgba(201,169,98,0.025) 0%, transparent 50%),
              radial-gradient(ellipse at 95% 95%, rgba(52,211,153,0.015) 0%, transparent 50%),
              var(--bg-base)
            `,
          }}
        >
          <div style={{ padding: '24px 28px 32px' }} className="animate-page">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;
