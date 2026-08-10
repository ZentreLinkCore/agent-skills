# Spec — Design System (Shared UI Kit)

> **Kind:** Greenfield
> **Portal:** Design System / Shared UI Kit
> **Route:** N/A (shared component library, no page route)
> **Conventions:** [ui-design.md](../../../rules/ui-design.md), [scaleup-branding.md](../../../blueprint/scaleup/design/scaleup-branding.md) §3 "Design System" and its shared Project Overview / Brand Identity / Color Palette / Typography / Icons / General Rules sections.
> **System Awareness:** No models/tables/routes involved (pure frontend component library). `resources/views/web/src/components/` currently does not exist — the prior ad-hoc kit (`Button`/`Badge`/`Card`/`Icons`) was deleted as part of a reset. This spec replaces it from scratch as Greenfield. `resources/css/app.css` currently defines only a `--font-sans: 'Instrument Sans'` token and a hard-coded `color-scheme: dark` — both are superseded by this spec's tokens (Inter font, light-first with class-based dark mode). `package.json` has no UI/icon dependency yet (`lucide-react`, Radix, or similar) — this spec proposes adding `lucide-react` only.

---

## 1. Purpose

ScaleUP is a premium Business Operating System, not an ERP or bookkeeping tool — every screen (dashboard, auth, onboarding, global layout) must share one consistent visual language modeled on Stripe / Linear / Notion / Vercel / Apple / Slack: generous whitespace, large confident typography, soft shadows, rounded corners, minimal color, elegant micro-interactions.

This spec defines that shared foundation once: a token system (color, spacing, radius, elevation, typography, grid) plus a reusable component inventory (Buttons, Inputs, Cards, Tables, Badges, Dropdowns, Modals, Sidebar, Navigation, Tabs, Charts) implemented as React 19 components under `resources/views/web/src/components/ui/`. Every other ScaleUP surface (landing, auth, onboarding, dashboard, global layout) is a *consumer* of this kit — it composes these primitives rather than re-implementing button/card/table styling per page. Without this spec, each portal risks inventing its own ad-hoc Tailwind classes (the exact "Bootstrap-looking" / "generic admin template" outcome the brand explicitly forbids), and dark mode / responsive behavior would have to be retrofitted per component instead of designed in once.

---

## 2. Design Decisions (Pros & Cons)

### Decision: Component library approach — hand-rolled Tailwind vs. headless primitives underneath

**Option A — Hand-rolled Tailwind components in `src/components/ui/`**
- Every component (Button, Input, Modal, Dropdown, Tabs) is built directly with JSX + Tailwind utility classes and local React state (`useState`, `useRef`) for open/closed, focus, hover.

| Pros | Cons |
|---|---|
| Zero extra runtime dependency; smallest bundle | Must hand-build accessibility behavior (focus trap in Modal, roving tabindex in Tabs, outside-click + Escape in Dropdown) that headless libraries give for free |
| Full control over every class/animation, easiest to match the exact Stripe/Linear look | Higher risk of subtly inconsistent keyboard/ARIA behavior across components, discovered late (accessibility bugs) |
| Simple mental model for a small team, nothing to learn on top of React + Tailwind | Re-solves problems (positioning a dropdown panel, portal-rendering a modal, focus-trapping) that are already solved and tested upstream |

**Option B — Headless primitive library (Radix UI or Headless UI) underneath hand-styled wrappers (Recommended)**
- Interactive, stateful components (Dropdown, Modal/Dialog, Tabs, Switch, Select, Checkbox/Radio) wrap Radix UI primitives (`@radix-ui/react-dialog`, `@radix-ui/react-dropdown-menu`, `@radix-ui/react-tabs`, `@radix-ui/react-switch`, etc.); all visual styling stays 100% Tailwind on top — Radix ships unstyled by design. Purely presentational components (Card, Badge, Button, Table wrapper) stay hand-rolled since they have no interaction/accessibility surface to delegate.

| Pros | Cons |
|---|---|
| Focus trap, portal rendering, outside-click, Escape-to-close, roving `tabindex`, and full ARIA wiring (`role`, `aria-expanded`, `aria-controls`) come for free and are battle-tested | One more dependency in `package.json` (small: Radix ships as scoped per-primitive packages, tree-shakes cleanly) |
| Visual styling is still 100% Tailwind — Radix is headless, so the brand's exact look is untouched | Small learning curve for contributors unfamiliar with Radix's "Root/Trigger/Content/Portal" composition pattern |
| Matches how Linear/Vercel-tier products are actually built in the React ecosystem — reduces the gap between "looks premium" and "behaves premium" (keyboard users, screen readers) | — |

**Recommendation:** **Option B.** Reserve Radix for components with real interaction/accessibility complexity — Dropdown, Modal, Tabs, Switch, Select/Combobox — and keep Button, Card, Badge, Table, Sidebar, Navigation as plain hand-rolled Tailwind (they're presentational, Radix adds nothing there). This gives the enterprise-grade behavior the brand calls for ("Apple × Stripe × Linear × Notion") without sacrificing full styling control.

---

### Decision: Dark mode strategy — Tailwind `class` strategy with toggle vs. `prefers-color-scheme` media-only

**Option A — `prefers-color-scheme` media-only**
- Dark styles apply automatically from the OS setting via `@media (prefers-color-scheme: dark)`; no in-app toggle.

| Pros | Cons |
|---|---|
| Zero extra state/JS, works immediately | User cannot override the OS preference from inside ScaleUP — the branding's own Global Layout section explicitly lists a "Theme Switch" in the top navigation, which this option cannot satisfy |
| No FOUC-avoidance logic needed | Can't persist a user's explicit choice across sessions |

**Option B — Tailwind `class` strategy (`dark:` variants gated on a `.dark` class on `<html>`) with a theme toggle (Recommended)**
- `tailwind.config` (or Tailwind v4 `@theme`/`@custom-variant` in `app.css`) sets `dark` mode to the `class` strategy. A `ThemeProvider`/`useTheme` hook reads `localStorage` (falling back to `prefers-color-scheme` on first visit), toggles the `dark` class on `<html>`, and persists the user's explicit choice. The Global Layout spec's "Theme Switch" control calls this hook.

| Pros | Cons |
|---|---|
| Satisfies the branding doc's explicit "Dark Mode Ready" requirement *and* the Global Layout's "Theme Switch" control in one mechanism | Needs a small inline `<script>` in `app.blade.php` (before paint) to set the class from `localStorage` and avoid a flash of the wrong theme |
| User choice persists across visits; OS preference is still respected as the default | One extra tiny provider/hook (`ThemeProvider`) to build and thread through `main.jsx` |
| Every component's `dark:` classes are driven by one flag — trivial to audit/test both themes | — |

**Recommendation:** **Option B.** The branding doc lists "Theme Switch" as a first-class Global Layout control and "Dark Mode Ready" as a first-class design-system requirement — media-only cannot deliver a manual toggle. Every token/component in §5 below ships both a light and a `dark:` value under this strategy.

---

### Decision: Design token storage — CSS custom properties vs. Tailwind `theme.extend` vs. both

**Option A — CSS custom properties in `app.css` only**
- All colors/radii/spacing defined as `--color-*`, `--radius-*` variables in `:root` / `.dark`; components reference them via arbitrary values (`bg-[var(--color-primary)]`).

| Pros | Cons |
|---|---|
| Runtime-swappable (theme switch is just reassigning variables, no rebuild) | Verbose arbitrary-value syntax everywhere (`text-[var(--color-text-secondary)]`) instead of a clean utility name; loses Tailwind's IntelliSense/autocomplete for these values |

**Option B — Tailwind v4 `@theme` config only (`resources/css/app.css`)**
- Tokens declared as Tailwind v4 `@theme` variables (this project already does this for `--font-sans`), generating real utilities like `bg-primary`, `text-secondary`, `rounded-card`.

| Pros | Cons |
|---|---|
| Clean utility classes, full editor autocomplete, matches the one existing token (`--font-sans`) already in `app.css` | Dark-mode value swap needs Tailwind's `dark:` variant per usage rather than one variable reassignment; slightly more verbose at the call site (`bg-primary dark:bg-primary-dark` vs. just `bg-primary` everywhere) |

**Option C — Both: CSS custom properties as the source of truth, Tailwind v4 `@theme` reads them (Recommended)**
- Declare raw values once as CSS variables in `:root` (light) and `.dark` (dark overrides) in `app.css`, then point Tailwind v4's `@theme` block at those same variables (`--color-primary: var(--color-primary-value)`), so Tailwind still emits `bg-primary`/`text-primary` utilities but the underlying value flips automatically when `.dark` is toggled — no `dark:` prefix needed on every usage.

| Pros | Cons |
|---|---|
| Single flip of the `.dark` class repaints the whole app — no `dark:` prefix needed on most color utilities, keeping component markup clean | Slightly more setup up front (two layers to define) than picking just one |
| Still get Tailwind utility classes + autocomplete (extends the project's existing `@theme` pattern for `--font-sans`) | Radius/spacing/shadow tokens that don't change between themes don't need the CSS-var indirection — only color roles do |
| Non-color tokens (radius, spacing, shadow, breakpoints) stay simple `@theme` values with no variable indirection needed | — |

**Recommendation:** **Option C**, but scoped sensibly: color role tokens (`--color-primary`, `--color-bg`, `--color-text`, etc.) get the CSS-variable-that-Tailwind-reads treatment for automatic theme-flip; radius, spacing, shadow, and typography tokens are plain Tailwind v4 `@theme` values (they don't change between light/dark) — this directly extends the existing `@theme { --font-sans: ... }` block in `resources/css/app.css` rather than replacing it.

---

### Decision: Icon strategy — `lucide-react` package vs. hand-picked SVG sprite

**Option A — Hand-picked SVG sprite**
- Export the exact Lucide icons needed as a single `sprite.svg`, reference via `<use href="#icon-name">`.

| Pros | Cons |
|---|---|
| Smallest possible bundle (no JS wrapper per icon); no npm dependency | Manual sprite regeneration every time a new icon is needed — friction that compounds as the app grows across auth/onboarding/dashboard/global-layout |
| — | No per-icon prop API (size/color/strokeWidth) without extra wrapper code — loses React ergonomics |

**Option B — `lucide-react` package (Recommended)**
- `npm install lucide-react`; import icons as React components (`import { ArrowRight, Menu, Search } from 'lucide-react'`) and use directly, sized/colored via `className`/`size` props.

| Pros | Cons |
|---|---|
| Directly matches the branding doc's explicit mandate ("Icons: Lucide Icons") with zero translation risk | One added npm dependency (tree-shakeable — unused icons are not bundled, so cost scales with actual usage) |
| Tree-shakeable: only imported icons ship in the bundle | — |
| Consistent `size`/`strokeWidth`/`color` props across every icon, trivial to theme via `currentColor` + Tailwind `text-*` | — |
| Zero sprite-maintenance step when a new icon is needed | — |

**Recommendation:** **Option B.** The branding doc names Lucide Icons specifically; the npm package is the canonical, actively maintained way to consume that icon set in React and needs no build-step maintenance.

---

## 3. Database

N/A — the Design System is a pure frontend component library. It introduces no tables, models, or migrations.

## 4. Backend

N/A — no controllers, routes, or Query/Handler/Action classes. The design system ships zero server-side code; it is consumed entirely client-side by other specs' pages.

---

## 5. Frontend

### 5.1 Package additions

```json
// package.json — dependencies to add
"lucide-react": "^0.5xx.0",
"@radix-ui/react-dialog": "^1.x",
"@radix-ui/react-dropdown-menu": "^2.x",
"@radix-ui/react-tabs": "^1.x",
"@radix-ui/react-switch": "^1.x",
"@radix-ui/react-select": "^2.x",
"clsx": "^2.x"
```
`clsx` is a tiny (228 B) class-name-joining helper — used by every component below to compose variant/state classes cleanly (`clsx(base, variant === 'primary' && '...', className)`).

### 5.2 Module layout

```
resources/views/web/src/
├── theme/
│   ├── ThemeProvider.jsx        # dark/light context + localStorage persistence + <html> class toggle
│   └── useTheme.js               # `const { theme, setTheme, toggle } = useTheme()`
└── components/
    └── ui/
        ├── Button.jsx
        ├── IconButton.jsx
        ├── Input.jsx
        ├── Textarea.jsx
        ├── Select.jsx
        ├── Checkbox.jsx
        ├── Radio.jsx
        ├── Switch.jsx
        ├── Card.jsx
        ├── Table.jsx
        ├── Badge.jsx
        ├── Dropdown.jsx
        ├── Modal.jsx
        ├── Sidebar.jsx
        ├── TopNavigation.jsx
        ├── Tabs.jsx
        ├── Chart/
        │   ├── LineChart.jsx
        │   ├── BarChart.jsx
        │   ├── AreaChart.jsx
        │   └── chartTheme.js     # shared color palette + tooltip/legend styling for all chart types
        └── index.js               # re-exports every component for `import { Button, Card } from '@/components/ui'`
```

`main.jsx` wraps `<App />` in `<ThemeProvider>` so `useTheme()` is available anywhere:

```jsx
// resources/views/web/main.jsx
import { ThemeProvider } from './src/theme/ThemeProvider';
createRoot(el).render(
  <ThemeProvider>
    <App />
  </ThemeProvider>
);
```

`app.blade.php` gets a small inline pre-paint script (before `@vite`) to avoid a flash-of-wrong-theme:
```html
<script>
  (function () {
    const stored = localStorage.getItem('scaleup-theme');
    const dark = stored ? stored === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.classList.toggle('dark', dark);
  })();
</script>
```

### 5.3 Token system (`resources/css/app.css`)

Extends the existing `@import 'tailwindcss'` + `@theme` block — does not replace `--font-sans`, but changes its value from `Instrument Sans` to `Inter` per the branding doc, and adds the color-role/radius/shadow tokens below. Color roles are defined as raw CSS variables in `:root` and `.dark` (Decision "Design token storage", Option C), then re-pointed into Tailwind's `@theme` so `bg-primary`, `text-secondary`, etc. become real utilities that auto-flip with the `.dark` class.

```css
@import 'tailwindcss';

@source '../views/web/**/*.{js,jsx,ts,tsx}';
@source '../../vendor/laravel/framework/src/Illuminate/Pagination/resources/views/*.blade.php';
@source '../../storage/framework/views/*.php';

@custom-variant dark (&:where(.dark, .dark *));

:root {
  color-scheme: light;

  /* Color roles — light (source of truth, from scaleup-branding.md) */
  --color-primary: #2563EB;
  --color-primary-hover: #1D4ED8;
  --color-accent: #10B981;
  --color-accent-hover: #059669;
  --color-bg: #FFFFFF;
  --color-bg-secondary: #F8FAFC;
  --color-text: #0F172A;
  --color-text-secondary: #64748B;
  --color-border: #E2E8F0;
  --color-danger: #DC2626;
  --color-danger-bg: #FEF2F2;
  --color-warning: #D97706;
  --color-warning-bg: #FFFBEB;
  --color-success: #059669;
  --color-success-bg: #ECFDF5;
  --color-info: #2563EB;
  --color-info-bg: #EFF6FF;

  /* Elevation */
  --shadow-sm: 0 1px 2px 0 rgb(15 23 42 / 0.04);
  --shadow-md: 0 4px 12px -2px rgb(15 23 42 / 0.08), 0 2px 4px -2px rgb(15 23 42 / 0.04);
  --shadow-lg: 0 12px 24px -4px rgb(15 23 42 / 0.10), 0 4px 8px -4px rgb(15 23 42 / 0.06);
  --shadow-xl: 0 24px 48px -8px rgb(15 23 42 / 0.14);
}

.dark {
  color-scheme: dark;

  --color-primary: #3B82F6;
  --color-primary-hover: #60A5FA;
  --color-accent: #34D399;
  --color-accent-hover: #6EE7B7;
  --color-bg: #0B0F17;
  --color-bg-secondary: #111827;
  --color-text: #F1F5F9;
  --color-text-secondary: #94A3B8;
  --color-border: #1E293B;
  --color-danger: #F87171;
  --color-danger-bg: #1F1315;
  --color-warning: #FBBF24;
  --color-warning-bg: #1F1810;
  --color-success: #34D399;
  --color-success-bg: #0F1F17;
  --color-info: #60A5FA;
  --color-info-bg: #101B2E;

  --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.3);
  --shadow-md: 0 4px 12px -2px rgb(0 0 0 / 0.45), 0 2px 4px -2px rgb(0 0 0 / 0.3);
  --shadow-lg: 0 12px 24px -4px rgb(0 0 0 / 0.5), 0 4px 8px -4px rgb(0 0 0 / 0.35);
  --shadow-xl: 0 24px 48px -8px rgb(0 0 0 / 0.6);
}

@theme {
  --font-sans: 'Inter', ui-sans-serif, system-ui, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji',
      'Segoe UI Symbol', 'Noto Color Emoji';

  /* Color roles -> Tailwind utilities (bg-primary, text-text-secondary, border-border, ...) */
  --color-primary: var(--color-primary);
  --color-primary-hover: var(--color-primary-hover);
  --color-accent: var(--color-accent);
  --color-accent-hover: var(--color-accent-hover);
  --color-bg: var(--color-bg);
  --color-bg-secondary: var(--color-bg-secondary);
  --color-text: var(--color-text);
  --color-text-secondary: var(--color-text-secondary);
  --color-border: var(--color-border);
  --color-danger: var(--color-danger);
  --color-danger-bg: var(--color-danger-bg);
  --color-warning: var(--color-warning);
  --color-warning-bg: var(--color-warning-bg);
  --color-success: var(--color-success);
  --color-success-bg: var(--color-success-bg);
  --color-info: var(--color-info);
  --color-info-bg: var(--color-info-bg);

  /* Radius scale */
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 14px;
  --radius-xl: 20px;
  --radius-full: 9999px;

  /* Elevation -> Tailwind shadow-* utilities */
  --shadow-sm: var(--shadow-sm);
  --shadow-md: var(--shadow-md);
  --shadow-lg: var(--shadow-lg);
  --shadow-xl: var(--shadow-xl);

  /* Breakpoints (Tailwind defaults kept explicit for the Responsive rules below) */
  --breakpoint-sm: 640px;
  --breakpoint-md: 768px;
  --breakpoint-lg: 1024px;
  --breakpoint-xl: 1280px;
  --breakpoint-2xl: 1536px;
}

html { scroll-behavior: smooth; }

::-webkit-scrollbar { width: 8px; height: 8px; }
::-webkit-scrollbar-track { background: var(--color-bg-secondary); }
::-webkit-scrollbar-thumb { background: var(--color-border); border-radius: 4px; }
::-webkit-scrollbar-thumb:hover { background: var(--color-text-secondary); }
```

`vite.config.js`'s `bunny('Instrument Sans', ...)` font loader is swapped for `bunny('Inter', { weights: [400, 500, 600, 700, 800] })` — the 700/800 weights are needed for the large-headline hero/dashboard typography the branding calls for.

### 5.4 Full token reference tables

**Color roles**

| Role | Token | Light value | Dark value | Usage |
|---|---|---|---|---|
| Primary | `--color-primary` | `#2563EB` | `#3B82F6` | Primary buttons, links, active nav/tab indicator, focus rings |
| Primary hover | `--color-primary-hover` | `#1D4ED8` | `#60A5FA` | Hover/active state of primary elements |
| Accent | `--color-accent` | `#10B981` | `#34D399` | Success emphasis, growth/positive metrics, secondary CTA accents |
| Accent hover | `--color-accent-hover` | `#059669` | `#6EE7B7` | Hover state of accent elements |
| Background | `--color-bg` | `#FFFFFF` | `#0B0F17` | Page background, Card/Modal surface |
| Background secondary | `--color-bg-secondary` | `#F8FAFC` | `#111827` | App shell background (Sidebar/TopNav), table header row, input fill |
| Text | `--color-text` | `#0F172A` | `#F1F5F9` | Headings, primary body text |
| Text secondary | `--color-text-secondary` | `#64748B` | `#94A3B8` | Captions, helper text, placeholders, secondary labels |
| Border | `--color-border` | `#E2E8F0` | `#1E293B` | Card/Input/Table borders, dividers |
| Danger | `--color-danger` | `#DC2626` | `#F87171` | Destructive buttons, error text/borders |
| Danger bg | `--color-danger-bg` | `#FEF2F2` | `#1F1315` | Error badge/alert fill |
| Warning | `--color-warning` | `#D97706` | `#FBBF24` | Warning badge/alert text |
| Warning bg | `--color-warning-bg` | `#FFFBEB` | `#1F1810` | Warning badge/alert fill |
| Success | `--color-success` | `#059669` | `#34D399` | Success badge/alert text |
| Success bg | `--color-success-bg` | `#ECFDF5` | `#0F1F17` | Success badge/alert fill |
| Info | `--color-info` | `#2563EB` | `#60A5FA` | Info badge/alert text |
| Info bg | `--color-info-bg` | `#EFF6FF` | `#101B2E` | Info badge/alert fill |

**Spacing scale** (Tailwind default 4px-based scale, used consistently — no custom spacing tokens needed): `1` (4px) · `2` (8px) · `3` (12px) · `4` (16px) · `5` (20px) · `6` (24px) · `8` (32px) · `10` (40px) · `12` (48px) · `16` (64px) · `20` (80px) · `24` (96px). Component padding defaults: buttons `px-4 py-2` (md), cards `p-6`, modals `p-8`, page sections `py-16`–`py-24` (matches "prioritize whitespace, large headlines").

**Radius scale**

| Token | Value | Usage |
|---|---|---|
| `--radius-sm` | 6px | Badges, small inputs (checkbox/radio) |
| `--radius-md` | 10px | Buttons, Inputs, Dropdown/Select menus |
| `--radius-lg` | 14px | Cards, Modals, Table container |
| `--radius-xl` | 20px | Hero panels, large feature cards |
| `--radius-full` | 9999px | Pills/Badges (rounded variant), Avatar, Switch track |

**Elevation scale**

| Token | Usage |
|---|---|
| `shadow-sm` | Resting Card, Input focus ring companion |
| `shadow-md` | Dropdown panel, Popover, hovered Card |
| `shadow-lg` | Modal, Command Palette |
| `shadow-xl` | Hero illustration panel, floating KPI cards (per branding's "floating UI cards") |

**Typography scale** (Inter; weights 400 regular / 500 medium / 600 semibold / 700 bold / 800 extrabold)

| Level | Size / Line-height | Weight | Tailwind classes |
|---|---|---|---|
| H1 | 48px / 56px (mobile 36px/44px) | 800 | `text-5xl md:text-6xl font-extrabold tracking-tight` |
| H2 | 36px / 44px (mobile 28px/36px) | 700 | `text-3xl md:text-4xl font-bold tracking-tight` |
| H3 | 28px / 36px | 700 | `text-2xl md:text-3xl font-bold` |
| H4 | 22px / 30px | 600 | `text-xl md:text-2xl font-semibold` |
| H5 | 18px / 26px | 600 | `text-lg font-semibold` |
| H6 | 16px / 24px | 600 | `text-base font-semibold` |
| Body | 16px / 26px | 400 | `text-base leading-relaxed` |
| Body small | 14px / 22px | 400 | `text-sm` |
| Caption | 12px / 18px | 500 | `text-xs font-medium text-text-secondary` |

Minimal-text rule from the branding doc: body copy defaults to `text-text-secondary`, not full `text-text` — reserve full-contrast text for headings and primary actions, keeping pages feeling airy rather than dense.

**Grid / breakpoint system**

| Breakpoint | Min-width | Layout behavior |
|---|---|---|
| Mobile | `< 640px` | Single column, Sidebar becomes an off-canvas drawer (Radix Dialog), Table wraps in horizontal drag-scroll |
| `sm` | `≥ 640px` | 2-column card grids begin |
| `md` (Tablet) | `≥ 768px` | Sidebar collapses to icon-only rail (not hidden); 2–3 column grids |
| `lg` (Desktop) | `≥ 1024px` | Full Sidebar (expanded, labeled) + TopNav; 3–4 column dashboard grids |
| `xl` | `≥ 1280px` | Max content width `1280px–1440px`, centered, extra gutter |
| `2xl` | `≥ 1536px` | Content max-width caps at `1440px`; extra space becomes margin, not more columns (keeps the "premium whitespace" feel instead of stretching) |

Base grid: 12-column CSS grid (`grid grid-cols-12 gap-6`) for dashboard/page layouts; components pick spans (`col-span-4`, `col-span-8`, etc.).

### 5.5 Component inventory

Every component: (a) accepts `className` for call-site overrides via `clsx`, (b) is dark-mode ready using the color-role tokens above (no component hardcodes a hex value), (c) forwards a `ref` where the underlying DOM node is commonly needed (`Input`, `Button`).

| Component | File | Variants / Props | States | Notes |
|---|---|---|---|---|
| **Button** | `src/components/ui/Button.jsx` | `variant`: `primary` \| `secondary` \| `ghost` \| `destructive`; `size`: `sm` \| `md` \| `lg`; `iconLeft`/`iconRight` (Lucide icon component) | default, hover, focus-visible (ring `ring-2 ring-primary/40`), active (`scale-[0.98]`), disabled (`opacity-50 cursor-not-allowed`), loading (spinner + disabled) | Hand-rolled. `primary`=`bg-primary text-white hover:bg-primary-hover`; `secondary`=`bg-bg-secondary border border-border text-text`; `ghost`=`bg-transparent hover:bg-bg-secondary`; `destructive`=`bg-danger text-white hover:opacity-90` |
| **IconButton** | `src/components/ui/IconButton.jsx` | `variant` (same as Button, minus label), `size` | same as Button | Square, icon-only (nav bars, table row actions) |
| **Input** | `src/components/ui/Input.jsx` | `type`, `leftIcon`, `rightIcon`, `error` (string) | default, focus (`ring-2 ring-primary/30 border-primary`), error (`border-danger` + helper text in `text-danger`), disabled (`bg-bg-secondary opacity-60`) | Hand-rolled `<input>` wrapper |
| **Textarea** | `src/components/ui/Textarea.jsx` | `rows`, `error` | same as Input | Hand-rolled |
| **Select** | `src/components/ui/Select.jsx` | `options`, `placeholder`, `error` | default, focus, error, disabled, open | Wraps `@radix-ui/react-select` for listbox a11y/positioning; Tailwind-styled trigger + panel |
| **Checkbox** | `src/components/ui/Checkbox.jsx` | `checked`, `indeterminate` | default, checked, focus, disabled | Hand-rolled (native `<input type="checkbox">` + custom visual box) |
| **Radio** | `src/components/ui/Radio.jsx` | `checked`, `name` | default, checked, focus, disabled | Hand-rolled, grouped via shared `name` |
| **Switch** | `src/components/ui/Switch.jsx` | `checked`, `onCheckedChange` | default, checked, focus, disabled | Wraps `@radix-ui/react-switch` (keyboard toggle + ARIA `switch` role for free) — used by the Theme Switch |
| **Card** | `src/components/ui/Card.jsx` | `padding`: `sm` \| `md` \| `lg`; `interactive` (adds hover elevation) | resting (`shadow-sm border-border`), hover (`shadow-md` if `interactive`) | Hand-rolled: `bg-bg border border-border rounded-lg` |
| **Table** | `src/components/ui/Table.jsx` | `columns`, `rows`, `stickyHeader` | row hover (`hover:bg-bg-secondary`), sorted column indicator, empty state | Hand-rolled. Outer wrapper: `overflow-x-auto cursor-grab active:cursor-grabbing select-none` with mouse `mousedown`/`mousemove`/`mouseup` drag-to-scroll per [ui-design.md](../../../rules/ui-design.md) "Table Drag-to-Scroll" rule, ported to React (`onMouseDown` + `window` listeners via `useEffect`, not Vue's `@mousedown`) |
| **Badge** | `src/components/ui/Badge.jsx` | `variant`: `neutral` \| `success` \| `warning` \| `danger` \| `info`; `pill` (boolean, `radius-full` vs `radius-sm`) | static (no interactive states) | Hand-rolled: `bg-{variant}-bg text-{variant} text-xs font-medium px-2.5 py-0.5` |
| **Dropdown** | `src/components/ui/Dropdown.jsx` | `trigger`, `items` (label/icon/onSelect/destructive) | closed, open (`shadow-md`), item hover/focus, item disabled | Wraps `@radix-ui/react-dropdown-menu` for positioning, outside-click, Escape, roving focus |
| **Modal** | `src/components/ui/Modal.jsx` | `size`: `sm` \| `md` \| `lg` \| `full`; `title`, `footer` | closed, opening/closing (fade+scale transition), open | Wraps `@radix-ui/react-dialog`: focus trap, portal, scroll-lock, Escape-to-close for free; panel styled `bg-bg rounded-xl shadow-xl` |
| **Sidebar** | `src/components/ui/Sidebar.jsx` | `items` (label/icon/href/active), `collapsed` (boolean) | expanded (labeled), collapsed (icon rail, `md` breakpoint default), active item (`bg-primary/10 text-primary border-l-2 border-primary`), mobile (off-canvas via Modal/Dialog) | Hand-rolled; consumes brand mark from Logo Concepts spec (see Out of Scope) |
| **TopNavigation** | `src/components/ui/TopNavigation.jsx` | `slots`: search, notifications, org switcher, theme switch, profile menu | default, search-focused, notification-badge-present | Hand-rolled shell; profile/org menus reuse `Dropdown`; search can promote to a Command Palette (`cmd+k`) — palette itself is out of scope here, but TopNavigation exposes the trigger slot |
| **Tabs** | `src/components/ui/Tabs.jsx` | `items`, `variant`: `underline` \| `pill` | default, active (`text-primary border-primary` underline, or `bg-primary text-white` pill), hover, disabled | Wraps `@radix-ui/react-tabs` for roving `tabindex` + ARIA `tablist`/`tabpanel` wiring |
| **Chart** (Line/Bar/Area) | `src/components/ui/Chart/*.jsx` | `data`, `series`, `height` | default, hover tooltip, empty-state | Hand-rolled thin wrappers (no chart runtime dependency decided in this spec — implementer picks Recharts/visx at build time); `chartTheme.js` exports the shared categorical palette below so every chart across Dashboard/Analytics looks identical |

**Chart base palette** (`chartTheme.js`), derived from Primary/Accent so multi-series charts never introduce off-brand colors:

| Series order | Color | Source |
|---|---|---|
| 1 | `#2563EB` (Primary) | Primary brand blue |
| 2 | `#10B981` (Accent) | Accent green |
| 3 | `#7C3AED` | Violet — complements Primary without clashing |
| 4 | `#F59E0B` | Amber — for a 3rd/4th series or "attention" values |
| 5 | `#64748B` (Secondary Text) | Neutral/"other" bucket |
| Grid lines | `--color-border` | Matches token, auto-flips in dark mode |
| Tooltip bg | `--color-bg` + `shadow-lg` | Matches Card/Modal surface treatment |

### 5.6 Responsive rules summary

- **Mobile (`<640px`)**: Sidebar hidden by default, opened as an off-canvas Modal/Dialog; TopNavigation collapses secondary slots (org switcher, search) behind an overflow menu; Tables use drag-to-scroll; Cards stack single-column; Modals default to `size="full"` (near full-screen sheet).
- **Tablet (`640–1024px`)**: Sidebar shows as a collapsed icon-only rail (expandable on hover/tap); dashboard grids drop to 2 columns; Modals use `md` size, centered.
- **Desktop (`≥1024px`)**: Full expanded Sidebar + TopNavigation; dashboard grids run 3–4 columns on a 12-col grid; Dropdowns/Tooltips have room to prefer right-side placement.

### 5.7 Dark mode overrides

All color-role tokens in §5.3/§5.4 already define both light and `.dark` values — no component-level dark override tables are needed beyond that single source of truth. The only non-token dark-mode nuance: Chart series colors are brightened (`#3B82F6`, `#34D399`, `#8B5CF6`, `#FBBF24`) to keep sufficient contrast against the `#0B0F17` dark background — recorded in `chartTheme.js` as a `dark` palette variant selected via the current `useTheme()` value.

---

## 6. Business Rules & Edge Cases

This is a UI kit, not a business workflow — "business rules" here are the enforceable design contracts every consumer spec must respect.

| Rule | Detail |
|---|---|
| No hardcoded hex in consuming pages | Any page/component outside `src/components/ui/` must use the Tailwind utilities generated by the tokens (`bg-primary`, `text-danger`, etc.) — never an inline hex or arbitrary Tailwind color (`bg-blue-600`) — so a future palette change is a one-file edit |
| Accessibility floor | Every interactive primitive (Button, Input, Select, Switch, Dropdown, Modal, Tabs) must be operable via keyboard and expose correct ARIA roles/states; Radix-backed components get this by default, hand-rolled ones (Button, Checkbox, Radio) must ship visible `focus-visible` rings and correct `role`/`aria-*` attributes manually |
| Contrast | Text-on-color combinations must clear WCAG AA (4.5:1 body text, 3:1 large text) in both themes — verified per component when built, since some brand pairs (e.g. Accent `#10B981` text on white) are borderline and may need the "strong" variant pattern already used for the Employee portal accent in [ui-design.md](../../../rules/ui-design.md) |
| Theme flash prevention | The inline pre-paint script in `app.blade.php` (§5.2) must run before `@vite` assets, or a flash-of-wrong-theme will occur on first paint |
| Component isolation | `src/components/ui/*` must never import from a `module/<name>/` folder — dependency direction is one-way (modules depend on `ui/`, never the reverse) |
| Table drag-to-scroll | Any Table wider than its container must get the `overflow-x-auto` + drag-scroll treatment (§5.5) — this is a hard requirement carried over from [ui-design.md](../../../rules/ui-design.md), not optional polish |
| No stock imagery inside UI kit | Per branding "General Rules," no photography/stock assets belong in `components/ui/` — illustrations are page-level concerns (Landing/Dashboard specs), not shared components |

**Edge cases**

| Case | Handling |
|---|---|
| User has no `localStorage` access (privacy mode) | `useTheme()` falls back to `prefers-color-scheme` read on every load; toggle still works for the session, just doesn't persist |
| Table with zero rows | `Table` renders a centered empty-state slot (icon + caption text), not a blank white box |
| Modal opened while another Modal is open | Radix Dialog handles nested/stacked dialogs; this spec does not support intentionally stacking two `Modal`s — consuming specs should close one before opening another |
| Long dropdown/select item lists | `Select`/`Dropdown` content scrolls internally (`max-h-*` + `overflow-y-auto`) rather than growing off-screen; Radix Popper positioning flips side automatically near viewport edges |
| Extremely narrow viewport (< 375px) | Sidebar drawer and Modal `full` size both fall back to `100vw`/`100dvh`; Button/Input maintain a 44px minimum tap target regardless of `size` prop for touch accessibility |
| Reduced-motion preference | All transition/animation classes (`transition`, Modal fade/scale, Dropdown enter/exit) must be wrapped or paired with a `motion-reduce:transition-none` fallback |

---

## 7. Build Order

1. Add dependencies to `package.json`: `lucide-react`, `@radix-ui/react-dialog`, `@radix-ui/react-dropdown-menu`, `@radix-ui/react-tabs`, `@radix-ui/react-switch`, `@radix-ui/react-select`, `clsx`. Run install.
2. Update `resources/css/app.css`: add the `:root`/`.dark` color-role variables, extend the `@theme` block (font swap to Inter, radius/shadow/breakpoint tokens), add `@custom-variant dark`.
3. Update `vite.config.js`: swap the `bunny()` font loader from `Instrument Sans` to `Inter` with the needed weights.
4. Add the pre-paint inline theme script to `resources/views/app.blade.php` (before `@vite`).
5. Build `src/theme/ThemeProvider.jsx` + `useTheme.js`; wrap `<App />` with it in `main.jsx`.
6. **Gate 1 (static, hard-coded props)** — build each `src/components/ui/*` component in isolation with representative hard-coded props, verified visually in both themes: Button → IconButton → Badge → Card → Input/Textarea/Checkbox/Radio → Select/Switch (Radix-backed) → Table (incl. drag-to-scroll) → Dropdown → Tabs → Modal → Sidebar → TopNavigation → Chart wrappers + `chartTheme.js`.
7. Add `src/components/ui/index.js` barrel export.
8. **Gate 2** — no live data wiring applies to this spec (no backend); "Gate 2" for this kit is instead a cross-component QA pass: toggle dark mode across every component, resize through all breakpoints, keyboard-tab through every interactive component, and confirm no page-level file references a raw hex/arbitrary Tailwind color instead of a token utility.
9. Hand off the finished `ui/` kit to the sibling specs (Logo Concepts, Global Layout, Dashboard Concept, Authentication, Onboarding) for consumption.

---

## 8. Out of Scope (Future Specs)

- **`.agents/specs/scaleup/brand/logo_concepts.md`** — the brand mark itself (logo lockup, favicon, wordmark). This spec's `Sidebar`/`TopNavigation` components render a logo slot but do not design the mark.
- **`.agents/specs/scaleup/global/global_layout.md`** — the actual page shell assembly (Sidebar + TopNavigation + Workspace + Notification Center + Command Palette + Organization Switcher composed together), responsive shell behavior end-to-end. Consumes `Sidebar`, `TopNavigation`, `Dropdown`, `Modal` from this spec.
- **`.agents/specs/scaleup/dashboard/dashboard_concept.md`** — Business Health Score, Revenue Overview, Growth Progress, and other dashboard-specific widgets/layouts. Consumes `Card`, `Chart/*`, `Badge` from this spec.
- **`.agents/specs/scaleup/auth/authentication.md`** — Login/Register/Forgot-Password/Verify/Reset screens and their split-layout illustration. Consumes `Input`, `Button`, `Card` from this spec.
- **`.agents/specs/scaleup/onboarding/onboarding.md`** — the 7-step onboarding wizard. Consumes `Input`, `Button`, `Card`, and likely `Tabs`/step-indicator patterns from this spec.
- **Command Palette** implementation (cmd+k global search/actions) — this spec only reserves a trigger slot on `TopNavigation`; the palette itself belongs to the Global Layout spec.
- **Chart runtime library selection** (Recharts vs. visx vs. another) — this spec fixes the *palette and theming contract* (`chartTheme.js`) but leaves the underlying charting library choice to whichever implement pass builds `Chart/*.jsx`.
