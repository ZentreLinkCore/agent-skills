# Spec — Landing Page

> **Kind:** Greenfield — the previous landing-page implementation (frontend module, shared UI kit, `Inquiry` model/migration, `LandingController`, related routes) and the two previous specs were deleted as part of a full reset. This spec re-derives everything from the current, empty repo state and the branding doc — nothing is being extended.
> **Portal:** **Public / Landing** (no `/api/<prefix>` group — public marketing site; `landing` frontend module).
> **Route:** `GET /` (`landing`), `GET /app` (`app_entry`).
> **Conventions:** [project-profile.md](../../../rules/project-profile.md), [system-awareness.md](../../../rules/system-awareness.md), [duplicate-prevention.md](../../../rules/duplicate-prevention.md), [incremental-generation.md](../../../rules/incremental-generation.md), [security.md](../../../rules/security.md), [naming-convention.md](../../../rules/naming-convention.md).
> **System Awareness:** Models — none reused, none created by default (optional `Inquiry` model only if Decision 2 / Option B is chosen). Tables — none reused, none created by default (optional `inquiries` table only if Decision 2 / Option B is chosen). Routes — `GET /` and `GET /app` **reused** (already registered in `routes/web.php`, both render `view('app')`); `POST /api/inquiries` would be **created** only if Decision 2 / Option B is chosen. New migration — **No** by default (Yes, `create_inquiries_table`, only if Decision 2 / Option B is chosen).

---

## 1. Purpose

The Landing Page is ScaleUP's public marketing homepage — the first thing a prospective business owner sees before ever creating an account. It has to communicate, in one scroll, that ScaleUP is a premium **Business Operating System** (not a bookkeeping tool, not a generic admin template) built around five pillars — **Manage, Measure, Plan, Connect, Scale** — and to convert a visitor into either a signup (**Get Started**) or a more-informed reader (**Learn More**). It is a purely presentational, mostly-static page: today `routes/web.php` already serves it (`GET /` → `view('app')`) but `resources/views/web/App.jsx` currently renders `null`, so there is no landing experience live at all.

**Confirmed current repo state (System Awareness Scan, run fresh for this spec):**
- `app/Models/` — only `User.php` exists. No `Inquiry` or landing-related model.
- `database/migrations/` — only the three base Laravel migrations (`users`, `cache`, `jobs`). No landing-related table.
- `routes/web.php` — `GET /` and `GET /app` both already render `view('app')`; nothing to add here.
- `routes/api.php` — an empty orchestrator comment stub; no portal groups exist yet.
- `app/Http/Controllers/` — only the base `Controller.php`.
- `resources/views/web/App.jsx` — renders `null` (placeholder).
- `resources/views/web/src/module/` — has empty stub folders `auth/`, `onboarding/`, `organization/`, `settings/` (each with empty `types/ composables/ components/ api/ pages/` subfolders) and **no `landing/` folder**.
- `resources/views/web/src/components/` — does not exist yet (the shared `ui/` kit is owned by the separate Design System spec).
- `resources/views/web/app/axios/axiosInstance.js` — exists and exports a fetch-based `http` client with the Axios-compatible `{get, post}` shape described in the frontend conventions; import as `http from '@/app/axios/axiosInstance'` (alias `@` → `resources/views/web/`, confirmed in `vite.config.js`).
- `package.json` — only `react` + `react-dom` (^19) are installed; **no router package** (`react-router*`) is present yet.
- `resources/css/app.css` — still contains **dark-theme leftovers** from the previous (deleted) obsidian implementation: `color-scheme: dark` on `html`, and a dark scrollbar (`#0B0F17` track, `#1E293B`/`#334155` thumb). This predates the light-palette pivot documented in the branding doc and will need to be swapped when the Design System spec lands (not fixed here — this spec touches no code).

This is therefore a clean **Greenfield** build: a new `landing` frontend module, and — pending the decisions below — at most one small optional backend surface.

---

## 2. Design Decisions (Pros & Cons)

### Decision 1: Content Delivery Model

**Option A — Static, hard-coded frontend content (Recommended)**
- All marketing copy (headline, section copy, the 9 ecosystem modules, the 5 pillars, footer links) lives as plain JS data in the `landing` module itself (e.g. `content/landing.content.js`), imported directly by the section components. No database, no API call, no loading state on first paint.

| Pros | Cons |
|---|---|
| Zero backend to build; ships fastest | Copy changes require a frontend deploy, not a CMS edit |
| No loading/skeleton state needed — content paints immediately (good LCP/SEO) | No built-in i18n/localization hook without a later refactor |
| Matches how Stripe/Linear/Vercel/Notion actually ship their own static marketing pages | Non-engineers can't edit copy directly |
| Nothing to secure, validate, or cache-bust | — |

**Option B — Backend-driven content (CMS-style)**
- A `LandingContentController` + Query reads section content from new DB table(s) (e.g. `landing_features`, `landing_modules`) so marketing could edit copy without a deploy.

| Pros | Cons |
|---|---|
| Non-engineers could edit copy without a PR | No CMS admin UI exists or is requested anywhere in the branding doc — this would require specifying and building one too |
| Could support future A/B testing or locales | Adds a table, model, query, controller, route, loading/error states, and cache invalidation for a *seven-section brochure page* — pure over-engineering for the current scope |
| — | Contradicts the Greenfield state: nothing in the repo or branding doc calls for dynamic content |

**Recommendation:** Option A. The branding doc describes a fixed set of sections with fixed copy — there is no stated requirement for non-engineer content editing, A/B testing, or localization. Building a CMS layer for a one-time marketing page is unjustified complexity.

---

### Decision 2: Lead Capture / Contact Persistence

**Option A — No lead-capture backend; both CTAs are pure navigation (Recommended)**
- **Get Started** (primary) navigates to the future registration entry point (today, that's simply `/app` — the same shell route already registered; which exact path it resolves to once auth exists is the Authentication spec's concern, not this one).
- **Learn More** (secondary) smooth-scrolls to the `#features` section on the same page.
- The Footer contains only static link columns (Product / Company / Legal) and social icons — no email/contact form.

| Pros | Cons |
|---|---|
| Matches the branding doc literally — it specifies exactly two buttons ("Get Started" / "Learn More"), no "Request a Demo" or "Contact Sales" form anywhere in the Landing Page section | No way to capture a pre-signup lead (e.g. an enterprise inquiry) if marketing later wants one |
| Zero backend, zero PII to validate/secure/store | — |
| No spam/rate-limiting surface to defend ([security.md](../../../rules/security.md)) | — |

**Option B — Add an `inquiries`-style lead-capture table**
- A `POST /api/inquiries` endpoint (public, no `auth:sanctum`) backed by a new `Inquiry` model/migration, wired to a "Contact Sales" or "Request a Demo" form embedded in the CTA or Footer.

| Pros | Cons |
|---|---|
| Future-proofs for enterprise/demo-request lead capture | Nothing in the branding doc's Landing Page section calls for a contact/demo form — this is speculative scope creep |
| Gives marketing a persisted list of interested leads | Adds validation, spam/rate-limiting, and PII-handling concerns ([security.md](../../../rules/security.md)) for a feature that wasn't requested |
| — | A form with no visible field spec (name/email/message?) would have to be invented, not derived from the source doc |

**Recommendation:** Option A. The branding doc's Landing Page section only specifies **Get Started** and **Learn More** as navigational buttons — neither implies a form submission. Section 3 (Database) below still documents the Option B schema for completeness, clearly marked as *not part of this build* unless explicitly chosen. If a "Contact Sales" flow is wanted later, it should get its own follow-up spec once the actual form fields and destination are defined.

---

### Decision 3: Visual Theme — Light Premium vs. Dark Obsidian

**Option A — Light premium palette per the branding doc (Recommended)**
- Background `#FFFFFF`, Secondary background `#F8FAFC`, Text `#0F172A`, Secondary text `#64748B`, Border `#E2E8F0`, Primary `#2563EB`, Accent `#10B981`. Inter typeface (or the project's currently-configured "Instrument Sans" — see note below), Lucide icons. Generous whitespace, large headlines, soft shadows, rounded corners, minimal gradients — Stripe/Linear/Notion/Vercel/Apple-inspired.

| Pros | Cons |
|---|---|
| It is the literal, current source-of-truth palette in `scaleup-branding.md` — not a reinterpretation | Requires purging the dark-theme leftovers already sitting in `resources/css/app.css` (`color-scheme: dark`, dark scrollbar colors) inherited from the previous, deleted implementation |
| Keeps Landing visually consistent with the five sibling specs (Design System, Auth, Onboarding, Dashboard, Global Layout), which all key off this same palette | Less "dramatic" first impression than a dark hero |
| Matches what Stripe/Linear/Vercel/Notion actually ship today (light, airy, high-whitespace) | — |

**Option B — Dark "obsidian" theme (the previous, now-deleted spec's approach)**
- Near-black backgrounds with glowing accent gradients.

| Pros | Cons |
|---|---|
| `html { color-scheme: dark; }` and a dark scrollbar are already partially present in `app.css` today | Directly contradicts the branding doc's explicit Color Palette (`#FFFFFF` **background**; `#0F172A` is the *text* color, not a background) |
| Can feel more "tech/futuristic" at first glance | Would desynchronize Landing from every sibling spec (Design System, Auth, Onboarding, Dashboard, Global Layout) that will key off the same light palette |
| — | The branding doc's General Rules explicitly reject an "admin dashboard"/generic-dark feel for the product; the Landing Page is the first, most visible surface to get this right |

**Recommendation:** Option A. The branding doc is the explicit source of truth for this exercise and its Color Palette section defines a light theme with specific hex values — use it as documented, not the previous (now superseded) dark direction.

> **Typeface note:** the branding doc specifies **Inter**. The repo's current `vite.config.js`/`app.css` has `laravel-vite-plugin/fonts` wired to **"Instrument Sans"** (a leftover from the prior implementation), not Inter. Reconciling the two is a Design System spec concern (font tokens); this spec assumes Inter per the branding doc and flags the mismatch rather than silently picking one.

---

### Decision 4: Hero "Business OS" Illustration Technique

**Option A — Composable CSS/SVG floating-module illustration (Recommended)**
- Nine small rounded "module" cards — **Business, Finance, Analytics, Planning, Goals, Community, Growth, Reports, Organization** — each a Card with a Lucide icon + label, arranged around a central hub with absolute-positioned offsets, connected by thin animated SVG lines, and a slow CSS-keyframe float/parallax (disabled under `prefers-reduced-motion: reduce`). No people, no stock photos, per the branding doc.

| Pros | Cons |
|---|---|
| No image asset/licensing to manage; crisp at any resolution and any zoom | More CSS positioning/responsive work than dropping in one image |
| Recolors automatically with theme tokens (works with light palette, and any future dark mode) | Needs a deliberate mobile fallback (fewer/simplified cards on small screens) |
| Built entirely from the Design System's own Card/Icon primitives — no one-off art asset | — |
| Matches "no people, no stock photos… use abstract business illustrations… floating UI cards" from the branding doc's General Rules almost verbatim | — |

**Option B — Single exported illustration asset (SVG/PNG from a design tool)**
- One flat illustration file dropped into the Hero section.

| Pros | Cons |
|---|---|
| Faster to place — no positioning logic to write | Not responsive without multiple exported breakpoints |
| — | Hard to re-theme/recolor later (locked into whatever the export baked in) |
| — | Doesn't compose with the Design System's token/component approach; a one-off art asset contradicts "use modern SaaS components" in General Rules |

**Recommendation:** Option A — composable, responsive, on-brand, and reuses Design System building blocks instead of commissioning a one-off asset.

---

### Decision 5: Landing Page Navigation Model

**Option A — Single scrollable one-pager with anchor navigation (Recommended)**
- A sticky top `Navbar` (logo + anchor links to `#features`, `#journey`, `#why-scaleup`, `#ecosystem`, plus a **Get Started** button) scrolls to in-page section ids using the smooth scrolling already enabled globally (`html { scroll-behavior: smooth; }` in `resources/css/app.css`). **Learn More** also scrolls to `#features`.

| Pros | Cons |
|---|---|
| No router dependency needed — none is installed yet (`react-router*` is absent from `package.json`) | Single page can get long; there's no dedicated URL per section, only hash anchors |
| Matches how the branding doc frames it: **one** "Landing Page" with named sections, not a multi-page site | — |
| Fastest to build; matches the current Greenfield/empty-repo state | — |

**Option B — Multi-route marketing site** (`/features`, `/why-scaleup`, `/ecosystem` as separate pages)

| Pros | Cons |
|---|---|
| Smaller individual pages; dedicated SEO URL per topic | Requires introducing a client router today, purely for this page — a larger, unrelated dependency decision |
| — | Not how the branding doc frames the feature (it lists *sections* of **one** Landing Page) |
| — | Far more build surface for a first landing page than the brief calls for |

**Recommendation:** Option A — simplest, on-convention with the current dependency set, and matches the branding doc's framing exactly.

---

## 3. Database

**Under the recommended decisions (1A + 2A): no new table or migration.** The Landing Page ships as pure static frontend content, and `GET /` / `GET /app` are already registered in `routes/web.php`.

**Only if Decision 2 / Option B is later chosen**, the following table would be added (shown here for completeness, per [project-profile.md](../../../rules/project-profile.md) conventions — no DB-level foreign keys, `id`-prefixed + indexed relationship columns if any, a `status` column instead of `SoftDeletes`, always `timestamps()`):

```php
Schema::create('inquiries', function (Blueprint $table) {
    $table->id();
    $table->string('name');
    $table->string('email')->index();
    $table->string('company')->nullable();
    $table->text('message')->nullable();
    $table->string('source')->default('landing_cta'); // e.g. landing_cta, landing_footer
    $table->unsignedTinyInteger('status')->default(1); // 0 = archived, 1 = new, 2 = contacted
    $table->timestamps();
});
```

`Inquiry` model `$fillable`: `['name', 'email', 'company', 'message', 'source', 'status']`.

---

## 4. Backend

**Under the recommended decisions (1A + 2A): no new backend code.** `routes/web.php` already serves both routes:

```php
Route::get('/', function () {
    return view('app');
})->name('landing');

Route::get('/app', function () {
    return view('app');
})->name('app');
```

Nothing else needs to change here — this spec reuses these routes as-is; do not add a `LandingController` or any `routes/api.php` entries under Decision 1A/2A.

**Only if Decision 2 / Option B is later chosen**, add (following the thin-controller + Handler pattern, no API Resources, per [project-profile.md](../../../rules/project-profile.md)):

- `App\Handlers\Landing\StoreInquiryHandler` (`app/Handlers/Landing/StoreInquiryHandler.php`) — static `execute($params = [])`, wraps the `Inquiry::create(...)` in `DB::transaction(...)`.
- `App\Http\Controllers\LandingController` (`app/Http/Controllers/LandingController.php`, top-level — this is a public/global endpoint, not portal-scoped) with a thin `storeInquiry(Request $request)` method:
  ```php
  public function storeInquiry(Request $request)
  {
      try {
          $data = StoreInquiryHandler::execute($request->validate([
              'name' => 'required|string|max:255',
              'email' => 'required|email|max:255',
              'company' => 'nullable|string|max:255',
              'message' => 'nullable|string|max:2000',
              'source' => 'nullable|string|max:50',
          ]));
          return response()->json(['data' => $data]);
      } catch (Exception $e) {
          return response()->json(['message' => $e->getMessage()], 400);
      }
  }
  ```
- Registered directly in `routes/api.php` as a **public** route (no `auth:sanctum` — this is the "Global" portal row, no prefix, per [project-profile.md](../../../rules/project-profile.md)'s portal table):
  ```php
  Route::post('/inquiries', [LandingController::class, 'storeInquiry']);
  ```

---

## 5. Frontend

### 5.1 Module layout

New module at `resources/views/web/src/module/landing/`, following ScaleUP's established convention (flat `<domain>` folder, same shape as the existing `auth/`, `onboarding/`, `organization/`, `settings/` stubs):

```
resources/views/web/src/module/landing/
├── index.jsx                          # barrel export
├── content/
│   └── landing.content.js             # static copy: hero, modules, pillars, features, footer links
├── pages/
│   └── LandingPage.jsx                # composes all sections in order
├── components/
│   ├── Navbar.jsx                     # logo, anchor nav links, Get Started button, mobile hamburger
│   ├── HeroSection.jsx                # headline, description, Get Started / Learn More, illustration
│   ├── FloatingModulesIllustration.jsx# the 9-module floating/connected illustration (Decision 4)
│   ├── FeaturesSection.jsx            # #features — capability cards drawn from the 9 ecosystem modules
│   ├── BusinessJourneySection.jsx     # #journey — Manage → Measure → Plan → Connect → Scale, as steps
│   ├── WhyScaleUpSection.jsx          # #why-scaleup — differentiators vs. traditional ERP/bookkeeping
│   ├── BusinessEcosystemSection.jsx   # #ecosystem — grid of the 9 connected modules with descriptions
│   ├── CtaSection.jsx                 # closing call-to-action, repeats Get Started
│   └── FooterSection.jsx              # logo/tagline, Product/Company/Legal columns, social, copyright
└── api/                                # OMITTED under Decision 1A/2A.
                                        # Only add api/landing.api.js (use<Feature>Api() calling
                                        # http from '@/app/axios/axiosInstance') if Decision 2 / Option B
                                        # is chosen later, exposing a submitInquiry(payload) call to
                                        # POST /api/inquiries.
```

Shared cross-module UI primitives (`Button`, `Badge`, `Card`, `Icon`, etc.) are consumed from `resources/views/web/src/components/ui/` — owned by the separate Design System spec ([design_system.md](../design/design_system.md)) — this spec **depends on** that kit but does not redefine it. Every section component below is written in terms of those primitives (e.g. `<Button variant="primary">Get Started</Button>`, `<Card>` for module tiles).

### 5.2 Wiring `App.jsx`

`resources/views/web/App.jsx` currently renders `null`. Minimal change needed to mount the landing page at `/` without introducing a router (Decision 5 / Option A, no router dependency yet):

```jsx
import LandingPage from './src/module/landing/pages/LandingPage';

export default function App() {
    if (window.location.pathname === '/') {
        return <LandingPage />;
    }
    return null; // /app entry point — owned by the Global Layout / Authentication specs
}
```

Full SPA routing (for `/app/...` authenticated routes, login, onboarding, etc.) is explicitly **out of scope** here — see Section 8.

### 5.3 Section content mapping (per branding doc §1 "Landing Page")

| Section | Anchor | Content |
|---|---|---|
| **Navbar** | — | Logo, links to Features / Business Journey / Why ScaleUP / Ecosystem, **Get Started** button |
| **Hero** | `#hero` | Headline: *"The Business Operating System for Growing Companies."* Description: *"ScaleUP helps businesses manage operations, understand performance, plan strategically, connect with opportunities, and achieve sustainable growth."* Primary button **Get Started**, secondary button **Learn More**. `FloatingModulesIllustration` (9 modules, no people/photos). |
| **Features** | `#features` | Capability cards drawn from the 9 ecosystem modules (Business, Finance, Analytics, Planning, Goals, Community, Growth, Reports, Organization), each with a Lucide icon, name, one-line benefit. |
| **Business Journey** | `#journey` | The five pillars as a horizontal step sequence: **Manage → Measure → Plan → Connect → Scale**, each step a short label + one-line description of what a growing business does at that stage with ScaleUP. |
| **Why ScaleUP** | `#why-scaleup` | Differentiator bullets contrasting ScaleUP against traditional ERP/bookkeeping tools/generic dashboards (e.g. "Not another spreadsheet", "One system instead of five disconnected tools", "Built for growth, not just bookkeeping"). |
| **Business Ecosystem** | `#ecosystem` | Grid/diagram of the same 9 modules as the hero illustration, each expanded with icon + name + one-sentence description, reinforcing "everything connected." |
| **Call To Action** | `#cta` | Restated value proposition headline + **Get Started** button. |
| **Footer** | — | Logo + tagline, link columns (Product: Features/Ecosystem; Company: About/Contact; Legal: Privacy/Terms — placeholders, see Section 6), social icons (Lucide), copyright line. |

### 5.4 API contract

**None, under the recommended decisions.** The page renders entirely from `content/landing.content.js`; there is no `fetch`/`http` call on initial load.

**Only if Decision 2 / Option B is chosen:**

| Method | Endpoint | Payload | Response |
|---|---|---|---|
| `POST` | `/api/inquiries` | `{ name, email, company?, message?, source? }` | `{ data: { id, name, email, company, message, source, status, created_at, updated_at } }` on 200; `{ message }` on 400 |

Called via `api/landing.api.js`:
```js
import http from '@/app/axios/axiosInstance';

export function useLandingApi() {
    return {
        submitInquiry: async (payload) => {
            const response = await http.post('/api/inquiries', payload);
            return response.data;
        },
    };
}
```

---

## 6. Business Rules & Edge Cases

- **Motion sensitivity**: the floating-module illustration's animation (Decision 4) must be disabled/reduced under `@media (prefers-reduced-motion: reduce)` — it is decorative only, never load-bearing for comprehension.
- **Responsive collapse**: on small viewports, the Navbar collapses to a hamburger menu, and the illustration simplifies (fewer visible module cards or a static single-row layout) rather than shrinking 9 absolutely-positioned cards into an unreadable cluster.
- **Sticky-nav scroll offset**: anchor scrolling (`#features`, `#journey`, etc.) must account for the sticky Navbar's height so section headings aren't hidden underneath it on arrival.
- **No auth-awareness yet**: `App.jsx` cannot currently tell whether a visitor is already signed in (no Authentication backend exists). **Get Started** unconditionally points at `/app` for now; routing an already-authenticated visitor straight to their dashboard instead of the landing/registration flow is the Authentication/Global Layout specs' concern once session state exists.
- **Footer legal links are placeholders**: Privacy/Terms pages don't exist yet. Link them as inert `#` anchors (or omit the `href` and disable the link) rather than fabricating page content — building Privacy/Terms pages is not part of this spec.
- **SEO/meta tags**: `App.jsx` currently ships no `<title>`/meta description — the Blade shell (`resources/views/app.blade.php` or equivalent) should carry a static `<title>ScaleUP — The Business Operating System for Growing Companies</title>` and meta description; this is a one-line addition alongside the Build Order below, not a dynamic per-route SEO system.
- **`app.css` dark leftovers**: `color-scheme: dark` and the dark scrollbar colors currently in `resources/css/app.css` are remnants of the deleted prior implementation and visually fight the light palette this spec assumes. This spec does not modify that file (no code changes here) — flag it for whichever implementation task (ideally the Design System spec/build) touches global CSS tokens first.
- **No analytics/tracking wired**: click tracking on **Get Started**/**Learn More** (e.g. for conversion funnels) is not part of this spec — see Out of Scope.
- **No lead-capture validation surface** under the recommended Decision 2A — since there is no form, there's nothing to rate-limit or sanitize; if Decision 2B is chosen later, standard input validation + rate limiting on `POST /api/inquiries` per [security.md](../../../rules/security.md) applies.

| Edge case | Handling |
|---|---|
| Visitor lands directly on `/app` with no session | Out of scope here — App.jsx currently returns `null` for any path other than `/`; the `/app` shell is owned by Global Layout/Authentication specs |
| JS disabled / crawler hitting `/` | Blade shell still returns 200 with the static `<title>`/meta tags server-side; the React-rendered body won't paint, which is an accepted limitation of a client-rendered SPA landing page (not addressed by this spec — no SSR is in scope) |
| Very narrow viewport (e.g. 320px) | Hero headline/description and CTA buttons stack vertically; illustration shows a simplified/static variant per the responsive rule above |
| User double-clicks **Get Started** | Pure navigation (no request in flight under Decision 2A), so no double-submit concern exists for the default build |

---

## 7. Build Order

1. Add a static `<title>` + meta description to the Blade view that serves `view('app')` (one-line addition; no new route needed — `GET /` already exists).
2. Scaffold the frontend module: `resources/views/web/src/module/landing/` with `index.jsx`, `content/landing.content.js`, `pages/LandingPage.jsx`, and empty `components/*.jsx` files per Section 5.1.
3. Populate `content/landing.content.js` with the hero copy, the 9 ecosystem modules, the 5 pillars, feature/differentiator copy, and footer links — all verbatim from the branding doc where specified.
4. Build `Navbar.jsx` and `HeroSection.jsx` (headline, description, **Get Started**/**Learn More** buttons) using the Design System's `Button`/`Card` primitives — **Gate 1: static design**, hard-coded content, no live wiring.
5. Build `FloatingModulesIllustration.jsx` (Decision 4 / Option A: CSS/SVG composition of the 9 modules), including the `prefers-reduced-motion` guard and the mobile-simplified variant.
6. Build `FeaturesSection.jsx`, `BusinessJourneySection.jsx` (5-pillar step sequence), `WhyScaleUpSection.jsx`, `BusinessEcosystemSection.jsx`.
7. Build `CtaSection.jsx` and `FooterSection.jsx`.
8. Assemble `LandingPage.jsx` composing all sections in document order with matching anchor `id`s; wire the sticky-nav scroll-offset handling.
9. Wire `App.jsx` to render `<LandingPage />` when `window.location.pathname === '/'` (Section 5.2).
10. Wire **Get Started** → navigate to `/app`; **Learn More** and Navbar anchor links → smooth-scroll to their section ids — **Gate 2: live wiring** (navigation only; no backend calls under the recommended decisions).
11. Responsive/accessibility QA pass: mobile Navbar collapse, illustration breakpoint behavior, `prefers-reduced-motion`, keyboard focus order through the CTAs.
12. *(Only if Decision 2 / Option B is chosen)*: run the `create_inquiries_table` migration, add the `Inquiry` model, `StoreInquiryHandler`, `LandingController@storeInquiry`, register `POST /api/inquiries`, add `api/landing.api.js`, and wire a contact/demo form in the Footer or CTA to it.
13. Coordinate with the Design System spec's build to replace the dark-theme leftovers in `resources/css/app.css` with the light-palette tokens this page assumes.

---

## 8. Out of Scope (Future Specs)

- **Logo Concepts** — [.agents/specs/scaleup/brand/logo_concepts.md](../brand/logo_concepts.md) (the logo used in the Navbar/Footer here is a placeholder pending that spec).
- **Design System** — [.agents/specs/scaleup/design/design_system.md](../design/design_system.md) (owns the shared `ui/` kit — `Button`, `Card`, `Badge`, `Icon`, etc. — that this spec's components consume, plus the global color/spacing/typography tokens and the `app.css` dark-leftover cleanup).
- **Authentication** — [.agents/specs/scaleup/auth/authentication.md](../auth/authentication.md) (owns what **Get Started** actually resolves to: register/login screens, session state, and therefore auth-aware CTA behavior).
- **Onboarding** — [.agents/specs/scaleup/onboarding/onboarding.md](../onboarding/onboarding.md) (owns the post-registration flow a new **Get Started** signup lands in).
- **Dashboard Concept** — [.agents/specs/scaleup/dashboard/dashboard_concept.md](../dashboard/dashboard_concept.md) (owns what an authenticated user sees at `/app` instead of the landing page).
- **Global Layout** — [.agents/specs/scaleup/global/global_layout.md](../global/global_layout.md) (owns the authenticated app shell/navigation and, likely, the actual SPA router this spec deliberately avoids introducing).
- **Contact/Lead-capture backend** — the `inquiries` table, `LandingController@storeInquiry`, and `POST /api/inquiries` documented in Sections 3–4 are **not built** under this spec's recommended decisions; revisit only if a genuine "Contact Sales"/"Request a Demo" requirement emerges.
- **Analytics/conversion tracking** on CTA clicks.
- **Server-side rendering / SEO beyond static meta tags** (no SSR, no per-section structured data).
- **Privacy Policy / Terms of Service page content** (Footer links are inert placeholders only).
- **Localization / i18n**.
