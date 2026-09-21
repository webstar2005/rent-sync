"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, CheckCircle2 } from "lucide-react";

const leadSchema = z.object({
  name: z.string().min(2, "Enter your full name").max(80),
  email: z.string().email("Enter a valid email"),
  phone: z.string().min(7, "Enter a valid phone number").max(20).optional().or(z.literal("")),
  portfolioSize: z.string().min(1, "Select portfolio size"),
  message: z.string().max(500, "Max 500 characters").optional().or(z.literal("")),
});

type LeadValues = z.infer<typeof leadSchema>;

export function LeadForm() {
  const [status, setStatus] = React.useState<"idle" | "submitting" | "success" | "error">("idle");
  const [serverError, setServerError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<LeadValues>({
    resolver: zodResolver(leadSchema),
    defaultValues: { name: "", email: "", phone: "", portfolioSize: "", message: "" },
  });

  const onSubmit = async (values: LeadValues) => {
    setStatus("submitting");
    setServerError(null);

    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const msg = data?.error ? `${data.error}` : `Request failed (${res.status})`;
        throw new Error(msg);
      }

      setStatus("success");
      reset();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setServerError(`Something went wrong (${message}). Please try again or email hello@rentsync.co.ke.`);
      setStatus("error");
    }
  };

  if (status === "success") {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-8 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" aria-hidden="true" />
        <h3 className="mt-4 font-heading text-h4 text-ink">Thanks — we got your request</h3>
        <p className="mt-2 text-small text-gray-500">We’ll reply within one business day. If you need faster help, email hello@rentsync.co.ke.</p>
        <button
          type="button"
          onClick={() => setStatus("idle")}
          className="mt-6 inline-flex h-10 items-center justify-center rounded-full border border-ink/10 bg-white px-6 text-sm font-semibold text-ink hover:bg-gray-100"
        >
          Send another
        </button>
      </div>
    );
  }

  return (
    <section id="contact" className="bg-white py-20 lg:py-28">
      <div className="mx-auto max-w-content px-6 lg:px-8">
        <div className="mx-auto grid max-w-5xl gap-10 lg:grid-cols-[1.1fr_1.6fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-burgundy-600">Get a demo</p>
            <h2 className="mt-3 font-heading text-h2 text-ink">See Rent Sync with your own portfolio</h2>
            <p className="mt-4 text-body text-gray-500">
              Tell us how many units you manage and we’ll tailor the walkthrough. No pushy sales — just a quick look.
            </p>
            <ul className="mt-6 space-y-2 text-small text-gray-500">
              <li>• 15-minute call, screenshare included</li>
              <li>• Pricing confirmed on the call</li>
              <li>• Data stays yours — no lock-in</li>
            </ul>
          </div>

          <form
            onSubmit={handleSubmit(onSubmit)}
            noValidate
            className="rounded-2xl border border-black/5 bg-gray-100 p-6 shadow-card lg:p-8"
          >
            <div className="grid gap-5">
              <div>
                <label htmlFor="lead-name" className="block text-sm font-medium text-ink">
                  Full name <span className="text-burgundy-600">*</span>
                </label>
                <input
                  id="lead-name"
                  autoComplete="name"
                  aria-invalid={!!errors.name}
                  aria-describedby={errors.name ? "lead-name-error" : undefined}
                  {...register("name")}
                  className="mt-1.5 w-full rounded-md border border-black/10 bg-white px-3.5 py-2.5 text-sm text-ink placeholder:text-gray-500 focus:border-burgundy-600 focus:outline-none focus:ring-2 focus:ring-burgundy-600/20 aria-[invalid=true]:border-burgundy-600"
                  placeholder="Jane Doe"
                />
                {errors.name && <p id="lead-name-error" className="mt-1 text-xs text-burgundy-600" role="alert">{errors.name.message}</p>}
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label htmlFor="lead-email" className="block text-sm font-medium text-ink">
                    Work email <span className="text-burgundy-600">*</span>
                  </label>
                  <input
                    id="lead-email"
                    type="email"
                    autoComplete="email"
                    aria-invalid={!!errors.email}
                    aria-describedby={errors.email ? "lead-email-error" : undefined}
                    {...register("email")}
                    className="mt-1.5 w-full rounded-md border border-black/10 bg-white px-3.5 py-2.5 text-sm text-ink placeholder:text-gray-500 focus:border-burgundy-600 focus:outline-none focus:ring-2 focus:ring-burgundy-600/20 aria-[invalid=true]:border-burgundy-600"
                    placeholder="jane@example.com"
                  />
                  {errors.email && <p id="lead-email-error" className="mt-1 text-xs text-burgundy-600" role="alert">{errors.email.message}</p>}
                </div>
                <div>
                  <label htmlFor="lead-phone" className="block text-sm font-medium text-ink">
                    Phone
                  </label>
                  <input
                    id="lead-phone"
                    type="tel"
                    autoComplete="tel"
                    aria-invalid={!!errors.phone}
                    aria-describedby={errors.phone ? "lead-phone-error" : undefined}
                    {...register("phone")}
                    className="mt-1.5 w-full rounded-md border border-black/10 bg-white px-3.5 py-2.5 text-sm text-ink placeholder:text-gray-500 focus:border-burgundy-600 focus:outline-none focus:ring-2 focus:ring-burgundy-600/20 aria-[invalid=true]:border-burgundy-600"
                    placeholder="+254 700 000 000"
                  />
                  {errors.phone && <p id="lead-phone-error" className="mt-1 text-xs text-burgundy-600" role="alert">{errors.phone.message}</p>}
                </div>
              </div>

              <div>
                <label htmlFor="lead-size" className="block text-sm font-medium text-ink">
                  Portfolio size <span className="text-burgundy-600">*</span>
                </label>
                <select
                  id="lead-size"
                  aria-invalid={!!errors.portfolioSize}
                  aria-describedby={errors.portfolioSize ? "lead-size-error" : undefined}
                  {...register("portfolioSize")}
                  className="mt-1.5 w-full rounded-md border border-black/10 bg-white px-3.5 py-2.5 text-sm text-ink focus:border-burgundy-600 focus:outline-none focus:ring-2 focus:ring-burgundy-600/20 aria-[invalid=true]:border-burgundy-600"
                  defaultValue=""
                >
                  <option value="" disabled>
                    Select range
                  </option>
                  <option value="1-10">1–10 units</option>
                  <option value="11-50">11–50 units</option>
                  <option value="51-150">51–150 units</option>
                  <option value="150+">150+ units</option>
                </select>
                {errors.portfolioSize && <p id="lead-size-error" className="mt-1 text-xs text-burgundy-600" role="alert">{errors.portfolioSize.message}</p>}
              </div>

              <div>
                <label htmlFor="lead-message" className="block text-sm font-medium text-ink">
                  Anything we should know?
                </label>
                <textarea
                  id="lead-message"
                  rows={3}
                  aria-invalid={!!errors.message}
                  aria-describedby={errors.message ? "lead-message-error" : undefined}
                  {...register("message")}
                  className="mt-1.5 w-full rounded-md border border-black/10 bg-white px-3.5 py-2.5 text-sm text-ink placeholder:text-gray-500 focus:border-burgundy-600 focus:outline-none focus:ring-2 focus:ring-burgundy-600/20 aria-[invalid=true]:border-burgundy-600"
                  placeholder="Current tools, pain points, timeline…"
                />
                {errors.message && <p id="lead-message-error" className="mt-1 text-xs text-burgundy-600" role="alert">{errors.message.message}</p>}
              </div>

              {serverError && (
                <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-xs text-burgundy-600">
                  {serverError}
                </p>
              )}

              <button
                type="submit"
                disabled={status === "submitting"}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-burgundy-600 px-8 text-sm font-semibold text-white shadow-cta hover:bg-burgundy-700 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-burgundy-600 focus-visible:ring-offset-2"
              >
                {status === "submitting" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Sending…
                  </>
                ) : (
                  "Request Demo"
                )}
              </button>

              <p className="text-xs leading-relaxed text-gray-500">
                By submitting, you agree to our <a href="/privacy" className="underline-offset-4 hover:underline text-ink">Privacy Policy</a>. We never share your data.
              </p>
            </div>
          </form>
        </div>
      </div>
    </section>
  );
}
