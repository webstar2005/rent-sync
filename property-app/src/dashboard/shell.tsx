import { useEffect, useState, type ReactNode } from 'react';
import { useDashboard, type PageId } from './context';
import { Button } from './ui';
import { OverviewPage } from './pages/OverviewPage';
import { PropertiesPage } from './pages/PropertiesPage';
import { TenantsPage } from './pages/TenantsPage';
import { InvoicesPage } from './pages/InvoicesPage';
import { PaymentsPage } from './pages/PaymentsPage';
import { ChannelsPage } from './pages/ChannelsPage';
import { ReportsPage } from './pages/ReportsPage';
import { MaintenancePage } from './pages/MaintenancePage';
import { Modals } from './modals';

type IconName =
  | 'overview'
  | 'properties'
  | 'tenants'
  | 'invoices'
  | 'payments'
  | 'channels'
  | 'reports'
  | 'maintenance'
  | 'logout'
  | 'menu'
  | 'refresh'
  | 'collect'
  | 'plus'
  | 'search'
  | 'chevron'
  | 'sun'
  | 'moon';

const ICON_PATHS: Record<IconName, ReactNode> = {
  overview: <path d="M4 13h6V4H4v9zm0 7h6v-5H4v5zm10 0h6v-9h-6v9zm0-16v5h6V4h-6z" />,
  properties: (
    <path d="M4 20V6a2 2 0 012-2h6a2 2 0 012 2v14M4 20h14M8 8h2m-2 4h2m6 8V10a2 2 0 012-2h2v10m0 0h-2" />
  ),
  tenants: (
    <path d="M16 19v-1a4 4 0 00-4-4H7a4 4 0 00-4 4v1M9.5 9.5a3 3 0 100-6 3 3 0 000 6zM21 19v-1a4 4 0 00-3-3.87M16 4.13A4 4 0 0119 8" />
  ),
  invoices: (
    <path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8l-5-5zM14 3v5h5M9 13h6M9 17h4" />
  ),
  payments: (
    <path d="M3 7a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7zM3 10h18M7 15h3" />
  ),
  channels: (
    <path d="M12 12a4 4 0 100-8 4 4 0 000 8zM5.6 18.4a9 9 0 0112.8 0M8.5 15.5a5 5 0 017 0M12 12v9" />
  ),
  reports: <path d="M4 19V5m0 14h16M8 15V9m4 6V7m4 8v-4" />,
  maintenance: (
    <path d="M14.7 6.3a4 4 0 105.3 5.3L14 17.6 6.4 10 12.4 4a4 4 0 002.3 2.3zM4 20l4-4" />
  ),
  logout: <path d="M9 21H6a2 2 0 01-2-2V5a2 2 0 012-2h3M16 17l5-5-5-5M21 12H9" />,
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  refresh: <path d="M20 11a8 8 0 10-2.3 6.3M20 5v6h-6" />,
  collect: <path d="M12 5v14m-4-4l4 4 4-4M5 7h14" />,
  plus: <path d="M12 5v14M5 12h14" />,
  search: <path d="M11 19a8 8 0 100-16 8 8 0 000 16zM21 21l-4.3-4.3" />,
  chevron: <path d="M9 6l6 6-6 6" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32l1.41-1.41" />
    </>
  ),
  moon: <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />,
};

export function Icon({ name, className = 'h-5 w-5' }: { name: IconName; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {ICON_PATHS[name]}
    </svg>
  );
}

export type { IconName };

const PAGES: { id: PageId; label: string; icon: IconName }[] = [
  { id: 'overview', label: 'Overview', icon: 'overview' },
  { id: 'properties', label: 'Properties', icon: 'properties' },
  { id: 'tenants', label: 'Tenants', icon: 'tenants' },
  { id: 'invoices', label: 'Invoices', icon: 'invoices' },
  { id: 'payments', label: 'Payments', icon: 'payments' },
  { id: 'channels', label: 'Channels', icon: 'channels' },
  { id: 'reports', label: 'Reports', icon: 'reports' },
  { id: 'maintenance', label: 'Maintenance', icon: 'maintenance' },
];

const MOBILE_TABS: PageId[] = ['overview', 'tenants', 'invoices', 'payments'];

const GROUPS: { title: string; pages: PageId[] }[] = [
  { title: 'Properties', pages: ['properties', 'tenants'] },
  { title: 'Billing', pages: ['invoices', 'payments'] },
  { title: 'Insights', pages: ['channels', 'reports'] },
  { title: 'Maintenance', pages: ['maintenance'] },
];

function initialsFor(name: string | null | undefined): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/* Compact count chip used on panel rows for the rail's detail view. */
function CountBadge({ count, tone = 'neutral' }: { count: number; tone?: 'neutral' | 'danger' }) {
  if (count <= 0) return null;
  return (
    <span
      className={`inline-flex min-w-[20px] items-center justify-center rounded-full px-1.5 text-[11px] font-semibold ${
        tone === 'danger' ? 'bg-[var(--danger-soft)] text-[var(--danger-text)]' : 'bg-[var(--neutral-soft)] text-[var(--neutral-text)]'
      }`}
    >
      {count}
    </span>
  );
}

function RailButton({
  entry,
  active,
  onClick,
}: {
  entry: { id: PageId; label: string; icon: IconName };
  active: boolean;
  onClick: () => void;
}) {
  return (
    <div className="group relative">
      <button
        type="button"
        aria-label={entry.label}
        aria-current={active ? 'page' : undefined}
        onClick={onClick}
        className={`relative flex h-11 w-11 items-center justify-center rounded-xl transition ${
          active ? 'bg-sidebar-active text-[var(--sidebar-active-text)]' : 'text-navy-muted hover:bg-[var(--bg-hover)] hover:text-ink'
        }`}
      >
        {active && <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full bg-accent" />}
        <Icon name={entry.icon} className="h-5 w-5" />
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 whitespace-nowrap rounded-lg bg-[#101820] px-2.5 py-1 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100"
      >
        {entry.label}
      </span>
    </div>
  );
}

function IconRail({ onTogglePanel, collapsed }: { onTogglePanel?: () => void; collapsed?: boolean }) {
  const { page, goTo, can, handleLogout, user } = useDashboard();
  const visiblePages = PAGES.filter((entry) => entry.id !== 'maintenance' || can('maintenance'));
  const name = user?.name || user?.email || 'Landlord';

  return (
    <nav aria-label="Dashboard sections" className="flex w-16 flex-col items-center bg-navy py-4 text-ink">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-sm font-bold text-accent-ink">
        RS
      </span>
      {onTogglePanel && (
        <button
          type="button"
          aria-label={collapsed ? 'Expand navigation panel' : 'Collapse navigation panel'}
          aria-expanded={!collapsed}
          onClick={onTogglePanel}
          className="mt-2 flex h-9 w-11 items-center justify-center rounded-lg text-navy-muted transition hover:bg-[var(--bg-hover)] hover:text-ink"
        >
          <Icon name="chevron" className={`h-4 w-4 transition-transform ${collapsed ? '' : 'rotate-180'}`} />
        </button>
      )}
      <div className="mt-6 flex flex-1 flex-col items-center gap-2">
        {visiblePages.map((entry) => (
          <RailButton
            key={entry.id}
            entry={entry}
            active={page === entry.id}
            onClick={() => goTo(entry.id)}
          />
        ))}
      </div>
      <div className="mt-2 flex flex-col items-center gap-2">
        <span
          className="flex h-9 w-9 items-center justify-center rounded-full bg-sidebar-active text-xs font-semibold text-[var(--sidebar-active-text)]"
          title={name}
          aria-hidden="true"
        >
          {initialsFor(name)}
        </span>
        <button
          type="button"
          aria-label="Log out"
          title="Log out"
          onClick={handleLogout}
          className="flex h-11 w-11 items-center justify-center rounded-xl text-navy-muted transition hover:bg-[var(--bg-hover)] hover:text-ink"
        >
          <Icon name="logout" className="h-5 w-5" />
        </button>
      </div>
    </nav>
  );
}

function SidebarPanel({
  collapsed,
  onToggleCollapse,
  onNavigate,
}: {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onNavigate?: () => void;
}) {
  const { page, goTo, can, handleLogout, user, invoices, maintenance } = useDashboard();

  const visiblePages = PAGES.filter((entry) => entry.id !== 'maintenance' || can('maintenance'));

  const badges: Partial<Record<PageId, number>> = {
    invoices: invoices.filter((invoice) => invoice.status === 'overdue').length,
    maintenance: maintenance.filter((item) => item.status === 'open').length,
  };

  const [open, setOpen] = useState<Record<string, boolean>>(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('rentsync.sidebar.groups') || 'null');
      if (stored && typeof stored === 'object') {
        return Object.fromEntries(GROUPS.map((g) => [g.title, stored[g.title] !== false]));
      }
    } catch {
      // fall through to defaults
    }
    return Object.fromEntries(GROUPS.map((g) => [g.title, true]));
  });

  const toggleGroup = (title: string) => {
    setOpen((current) => {
      const next = { ...current, [title]: !current[title] };
      try {
        localStorage.setItem('rentsync.sidebar.groups', JSON.stringify(next));
      } catch {
        // storage unavailable; keep in-memory state
      }
      return next;
    });
  };

  const navigate = (id: PageId) => {
    goTo(id);
    onNavigate?.();
    const group = GROUPS.find((entry) => entry.pages.includes(id));
    if (group && !open[group.title]) {
      setOpen((current) => {
        const next = { ...current, [group.title]: true };
        try {
          localStorage.setItem('rentsync.sidebar.groups', JSON.stringify(next));
        } catch {
          // storage unavailable; keep in-memory state
        }
        return next;
      });
    }
  };

  const groupItems = (pages: PageId[]) =>
    pages
      .filter((id) => visiblePages.some((entry) => entry.id === id))
      .map((id) => {
        const entry = PAGES.find((pageEntry) => pageEntry.id === id)!;
        const active = page === entry.id;
        return (
          <li key={entry.id}>
            <button
              type="button"
              aria-current={active ? 'page' : undefined}
              onClick={() => navigate(entry.id)}
              className={`flex min-h-9 w-full items-center gap-2.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                active ? 'bg-sidebar-active text-[var(--sidebar-active-text)]' : 'text-navy-muted hover:bg-[var(--bg-hover)] hover:text-ink'
              }`}
            >
              <Icon name={entry.icon} className="h-4 w-4 shrink-0" />
              <span className="min-w-0 flex-1 truncate text-left">{entry.label}</span>
              {badges[entry.id] !== undefined && (
                <CountBadge count={badges[entry.id] as number} tone={entry.id === 'invoices' ? 'danger' : 'neutral'} />
              )}
            </button>
          </li>
        );
      });

  return (
    <div
      className="rs-panel flex h-full w-full flex-col overflow-hidden bg-panel text-ink md:w-60"
      data-collapsed={collapsed ? 'true' : undefined}
    >
      <div className="flex items-center justify-between gap-2 px-4 py-5">
        <div className="min-w-0">
          <div className="text-lg font-semibold tracking-tight">Rent Sync</div>
          <div className="truncate text-xs text-navy-muted">{user?.email}</div>
        </div>
        {onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label={collapsed ? 'Expand navigation panel' : 'Collapse navigation panel'}
            aria-expanded={!collapsed}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-navy-muted transition hover:bg-[var(--bg-hover)] hover:text-ink"
          >
            <Icon name="chevron" className={`h-4 w-4 transition-transform ${collapsed ? '' : 'rotate-180'}`} />
          </button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-2" aria-label="Dashboard pages">
        <ul className="space-y-1">
          <li>
            <button
              type="button"
              aria-current={page === 'overview' ? 'page' : undefined}
              onClick={() => navigate('overview')}
              className={`flex min-h-9 w-full items-center gap-2.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                page === 'overview' ? 'bg-sidebar-active text-[var(--sidebar-active-text)]' : 'text-navy-muted hover:bg-[var(--bg-hover)] hover:text-ink'
              }`}
            >
              <Icon name="overview" className="h-4 w-4 shrink-0" />
              <span className="min-w-0 flex-1 truncate text-left">Overview</span>
            </button>
          </li>
        </ul>

        {GROUPS.map((group) => (
          <div key={group.title} className="mt-3">
            <button
              type="button"
              onClick={() => toggleGroup(group.title)}
              aria-expanded={open[group.title]}
              className="flex w-full items-center justify-between px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-navy-muted transition hover:text-ink"
            >
              {group.title}
              <Icon name="chevron" className={`h-3.5 w-3.5 transition-transform ${open[group.title] ? 'rotate-90' : ''}`} />
            </button>
            <div className="rs-group" data-open={open[group.title] ? 'true' : 'false'}>
              <div>
                <ul className="mt-1 space-y-1">{groupItems(group.pages)}</ul>
              </div>
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-line px-3 py-3">
        <div className="mb-2 truncate px-3 text-xs text-navy-muted">{user?.email}</div>
        <button
          type="button"
          onClick={() => {
            handleLogout();
            onNavigate?.();
          }}
          className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium text-navy-muted transition hover:bg-[var(--bg-hover)] hover:text-ink"
        >
          <Icon name="logout" className="h-5 w-5 shrink-0" />
          Logout
        </button>
      </div>
    </div>
  );
}

function TopBar({ onOpenMenu, theme, onToggleTheme }: { onOpenMenu: () => void; theme: 'dark' | 'light'; onToggleTheme: () => void }) {
  const { page, lastUpdated, refreshing, handleRefresh, startCollecting, user } = useDashboard();
  const current = PAGES.find((entry) => entry.id === page);
  const name = user?.name || user?.email || 'Landlord';

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-page/95 backdrop-blur">
      <div className="flex min-h-16 items-center gap-3 px-4 sm:px-6">
        <button
          type="button"
          onClick={onOpenMenu}
          aria-label="Open navigation"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-line text-ink md:hidden"
        >
          <Icon name="menu" />
        </button>

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold text-heading">
            {current?.label ?? 'Overview'}
          </h1>
          {lastUpdated && (
            <p className="hidden text-xs text-muted sm:block">
              Updated {lastUpdated.toLocaleTimeString()}
            </p>
          )}
        </div>

        <Button variant="secondary" onClick={() => void handleRefresh()} disabled={refreshing}>
          <Icon name="refresh" className="h-4 w-4" />
          <span className="hidden sm:inline">{refreshing ? 'Refreshing…' : 'Refresh'}</span>
        </Button>

        <Button variant="primary" onClick={startCollecting}>
          <Icon name="collect" className="h-4 w-4" />
          Collect
        </Button>

        <button
          type="button"
          onClick={onToggleTheme}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          aria-pressed={theme === 'light'}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[var(--border-control)] text-ink transition hover:bg-[var(--bg-hover)]"
        >
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} className="h-4 w-4" />
        </button>

        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-accent-ink"
          title={name}
          aria-hidden="true"
        >
          {initialsFor(name)}
        </span>
      </div>
    </header>
  );
}

function PageBody() {
  const { page } = useDashboard();
  switch (page) {
    case 'properties':
      return <PropertiesPage />;
    case 'tenants':
      return <TenantsPage />;
    case 'invoices':
      return <InvoicesPage />;
    case 'payments':
      return <PaymentsPage />;
    case 'channels':
      return <ChannelsPage />;
    case 'reports':
      return <ReportsPage />;
    case 'maintenance':
      return <MaintenancePage />;
    default:
      return <OverviewPage />;
  }
}

function MobileTabBar({ onOpenMore }: { onOpenMore: () => void }) {
  const { page, goTo } = useDashboard();
  const tabs = PAGES.filter((entry) => MOBILE_TABS.includes(entry.id));

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-card md:hidden"
    >
      <ul className="grid grid-cols-5">
        {tabs.map((entry) => {
          const active = page === entry.id;
          return (
            <li key={entry.id}>
              <button
                type="button"
                aria-current={active ? 'page' : undefined}
                onClick={() => goTo(entry.id)}
                className={`flex min-h-[56px] w-full flex-col items-center justify-center gap-1 px-1 text-[11px] font-medium ${
                  active ? 'text-accent' : 'text-muted'
                }`}
              >
                <Icon name={entry.icon} className="h-5 w-5" />
                {entry.label}
              </button>
            </li>
          );
        })}
        <li>
          <button
            type="button"
            onClick={onOpenMore}
            className="flex min-h-[56px] w-full flex-col items-center justify-center gap-1 px-1 text-[11px] font-medium text-muted"
          >
            <Icon name="menu" className="h-5 w-5" />
            More
          </button>
        </li>
      </ul>
    </nav>
  );
}

export function AppShell() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem('rentsync.sidebar.collapsed') === 'true';
    } catch {
      return false;
    }
  });
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try {
      return localStorage.getItem('rentsync.theme') === 'light' ? 'light' : 'dark';
    } catch {
      return 'dark';
    }
  });

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('rentsync.theme', theme);
    } catch {
      // storage unavailable; keep in-memory state
    }
  }, [theme]);

  const toggleTheme = () => setTheme((current) => (current === 'dark' ? 'light' : 'dark'));

  const toggleCollapsed = () => {
    setCollapsed((current) => {
      const next = !current;
      try {
        localStorage.setItem('rentsync.sidebar.collapsed', String(next));
      } catch {
        // storage unavailable; keep in-memory state
      }
      return next;
    });
  };

  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [menuOpen]);

  return (
    <div className="min-h-screen bg-page text-ink">
      <aside className="fixed inset-y-0 left-0 z-40 hidden md:flex">
        <IconRail onTogglePanel={toggleCollapsed} collapsed={collapsed} />
        <SidebarPanel collapsed={collapsed} onToggleCollapse={toggleCollapsed} />
      </aside>

      {menuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMenuOpen(false)} aria-hidden="true" />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
            className="absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-[var(--bg-panel-solid)]"
          >
            <SidebarPanel onNavigate={() => setMenuOpen(false)} />
          </div>
        </div>
      )}

      <div className={`transition-[padding-left] duration-[220ms] ${collapsed ? 'md:pl-16' : 'md:pl-[19rem]'}`}>
        <TopBar onOpenMenu={() => setMenuOpen(true)} theme={theme} onToggleTheme={toggleTheme} />
        <main className="mx-auto w-full max-w-6xl px-4 pb-24 pt-6 sm:px-6 md:pb-10">
          <PageBody />
        </main>
      </div>

      <MobileTabBar onOpenMore={() => setMenuOpen(true)} />
      <Modals />
    </div>
  );
}
