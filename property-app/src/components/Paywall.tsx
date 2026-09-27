import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { getBilling, submitPaymentRequest, type BillingState } from '../lib/api/billing';
import { logout } from '../lib/api/auth';

// Shown instead of the dashboard when the account has not paid.
//
// The point of this screen is that it is the ONLY thing a locked-out user can reach, so it has to
// carry everything needed to resolve the lock: what they owe, where to send it, and a way to hand
// over the M-Pesa confirmation code. It also deliberately does not pretend to know when the
// payment lands — nothing in the system can know that, because a Send Money transfer carries no
// reference we can read.
export default function Paywall({ onActivated }: { onActivated: () => void }) {
  const [state, setState] = useState<BillingState | null>(null);
  const [loadError, setLoadError] = useState('');
  const [plan, setPlan] = useState('standard');
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [sent, setSent] = useState(false);

  async function refresh() {
    try {
      const next = await getBilling();
      setState(next);
      setLoadError('');
    } catch {
      setLoadError('Could not load your subscription. Check your connection and try again.');
    }
  }

  // Fetched on mount rather than passed in: the dashboard's own data loaders are all about to be
  // skipped, and this is the one request a locked account is guaranteed to be allowed to make.
  useEffect(() => {
    getBilling()
      .then((next) => setState(next))
      .catch(() =>
        setLoadError('Could not load your subscription. Check your connection and try again.')
      );
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setSubmitError('');
    try {
      await submitPaymentRequest({ plan, mpesa_confirmation_code: code.trim() });
      setSent(true);
      setCode('');
      await refresh();
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Could not submit that');
    } finally {
      setSubmitting(false);
    }
  }

  const billing = state?.billing;
  const subscription = state?.subscription;
  const selected = state?.plans.find((p) => p.key === plan);
  const hasPending = (state?.pendingRequests.length ?? 0) > 0;

  return (
    <div className="min-h-screen bg-[#0D0A0B] px-4 py-10 text-[#F6F2F3]">
      <div className="mx-auto max-w-3xl">
        <div className="rounded-3xl border border-[#261F22] bg-[#161112] p-8 shadow-[0_20px_60px_rgba(0,0,0,0.6)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#C65A70]">Rent Sync</p>
              <h1 className="mt-3 text-3xl font-bold text-[#F6F2F3]">
                {subscription?.status === 'suspended' ? 'Your subscription is suspended' : 'Activate your account'}
              </h1>
            </div>
            <button
              type="button"
              onClick={() => void logout()}
              className="no-scale rounded-lg border border-[#3A2F33] px-4 py-2 text-sm font-semibold text-[#C9C0C4] transition hover:border-[#C65A70] hover:text-white"
            >
              Sign out
            </button>
          </div>

          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-[#C9C0C4]">
            {subscription?.status === 'suspended'
              ? 'Please get in touch and we will sort this out.'
              : 'Your account is set up and your data is safe. Add a property the moment your first payment is confirmed — everything unlocks automatically, no need to sign in again.'}
          </p>

          {loadError && <p className="mt-6 rounded-xl bg-[#2A1418] p-4 text-sm text-[#F0A0A0]">{loadError}</p>}

          {hasPending && (
            <p className="mt-6 rounded-xl border border-[#3A2F33] bg-[#1C1618] p-4 text-sm text-[#C9C0C4]">
              You have a payment waiting to be checked. We will switch your account on as soon as it
              matches our statement — there is nothing else to do.
            </p>
          )}

          {/* 1. Choose a plan */}
          <section className="mt-8">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-[#8E8186]">1. Your plan</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {(state?.plans ?? [])
                .filter((p) => p.amount !== null)
                .map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => setPlan(p.key)}
                    aria-pressed={plan === p.key}
                    className={`no-scale rounded-xl border p-4 text-left transition ${
                      plan === p.key
                        ? 'border-[#7A1428] bg-[#2A1418]'
                        : 'border-[#3A2F33] bg-[#1C1618] hover:border-[#7A1428]'
                    }`}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-semibold text-[#F6F2F3]">{p.name}</span>
                      <span className="font-semibold text-[#C65A70]">
                        KES {p.amount?.toLocaleString()}
                        <span className="text-xs font-normal text-[#8E8186]">/mo</span>
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-[#8E8186]">
                      {p.unitCeiling ? `Up to ${p.unitCeiling} units` : 'Unlimited units'}
                    </p>
                  </button>
                ))}
            </div>
            <p className="mt-3 text-xs text-[#8E8186]">
              Running 100+ units, or fewer than 5? Message us and we will price it for you.
            </p>
          </section>

          {/* 2. Send the money */}
          <section className="mt-8">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-[#8E8186]">
              2. Send {selected?.amount ? `KES ${selected.amount.toLocaleString()}` : 'the amount'} by M-Pesa
            </h2>
            {billing ? (
              <>
                <div className="mt-3 rounded-xl border border-[#3A2F33] bg-[#1C1618] p-5">
                  <p className="text-xs uppercase tracking-widest text-[#8E8186]">Send Money to</p>
                  <p className="mt-1 text-2xl font-bold text-[#F6F2F3]">{billing.phoneDisplay}</p>
                  <p className="mt-3 text-xs leading-relaxed text-[#8E8186]">
                    The name Safaricom shows you is the personal name on the receiving account, not a
                    company name. That is expected.
                  </p>
                </div>
                <ol className="mt-4 space-y-2">
                  {billing.instructions.map((step, i) => (
                    <li key={step} className="flex gap-3 text-sm text-[#C9C0C4]">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#7A1428] text-xs font-semibold text-white">
                        {i + 1}
                      </span>
                      <span className="pt-0.5">{step}</span>
                    </li>
                  ))}
                </ol>
              </>
            ) : (
              <p className="mt-3 text-sm text-[#8E8186]">Loading payment details…</p>
            )}
          </section>

          {/* 3. Hand over the code */}
          <section className="mt-8">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-[#8E8186]">
              3. Send us the confirmation code
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-[#C9C0C4]">
              A Send Money transfer carries no reference we can read, so we cannot match it to your
              account on our own. Paste the confirmation code from your M-Pesa SMS and we will check
              it against our statement.
            </p>

            {sent ? (
              <p className="mt-4 rounded-xl border border-[#2F5D3A] bg-[#14251A] p-4 text-sm text-[#9BD6AC]">
                Received — we are checking it now. This screen will let you in as soon as it matches.
              </p>
            ) : (
              <form className="mt-4 space-y-3" onSubmit={handleSubmit}>
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="e.g. QJG7X2M4KL9RT"
                  aria-label="M-Pesa confirmation code"
                  className="w-full rounded-xl border border-[#3A2F33] bg-[#1C1618] px-4 py-3 text-sm text-[#F6F2F3] placeholder:text-[#6E6367] focus:border-[#7A1428] focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={submitting || code.trim().length < 8}
                  className="no-scale w-full rounded-xl bg-[#7A1428] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#5C0F1F] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting ? 'Sending…' : 'I have paid — submit my code'}
                </button>
                {submitError && <p className="text-sm text-[#F0A0A0]">{submitError}</p>}
              </form>
            )}

            <button
              type="button"
              onClick={onActivated}
              className="no-scale mt-4 text-xs text-[#8E8186] underline underline-offset-4 hover:text-[#C9C0C4]"
            >
              Already activated? Check again
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}
