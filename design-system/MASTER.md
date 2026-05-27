# Unit 20 — Master Design System

> Locked design system. This is the single source of truth for every page and
> component. Implementation lives in `app/globals.css` (tokens + semantic
> classes). When in doubt, this file wins.

**Provenance.** Intended to be generated with the *UI UX Pro Max* skill, then
overridden with the brand spec. That plugin was **not installed** in this
environment, so this system was authored directly from the project brief's
inline design spec. The anti-pattern guardrails below encode the skill's
defaults that the brief called out. If the skill is later installed, re-run a
design pass and reconcile — but do not regress the locked tokens.

---

## 1. Brand positioning

Unit 20 is a Christchurch DJ practice studio, gear-hire business, and event
venue. **Club / underground-adjacent. Not corporate.** Reference points:
Resident Advisor, Boiler Room, Pirate.com, Bureau Borsché.

Voice: direct, confident, a little nocturnal. Real copy, never lorem. Short
declaratives. Mono for facts (prices, times, refs). Serif for statements.

Feeling: a dark room, warm light on metal, precise mechanical motion.

---

## 2. Colour

Dark mode only at MVP. No light/dark toggle.

| Token              | Value                       | Use                                  |
| ------------------ | --------------------------- | ------------------------------------ |
| `--bg`             | `#0A0A0A`                   | Page background (off-black)          |
| `--bg-elev`        | `#141414`                   | Raised surfaces, panels              |
| `--bg-elev-2`      | `#1F1F1F`                   | Cards, modals                        |
| `--text`           | `#F5F1EA`                   | Primary text (warm off-white)        |
| `--text-muted`     | `#8A8580`                   | Secondary text, leads                |
| `--text-dim`       | `#5C5856`                   | Tertiary, disabled, placeholder      |
| `--accent`         | `#3DDC97`                   | Washed sea green — CTAs, focus, links |
| `--accent-hover`   | `#2EC785`                   | Accent hover                         |
| `--accent-glow`    | `rgba(61,220,151,0.15)`     | Glows, 3D rim light, screen emissive |
| `--border`         | `rgba(245,241,234,0.08)`    | Hairlines, default borders           |
| `--border-strong`  | `rgba(245,241,234,0.15)`    | Input underlines, hovered borders    |
| `--danger`         | `#E5484D`                   | Errors, destructive actions          |

Tailwind utilities: `bg-bg`, `bg-bg-elev`, `bg-bg-elev-2`, `text-text`,
`text-text-muted`, `text-text-dim`, `text-accent`, `bg-accent`, `border-border`,
`border-border-strong`, `text-danger`.

Contrast: `--text` on `--bg` ≈ 16:1, `--text-muted` on `--bg` ≈ 6.3:1,
`--accent` on `--bg` ≈ 9:1 — all WCAG AA+. Never put `--text-dim` on `--bg` for
body copy (it's for disabled/decorative only).

---

## 3. Typography

| Role            | Family             | Weight  | Notes                                    |
| --------------- | ------------------ | ------- | ---------------------------------------- |
| Display / heads | **Fraunces**       | 600     | High optical size (`opsz`), tracking −0.03em |
| Body / UI       | **Inter**          | 400–600 | `font-feature-settings: ss01, ss03, cv11` |
| Mono accent     | **JetBrains Mono** | 400–500 | Prices, times, meta, refs. Uppercase eyebrows +0.05em |

Loaded via `next/font/google` as CSS variables `--font-fraunces`,
`--font-inter`, `--font-jetbrains`. Mapped to `font-display`, `font-sans`,
`font-mono`.

Fluid type scale (mobile → desktop, via `clamp()`):

| Class      | Size            | Line height |
| ---------- | --------------- | ----------- |
| `.display` | 56 → 96px       | 1.02        |
| `.h1`      | 40 → 64px       | 1.05        |
| `.h2`      | 28 → 40px       | 1.10        |
| `.h3`      | 20 → 24px       | 1.20        |
| body       | 16 → 17px       | 1.55        |
| `.eyebrow` | 13 → 14px mono  | uppercase, +0.05em |

Semantic classes (`.display`, `.h1`, `.h2`, `.h3`, `.eyebrow`, `.lead`, `.mono`)
are defined in `globals.css`. Use them rather than re-deriving font + size +
tracking in markup.

Section header pattern: small mono uppercase eyebrow → big serif headline → thin
muted paragraph.

---

## 4. Layout

- Max content width **1280px** (`.container-page`); heroes are full-bleed.
- Vertical rhythm: **96px+** between sections on desktop, **64px** on mobile.
- **Asymmetric grids.** Avoid 3-up centred card rows. Offset, span, and stagger.
- Generous whitespace. Let things breathe; the dark ground does the work.

---

## 5. Motion

All motion reads mechanical and precise — no bounce, no elastic overshoot.

| Easing       | Curve                              | Use                          |
| ------------ | ---------------------------------- | ---------------------------- |
| `--ease-mech` | `cubic-bezier(0.22, 1, 0.36, 1)`  | Entries, hovers (300–450ms)  |
| `--ease-panel`| `cubic-bezier(0.83, 0, 0.17, 1)`  | Master hub panels (650ms)    |

- Link hover: underline wipes left→right (`.link`), never fades.
- Card hover: border-colour shift + **2px lift max**. No large scale transforms.
- Buttons: colour transition + 1px active press.
- **`prefers-reduced-motion: reduce` disables all non-essential motion**
  (global reset in `globals.css`). The 3D scene falls back to static SVG; the
  gyroscope parallax is bypassed; hub panels stay at 33% (navigate on click).

---

## 6. Components

- **Buttons** (`.btn` + `.btn-primary` / `.btn-secondary`): **4px corners.**
  Primary = accent fill, bg-colour text. Secondary = transparent + border.
  Disabled = border-only + dim text. Never pill, never `rounded-xl`.
- **Inputs** (`.input`): single **bottom border**, not boxed. Focus = accent
  underline. Invalid = danger underline (`aria-invalid`).
- **Cards** (`.card` + `.card-hover`): 1px border, **no shadow**, slight border
  shift on hover. Never `rounded-2xl`.
- **Pricing**: mono. Currency symbol smaller weight than the amount.
- **Eyebrows / meta / refs**: mono, uppercase where it's a label.

---

## 7. Anti-patterns — actively avoid

- ❌ Purple / pink "AI" gradients
- ❌ Generic SaaS hero: centred CTA + abstract blob
- ❌ Stock smile photography
- ❌ `rounded-2xl` everywhere
- ❌ Emoji used as icons (use Lucide)
- ❌ Fade-up-on-scroll on *every* section (use sparingly, with intent)
- ❌ Lorem / filler copy — write real brand copy or leave `{{ TODO: copy }}`

---

## 8. Accessibility (non-negotiable)

- Keyboard-reachable interactive elements; visible accent focus ring on dark.
- WCAG AA contrast (4.5:1) on all text.
- Reduced motion respected everywhere; 3D → static SVG.
- Form errors announced via `aria-live`; errors in `--danger` with real copy.
- Skip-to-content link in the layout. Alt text on every image.
- The booking calendar announces date + availability to screen readers.

---

## 9. Imagery

- `next/image` with explicit width/height (no CLS). AVIF → WebP → JPEG.
- Lazy-load below the fold. Mood-lit interiors, gear close-ups; no stock smiles.
- Unsplash at MVP via `images.unsplash.com` (configured in `next.config.ts`).

---

## 10. Page-specific overrides

Live in `design-system/pages/`. They may extend but must not contradict the
tokens or anti-patterns above.
