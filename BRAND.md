# Purple Voice — Brand and design system

Everything that makes Purple Voice look like Purple Voice: the idea, the voice, the
logo, the tokens, the components and the rules for using them. The design tokens live
in one file — [`apps/web/src/styles/tokens.css`](apps/web/src/styles/tokens.css) — and
every page (website, dashboard, admin) reads them. **To restyle the product, change a
token, not a component.**

---

## 1. The idea

**Calm, capable, a little bit of night-sky magic.** Purple Voice puts an AI on the phone
for a sales team. The brand should feel trustworthy enough to speak for a business and
modern enough to feel like the future — never gimmicky.

The look comes from five references, combined:

| Reference | What we took | Where it shows |
|---|---|---|
| Dark "Stardust" landing page | Near-black night sky, a violet light beam, a glowing orb ringed by glass cards, Manrope headlines | Home hero, CTA bands, footer, auth screens, featured pricing card |
| "Magic button" | A dark pill with a rotating neon edge (violet → periwinkle → cyan) and a soft glow | `.btn-magic`: the primary call to action on dark backgrounds |
| Pastel orbit ("But most don't have control") | Pink → lilac → periwinkle wash, light words beside one heavy word, icons orbiting a glowing spark | The statement band on the home page, page intros |
| Bento feature cards | White cards whose top half is a pastel, gridded illustration made of real UI fragments, black pill labels | Home features, blog cards, empty cover art |
| "Moon Club" dashboard | Lavender canvas, rounded panel, a rail of round icons with the active one in black, lilac gradient stat tiles, light-weight big numbers, a radial tick gauge, black pill buttons | Subscriber dashboard and admin panel |

---

## 2. Voice and tone

- **Plain and specific.** "Book a free 30-minute consultation", not "unlock your growth".
- **Confident, not loud.** No exclamation marks in the product; at most one on the website.
- **Speak to the person doing the work** — the sales lead, the founder, the agency owner.
- **Honest about limits.** Say what a plan includes, what is billed elsewhere (phone
  numbers, AI usage) and what isn't available yet.
- UI copy: sentence case everywhere ("Connect a carrier", not "Connect A Carrier");
  buttons say what happens ("Create agent", "Send reply").

---

## 3. Logo

The mark is a **four-point spark inside a violet orb**, with a small satellite dot — the
same spark that glows at the centre of the brand imagery. The wordmark is
**Purple Voice** in Manrope Bold, tracking −0.4%.

| Asset | File |
|---|---|
| Mark (SVG) | `apps/web/public/images/brand/purple-voice-mark.svg` (also the favicon, `apps/web/src/app/icon.svg`) |
| Logo, horizontal (SVG) | `apps/web/public/images/brand/purple-voice-logo.svg` |
| React component | `apps/web/src/components/brand/Logo.tsx` (`<Logo tone="dark" | "light" />`, `<LogoMark />`) |
| Social card | generated: `apps/web/src/app/opengraph-image.tsx` |

Rules: keep clear space equal to the orb's radius on every side; minimum size 24 px for
the mark, 120 px wide for the logo; use the light wordmark (`tone="light"`) on night
backgrounds; never recolour the spark, stretch the orb, add effects or place the logo on
a busy image.

---

## 4. Colour

All colours are CSS custom properties holding RGB channels (so Tailwind opacity works:
`bg-brand/10`). Tailwind names in brackets.

### Brand violet (`brand-*`)
| Token | Hex | Use |
|---|---|---|
| `--pv-violet-50` | `#F7F4FF` | Faint tints, hovers on white |
| `--pv-violet-100` | `#EEE9FF` | Soft buttons, badges, selected rows |
| `--pv-violet-200` | `#DDD3FE` | Stat-tile gradient start, selection |
| `--pv-violet-300` | `#BEACFC` | Stat-tile gradient end, accents on dark |
| `--pv-violet-400` | `#9C80FA` | Glows, focus borders |
| `--pv-violet-500` | `#7C58F8` | Gradients, focus ring |
| **`--pv-violet-600`** | **`#6236F0`** | **Primary brand colour (`brand`)**, links, chart series |
| `--pv-violet-700` | `#4C1DD8` | Text links on tints, gradient end |
| `--pv-violet-800` | `#3512A8` | Hover for black buttons, deep orbit icons |
| `--pv-violet-900` | `#260E78` | Deep backgrounds behind the neon button |
| `--pv-violet-950` | `#150840` | Heavy display words on pastel ("time.") |

### Pastels and neon
| Token | Hex | Use |
|---|---|---|
| `--pv-pink-100` / `--pv-pink-300` | `#FDE6F8` / `#F6B6EC` | Pastel wash, orbit chips |
| `--pv-periwinkle-200` / `-300` | `#C7D2FE` / `#A5B4FC` | Pastel wash, neon gradient middle |
| `--pv-cyan-300` | `#67E8F9` | Only the neon edge of `.btn-magic` |

### Neutrals
| Token | Hex | Use |
|---|---|---|
| `--pv-ink` (`ink`) | `#0E0B1A` | Body text, **black pill buttons**, active nav |
| `--pv-ink-soft` | `#342E4A` | Secondary text |
| `--pv-muted` (`muted`) | `#6E6887` | Descriptions, captions (AA on white) |
| `--pv-subtle` (`subtle`) | `#78728F` | Placeholders, tertiary text — on white only (4.6:1); use `muted` on canvas |
| `--pv-line` (`line`) | `#E8E4F3` | Borders, dividers, chart grid |
| `--pv-surface` (`surface`) | `#FFFFFF` | Cards |
| `--pv-canvas` (`canvas`) | `#F7F6FB` | Light page background |

### Night (dark sections) and app shell
| Token | Hex | Use |
|---|---|---|
| `--pv-night` | `#07060C` | Hero, footer, CTA bands, auth panel |
| `--pv-night-2` / `-3` | `#100D1C` / `#1B162E` | Raised dark surfaces |
| `--pv-app-bg` | `#E9E4FA` | Dashboard canvas (lavender) |
| `--pv-app-panel` | `#F4F1FE` | Dashboard main panel |

### Status (reserved — never for decoration or chart series)
`--pv-success #047857` · `--pv-warning #A15C07` · `--pv-danger #C81E4B` · `--pv-info #1D56D0`.
Each passes WCAG AA as text on white and on its own 10% tint (badges). Always paired with
an icon or a word, never colour alone.

### Gradients
| Token | Tailwind | Use |
|---|---|---|
| `--pv-gradient-brand` | `bg-gradient-brand` | Brand buttons, avatars, progress |
| `--pv-gradient-pastel` | `bg-gradient-pastel` | Bento illustration panels |
| `--pv-gradient-wash` | `bg-gradient-wash` | Statement band, page intros, setup checklist |
| `--pv-gradient-stat` | `bg-gradient-stat` | Dashboard stat tiles |
| `--pv-gradient-neon` | (`.btn-magic`) | The magic button's rotating edge |

**Contrast (measured):** `ink` 19.4:1 on white / 18.1:1 on canvas; `muted` 5.3:1 / 4.9:1;
`brand-600` 6.4:1 on white; `subtle` 4.6:1 on white only. On night backgrounds use white at 60–90% opacity.

---

## 5. Typography

**Manrope** for everything (300–800), self-hosted by `next/font` — no external request.

| Token | Size | Use |
|---|---|---|
| `text-display` | clamp(40 → 72 px), 1.08, −0.035em | Home hero headline only |
| `text-h1` | clamp(32 → 52 px) | Page and section titles |
| `text-h2` | clamp(28 → 40 px) | Section titles, statement copy |
| `text-h3` | 20 px | Card titles |
| `text-lead` | 17 → 20 px, 1.6 | Intro paragraphs |
| body | 14–17 px | UI 14 px, reading 17 px (`.prose-pv`) |

Rules: headlines semibold (600) with tight tracking; the "statement" style pairs a
**Light (300)** phrase with one **ExtraBold (800)** word. Big dashboard numbers are
**Light** and tabular (`.num`). Eyebrows: 12 px, bold, uppercase, 0.16em tracking, violet.

---

## 6. Space, shape, depth, motion

| Token | Value | Use |
|---|---|---|
| `--pv-gutter` | 16–32 px fluid | Page side padding |
| `--pv-section` | 72–136 px fluid | Vertical rhythm between website sections |
| `--pv-container` | 1200 px | Content width (`.container`) |
| `--pv-container-narrow` | 760 px | Reading width (`max-w-narrow`) |
| `--pv-radius-sm` / `--pv-radius` / `-lg` / `-xl` / `-pill` | 10 / 16 / 24 / 32 px / pill | Inputs / small cards / cards / panels / buttons and chips |
| `--pv-shadow-sm` / `--pv-shadow` / `-lg` | soft, violet-tinted | Inputs / cards / popovers and featured cards |
| `--pv-glow` | violet halo | Brand buttons, focus of attention |
| `--pv-ease` / `--pv-duration` | `cubic-bezier(.16,1,.3,1)` / 220 ms | All transitions |

Motion is slow and ambient: the orbit turns once every 40 s, glass cards float 8 px,
the hero glow breathes. Only `transform` and `opacity` animate, and everything stops
under `prefers-reduced-motion`.

---

## 7. Components

Defined once in `apps/web/src/styles/globals.css` (`@layer components`) and
`apps/web/src/components/ui`.

**Buttons** — all pills (`.btn` + one look + optional size `.btn-sm` / `.btn-lg`):
| Class | Looks like | Use for |
|---|---|---|
| `.btn-primary` | Black pill, white text | The default action anywhere on light backgrounds |
| `.btn-magic` | Dark pill, rotating neon edge, glow | The single most important CTA on dark backgrounds (max one per view) |
| `.btn-brand` | Violet gradient with glow | Upgrades, "Activate", header CTA on dark |
| `.btn-secondary` | White, hairline border | Secondary actions |
| `.btn-glass` | Translucent on dark | Secondary action next to `.btn-magic` |
| `.btn-soft` / `.btn-ghost` / `.btn-danger` | Tinted / text-only / red | Tertiary, toolbars, destructive |

**Surfaces** — `.card` (white, 24 px radius, hairline border, soft shadow) · `.panel`
(lavender app panel) · `.glass` (translucent card on night) · `.stat-tile` (lilac gradient
tile with a light-weight number).

**Forms** — `.input`, `.select`, `.textarea` (44 px tall, 10 px radius, violet focus ring),
`.label`, `.help`, `.field-error`; always wrapped by `<Field>` so labels and errors are wired
to the control for screen readers.

**Badges and chips** — `.badge-*` for status (always readable as text); `.chip` for filters
and segmented controls (selected = black, like the reference's D/W/M/Y switch).

**Navigation** — dashboard/admin sidebar of pill links with a round icon; the active item
is black with white text.

**Decoration (CSS only, zero image requests)** — `.starfield`, `.light-beam`,
`.grid-pattern`, `.text-gradient`, the orb (`Hero.tsx`), the orbit (`Statement.tsx`).

---

## 8. Imagery and illustration

- Prefer **UI fragments over stock imagery**: product cards, chips, mini calendars and
  transcripts on pastel gridded panels (the bento style), or glass cards on night.
- Photography, if used, is natural and warm, of real people at work, never staged robots or
  headsets.
- Icons: **Lucide**, 1.5–2 px stroke, inside a round chip (`bg-brand-100 text-brand-700`, or
  black for emphasis).

### Image files
- Static images: `apps/web/public/images/<page>/` — one folder per page, WebP only, no
  duplicates (`npm run images` converts, `npm run images:check` enforces).
- Uploaded images: Admin → Media. Each upload becomes WebP at full resolution, is stored once
  (duplicates are detected by content and reused) and lives in the folder of the page or post
  that uses it (`pages/home`, `blog/<slug>`, `brand`). Always add alt text.

---

## 9. Data visualisation

- One series per chart, drawn in `--pv-violet-600`. Two measures → two charts, never two axes.
- Lines 2 px; area fill a ~10% wash; columns ≤ 24 px with 4 px rounded tops; hairline,
  horizontal-only grid in `--pv-line`; axis text `--pv-muted`.
- Every chart has a hover tooltip and a "Show data table" view; text never takes the series
  colour.
- Status colours are never used as series colours.
- A single headline number is a stat tile, not a chart. Empty data shows a message, not an
  empty axis.

---

## 10. Accessibility

WCAG 2.2 AA: text contrast ≥ 4.5:1; visible focus ring (`ring-brand-500`) on everything
interactive; real `<button>`/`<a>` elements; native `<dialog>` modals; `<details>`
accordions that work without JavaScript; labels on every input; a "Skip to content" link;
status never conveyed by colour alone; motion off under `prefers-reduced-motion`.
Lighthouse accessibility on the public site: 96–100.

---

## 11. Changing the brand

| To change… | Edit |
|---|---|
| Any colour, gradient, radius, shadow, spacing or type size | `apps/web/src/styles/tokens.css` |
| The font family | `apps/web/src/app/layout.tsx` (`next/font`) and `--pv-font-sans` |
| Button and card styles | `apps/web/src/styles/globals.css` → `@layer components` |
| The logo | `components/brand/Logo.tsx`, `app/icon.svg`, `public/images/brand/*` |
| Social card | `app/opengraph-image.tsx`, or set an image in Admin → SEO |
| Plan names, prices, bullets | Admin → Plans & pricing (no deploy) |
| The website's theme | Super admin → Website theme (no deploy) |

## 12. Website themes

The public website and sign-in pages can wear a different theme; the dashboard and
admin always use the Purple Voice look. A super admin picks the theme in **Super admin →
Website theme** (SiteSetting `appearance`), and it is live within seconds.

**Every theme shows the same content.** Copy, plans, FAQs and page structure come from
the same components; a theme changes only colours, type, shapes, imagery and decoration.

| Theme | Look | Files |
|---|---|---|
| Purple Voice (`default`) | Everything above | `tokens.css` |
| Kawaii (`kawaii`) | A looping video of a lone tree in a pastel sea (home hero, poster image under reduced motion), a hand-painted twilight valley (CTA band, sign-in), plum ink, candy-gradient pills, Plus Jakarta Sans, extra-round shapes, polka-dot bento art, drifting clouds, cloud-edged twilight footer, optional background music | `styles/themes/kawaii.css`, `public/images/themes/kawaii/`, `public/video/themes/kawaii/hero.mp4`, `public/audio/themes/kawaii.mp3` |

How a theme works: `(site)/layout.tsx` and `(auth)/layout.tsx` set `data-theme` on their
wrapper; the theme's stylesheet overrides tokens under `[data-theme='…']` (gradients,
shadows and the font must be redefined there too, because they are computed where they are
declared). Where a token can't express the look (the home hero, the CTA band, the sign-in
panel), the component renders a theme variant from the same copy constants.

To add a theme: add its id to `SITE_THEMES` and `SITE_THEME_INFO` in
`packages/shared/src/schemas.ts`, create `styles/themes/<id>.css` and import it in
`globals.css`, add a preview in `app/admin/appearance/page.tsx`, and add variants only where
needed. Music is optional (`lib/theme.ts`); the play button appears only when the file
exists and the super admin left music on, and it never autoplays.
