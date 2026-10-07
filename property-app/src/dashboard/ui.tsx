import { useEffect, useRef, type ReactNode } from 'react';

/* ------------------------------------------------------------------
   Shared UI primitives.

   One visual language for the whole portal: dark slate cards on a
   slate page, the dark navy button fill reserved for primary actions.
   ------------------------------------------------------------------ */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

const BUTTON_STYLES: Record<ButtonVariant, string> = {
  primary:
    'bg-[var(--color-button)] text-[var(--color-button-text)] hover:bg-[var(--color-button-hover)] active:bg-[var(--color-button-active)] border border-[var(--border-control)] shadow-[var(--shadow-sm)]',
  secondary:
    'bg-card text-ink border border-[var(--border-control)] hover:bg-hover',
  ghost: 'bg-transparent text-muted border border-transparent hover:bg-hover hover:text-ink',
  danger:
    'bg-[var(--danger-soft)] text-[var(--danger-text)] border border-transparent hover:brightness-95',
};

export function Button({
  variant = 'secondary',
  className = '',
  type = 'button',
  ...rest
}: {
  variant?: ButtonVariant;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${BUTTON_STYLES[variant]} ${className}`}
      {...rest}
    />
  );
}

export function Card({ className = '', children }: { className?: string; children: ReactNode }) {
  return (
    <section
      className={`rounded-2xl border border-line bg-card shadow-[var(--shadow-sm)] ${className}`}
    >
      {children}
    </section>
  );
}

export function CardHeader({
  title,
  subtitle,
  actions,
  count,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  count?: string;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-base font-semibold text-heading">{title}</h2>
          {count && <Badge tone="neutral">{count}</Badge>}
        </div>
        {subtitle && <div className="mt-1 text-sm text-muted">{subtitle}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function CardBody({ className = '', children }: { className?: string; children: ReactNode }) {
  return <div className={`p-5 ${className}`}>{children}</div>;
}

export type BadgeTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'accent';

const BADGE_STYLES: Record<BadgeTone, string> = {
  success: 'bg-[var(--success-soft)] text-[var(--success-text)]',
  warning: 'bg-[var(--warning-soft)] text-[var(--warning-text)]',
  danger: 'bg-[var(--danger-soft)] text-[var(--danger-text)]',
  info: 'bg-[var(--info-soft)] text-[var(--info-text)]',
  neutral: 'bg-[var(--neutral-soft)] text-[var(--neutral-text)]',
  accent: 'bg-accent-soft text-accent',
};

export function Badge({
  tone = 'neutral',
  className = '',
  children,
}: {
  tone?: BadgeTone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${BADGE_STYLES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

/* Compact KPI card: a small uppercase label, a large number, and a thin
   coloured rule on the left so the four tiles read apart at a glance. */
export function KpiCard({
  label,
  value,
  accent,
  hint,
  loading,
}: {
  label: string;
  value: ReactNode;
  accent: 'blue' | 'green' | 'amber' | 'red';
  hint?: string;
  loading?: boolean;
}) {
  const accentVar = `var(--kpi-${accent})`;
  return (
    <div className="flex min-h-[104px] flex-col justify-between rounded-2xl border border-line border-l-4 bg-card p-4 shadow-[var(--shadow-sm)]" style={{ borderLeftColor: accentVar }}>
      <p className="rs-label">{label}</p>
      {loading ? (
        <Skeleton className="mt-3 h-8 w-24" />
      ) : (
        <p className="mt-2 text-2xl font-semibold tracking-tight text-heading">{value}</p>
      )}
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <span className={`block animate-pulse rounded-md bg-skeleton ${className}`} />;
}

/* Rows of shimmering placeholders, shown while the first payload is in flight so a card reads as
   "coming" rather than "nothing here yet". */
export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3" aria-hidden="true">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="rounded-xl border border-line bg-subtle p-4">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="mt-3 h-3 w-1/2" />
          <Skeleton className="mt-2 h-3 w-1/4" />
        </div>
      ))}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6" aria-hidden="true">
          <path d="M4 6h16M4 12h16M4 18h10" strokeLinecap="round" />
        </svg>
      </div>
      <div>
        <p className="text-sm font-semibold text-heading">{title}</p>
        {description && <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function ErrorBanner({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p
      role="alert"
      className="rounded-xl border border-[var(--danger-soft)] bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger-text)]"
    >
      {children}
    </p>
  );
}

/* Slide-over drawer used by every "create" form. Closes on Escape and on a
   backdrop click, traps focus into the panel and restores it on close. */
export function Drawer({
  open,
  onClose,
  title,
  description,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) return;
      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    const focusTimer = window.setTimeout(() => {
      const target = panelRef.current?.querySelector<HTMLElement>(
        'input, select, textarea, button:not([data-drawer-close])'
      );
      target?.focus();
    }, 0);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
      restoreRef.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative flex h-full w-full max-w-lg flex-col border-l border-line bg-[var(--bg-card-solid)] shadow-[var(--shadow-modal)]"
      >
        <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-heading">{title}</h2>
            {description && <p className="mt-1 text-sm text-muted">{description}</p>}
          </div>
          <button
            type="button"
            data-drawer-close
            onClick={onClose}
            aria-label="Close"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-line text-muted hover:bg-hover hover:text-ink"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
        {footer && <footer className="border-t border-line px-5 py-4">{footer}</footer>}
      </div>
    </div>
  );
}

/* Centred dialog for confirmations and the tenant detail sheet. */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  size = 'md',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  size?: 'md' | 'xl';
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const restoreRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    const focusTimer = window.setTimeout(() => {
      panelRef.current?.querySelector<HTMLElement>('button, input, select, textarea')?.focus();
    }, 0);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
      restoreRef.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-4 sm:p-6">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`relative my-auto w-full ${size === 'xl' ? 'max-w-3xl' : 'max-w-xl'} rounded-2xl border border-line bg-[var(--bg-card-solid)] shadow-[var(--shadow-modal)]`}
      >
        <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <h2 className="text-lg font-semibold text-heading">{title}</h2>
            {description && <p className="mt-1 text-sm text-muted">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-line text-muted hover:bg-hover hover:text-ink"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            </svg>
          </button>
        </header>
        <div className="max-h-[75vh] overflow-y-auto px-5 py-5">{children}</div>
      </div>
    </div>
  );
}

/* Table shell. Rows render inside `.rs-scroll` so a wide table scrolls in
   the card rather than dragging the whole page sideways. */
export function Table({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="rs-scroll rounded-xl border border-line">
      <table className="w-full min-w-full border-collapse text-left text-sm" aria-label={label}>
        {children}
      </table>
    </div>
  );
}

export function THead({ columns }: { columns: string[] }) {
  return (
    <thead className="bg-subtle">
      <tr>
        {columns.map((column) => (
          <th key={column} scope="col" className="whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted">
            {column}
          </th>
        ))}
      </tr>
    </thead>
  );
}

export function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-ink">
        {label}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-[var(--danger-text)]">{error}</p>}
      {!error && hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}
