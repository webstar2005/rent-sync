import { Mail, MessageCircle, Phone } from "lucide-react";
import { contact } from "@/content/contact";

const channels = [
  {
    icon: Phone,
    label: "Call us",
    value: contact.phone,
    href: contact.phoneHref,
    hint: "Fastest for anything urgent",
  },
  {
    icon: MessageCircle,
    label: "WhatsApp",
    value: contact.phone,
    href: contact.whatsappHref,
    hint: "Send us a message any time",
  },
  {
    icon: Mail,
    label: "Email",
    value: contact.email,
    href: contact.emailHref,
    hint: "We reply within one business day",
  },
];

export function Contact() {
  return (
    <section id="contact" className="bg-white py-20 lg:py-28">
      <div className="mx-auto max-w-content px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-burgundy-600">Contact</p>
          <h2 className="mt-3 font-heading text-h2 text-ink">Talk to a real person</h2>
          <p className="mt-4 text-body text-gray-500">
            Questions about a plan, a migration off spreadsheets, or a portfolio over 100 units? Reach us
            however suits you — we answer every one.
          </p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {channels.map((c) => (
            <a
              key={c.label}
              href={c.href}
              className="group flex flex-col rounded-xl border border-black/[.04] bg-white p-6 shadow-card transition hover:border-burgundy-600/20 hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-burgundy-600 focus-visible:ring-offset-2"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-burgundy-50 text-burgundy-600">
                <c.icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <p className="mt-4 text-xs font-semibold uppercase tracking-widest text-gray-500">
                {c.label}
              </p>
              <p className="mt-1.5 font-heading text-h4 break-words text-ink transition group-hover:text-burgundy-600">
                {c.value}
              </p>
              <p className="mt-auto pt-4 text-small text-gray-500">{c.hint}</p>
            </a>
          ))}
        </div>

        <p className="mt-8 text-center text-small text-gray-500">
          Serving landlords and property managers across {contact.region}
        </p>
      </div>
    </section>
  );
}
