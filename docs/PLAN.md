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
| 10 | `Footer` | `content/site.ts` | Sitemap columns, social links, legal links |

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
type SiteConfig = { name: string; navLinks: {label: string; href: string}[]; stats?: {label: string; value: string}[] };
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

Not needed. The marketing site ships with no lead-capture or contact form — it's a static showcase that links to the logged-in product app via `siteConfig.appUrl` ("Sign In", "Get Started", footer links). Nothing to host, no form service, no webhook.

The **product app** (Section 11) is the separate logged-in app (e.g. `app.clientdomain.com`) — out of scope for this marketing site. Any enquiries handled in-product or via the client's own channels, not public contact details on this site.

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
7. Build `/pricing` and `/faqs` pages (mostly reusing homepage components).
8. Add metadata/sitemap/robots (Section 8).
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

This is the actual application, separate from the marketing site: a multi-tenant SaaS where each landlord account manages their own properties, tenants, invoices, and payments in isolation from every other account.

> **Status note.** Section 11 below has been rewritten to match how the product app is actually built. The earlier planning text described Supabase + Row-Level Security + M-Pesa (Daraja) + SMS — **that stack was rejected during implementation**. The app is instead a classic **Express + Postgres REST API** with **owner-scoped SQL** (no RLS, no Supabase), payments via **PayHero** (not Daraja), and **no SMS layer at all**. Do not reintroduce Supabase/RLS/Daraja/SMS when extending the app.

### 11.1 High-level stack (as built)

- **Frontend:** Vite + React + TypeScript, in `property-app/` (client). A plain SPA is fine — everything is behind auth, so no SSR/SEO needed.
- **Backend:** Express + Node.js in `property-app/backend/`, speaking JSON to a **Postgres** database via `pg`. Migration files live in `backend/database/migrations/` (applied on top of `schema.sql`).
- **Auth:** JWT (`jsonwebtoken`) with bcrypt password hashing; optional Google sign-in via `google-auth-library` behind `GOOGLE_CLIENT_ID`.
- **Payments:** PayHero (Kenya) — landlords register their own Paybill/Till/Bank channels and receive payment callbacks through a verified webhook.
- **Hosting:** not yet deployed; dev runs the client (Vite `:5173`) + backend (`:4000`) locally.

### 11.2 Data model (Postgres schema)

Defined in `backend/database/schema.sql`, kept under version control. Key tables: `users`, `properties`, `tenants`, `invoices`, `payment_channels`, `payments`, `payhero_callback_log`, `payment_reconciliation_events`, `maintenance_requests`, `property_members`.

Every domain table is owned via a `owner_id` foreign key on `properties` (tenants/invoices/payments reach the owner through their property relationship). **Multi-tenant isolation is enforced in every route with `WHERE p.owner_id = $user`** — see 11.3. Invoices are unique per `invoice_number` and statuses are `pending | paid | partial | overdue | cancelled`; every payment keeps a nullable `invoice_id`/`tenant_id` so unmatched inbound money is recorded, never dropped.

### 11.3 Auth, roles, and owner scoping (no RLS)

- `requireAuth` verifies the JWT and attaches `req.user` (`sub`, `email`, `role`, `name`).
- Roles today: `landlord` (full access), `manager`, `staff`, `tenant`, `admin`. `requireRole(...roles)` and `requireOwnerOrAdmin` gate sensitive routes (e.g. invoice auto-generation, reports). Detailed manager/staff permission boundaries are still to be decided with the client — the codebase currently treats landlord = owner and only owners/admins see reports.
- **Isolation model:** no Row-Level Security. Every list/query filters by `p.owner_id = $1` at the SQL level, and every membership action re-checks ownership before mutating. This is simpler and testable; the integration test suite (`backend/test/*.test.js`) asserts one landlord cannot see or affect another's invoice generation, arrears, or tenant statements.
- Tenant login/portal is **undecided** — decide before building; adding it changes the auth model (tenants currently have no own login to a portal).

### 11.4 Payments integration (PayHero — no Daraja/M-Pesa)

- **PayHero** is the payment aggregator. Landlords register **payment channels** (Paybill/Till/Bank) via `POST /api/payment-channels`, which creates them on the PayHero portal too; channels are scoped to the owner, deactivated (not hard-deleted) once they have history.
- Inbound money arrives via the **PayHero webhook** (`/webhooks/payhero`), verified with `PAYHERO_WEBHOOK_SECRET`. Every callback is persisted to `payhero_callback_log` **before** processing, then matched to the owning channel → supporting tenant → oldest open invoice, credited as a `completion` PaymentHero payment, and the invoice advanced `pending → paid/partial` (unmatched payments are never dropped — they sit flagged for manual review).
- **STK Push** for outbound prompts exists via PayHero (`services/payhero.js`), driven by a `payheroStkPush` live script for demo.
- `POST /api/reconciliation` lets a landlord manually link a received payment (e.g. a bank transfer or an unmatched mobile-money reference) to a tenant; a matching engine and an alerts feed show unmatched/duplicate/manual-review items.
- **M-Pesa Daraja API and property-level payment settings were intentionally removed** during cleanup — payment method is now `mobile_money` (PayHero) or manual recording (bank_transfer/cash/card/other).
- **Needs from client for live use:** PayHero account funded (prepaid wallet), channels verified/active, and (for STK push) the landlord's PIN approval on the receiving phone — plus a deployed URL for the webhook.

### 11.5 Automated invoicing

- `POST /api/invoices/generate` (landlord/admin) and `POST /api/cron/invoices` (system-wide, `x-cron-secret` guard) run `generateMonthlyInvoices`: for every ACTIVE tenant on an ACTIVE property, one `pending` invoice for next month's rent (`due_date` from the property's `rent_due_day`), idempotent per tenant+period (`invoice_number = INV-<tenantId>-<YYYYMM>`).
- The same job flips unpaid `pending` invoices past their due date to `overdue` (`markOverdueInvoices`); `partial` invoices are left to reconciliation.
- No SMS reminders — that layer was removed (see 11.6).

### 11.6 SMS / notifications — REMOVED

Explicitly deleted: `services/sms.js`, the `POST /api/cron/reminders` route, all SMS env vars and references. **Do not reintroduce an SMS layer without a client decision + budget** (billed per message) and a provider choice (Africa's Talking / Twilio).

### 11.7 Reporting

Implemented as owner-scoped SQL endpoints under `GET /api/reports/...` with `?format=csv` export:

- `/api/reports/arrears` — invoiced / paid / outstanding / overdue per active property.
- `/api/reports/collection-rate?months=N` — monthly invoiced vs collected percentage over the last N months (1–24).
- `/api/reports/tenant-statement/:tenantId` — invoice + payment history with running balance (404 for another owner's tenant).

The client surfaces these in the dashboard **Reports** card (arrears, 12-month collection rate, per-tenant statement, CSV downloads).

### 11.8 Build order used for the product app

1. Vite + React + TS client scaffold; Express + Postgres backend with `schema.sql`.
2. Auth: JWT register/login (+ Google), `requireAuth`.
3. Core CRUD: Properties → Tenants (incl. bulk import), owner-scoped throughout.
4. Invoicing: manual + monthly auto-generation + overdue marking (11.5).
5. PayHero integration: channels, webhook pipeline with callback logging, matching engine (11.4).
6. Reconciliation UI: unmatched alerts, manual matching, payment recording.
7. Maintenance request tracking (owner-isolated action queue + escalation).
8. Reports + CSV (11.7).
9. Cleanup pass: removed M-Pesa/Daraja, property payment settings, Supabase/RLS bits, SMS — see 11.6 note.
10. CI: `.github/workflows/ci.yml` (backend tests against a Postgres service container, client typecheck/lint/build, marketing-site lint/build).
11. Remaining: staging/prod DBs + hosting + domain (11.9), then production deploy.

### 11.9 Requires client input before this can be built / go live

- **Tenant portal**: do tenants get their own login to view invoices/pay? (undecided — biggest open decision)
- **Roles**: confirm exact permission boundaries for manager / staff (e.g. do managers see financial reports?).
- **PayHero live readiness**: funded wallet, active KYC + verified channels, dedicated webhook URL (currently points at a dev tunnel), STK approval on the landlord's phone.
- **Hosting & domains**: pick hosts + domains for the marketing site and `app.*`; set `NEXT_PUBLIC_APP_URL` on the marketing site to point at the deployed app.
- **SMS**: only if client decides on affordance + provider + budget (currently absent on purpose).
- **Seed/demo data**: the dev DB still holds earlier demo records — clean before handing over.
- **Data protection compliance**: tenant PII + financial data — review under Kenya's Data Protection Act before launch.

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

Skip TrustBar (no real stats yet) and leave testimonials.ts empty with a TODO comment (no real quotes yet). Skip RoleBenefitsTabs for now — go straight to FeatureGrid. Don't build /features, /pricing, /faqs pages yet.
```

**Phase 3 — Remaining Pages**
```
Using docs/PLAN.md as context:
1. Build the /features, /pricing, and /faqs pages per Section 3, reusing homepage components where sensible.
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

The product app lives in `property-app/` (frontend) and `property-app/backend/` (API). It is **already built** — see Section 11 for the as-built architecture and Section 11.8 for the build order actually used. Phases below describe the codebase as it stands; treat them as orientation, not future work.

**Phase 1 — Scaffold + Data Model**
```
Scaffold a Vite + React + TS client and an Express + Postgres backend per Section 11.1. Define the Postgres schema (Section 11.2) in backend/database/schema.sql with migrations in backend/database/migrations/. Apply via `createdb property_app` + `psql -f schema.sql` or the test helper's applySchema().
```

**Phase 2 — Auth + Owner Scoping**
```
Build register/login (JWT + bcrypt, optional Google sign-in behind GOOGLE_CLIENT_ID) and requireAuth per Section 11.3. Enforce owner isolation in every route with `WHERE p.owner_id = $user` — no RLS. Add requireRole / requireOwnerOrAdmin for sensitive routes.
```

**Phase 3 — Core CRUD**
```
Build Properties → Tenants screens (incl. bulk import) scoped to the logged-in owner. Maintenance request tracking per Section 11.8 (owner action queue + 48h urgent escalation).
```

**Phase 4 — Invoicing**
```
Build manual invoice creation plus the monthly auto-generation cron per Section 11.5 — idempotent per tenant+period, flips pending→overdue past due. See src/services/invoiceService.js and tests in backend/test/invoice.test.js.
```

**Phase 5 — PayHero Payments (not Daraja)**
```
Integrate PayHero per Section 11.4: payment-channel registration/sync, verified webhook at /webhooks/payhero that logs every callback first, matches channel→tenant→oldest open invoice, and reconciles to paid/partial. Never drop unmatched money — flag it for the reconciliation UI instead.
```

**Phase 6 — Reporting**
```
Build the Section 11.7 report endpoints (arrears, collection-rate, tenant-statement + CSV) with owner-scoped SQL, tests in backend/test/report.test.js, and the dashboard Reports card.
```

**Phase 7 — Security + Cleanup (completed)**
```
Cleanup pass removed: M-Pesa/Daraja STK Push, per-property payment settings (now scoped to landlords via payment_channels), Supabase/RLS/RLS-test scaffolding, and the SMS layer (11.6). Keep the codebase free of them.
```

---

## Guardrail Note for the Agent

This plan intentionally follows a common SaaS landing-page *layout convention* (used by most SaaS sites, not any single company). Do not copy specific wording, color palettes, illustrations, or visual layouts from any named competitor or reference site. All copy, imagery, and the Section 2 design system must be original to this client.
