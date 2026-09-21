# Design System — Rent Sync Marketing Site

> Decisions for `tailwind.config.ts` + `src/app/globals.css`. Locked before any section component is built (docs/PLAN.md Section 2).

## 1. Brand Palette — Black + Burgundy

Spec is **exact** per `docs/PLAN.md:79` — no invented colors.

| Token | Hex | Usage |
|-------|-----|-------|
| `burgundy-600` | `#7A1428` | Primary — CTAs, links, primary buttons, focus ring |
| `burgundy-700` | `#5C0F1F` | Hover / active / pressed states |
| `burgundy-50` | `#F7E9EB` | Light tint — badges, selection, subtle highlights, CTA hover wash |
| `ink` | `#0D0D0D` | Near-black — nav, footer, headings (`h1–h4`) |
| `gray-900` | `#1A1A1A` | Body text — meets AA on white |
| `gray-500` | `#6B6B6B` | Secondary / muted text, placeholders |
| `gray-100` | `#F5F5F5` | Section backgrounds (alternating white / gray-100) |
| `white` / `background` | `#FFFFFF` | Base page background |

**Contrast checks (against white `#FFFFFF`):**
- `burgundy-600` on white ~8.2:1 — AAA for body, AA for large.
- `ink` on white ~18:1 — AAA.
- `gray-900` on white ~17:1 — AAA body.
- `gray-500` on white ~5.4:1 — passes AA for body (use only for secondary text, not for thin 12px).
- White text on `burgundy-600` ~8.2:1 — AAA for buttons.
- White text on `ink` ~18:1 — AAA for nav/footer.

No dark-mode inversion is shipped in Phase 1 (the `prefers-color-scheme` dark block from the scaffold was removed — marketing site is light-only to keep contrast predictable).

## 2. Typography

**Fonts (Google Fonts, `next/font`):**
- **Heading:** `Sora` (geometric sans, modern, distinctive at large sizes) — `--font-heading`
- **Body:** `Inter` (neutral, highly legible at 14–18px) — `--font-body`

One heading + one body only, per spec. No decorative third font.

**Type scale (in `tailwind.config.ts`):**
```
h1  48px / 1.1  700 -0.02em  Sora  — hero only, one per page
h2  36px / 1.2  700 -0.015em Sora  — section titles
h3  24px / 1.3  600 -0.01em  Sora  — card/feature titles
h4  20px / 1.4  600          Sora  — sub-sections, pricing tier names
body     16px / 1.7 400     Inter — default prose
body-lg  18px / 1.7 400     Inter — hero subhead, lead paragraphs
small    14px / 1.5 400     Inter — captions, meta
xs       12px / 1.5 500 0.04em Inter — eyebrow / kicker / badges (uppercase)
```

Headings render in `ink` (#0D0D0D), body in `gray-900` (#1A1A1A), secondary in `gray-500`.

## 3. Spacing / Layout

- **Max content width:** `72rem` (1152px) — centered `mx-auto`, gutters `px-6` → `lg:px-8`.
- **Section padding:** `py-20` (mobile) → `lg:py-28` (desktop). Alternating `bg-white` / `bg-gray-100`.
- **Grid gaps:** `gap-6` (cards) → `lg:gap-8`.
- **Tailwind spacing extension:** `18: 4.5rem`, `22: 5.5rem` for occasional loose stacks.

Mobile-first breakpoints: `sm` 640, `md` 768, `lg` 1024, `xl` 1280 — nav collapses below `md`.

## 4. Radius / Shadow

Single direction applied everywhere:

| Token | Value | Where |
|-------|-------|-------|
| `sm` | 6px | Inputs, badges |
| `md` / `DEFAULT` | 8px | Buttons (pill uses `full`) |
| `lg` | 12px | Small cards |
| `xl` | 16px | Feature/pricing cards, section callouts |
| `2xl` | 20px | Modals, large surfaces |
| `full` | 9999px | Primary CTAs (pill buttons), avatars |

**Shadows (soft, not hard):**
- `soft` `0 2px 10px rgba(13,13,13,.06)` — subtle divider
- `card` `0 4px 24px rgba(13,13,13,.06)` — default card
- `card-hover` `0 8px 32px rgba(13,13,13,.10)` — card hover lift
- `cta` `0 4px 14px rgba(122,20,40,.25)` — burgundy CTA only

No sharp corners, no heavy drop shadows, no glass — flat/soft-shadow direction.

## 5. Component Style Direction

- **Buttons:** Primary = `bg-burgundy-600` + `text-white` + `rounded-full` + `shadow-cta`, hover `bg-burgundy-700`. Secondary = `bg-white` + `border-ink/10` + `text-ink`, hover `bg-gray-100`. Always `font-semibold text-sm`, `px-6 py-3`.
- **Cards:** `bg-white`, `rounded-xl`, `shadow-card`, `hover:shadow-card-hover` transition, `border border-black/[.04]`. Icon in `bg-burgundy-50` square with `rounded-lg`.
- **Nav:** `bg-ink`, `text-white`, links `text-white/80 hover:text-white`, CTA is burgundy pill inside black bar. Sticky on scroll.
- **Footer:** `bg-ink`, `text-white/60`, headings `text-white`, link hover `text-white`. Same ink to book-end the page.
- **Inputs:** `rounded-md border border-black/10`, focus `ring-2 ring-burgundy-600/20 + border-burgundy-600`.
- **Accent:** Burgundy is never used as a background wash for whole sections — only CTAs, links, badges, icon tiles, and `burgundy-50` tints.

## 6. Imagery Approach

No stock SaaS dashboard mockups that resemble a competitor. Options:
- Abstract geometric shapes / gradients in burgundy → burgundy-50 → white (for hero side visual)
- Custom line illustrations (thin stroke, ink + burgundy)
- Real product screenshots when available (Phase 2+)

## 7. Implementation Notes

- **Tailwind 4:** Tokens live in two places — `tailwind.config.ts` (for tooling/docs) and `@theme inline` in `src/app/globals.css` (runtime). Keep them in sync.
- **Fonts are loaded via `next/font`** (`Inter` + `Sora`) with CSS variables `--font-body` / `--font-heading`; no external stylesheet.
- **Content is data-driven** — copy lives in `src/content/*.ts`, components read from there (Section 1 folder structure).
- `src/lib/utils.ts` provides `cn()` (`clsx`) for class merging; `src/lib/supabase.ts` is a stub for Option B.
