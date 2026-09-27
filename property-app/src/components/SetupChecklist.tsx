import type { ReactNode } from 'react';

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

  // Everything is done: say so once, briefly, and get out of the way. A permanent congratulatory
  // banner on every dashboard visit is noise.
  if (done === STEPS.length) {
    return (
      <section className="mb-8 rounded-3xl border border-[#1F3A2C] bg-[#14201A] p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-medium text-[#A8D5BC]">
            You’re set up — properties, tenants, invoices and your first payment are all in.
          </p>
          {state.hasChannel ? null : (
            <button
              type="button"
              onClick={() => onAction('channel')}
              className="rounded-xl border border-[#2C4A3A] bg-transparent px-3 py-2 text-xs font-semibold text-[#A8D5BC] transition hover:border-[#A8D5BC]"
            >
              Set up automatic prompts
            </button>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="mb-8 rounded-3xl border border-[#3A2530] bg-[#1C1618] p-4 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold text-[#F6F2F3]">Get set up</h2>
        <span className="text-xs font-medium text-[#A49DA1]">
          {done} of {STEPS.length} done
        </span>
      </div>
      <p className="mt-1 text-sm text-[#A99FA3]">
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
              className={`rounded-2xl border p-3 sm:p-4 ${
                active ? 'border-[#7A3B4C] bg-[#241A1D]' : 'border-[#2A2225] bg-[#161112]'
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span
                    aria-hidden="true"
                    className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      complete ? 'bg-[#1F3A2C] text-[#A8D5BC]' : 'bg-[#2B1A1E] text-[#C65A70]'
                    }`}
                  >
                    {complete ? '✓' : index + 1}
                  </span>
                  <div>
                    <p className={`text-sm font-semibold ${complete ? 'text-[#7E767A] line-through' : 'text-[#F6F2F3]'}`}>
                      {step.title}
                    </p>
                    <p className="mt-1 max-w-prose text-xs leading-relaxed text-[#A99FA3]">{step.detail}</p>
                    {optional && (
                      <p className="mt-1 text-xs text-[#8A7F83]">
                        Optional for now — you can collect without it.
                      </p>
                    )}
                  </div>
                </div>

                {complete ? (
                  <span className="text-xs font-medium text-[#7E767A]">Done</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => onAction(step.id)}
                    className={`shrink-0 rounded-xl px-3 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                      active
                        ? 'bg-[#7A1428] text-white hover:bg-[#8E1A30]'
                        : 'border border-[#33282C] bg-transparent text-[#CFC5CA] hover:border-[#7A3B4C]'
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
    </section>
  );
}
