# Spec — Logo Concepts

> **Kind:** Greenfield
> **Portal:** Brand / Design Assets
> **Route:** N/A (static asset deliverable, no page route)
> **Conventions:** [scaleup-branding.md](../../../blueprint/scaleup/design/scaleup-branding.md) §"2. Logo Concepts" (this spec's source of truth), plus the shared Project Overview / Brand Identity / Color Palette / Typography / Icons / General Rules sections at the top of that document.
> **System Awareness:** No models, tables, or routes involved (pure design-asset deliverable). `public/favicon.ico` exists but is a 0‑byte empty placeholder — no ScaleUP‑branded logo or favicon exists anywhere in the repo today. `resources/views/web/src/components/` contains no shared components directory yet (only `resources/views/web/src/module/{organization,settings,auth,onboarding}/components/`). This is fully **Greenfield**.

---

## 1. Purpose

ScaleUP needs a small, cohesive family of logo assets — not a single file — that can represent the brand at every size and surface the product touches: a full lockup in the marketing navbar, an icon-only mark in a 16px browser tab, a monochrome mark on a dark app shell, and a raster icon on a phone home screen. Today there is **nothing**: no SVG source, no favicon, no app icon, no OG image. Every other spec that renders "the logo" (landing page navbar, global app-shell navbar/sidebar, auth screens, email headers, future PWA manifest) is currently blocked on this decision.

The business problem this solves: ScaleUP is positioned as a premium Business Operating System competing visually with Stripe, Linear, Notion, Vercel — its mark is often the *first* brand impression (browser tab, app icon, OG share card) and must read cleanly as a tiny mark long before a visitor ever sees the wordmark or reads the tagline. A logo that only works at hero-banner size is not shippable for this product; one that survives a 16×16 favicon is the actual bar.

This spec defines: which concept direction to design toward, what the deliverable file set is, where those files live in the repo, which lockup is used on which surface, and the non-negotiable usage rules (clear space, minimum size, don't-do list) so that `/webkit.frontend-implement` can wire real files into the navbar, favicon `<link>` tags, and manifest icons without re-deciding any of this.

---

## 2. Design Decisions (Pros & Cons)

### Decision: Logo Concept Direction

The branding doc lists six possible concept directions. Evaluated against: (1) fit to the five pillars — Manage / Measure / Plan / Connect / Scale, (2) legibility scaled down to a 16px favicon, (3) monochrome / dark-mode legibility (the app shell's `html { color-scheme: dark }` in `resources/css/app.css` means the mark lives on a dark background by default), (4) trademark/uniqueness risk, and (5) production/vector complexity.

**Option A — Arrow**
- A single upward or forward-diagonal arrow (optionally clipped inside a rounded square), reading as directional growth/momentum.

| Pros | Cons |
|---|---|
| Extremely simple silhouette; survives 16px favicon without issue | Arrow-as-logo is one of the most oversaturated marks in fintech/SaaS (growth apps, investment apps) — high genericness/trademark-collision risk |
| Cheap to produce as a single-path SVG | Only maps to "Scale"/"Measure" (momentum) — has nothing to say about Manage, Plan, or Connect |
| Reads instantly at a glance | Feels more "startup growth metric" than "operating system" — risks looking like a finance-tracking app, which the brand brief explicitly says ScaleUP is *not* |

**Option B — Growth (bar/ascent motif)**
- Ascending bars or a stepped staircase silhouette, sometimes fused with a circle (like a bar chart turning into a sun/arc).

| Pros | Cons |
|---|---|
| Directly literal about "growth," easy to explain to stakeholders | Very close to generic "analytics dashboard" iconography (bar chart) — clashes with the brief's explicit instruction to avoid looking like a bookkeeping/BI tool |
| Simple geometry, vector-cheap | Ascending bars need multiple discrete shapes; at 16px the gaps between bars merge into a blob — poor favicon legibility |
| — | Weak metaphor coverage for Manage/Plan/Connect pillars |

**Option C — Network**
- Dots/nodes joined by connecting lines forming an abstract cluster or constellation.

| Pros | Cons |
|---|---|
| Best metaphor fit for the "Connect" pillar; can also suggest "Manage" (a system of connected parts) | Line-based marks lose all connecting strokes at favicon size — the connections (the entire point of the metaphor) disappear first, leaving a scatter of dots |
| Modern, "platform/ecosystem" feel used well by Slack, Notion-adjacent brands | Higher vector complexity (multiple nodes + line-join rendering) and harder to keep pixel-crisp when rasterized small |
| — | Weakest metaphor fit for "Scale" specifically (no directional/growth cue) |

**Option D — Business Nodes**
- A hub-and-spoke or hexagonal node cluster, similar to Network but organized around one central node representing "the business."

| Pros | Cons |
|---|---|
| Strong metaphor for "Manage" (central hub coordinating parts) and "Connect" | Same small-size fragility as Network — thin spokes vanish before the nodes do, and at 16px it becomes indistinguishable from Network |
| Distinguishes ScaleUP from generic arrow/chart competitors | No inherent motion/growth cue, so "Scale" and "Measure" are not represented at all without added elements |
| — | Most complex option to keep genuinely minimal — easy to overload with more nodes than a favicon can resolve |

**Option E — Abstract "S"**
- A single abstracted letterform built from the initial of "ScaleUP," constructed from geometric arcs/bars rather than a literal typographic S.

| Pros | Cons |
|---|---|
| Directly ties the mark to the brand name — memorable and ownable, lowest risk of being confused with a competitor's mark | A bare abstract "S" alone doesn't automatically communicate any of the five pillars — it needs a supporting visual cue (see Recommendation) to avoid being "just a letter" |
| A single continuous or two-part geometric form scales flawlessly to 16px if kept to 1–2 shapes | Countless SaaS companies also use an "S" monogram — needs a genuinely distinct construction (not a generic swoosh) to avoid look-alike risk |
| Cheapest to produce and maintain as a single vector path; easiest to keep crisp in monochrome on both light and dark | — |

**Option F — Modern geometric mark**
- A non-representational abstract mark (rounded square/circle with a cut, overlapping shapes, an interlocking form) that reads as a "badge" rather than any literal object.

| Pros | Cons |
|---|---|
| Maximum flexibility and lowest trademark-collision risk since it isn't tied to a common metaphor (arrow, chart, network) that competitors also reach for | Purely abstract marks carry no built-in story — everything has to be explained rather than read, weakest direct fit to the five pillars of any option |
| Geometric primitives (circles, rounded squares, boolean cuts) are the easiest of all options to keep pixel-perfect at every size, including 16px | Risk of looking like a placeholder/generic "app icon" if the shape isn't distinctive enough |
| Fits the brand's "rounded corners, soft shadows, minimal gradients" visual language most directly of all six options | — |

**Recommendation:** **Option E (Abstract "S"), enhanced with a single embedded ascending cue from Option A** — a geometric "S" built from two stacked, slightly offset rounded bars/arcs where the top segment is subtly cantilevered upward-right, so the same silhouette reads simultaneously as "S" (brand initial → Manage/Plan, the system holding things together) and as upward motion (→ Scale/Measure) without needing a literal arrowhead or bar chart. This is the only option that (a) ties directly and ownably to the brand name, (b) reduces to one or two simple geometric shapes that survive a 16px favicon and monochrome dark-mode rendering, and (c) avoids the generic-arrow/bar-chart look the brand brief explicitly warns against. **Option F (Modern geometric mark)** is the recommended **fallback** if the "S" construction turns out to look too close to an existing competitor mark during trademark screening (see §6 Business Rules) — it carries the least metaphor but the least collision risk. Option C/D (Network/Business Nodes) are not recommended as the *primary* mark given their favicon-legibility failure, but remain candidates for a secondary "ecosystem" illustration motif (already separately in scope for the landing page's Business Ecosystem section, not this logo).

---

### Decision: Lockup Type per Surface

**Option A — Three lockups, each used contextually (Recommended)**
- Maintain three distinct, purpose-built artifacts derived from one master mark: (1) **primary lockup** = icon + wordmark side by side, (2) **icon-only mark**, (3) **wordmark-only** (no icon). Each is picked per surface based on available space and whether the icon alone is already recognizable there.

| Pros | Cons |
|---|---|
| Every surface gets an asset actually shaped for its space (a favicon never has to squeeze a wordmark into 16px; a navbar never wastes width on a mark that's already establishing brand elsewhere on the page) | Three artifacts (×4 color variants each, see below) to keep in sync when the brand evolves, versus one flexible file |
| Matches how every comparable brand (Stripe, Linear, Notion) actually ships their logo — this is the industry-standard pattern, not a novel decision | Slightly more to hand off to `/webkit.frontend-implement` (which file for which component) — mitigated by the explicit mapping table below |

**Option B — Single lockup file, scaled/cropped per context**
- Ship only the icon+wordmark lockup; consuming surfaces crop or scale it as needed (e.g. CSS `object-fit` tricks to show just the icon portion for a favicon).

| Pros | Cons |
|---|---|
| Only one artifact to design and maintain | Cropping a combined lockup to fake an icon-only mark almost never produces a well-centered, well-padded icon — favicons and app icons end up looking clipped |
| — | Breaks the moment any surface needs the wordmark without the icon (e.g. a footer credit line) or the icon without the wordmark (e.g. a loading spinner) |

**Recommendation:** **Option A.** The three-lockup pattern is cheap once the master mark is drawn (they're artboards of the same source file, not separate designs) and it is what every sibling spec (landing navbar, global app shell, favicon) will actually need to consume correctly.

**Surface → lockup mapping:**

| Surface | Lockup used | Why |
|---|---|---|
| Marketing navbar (landing page) | Primary lockup (icon + wordmark) | Full width available; establishes brand name for first-time visitors |
| App shell top nav / sidebar header (global layout, logged-in) | Icon-only mark (wordmark optional at wide breakpoints only) | Sidebar width is narrow on collapse; icon alone is enough once a user is already inside the product |
| Favicon (`favicon.svg`/`.ico`) | Icon-only mark | Wordmark is unreadable below ~32px; icon must carry 100% of the recognition |
| Mobile/desktop app icon (PWA manifest, `apple-touch-icon`) | Icon-only mark, on solid brand-primary background (`#2563EB`) | OS app-icon slots do not allow transparent or busy backgrounds; needs a self-contained badge |
| Loading / splash screen | Icon-only mark, animatable (subtle fade/scale only — no added motion elements) | Center-stage, no room for a wordmark at typical splash proportions without looking cramped |
| Email header | Primary lockup (icon + wordmark), light-background version | Email clients frequently block/strip background images and default to light chrome; must not depend on dark-mode CSS |
| Social / OG share image (1200×630) | Primary lockup, centered or corner-anchored, on brand gradient/solid background | OG cards are the one surface with abundant space — full lockup maximizes brand recall in link previews |
| Footer / legal / print | Wordmark-only (or primary lockup at small scale) | Footers are typically monochrome/low-emphasis; a bare wordmark keeps it unobtrusive |

---

### Decision: Master Asset Format & Derivation Pipeline

**Option A — SVG-first master, all other formats derived (Recommended)**
- Design and hand-off the master mark as vector SVG (per lockup, per color variant). Every raster format (`.ico`, `.png` app-icon sizes, OG `.png`/`.jpg`) is mechanically exported/derived from the SVG masters, not redrawn.

| Pros | Cons |
|---|---|
| SVG is infinitely scalable — the same source produces a crisp 16px favicon and a crisp 4K OG image with zero quality loss | Requires an export pass (a script or a one-time manual export set) to produce the raster sizes browsers/OSes still require (`.ico`, `apple-touch-icon.png`) |
| Matches the existing stack exactly — React 19 renders SVG natively as components, Lucide icons used elsewhere in the product are also SVG, Tailwind v4 styles SVG via `currentColor`/`fill` utilities directly | — |
| Trivially recolorable for the monochrome/dark variants (single `fill` swap) instead of maintaining fully separate raster files per color | — |

**Option B — Design directly in raster (PNG) at each required size**
- Design/export a fixed PNG at every size a surface needs (16, 32, 180, 192, 512px, etc.) with no vector source.

| Pros | Cons |
|---|---|
| No export tooling needed | Any future edit (palette tweak, spacing fix) means redoing every single size by hand |
| — | Cannot be styled by CSS/Tailwind at all — a separate raster file is needed for every color × size combination, quickly multiplying file count |
| — | Not how anything else in this SVG/Lucide-based stack is built — inconsistent with the codebase |

**Recommendation:** **Option A.** SVG-first is standard for this exact stack and the branding doc's own "Icons: Lucide Icons" convention already commits the project to SVG-based iconography — the logo should follow the same convention rather than introducing a second, raster-only asset pipeline.

---

### Decision: Where Master Assets Live in the Repo

**Option A — Versioned SVG masters in `resources/images/brand/`, standardized browser/OS contract files copied into `public/` (Recommended)**
- Keep the *source-of-truth* SVGs (all lockups × all color variants) under version control at `resources/images/brand/`, imported directly by React components (e.g. `<Logo variant="icon" />` importing an `.svg` via Vite's asset pipeline) and referenced by Blade where needed. Separately, publish the small fixed set of files browsers and OSes require at *fixed, unfingerprinted* root-relative URLs — `favicon.ico`, `favicon.svg`, `apple-touch-icon.png`, PWA manifest icon PNGs, `og-image.png` — into `public/`, generated/copied from the `resources/images/brand/` masters at build time (or committed directly, since they change rarely).

| Pros | Cons |
|---|---|
| Matches how the rest of the app already separates concerns: `resources/` = source assets processed by Vite, `public/` = files that must be served verbatim at a fixed URL (already true of `public/favicon.ico`, `public/robots.txt`) | Two locations to know about instead of one — mitigated by the explicit file table in §5, which states exactly what goes where |
| Browser/OS contracts (`<link rel="icon">`, `apple-touch-icon`, `manifest.json` icon paths) *require* stable root-relative URLs — they cannot resolve through Vite's fingerprinted `resources/` imports, so this split isn't optional, it's dictated by the platforms consuming these files | — |
| React components (navbar, sidebar, loading splash) get proper Vite-processed SVG imports with tree-shaking/inlining benefits instead of hard-coded `/public` paths | — |

**Option B — Everything in `public/`, nothing in `resources/`**
- Put every logo file, including the ones React components import, directly under `public/brand/` and reference by static URL from React.

| Pros | Cons |
|---|---|
| One location, no split to explain | React components lose Vite's asset pipeline (no import-time optimization, no bundling, no `?react` SVG-as-component transform) for what will be one of the most frequently rendered elements in the app (every navbar/sidebar render) |
| — | Inconsistent with how every other image/asset in a Vite+React Laravel app is organized — `public/` is conventionally for files that must be served at a literal, stable URL, not for componentized source assets |

**Recommendation:** **Option A.** The split is not arbitrary — it is forced by the fact that favicons and PWA manifest icons must live at fixed root URLs while everything else benefits from Vite's asset pipeline. §5 gives the exact file-by-file placement.

---

### Decision: Monochrome / Dark-Mode Variant Strategy

**Option A — Separate pre-baked color-variant SVG files (Recommended)**
- Ship four static SVG files per lockup: full-color-on-light, full-color-on-dark, monochrome-white, monochrome-black — each with its fills already set, no runtime color logic.

| Pros | Cons |
|---|---|
| Zero runtime risk — a logo rendered in an `<img>` tag, an email, a PDF export, or a static OG image always looks correct because the color is baked in, not dependent on CSS/JS executing | 4 files per lockup × 3 lockups = up to 12 SVGs to keep in sync if the mark changes (mitigated: they're just different `fill` values of one shared path — cheap to regenerate from a single source file with fills as the only difference) |
| Works everywhere, including contexts with no Tailwind/CSS at all (email clients, `og-image.png` generation, PDF exports) | — |

**Option B — Single SVG using `currentColor`, recolored live via CSS**
- One SVG per lockup with `fill="currentColor"`, recolored dynamically by the parent element's `color` (Tailwind text-color utility) depending on light/dark theme.

| Pros | Cons |
|---|---|
| Fewest files — one SVG per lockup handles every color context via CSS | Breaks the moment the SVG is used outside a CSS context — raw `<img src="logo.svg">`, email HTML, or a server-generated OG image has no `currentColor` to inherit and falls back to black, which is wrong on the dark app shell |
| Trivial to theme-toggle live in React (matches the Global Layout spec's planned "Theme Switch") | The primary lockup mixes a fixed-brand-color icon (should generally stay `#2563EB`/`#10B981`, not go monochrome) with a wordmark that does need to invert — `currentColor` alone can't express "icon stays brand blue, text inverts," so this option only cleanly covers the pure-monochrome variants, not the full-color ones |

**Recommendation:** **Option A** for anything that must render correctly outside a live CSS context (favicon, app icon, email, OG image, PDF) — which is most of this asset's usage. Where the icon-only mark appears purely inside the React app shell (e.g. sidebar header) and Option B's `currentColor` convenience is genuinely useful for live theme-toggling, `/webkit.frontend-implement` may *additionally* wire a `currentColor` monochrome variant for that one in-app case — but the four pre-baked files in Option A remain the required baseline deliverable regardless, since they are the only ones guaranteed to work everywhere else this mark ships.

---

## 3. Database

N/A — static design asset, no database or backend involvement.

## 4. Backend

N/A — static design asset, no database or backend involvement.

---

## 5. Frontend / Asset Delivery

### 5.1 Repo placement

```
resources/images/brand/               ← source-of-truth SVG masters (Vite-processed, imported by React)
  logo-full-color.svg                 primary lockup · icon + wordmark · full color · light bg
  logo-full-color-dark-bg.svg         primary lockup · icon + wordmark · full color · dark bg
  logo-mark-only.svg                  icon-only mark · full color
  logo-wordmark-only.svg              wordmark-only · full color
  logo-white.svg                      icon-only mark · monochrome white (for dark/photo backgrounds)
  logo-black.svg                      icon-only mark · monochrome black (for light backgrounds, print)
  logo-primary-lockup-white.svg       primary lockup · monochrome white
  logo-primary-lockup-black.svg       primary lockup · monochrome black
  og-image-source.svg                 1200×630 source used to render the static OG PNG below

public/                               ← fixed, unfingerprinted URLs required by browsers/OSes — generated/copied from the masters above
  favicon.ico                         16/32/48px multi-res ICO (legacy browser fallback) — replaces the current 0-byte placeholder
  favicon.svg                         modern vector favicon (Chrome/Firefox/Safari support SVG favicons directly)
  apple-touch-icon.png                180×180 PNG, icon-only mark on solid #2563EB background, no transparency
  icons/icon-192.png                  PWA manifest icon
  icons/icon-512.png                  PWA manifest icon (maskable-safe padding)
  og-image.png                        1200×630 static render for social/link previews
```

**Why this split:** `resources/images/brand/` is what React actually imports (`import logo from '@/images/brand/logo-mark-only.svg'` or an SVGR-style `?react` import so the mark can be inlined as a component and styled/sized via Tailwind). `public/` holds only the handful of files that browsers and OSes fetch by convention at a fixed path (`/favicon.ico`, `/apple-touch-icon.png`) — those cannot go through Vite's fingerprinted asset URLs, so they must be plain files in `public/`, generated once from the masters and re-generated only when the mark changes.

### 5.2 Color variants (tied to the palette)

| Variant | Icon fill | Wordmark fill | Used on |
|---|---|---|---|
| Full-color (light bg) | `#2563EB` primary, `#10B981` accent detail | `#0F172A` (Text) | White/`#FFFFFF` or `#F8FAFC` backgrounds — marketing site sections, email, print, OG image |
| Full-color (dark bg) | `#2563EB` primary, `#10B981` accent detail | `#FFFFFF` | The app shell's dark navbar/sidebar (default theme per `resources/css/app.css`'s `color-scheme: dark`) |
| Monochrome white | `#FFFFFF` (single fill, no accent) | `#FFFFFF` | Overlays on photography/gradients, dark hero sections, favicon dark-mode variant |
| Monochrome black | `#0F172A` or `#000000` (single fill, no accent) | `#0F172A` | Print, legal/footer credit lines, watermarks |

The icon's two-tone brand colors (`#2563EB` + `#10B981`) are reserved for the full-color variants only — monochrome variants must never introduce a third color or a gradient; they are single-fill by definition (see §6 don't-do list).

### 5.3 Usage-guideline table (clear space & minimum size)

| Rule | Specification |
|---|---|
| Minimum clear space | ≥ 1× the icon's height on all sides, measured from the outer edge of the mark — no other UI element, text, or edge of viewport may enter this zone |
| Minimum size — icon-only mark | 16px (favicon floor); below 16px the mark must not be used at all (e.g. a browser tab pinned/compact view falls back to a single-letter or blank state, not a further-shrunk logo) |
| Minimum size — primary lockup | 24px icon height (wordmark becomes illegible below this even if the icon itself would still hold up) |
| Minimum size — wordmark-only | 14px cap-height, matching Inter's practical legibility floor at the brand's tracking |
| Favicon-specific check | Icon-only mark must be legibility-tested as a physical 16×16 and 32×32 render before sign-off — not just visually shrunk in a design tool, since browser favicon rasterization can differ |

### 5.4 Don't-do list

- Do not stretch or skew the mark to fit a non-native aspect ratio (crop the canvas around it instead).
- Do not recolor the icon outside the four defined variants — no arbitrary hex, no gradient, no tint-on-hover unless a future Design System spec explicitly defines a motion/hover state for it.
- Do not place the full-color or monochrome-black variant on a low-contrast or busy background (photography, textured gradients) — use the monochrome-white variant there instead.
- Do not add drop shadows, glows, bevels, or gradients to the mark itself — the brand system's "soft shadows" language applies to UI surfaces (cards, buttons), not to the logo, which must stay flat per the "minimal gradients" rule in the branding doc's General Rules.
- Do not redraw or hand-trace the mark for a new size — always scale the vector master; if a size looks wrong, fix the master, not a one-off copy.
- Do not embed the wordmark as part of a rasterized icon-only mark (e.g. baking text into the favicon PNG) — the two are separate lockups by design (§2 Lockup Type decision).

---

## 6. Business Rules & Edge Cases

**Trademark/uniqueness screening (business rule, not a technical default — user's call):** Before finalizing the Abstract-"S" master (§2 recommendation), run a basic visual trademark screen (USPTO TESS / EUIPO search, plus a reverse-image style check against known SaaS logos) to confirm no confusing similarity, particularly against other "S"-monogram business/finance-adjacent brands. This is a go/no-go gate before commissioning final production art, not something this spec can resolve — flag it to the user/stakeholder explicitly.

**Dark-mode-first default:** Because `resources/css/app.css` sets `html { color-scheme: dark }`, the app shell renders dark by default today. The full-color-on-dark-bg variant is therefore the *primary* day-to-day variant for in-app surfaces (sidebar, top nav), not a secondary fallback — the light-background variant is primary only for out-of-app surfaces (marketing site light sections, email, print, OG image).

| Edge case | Handling |
|---|---|
| Browser tab too narrow to render even the favicon meaningfully (e.g. extreme OS-level zoom) | Out of this spec's control — rely on the 16px legibility floor already enforced in §5.3; no further fallback asset needed |
| Email client blocks remote images by default | Primary lockup `<img>` in email header must always carry descriptive `alt="ScaleUP"` text so the brand name still reads with images off |
| OG image requested at a non-standard aspect ratio by a specific platform (e.g. Slack unfurl vs. X/Twitter card) | Out of scope for this spec — a single 1200×630 `og-image.png` covers the dominant standard; per-platform variants are a future asset request, not part of this deliverable |
| Maskable PWA icon safe-zone (Android adaptive icons crop to a circle/squircle) | `icons/icon-512.png` must keep the icon-only mark within the inner ~80% safe zone so OS masking doesn't clip it — call this out explicitly to whoever exports the PWA icon set |
| Favicon requested by a browser that only supports `.ico`, not `.svg` | `favicon.ico` (multi-resolution 16/32/48) remains a required deliverable alongside `favicon.svg`, not optional — this is why both appear in §5.1 rather than shipping SVG-only |
| Print / grayscale reproduction | Monochrome-black variant is the deliverable for this; no separate "print-safe" asset is needed since it's already single-fill and vector |

---

## 7. Build Order

1. **Decide the concept direction** — confirm the Abstract-"S"-with-ascent recommendation (§2) with the stakeholder, or select the Modern-geometric-mark fallback; this is the one decision that gates everything downstream.
2. **Trademark/uniqueness screen** the chosen concept (§6) before investing in final production art.
3. **Draw the master mark** as a single vector artboard (icon only) at a scale that makes the clear-space and minimum-size rules (§5.3) easy to verify (e.g. a 512×512 or 24×24-grid-aligned artboard).
4. **Derive the three lockups** (primary, icon-only, wordmark-only) from the master, per §2's Lockup Type decision.
5. **Derive the four color variants** per lockup (full-color-light, full-color-dark, monochrome-white, monochrome-black) per §5.2 — single-fill swaps of the same paths, no redraws.
6. **Export the `resources/images/brand/` SVG set** exactly as named in §5.1.
7. **Generate the `public/` browser/OS contract files** (`favicon.ico`, `favicon.svg`, `apple-touch-icon.png`, `icons/icon-192.png`, `icons/icon-512.png`, `og-image.png`) from the masters, replacing the existing 0-byte `public/favicon.ico` placeholder.
8. **Legibility-test** the icon-only mark as physical 16×16 and 32×32 renders (§5.3) before sign-off.
9. Hand off to `/webkit.frontend-implement` to wire: `resources/views/app.blade.php` `<title>`/`<link rel="icon">` tags, a shared `<Logo />` React component (variant prop for primary/icon/wordmark, auto color-variant per theme), the PWA `manifest.json` icon entries, and the navbar/sidebar consumption points defined in the Global Layout and Landing Page specs (§8).
10. Feed the finalized hex/variant table (§5.2) into the Design System spec so the logo's color tokens are formalized alongside the rest of the palette rather than re-derived independently.

---

## 8. Out of Scope (Future Specs)

- **Landing Page navbar consumption** of the primary lockup — see [`.agents/specs/scaleup/landing/landing_page.md`](../landing/landing_page.md) (not yet written; this spec only defines which asset that navbar consumes, not the navbar itself).
- **Design System color-token formalization** — the hex-to-variant mapping in §5.2 is authoritative here but should be re-expressed as design tokens in [`.agents/specs/scaleup/design/design_system.md`](../design/design_system.md) (not yet written) alongside buttons/inputs/cards/etc.
- **Global Layout consumption** of the icon-only mark in the app-shell top nav/sidebar and the favicon wiring in the root Blade view — see [`.agents/specs/scaleup/global/global_layout.md`](../global/global_layout.md) (not yet written).
- **Full brand guideline document/PDF** (beyond this spec's lightweight usage table) — a comprehensive external-facing brand book is a separate deliverable if ScaleUP ever needs to hand the mark to a third-party partner or press.
- **Animated/motion logo identity** (e.g. an animated loading-splash variant beyond the simple fade/scale noted in §2's surface table) — not specified here; would be its own future spec once a motion-design system exists.
- **Print collateral / letterhead / business cards** — not specified here; the monochrome-black variant is sufficient raw material for a future print spec but the collateral layouts themselves are out of scope.
- **Per-platform OG/social image variants** (Slack unfurl, X/Twitter card, LinkedIn) beyond the single standard 1200×630 image — noted as an edge case in §6, deliberately deferred.
