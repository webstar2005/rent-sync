import type { FaqItem } from "@/types";

export const faqs: FaqItem[] = [
  {
    question: "What does Rent Sync do?",
    answer:
      "Rent Sync helps landlords and property managers track rent, tenants, invoices, and payments in one dashboard — replacing spreadsheets and manual follow-up. It bills rent automatically, matches incoming payments to the right tenant, and shows you what is still owed.",
  },
  {
    question: "Do I need to install any software?",
    answer:
      "No. Rent Sync runs in your browser, so there is nothing to install on your computer or phone. Open the dashboard, sign in, and start adding your properties.",
  },
  {
    question: "How do tenants pay, and do I have to record it myself?",
    answer:
      "You register your own M-Pesa paybill, till number, or bank account with us. When a tenant pays, the payment is matched to their invoice automatically and the invoice is marked paid or part-paid. If a payment cannot be matched — a cash payment, or a bank transfer with an unclear reference — you record or reconcile it by hand. Nothing is ever lost.",
  },
  {
    question: "Can I manage more than one property?",
    answer:
      "Yes. Add as many properties, units, and tenants as you need behind one login, and see collected versus outstanding for each property separately. Your records are scoped to your own account and are not visible to any other landlord on the platform.",
  },
  {
    question: "How is my tenant data kept secure?",
    answer:
      "Traffic is encrypted in transit, passwords are stored as bcrypt hashes rather than plain text, and every request is authenticated and checked against your account before it returns data. Access is limited to the people you give an account to.",
  },
  {
    question: "How much does it cost?",
    answer:
      "Pricing is based on how many units you manage, and every plan includes the full feature set: from KES 2,000/month for 5–20 units, up to a custom Enterprise plan for 100+ units. See the pricing page for the full breakdown, or get in touch if you have fewer than 5 units.",
  },
];
