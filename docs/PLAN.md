# SaaS Marketing Website — Build Plan

**Purpose:** Build an original SaaS product for the client, in two parts:
1. **The marketing website** (Sections 1–10 below) — the public-facing site.
2. **The product app itself** (Section 11) — the logged-in application where landlords/property managers actually manage tenants, invoices, and payments.

These are two separate codebases/deployments (e.g. `clientdomain.com` for the marketing site, `app.clientdomain.com` for the product). This plan uses an industry-standard SaaS site *structure* but requires 100% original copy, visuals, and design tokens — do not reference, scrape, or visually match any competitor site. Note: Section 11 (the actual product) is a substantially larger engineering effort than the marketing site — treat it as a multi-phase build, not a single pass.

---

## 1. Project Setup

```bash
npx create-next-app@latest client-saas-site --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"
cd client-saas-site
npm install react-hook-form zod @hookform/resolvers lucide-react framer-motion clsx
```

- Framework: **Next.js (App Router) + TypeScript** — needed for SEO (SSR/SSG), which matters a lot for a SaaS marketing site.
- Styling: **Tailwind CSS**.
- Icons: **lucide-react** (or swap for custom SVGs later — do not use another company's icon set 1:1).
- Forms: **react-hook-form + zod** for the lead-capture/demo-request form.
- Animation (optional, light use only): **framer-motion** for section fade-ins.
- Backend: none needed by default — see Section 7 for the lead form's two options (no backend, or a Supabase table if submissions need to persist).

### Folder structure

```
src/
  app/
    page.tsx                # Home
    features/page.tsx
    pricing/page.tsx
    faqs/page.tsx
    contact/page.tsx
    layout.tsx
    globals.css
  components/
    layout/
      Navbar.tsx
      Footer.tsx
    sections/
      Hero.tsx
      TrustBar.tsx
      RoleBenefitsTabs.tsx
      FeatureGrid.tsx
      Testimonials.tsx
      Pricing.tsx
      CtaBanner.tsx
      FaqAccordion.tsx
      LeadForm.tsx
    ui/
      Button.tsx
      Card.tsx
      Accordion.tsx
      Tabs.tsx
  content/
    site.ts                 # site-wide config (name, nav links, social)
    features.ts
    pricing.ts
    testimonials.ts
    faqs.ts
  lib/
    supabase.ts              # Optional: Supabase client init (see Section 7, Option B)
  types/
    index.ts
```

Content is **data-driven**: components read from `src/content/*.ts` rather than hardcoding copy inline. This lets the client's actual copy get dropped in without touching component code, and makes it trivial to update later.

---

## 2. Design System (define BEFORE building components)

This is the step that keeps the site from looking templated or derivative. Have the agent generate this first, as a `tailwind.config.ts` theme extension + a short `DESIGN.md`, before writing any section component.

Decide and document:

- **Brand color palette — decided: black + burgundy.** Use exactly these tokens:
  - `burgundy-600` `#7A1428` — primary: CTAs, links, buttons
  - `burgundy-700` `#5C0F1F` — hover/active states
  - `burgundy-50` `#F7E9EB` — light tint: badges, subtle highlights
  - `ink` `#0D0D0D` — near-black: nav, footer, headings
  - `gray-900` `#1A1A1A` — body text
  - `gray-500` `#6B6B6B` — secondary/muted text
  - `gray-100` `#F5F5F5` — section backgrounds
  - `white` `#FFFFFF` — base background
  Mostly white/light section backgrounds with a black nav/footer and burgundy CTAs — keeps WCAG AA contrast easy while the black+burgundy identity carries through the header, footer, and every button.
- **Typography** — one heading font, one body font (Google Fonts is fine). Define a type scale (h1–h4, body, small).
- **Spacing/radius/shadow scale** — consistent corner radius and shadow depth across cards, buttons, inputs.
- **Component style direction** — e.g., flat vs. soft-shadow cards, sharp vs. rounded corners, solid vs. outline buttons. Pick one direction and apply it consistently.
- **Imagery approach** — real product screenshots (if available), custom illustrations, or abstract shapes/gradients. Do not use stock SaaS dashboard mockup images that resemble a specific competitor.

Output: a `tailwind.config.ts` with the palette/fonts wired in, plus a short written style guide so section components stay visually consistent.

---

## 3. Site Map

| Route | Purpose |
|---|---|
| `/` | Home — full marketing narrative, see Section 4 |
| `/features` | Expanded feature detail, one sub-section per major feature |
| `/pricing` | Pricing tiers + comparison |
| `/faqs` | Full FAQ list |
| `/contact` | Demo request / contact form |
| `/privacy`, `/terms` | Legal pages |

Skip use-case-specific landing pages (`/for-x`) unless the client has genuinely distinct buyer personas with different pain points. Don't build these speculatively.

---

## 4. Homepage — Section-by-Section Component Spec

Build in this order. Each row is one component in `src/components/sections/`.

| # | Component | Content driven by | Behavior notes |
|---|---|---|---|
| 1 | `Navbar` | `content/site.ts` | Sticky on scroll, mobile hamburger menu, CTA button distinct from nav links |
| 2 | `Hero` | Inline props (headline/subhead are unique enough to hardcode, or pull from `site.ts`) | Headline + subhead + primary CTA + secondary ("See how it works") CTA. One supporting visual (screenshot/illustration/mockup) |
| 3 | `TrustBar` | `content/site.ts` (`stats: {label, value}[]`) | Only include if client has real numbers. Omit entirely rather than fabricate stats |
| 4 | `RoleBenefitsTabs` | `content/features.ts` grouped by audience | Only build if client truly has 2+ distinct audiences (e.g. different plan types with different value props). Otherwise skip and go straight to FeatureGrid |
| 5 | `FeatureGrid` | `content/features.ts` | 4–6 cards, icon + title + 1–2 sentence benefit (not a feature list — lead with the outcome) |
| 6 | `Testimonials` | `content/testimonials.ts` | Carousel or static 3-grid. **Needs real client testimonials — flag as a content dependency, never invent quotes** |
| 7 | `Pricing` | `content/pricing.ts` | Tiered cards; confirm currency, billing period, and whether "most popular" tier should be highlighted |
| 8 | `CtaBanner` | Inline | Reinforcement headline + single CTA, optionally one supporting stat |
| 9 | `FaqAccordion` | `content/faqs.ts` | Expand-one-at-a-time accordion, show 5–6 on homepage with "See all FAQs" link to `/faqs` |
| 10 | `LeadForm` | react-hook-form + zod schema | See Section 7 for submission handling |
| 11 | `Footer` | `content/site.ts` | Sitemap columns, contact info, social links, legal links |

---

## 4a. Domain-Specific Starter Content (Property Management / Rent Collection SaaS)

The client's product is in the **property management / rent collection software** category — the same broad space as tools like Bomahut, Buildium, or AppFolio. This is a well-established software category with common, non-proprietary concepts (rent reminders, tenant records, invoicing, arrears tracking). The content below is original starter copy in that category — written from scratch, not copied from any competitor — meant to give the agent something concrete to build against. Treat it as a first draft: swap in the client's real product name, actual feature set, and confirmed pricing once available.

**Audience segments** (confirm with client which apply — start with just the first two if unsure):
- Landlords (self-managing their own units)
- Property Managers (managing units on behalf of owners)
- *(optional, only if client's product supports it)* Real Estate Agencies / Housing Estates

**Hero copy (draft):**
- Headline: "Run Your Rental Portfolio Without the Spreadsheet Chaos"
- Subhead: "Software for landlords and property managers to track rent, tenants, and payments — all in one place."
- Primary CTA: "Start Free" · Secondary CTA: "See How It Works"

**Feature set (draft — 6 features for `FeatureGrid`):**
1. **Automated Rent Reminders & Collection** — Send automatic payment reminders and collect rent via mobile money or bank transfer, without manual follow-ups.
2. **Digital Tenant Records** — Keep tenant details, lease terms, and full payment history organized and searchable in one dashboard.
3. **Instant Invoices & Receipts** — Invoices and receipts generate and send automatically the moment a payment clears.
4. **Real-Time Financial Reports** — Track income, arrears, and occupancy across the whole portfolio with exportable statements.
5. **Multi-Property Dashboard** — Manage multiple buildings or units from one login, with role-based access for staff.
6. **Maintenance Request Tracking** — Tenants submit maintenance issues in-app and track resolution status without back-and-forth calls.

**Pricing model (draft — common shape for this category, confirm actual numbers/currency with client):**
Tiered by number of units managed, e.g.:
- Starter — 1–10 units
- Growth — 11–50 units
- Scale — 51–150 units
- Enterprise — 150+ units, custom pricing

**FAQ starters (draft):**
- What does [Product] do?
- Do I need to install any software?
- Can I manage more than one property?
- How is my tenant data kept secure?
- Do you support mobile money and bank payments?
- Is there a free trial?

---

## 5. Content Data Shapes

Define these types in `src/types/index.ts` and populate matching files in `src/content/`:

```ts
type Feature = { icon: string; title: string; description: string; audience?: string };
type PricingTier = { name: string; price: string; billingUnit: string; description: string; features: string[]; ctaLabel: string; highlighted?: boolean };
type Testimonial = { quote: string; name: string; role?: string; company?: string; rating?: number };
type FaqItem = { question: string; answer: string };
type SiteConfig = { name: string; navLinks: {label: string; href: string}[]; stats?: {label: string; value: string}[]; contact: {email: string; phone?: string; address?: string} };
```

Populate with the Section 4a draft content as a starting point, e.g. `content/features.ts`:

```ts
export const features: Feature[] = [
  { icon: "bell", title: "Automated Rent Reminders & Collection", description: "Send automatic payment reminders and collect rent via mobile money or bank transfer, without manual follow-ups." },
  { icon: "users", title: "Digital Tenant Records", description: "Keep tenant details, lease terms, and full payment history organized and searchable in one dashboard." },
  { icon: "receipt", title: "Instant Invoices & Receipts", description: "Invoices and receipts generate and send automatically the moment a payment clears." },
  { icon: "bar-chart", title: "Real-Time Financial Reports", description: "Track income, arrears, and occupancy across the whole portfolio with exportable statements." },
  { icon: "building", title: "Multi-Property Dashboard", description: "Manage multiple buildings or units from one login, with role-based access for staff." },
  { icon: "wrench", title: "Maintenance Request Tracking", description: "Tenants submit maintenance issues in-app and track resolution status without back-and-forth calls." },
];
```

This is still draft copy — replace with the client's real product name, confirmed feature set, actual pricing numbers/currency, and genuine testimonials before final build. Placeholder/lorem-ipsum copy should never ship, but the drafts above are meant to be refined, not invented from nothing.

---

## 6. Responsive & Accessibility Requirements

- Mobile-first Tailwind breakpoints (`sm`, `md`, `lg`, `xl`).
- Nav collapses to a mobile menu below `md`.
- All interactive elements (accordion, tabs, carousel) keyboard-navigable.
- Images use `next/image` with proper `alt` text.
- Color contrast meets WCAG AA against chosen palette.

---

## 7. Form / Backend Handling

Pick one based on client needs:

**Option A — No backend needed yet (fastest):**
Use a form service (e.g. Formspree, or a Next.js API route that emails via a transactional email API) for the lead/demo-request form. No Firebase required.

**Option B — Marketing site's lead form needs its own storage:**
- The product app (Section 11) now runs on Supabase, not Firebase. If the marketing site's lead form should persist submissions rather than just email them, the simplest path is writing to a `leads` table in the same or a separate Supabase project — using `@supabase/supabase-js` — rather than introducing Firebase as a second backend platform.
- If the product itself has a logged-in app area, that's the separate app from Section 11 (e.g. `app.clientdomain.com`) — out of scope for this marketing site; just link the "Sign In" / "Get Started" nav buttons to it.

Decide which option applies before building `LeadForm.tsx`.

---

## 8. SEO & Metadata

- Per-page `metadata` export in Next.js App Router (title, description, OG image).
- `sitemap.xml` and `robots.txt` via Next.js conventions (`app/sitemap.ts`, `app/robots.ts`).
- Semantic HTML (one `h1` per page, proper heading hierarchy).

---

## 9. Build Order (give this to the agent as the execution sequence)

1. Scaffold project (Section 1).
2. Build design system: `tailwind.config.ts` + `DESIGN.md` (Section 2).
3. Build `ui/` primitives: `Button`, `Card`, `Accordion`, `Tabs`.
4. Build `layout/Navbar` and `layout/Footer`.
5. Build homepage sections in the order listed in Section 4, wiring each to its content file with placeholder copy first.
6. Assemble `app/page.tsx` from the sections.
7. Build `/pricing`, `/faqs`, `/contact` pages (mostly reusing homepage components).
8. Wire up `LeadForm` per the chosen option in Section 7.
9. Add metadata/sitemap/robots (Section 8).
10. Swap in real client content (copy, images, testimonials, pricing) — do not ship placeholder text.
11. Responsive + accessibility QA pass (Section 6).
12. Lighthouse pass (performance, SEO, accessibility scores).

---

## 10. Explicitly Out of Scope / Requires Client Input Before Final Build

- Real product screenshots or demo video.
- Actual testimonial quotes and names (with permission to publish).
- Final pricing numbers, currency, and tier breakpoints.
- Brand colors/logo — if the client has no existing brand, this needs a decision before Section 2 can be finalized.
- Whether multiple audience segments exist (affects whether `RoleBenefitsTabs` and use-case landing pages get built at all).

---

## 11. Product App — Backend & Architecture

This is the actual application, separate from the marketing site: a multi-tenant SaaS where each landlord/property manager account manages their own properties, tenants, invoices, and payments in isolation from every other account.

### 11.1 High-level stack

- **Frontend:** Vite + React + TypeScript. (A separate app from the marketing site — this one is entirely behind auth, so it doesn't need Next.js's SSR/SEO benefits; a plain SPA is simpler to build and deploy.)
- **Backend:** Supabase — Postgres (database), Supabase Auth (login), Edge Functions (server-side logic, webhooks, scheduled jobs), Supabase Storage (documents/receipts).
- **Hosting:** Vercel/Netlify for the frontend; Supabase hosts the database, auth, and functions.
- **Why Postgres over Firestore here:** this app is a financial ledger — invoices, payments, tenants, and units are linked records. Postgres gives real foreign keys and referential integrity instead of enforcing links in application code, and SQL makes reporting (arrears by property, collection rate over time) a straightforward query instead of manual aggregation. Multi-tenant isolation is enforced via Postgres Row-Level-Security, a well-established pattern for exactly this "one org can't see another org's rows" problem.
- The shift from Firebase isn't a steep one — Auth, real-time subscriptions, and Storage all exist in Supabase too. The main new skill is SQL instead of NoSQL queries, which is a worthwhile trade for a system handling money.

### 11.2 Data model (Postgres schema)

Every table except `organizations` and `profiles` carries an `organization_id` foreign key — this is what makes the system multi-tenant, and it's enforced at the database level, not just in application code.

```sql
create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid references auth.users(id),
  plan text,
  created_at timestamptz default now()
);

-- one row per auth user, holding role + org membership
create table profiles (
  id uuid primary key references auth.users(id),
  name text,
  email text,
  phone text,
  role text check (role in ('owner','manager','staff')),
  organization_id uuid references organizations(id)
);

create table properties (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) not null,
  name text not null,
  address text,
  type text
);

create table units (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) not null,
  property_id uuid references properties(id) not null,
  unit_number text,
  rent_amount numeric not null,
  status text check (status in ('occupied','vacant')) default 'vacant'
);

create table tenants (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) not null,
  unit_id uuid references units(id),
  name text not null,
  phone text,
  email text,
  lease_start date,
  lease_end date,
  deposit_amount numeric
);

create table invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) not null,
  tenant_id uuid references tenants(id) not null,
  unit_id uuid references units(id) not null,
  amount numeric not null,
  due_date date not null,
  period text,
  status text check (status in ('pending','paid','overdue')) default 'pending'
);

create table payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) not null,
  invoice_id uuid references invoices(id) not null,
  tenant_id uuid references tenants(id) not null,
  amount numeric not null,
  method text check (method in ('mpesa','bank','cash')),
  transaction_ref text,
  paid_at timestamptz default now()
);

create table maintenance_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) not null,
  unit_id uuid references units(id) not null,
  tenant_id uuid references tenants(id),
  description text,
  status text check (status in ('open','in_progress','resolved')) default 'open',
  created_at timestamptz default now()
);
```

Foreign keys (`references`) mean the database itself rejects an invoice pointing at a tenant that doesn't exist — this is the referential-integrity guarantee Firestore doesn't give you.

### 11.3 Auth, roles, and multi-tenant security (Row-Level Security)

- Supabase Auth handles login (email/password, or phone OTP — worth considering given how SMS-centric this market already is).
- On signup, create an `organizations` row and a matching `profiles` row for the owner (via a Postgres trigger or an Edge Function) — `profiles.organization_id` and `profiles.role` are what every security policy checks against.
- Roles: **owner** (full access), **manager** (day-to-day operations, possibly restricted financial visibility), **staff** (limited — e.g. maintenance only). Confirm exact permission boundaries with the client.
- **Enable Row-Level Security on every table and write a policy like this for each one** — this is the single most important checkpoint in the whole build, the same way the Firestore rules were before:

```sql
alter table properties enable row level security;

create policy "org members can access their org's properties"
on properties
for all
using (
  organization_id = (select organization_id from profiles where id = auth.uid())
);
```

Repeat this pattern (adjusted per table) for `units`, `tenants`, `invoices`, `payments`, and `maintenance_requests`. For role-based restrictions (e.g. staff can't see `payments`), add a role check into the policy's `using` clause, or expose a restricted view for lower-privilege roles instead of raw table access.

- Write a Postgres test suite (pgTAP, or integration tests against a local Supabase instance) that specifically tries to read/write Organization B's rows while authenticated as an Organization A user, for every table — the SQL equivalent of the emulator tests from the Firestore version of this plan.
- Decide early whether tenants get their own login (a tenant portal to view invoices/pay) or are purely managed by the landlord/PM with no login of their own — this materially changes the auth and RLS model.

### 11.4 Payments integration

- For Kenya, **M-Pesa (Safaricom Daraja API)** is the standard mobile money integration — via STK Push (prompt the tenant's phone to pay) or a paybill/till number tenants pay into directly.
- Build a Supabase Edge Function as the webhook endpoint to receive M-Pesa payment confirmation callbacks; it inserts a `payments` row and updates the matching `invoices.status` to `'paid'` using the Supabase service-role client.
- Bank payments are typically reconciled manually or via CSV import unless the client has a specific bank API partnership — don't over-build this without a confirmed integration.
- **Needs from client before this can be built:** a registered M-Pesa Till/Paybill number and Daraja API app credentials (sandbox credentials are enough to start development).

### 11.5 Automated invoicing & reminders

- Use `pg_cron` (a Postgres extension Supabase supports natively) or a scheduled Edge Function to generate `invoices` monthly for each active tenant, based on their unit's `rent_amount`.
- A second scheduled job checks for `pending`/`overdue` invoices approaching or past due and triggers reminder notifications (Section 11.6).

### 11.6 SMS / notifications

- Provider options: **Africa's Talking** (common for Kenya/East Africa SMS) or **Twilio**.
- Trigger SMS sends from an Edge Function, called either directly from application code or via a **Database Webhook** (Supabase can fire a webhook on insert/update to a table — e.g. an `invoices` insert triggers the "invoice created" SMS automatically).
- **Needs from client:** SMS provider account + budget (billed per message) before this can go live.

### 11.7 Reporting

- With Postgres, reports like arrears-by-property or collection-rate-over-time are plain SQL (`GROUP BY` + `SUM`), optionally wrapped in a Postgres **view** for reuse across the dashboard — no manual aggregation step needed the way Firestore would require.
- If the client's portfolio grows large enough that live aggregation gets slow, upgrade the view to a **materialized view** refreshed on a schedule, rather than building a custom precomputation system from scratch.

### 11.8 Build order for the product app

1. Set up a Supabase project (Postgres, Auth, Edge Functions, Storage) — separate from anything used for the marketing site.
2. Define the Postgres schema (Section 11.2) and **enable + test Row-Level-Security policies first**, before any UI.
3. Build auth: signup (creates org + owner profile), login, role-based route guards.
4. Build core CRUD screens: Properties → Units → Tenants.
5. Build manual invoice creation, then automate it (Section 11.5).
6. Integrate M-Pesa in **sandbox mode** first (Section 11.4).
7. Build payment recording + auto-reconciliation against invoices.
8. Add SMS notifications (Section 11.6).
9. Build reporting/dashboard views (Section 11.7).
10. Add maintenance request tracking.
11. Full RLS policy audit — specifically test that Org A can never read/write Org B's rows, across every table and every Edge Function.
12. Staging deploy → test with realistic data volume → production deploy.

### 11.9 Requires client input before this can be built (separate from the marketing-site list in Section 10)

- Exact role/permission boundaries (owner vs. manager vs. staff).
- Whether tenants get their own login/portal.
- Confirmed payment methods at launch (M-Pesa only, or also bank/cash recording).
- M-Pesa Daraja API credentials (sandbox to start).
- SMS provider choice and budget.
- Any data migration needs (existing spreadsheets/records to import).
- Data protection compliance requirements — this system stores tenant PII and financial data, so this should be reviewed under Kenya's Data Protection Act before launch, not treated as an afterthought.

---

## 12. Per-Phase Prompts for OpenCode

Don't paste the whole plan as one instruction. Run these one phase at a time, in order, and review each output before starting the next — especially Phase 1 of the product app, where a mistake is a security bug, not just a visual one. Keep this whole file in each repo as `docs/PLAN.md` so opencode can reference it across sessions.

### 12.1 Marketing Site

**Phase 1 — Scaffold + Design System**
```
Using docs/PLAN.md in this repo as context, complete Sections 1 and 2 only:
1. Scaffold the Next.js + TypeScript + Tailwind project exactly as specified in Section 1, including the folder structure.
2. Generate the design system: extend tailwind.config.ts with a color palette, typography scale, and spacing/radius scale per Section 2, and write a short DESIGN.md documenting the choices.

Do not build any page or section components yet. Use the exact black + burgundy palette specified in Section 2 (already decided — don't invent your own colors). Stop after the scaffold and design system are in place so I can review before continuing.
```

**Phase 2 — Layout + Homepage Sections**
```
Using docs/PLAN.md as context, build the homepage per Sections 4 and 4a:
1. Build the ui/ primitives (Button, Card, Accordion, Tabs).
2. Build layout/Navbar and layout/Footer.
3. Build each homepage section component in the order listed in Section 4's table, reading from src/content/*.ts.
4. Populate src/content/features.ts, site.ts, pricing.ts, and faqs.ts using the draft copy in Section 4a as a starting point.
5. Assemble app/page.tsx from the sections.

Skip TrustBar (no real stats yet) and leave testimonials.ts empty with a TODO comment (no real quotes yet). Skip RoleBenefitsTabs for now — go straight to FeatureGrid. Don't build /features, /pricing, /faqs, /contact pages yet.
```

**Phase 3 — Remaining Pages + Lead Form**
```
Using docs/PLAN.md as context:
1. Build the /features, /pricing, /faqs, and /contact pages per Section 3, reusing homepage components where sensible.
2. Build LeadForm.tsx per Section 7, Option A (a form service or a Next.js API route — the product app now runs on Supabase, so don't reach for Firebase here either unless you specifically want it just for this simple lead form).

Use react-hook-form + zod for validation as specified.
```

**Phase 4 — SEO, Metadata, QA**
```
Using docs/PLAN.md as context, complete Sections 6 and 8:
1. Add per-page metadata exports (title, description, OG image) for every route.
2. Add app/sitemap.ts and app/robots.ts.
3. Do a responsive pass across all breakpoints and an accessibility pass (keyboard nav on accordion/tabs, alt text, color contrast).

Report back any contrast or accessibility issues you can't resolve without a design decision from me.
```

### 12.2 Product App

This is a separate repo/project from the marketing site. Phases 5 and 6 below are **blocked** until the Section 11.9 decisions (M-Pesa credentials, SMS provider) are confirmed with the client — don't run those prompts until you have real values to fill in.

**Phase 1 — Data Model + Row-Level Security**
```
This is a new repo for the product app (separate from the marketing site). Using docs/PLAN.md Section 11 as context:
1. Set up a new Supabase project and a Vite + React + TypeScript app per Section 11.1.
2. Run the Postgres schema from Section 11.2 as a migration (tables, foreign keys, check constraints).
3. Enable Row-Level Security on every table except organizations, and write policies enforcing organization_id-based isolation as described in Section 11.3 — each policy must check organization_id against the requesting user's profiles.organization_id.
4. Write a test suite (pgTAP or integration tests against a local Supabase instance) specifically testing that a user from Organization A cannot select, insert, update, or delete any row belonging to Organization B, for every table.

Do not build any UI yet. Stop here — I need to review the RLS policies and test results myself before anything else gets built on top of them.
```

**Phase 2 — Auth + Role-Based Routing**
```
Using docs/PLAN.md Section 11.3 as context, build:
1. Signup flow: creates an organizations row and a profiles row for the owner (via a Postgres trigger or Edge Function).
2. Login flow using Supabase Auth.
3. Role-based route guards for owner / manager / staff — use owner=full access, manager=no financial reports, staff=maintenance-only as placeholder permission boundaries until the client confirms exact rules.

No tenant-facing login yet — that's still undecided per Section 11.9.
```

**Phase 3 — Core CRUD**
```
Using docs/PLAN.md Section 11.2 as context, build CRUD screens for Properties → Units → Tenants, relying on RLS to scope every query to the logged-in user's organization automatically. Basic list/create/edit/delete views, no invoicing or payments yet.
```

**Phase 4 — Invoicing**
```
Using docs/PLAN.md Section 11.5 as context:
1. Build manual invoice creation (insert an invoices row for a tenant/unit).
2. Build the scheduled job (pg_cron or a scheduled Edge Function) that auto-generates invoices monthly based on each unit's rent_amount.

No payment integration yet — invoices just sit in 'pending' status.
```

**Phase 5 — M-Pesa Integration (blocked on credentials)**
```
Using docs/PLAN.md Section 11.4 as context, build the M-Pesa Daraja API integration in sandbox mode using these credentials: [insert sandbox credentials]. Build the Supabase Edge Function webhook that receives payment confirmations, inserts a payments row, and updates the matching invoice's status to 'paid' using the service-role client. Do not switch to production credentials until this is tested end-to-end in sandbox.
```

**Phase 6 — SMS Notifications (blocked on provider choice)**
```
Using docs/PLAN.md Section 11.6 as context, integrate [Africa's Talking / Twilio — insert final choice] using these credentials: [insert credentials]. Trigger SMS via an Edge Function (called directly or via a Database Webhook) on: invoice created, payment received (receipt), and scheduled reminders for upcoming/overdue rent.
```

**Phase 7 — Reporting**
```
Using docs/PLAN.md Section 11.7 as context, build dashboard views for arrears, collection totals, and occupancy using SQL views over the Postgres schema. Only upgrade a view to a materialized view if portfolio size testing shows live aggregation is too slow.
```

**Phase 8 — Maintenance Requests**
```
Build maintenance request tracking per the data model in Section 11.2 — a tenant or staff user can create a request, and its status moves through open → in_progress → resolved.
```

**Phase 9 — Final Security Audit (before any production deploy)**
```
Re-run and extend the cross-tenant test suite from Phase 1 to cover every table and every Edge Function added since. Specifically test that a manager or staff user cannot escalate their own role or access another organization's data through any function, not just direct table access. Report every case tested and its result.
```

---

## Guardrail Note for the Agent

This plan intentionally follows a common SaaS landing-page *layout convention* (used by most SaaS sites, not any single company). Do not copy specific wording, color palettes, illustrations, or visual layouts from any named competitor or reference site. All copy, imagery, and the Section 2 design system must be original to this client.
