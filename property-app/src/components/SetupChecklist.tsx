import { useState, type ReactNode } from 'react';

// First-run checklist.
//
// A new landlord arrives with an empty account and a single scrolling page. Before this, the only
// guidance was "add a property" -- nothing mentioned tenants, invoices, or collecting, and the
// payment-channel section sits at the very bottom below eight empty sections. This walks the four
// steps in the order they actually have to happen, and marks the channel step as optional because a
// landlord without a Till or Paybill cannot do it, and manual recording works without one.

export type SetupStep = 'property' | 'tenant' | 'invoice' | 'collect' | 'channel';

export type SetupState = {
  hasProperty: boolean;
  hasTenant: boolean;
  hasInvoice: boolean;
  hasCollected: boolean;
  hasChannel: boolean;
};

type StepDefinition = {
  id: SetupStep;
  title: string;
  detail: string;
  // Rendered as a muted "later" affordance instead of the primary button.
  optional?: boolean;
  action: string;
};

const STEPS: StepDefinition[] = [
  {
    id: 'property',
    title: 'Add a property',
    detail: 'Name, address, units and the day rent is due. Tenants and invoices hang off it.',
    action: 'Add property',
  },
  {
    id: 'tenant',
    title: 'Add your tenants',
    detail: 'One at a time, or import a spreadsheet. Each tenant needs a phone number to be prompted.',
    action: 'Add tenant',
  },
  {
    id: 'invoice',
    title: 'Generate invoices',
    detail: 'Creates this month’s rent for every active tenant. Safe to run more than once.',
    action: 'Generate invoices',
  },
  {
    id: 'collect',
    title: 'Collect',
    detail:
      'Record a payment you already received, or ask the tenant to pay by prompt. Registering a Paybill or Till lets you send prompts automatically, but you need one issued to you for that.',
    action: 'Record a payment',
  },
];

function isDone(step: SetupStep, state: SetupState): boolean {
  switch (step) {
    case 'property':
      return state.hasProperty;
    case 'tenant':
      return state.hasTenant;
    case 'invoice':
      return state.hasInvoice;
    case 'collect':
      // A landlord is set up once money has actually landed, whether it arrived by prompt or was
      // keyed in by hand. Registering a channel is a means to that, not the goal itself.
      return state.hasCollected;
    default:
      return false;
  }
}

export default function SetupChecklist({
  state,
  onAction,
  actionContent,
}: {
  state: SetupState;
  onAction: (step: SetupStep) => void;
  actionContent?: Partial<Record<SetupStep, ReactNode>>;
}) {
  const done = STEPS.filter((step) => isDone(step.id, state)).length;
  const [collapsed, setCollapsed] = useState(false);

  // Everything is done: get out of the way. A permanent congratulatory banner on
  // every dashboard visit is noise, and the steps behind it (properties, tenants,
  // invoices, collecting) all have their own home in the sidebar now.
  if (done === STEPS.length) {
    return null;
  }

  return (
    <section className="mb-6 rounded-2xl border border-line bg-card shadow-[var(--shadow-sm)]">
      <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-4">
        <div className="flex items-baseline gap-3">
          <h2 className="text-base font-semibold text-heading">Get set up</h2>
          <span className="text-xs font-medium text-muted">
            {done} of {STEPS.length} done
          </span>
        </div>
        <button
          type="button"
          onClick={() => setCollapsed((open) => !open)}
          aria-expanded={!collapsed}
          className="min-h-11 rounded-xl px-3 text-sm font-semibold text-accent hover:bg-accent-soft"
        >
          {collapsed ? 'Show' : 'Hide'}
        </button>
      </div>

      {collapsed ? null : (
        <div className="border-t border-line px-5 py-4">
          <p className="text-sm text-muted">
            Four steps, in order. You can come back to any of them later.
          </p>

          <ol className="mt-4 space-y-2">
        {STEPS.map((step, index) => {
          const complete = isDone(step.id, state);
          // The first unfinished step is the one worth acting on; later ones are dimmed so the list
          // does not shout at someone who only needs to do one thing today.
          const active = !complete && STEPS.slice(0, index).every((earlier) => isDone(earlier.id, state));
          const isCollect = step.id === 'collect';
          const optional = isCollect && !state.hasChannel;

          return (
            <li
              key={step.id}
              className={`rounded-xl border p-3 sm:p-4 ${
                active ? 'border-accent bg-accent-soft/60' : 'border-line bg-subtle'
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span
                    aria-hidden="true"
                    className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      complete ? 'bg-[var(--success-soft)] text-[var(--success-text)]' : 'bg-accent-soft text-accent'
                    }`}
                  >
                    {complete ? '✓' : index + 1}
                  </span>
                  <div>
                    <p className={`text-sm font-semibold ${complete ? 'text-faint line-through' : 'text-heading'}`}>
                      {step.title}
                    </p>
                    <p className="mt-1 max-w-prose text-xs leading-relaxed text-muted">{step.detail}</p>
                    {optional && (
                      <p className="mt-1 text-xs text-faint">
                        Optional for now — you can collect without it.
                      </p>
                    )}
                  </div>
                </div>

                {complete ? (
                  <span className="text-xs font-medium text-faint">Done</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => onAction(step.id)}
                    className={`min-h-11 shrink-0 rounded-xl px-3 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                      active
                        ? 'bg-accent text-accent-ink hover:bg-accent-hover'
                        : 'border border-line bg-card text-ink hover:border-line-strong'
                    }`}
                  >
                    {actionContent?.[step.id] ?? step.action}
                  </button>
                )}
              </div>
            </li>
          );
        })}
          </ol>
        </div>
      )}
    </section>
  );
}
