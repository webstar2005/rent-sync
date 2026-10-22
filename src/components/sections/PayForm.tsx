"use client";

import { useState } from "react";
import { pricingTiers } from "@/content/pricing";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.rentsync.africa";
const payable = pricingTiers.filter((t) => t.billingUnit);

type Status = "idle" | "prompting" | "success" | "failed";

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validatePhone(phone: string): boolean {
  return /^(?:\+?254|0)?(?:7|1)\d{8}$/.test(phone.trim());
}

export function PayForm() {
  const [form, setForm] = useState({ plan: "basic", email: "", phone: "" });
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<{ type: "error" | "success" | "info"; text: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function pollStatus(checkoutRequestId: string, attempt = 0) {
    if (attempt >= 30) {
      setStatus("failed");
      setMessage({
        type: "info",
        text: "We have not heard back from M-Pesa yet. If you approved the prompt, your account will switch on within a minute — sign in to check.",
      });
      return;
    }
    try {
      const res = await fetch(`${API_URL}/api/billing/stk-push/status/${checkoutRequestId}`);
      const data = await res.json();
      if (res.ok && data.status === "completed") {
        setStatus("success");
        setMessage({
          type: "success",
          text: "Payment received. Your account is active — sign in to the dashboard and it will open without the paywall.",
        });
        return;
      }
      if (res.ok && data.status === "failed") {
        setStatus("failed");
        setMessage({
          type: "error",
          text: data.message || "The payment did not go through. Check your M-Pesa balance and try again.",
        });
        return;
      }
    } catch {
      // network hiccup — keep polling
    }
    setTimeout(() => pollStatus(checkoutRequestId, attempt + 1), 4000);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    if (!validateEmail(form.email.trim())) {
      setMessage({ type: "error", text: "Please enter the email address you signed up to Rent Sync with." });
      return;
    }
    if (!validatePhone(form.phone)) {
      setMessage({ type: "error", text: "Please enter a valid Safaricom number, e.g. 0712 345 678." });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/billing/stk-push/initiate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: form.plan,
          email: form.email.trim().toLowerCase(),
          phone: form.phone.trim(),
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setStatus("failed");
        setMessage({ type: "error", text: data.message || "We could not start the payment. Try again." });
        return;
      }

      setStatus("prompting");
      setMessage({
        type: "info",
        text: "Check your phone — an M-Pesa request for your plan is waiting. Enter your PIN to approve it.",
      });
      pollStatus(data.checkoutRequestId);
    } catch {
      setStatus("failed");
      setMessage({ type: "error", text: "Network problem. Check your connection and try again." });
    } finally {
      setIsSubmitting(false);
    }
  }

  const messageStyles = {
    error: "border-red-200 bg-red-50 text-red-700",
    success: "border-emerald-200 bg-emerald-50 text-emerald-700",
    info: "border-burgundy-600/20 bg-burgundy-50 text-burgundy-700",
  } as const;

  return (
    <section className="bg-gray-100 py-12 lg:py-16">
      <div className="mx-auto max-w-content px-6 lg:px-8">
        <div className="grid gap-8 lg:grid-cols-[1.1fr_1fr] lg:gap-12">
          <div>
            <h2 className="font-heading text-h3 text-ink">Pay instantly from your phone</h2>
            <p className="mt-2 text-small text-gray-500">
              Enter your Safaricom number and the email on your Rent Sync account. We will send an
              M-Pesa prompt straight to your phone — approve it with your PIN and your account
              switches on automatically. No codes to copy, nothing to paste.
            </p>

            <form
              onSubmit={handleSubmit}
              className="mt-6 rounded-xl border border-black/[.04] bg-white p-6 shadow-card"
            >
              <div className="space-y-5">
                <div>
                  <label htmlFor="pay-plan" className="block text-small font-medium text-gray-700">
                    Plan
                  </label>
                  <select
                    id="pay-plan"
                    value={form.plan}
                    onChange={(e) => setForm({ ...form, plan: e.target.value })}
                    disabled={status === "prompting"}
                    className="mt-2 w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-body text-ink focus:border-burgundy-600 focus:outline-none focus:ring-2 focus:ring-burgundy-600/20 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {payable.map((tier) => (
                      <option key={tier.id} value={tier.id}>
                        {tier.name} — {tier.price}
                        {tier.billingUnit}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="pay-email" className="block text-small font-medium text-gray-700">
                    Your Rent Sync email
                  </label>
                  <input
                    id="pay-email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    disabled={status === "prompting"}
                    className="mt-2 w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-body text-ink placeholder:text-gray-400 focus:border-burgundy-600 focus:outline-none focus:ring-2 focus:ring-burgundy-600/20 disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </div>

                <div>
                  <label htmlFor="pay-phone" className="block text-small font-medium text-gray-700">
                    Safaricom number to pay from
                  </label>
                  <input
                    id="pay-phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="0712 345 678"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    disabled={status === "prompting"}
                    className="mt-2 w-full rounded-xl border border-black/10 bg-white px-4 py-3 text-body text-ink placeholder:text-gray-400 focus:border-burgundy-600 focus:outline-none focus:ring-2 focus:ring-burgundy-600/20 disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </div>

                {message && (
                  <p
                    role="status"
                    className={`rounded-xl border px-4 py-3 text-small leading-relaxed ${messageStyles[message.type]}`}
                  >
                    {message.text}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting || status === "prompting"}
                  className="inline-flex h-12 w-full items-center justify-center rounded-full bg-burgundy-600 px-8 text-sm font-semibold text-white shadow-cta transition hover:bg-burgundy-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-burgundy-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting
                    ? "Sending the prompt…"
                    : status === "prompting"
                      ? "Waiting for your PIN…"
                      : "Send M-Pesa prompt"}
                </button>
              </div>
            </form>
          </div>

          <div>
            <h2 className="font-heading text-h3 text-ink">How much you will pay</h2>
            <ul className="mt-6 space-y-3">
              {payable.map((tier) => (
                <li
                  key={tier.id}
                  className={`rounded-xl border p-5 transition ${
                    form.plan === tier.id
                      ? "border-burgundy-600 bg-white shadow-card"
                      : "border-black/[.04] bg-white"
                  }`}
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-heading text-h4 text-ink">{tier.name}</span>
                    <span className="font-heading text-h4 text-burgundy-600">
                      {tier.price}
                      <span className="text-small font-normal text-gray-500">{tier.billingUnit}</span>
                    </span>
                  </div>
                  <p className="mt-1 text-small text-gray-500">{tier.description}</p>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-small text-gray-500">
              Running 100+ units? Enterprise is priced by conversation — get in touch and we will
              put a custom plan together.
            </p>
            <div className="mt-6 rounded-xl border border-black/[.04] bg-white p-6">
              <p className="text-small leading-relaxed text-gray-700">
                Prefer to pay the old way? Send Money to our business number and submit the
                confirmation code from your SMS in the dashboard — both methods switch your account
                on. You can also pay by STK Push for someone else: enter their Rent Sync email and
                your own Safaricom number.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
