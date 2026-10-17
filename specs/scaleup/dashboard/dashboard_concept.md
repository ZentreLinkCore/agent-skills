# Spec — Dashboard Concept (Home Page)

> **Kind:** Greenfield — no dashboard code, route, model, or table exists anywhere in the repo today.
> **Portal:** **Dashboard / Global** (`dashboard` frontend module; no `/api/dashboard/...` routes exist yet — Gate 1 ships mock-data-only, see Decision 2).
> **Route:** `/dashboard` (new Laravel + client-route entry — **recommended**, see Decision 1 for the `/app`-reuse alternative that was considered and rejected).
> **Conventions:** [project-gate.md](../../../rules/core/project-gate.md) (thin-controller + Query/Handler/Action pattern, no API Resources, no DB foreign keys), [ui-design.md](../../../rules/conditional/ui-design.md) (responsive grid, dark mode, micro-transitions), [system-awareness.md](../../../rules/conditional/system-awareness.md), [ScaleUP Branding §6 "Dashboard Concept"](../../../blueprint/scaleup/design/scaleup-branding.md).
> **System Awareness:** **Models** — none reused; `app/Models/` contains only `User.php` (no `Organization`, `Sales`, `Expense`, `Goal`, `Plan`, `Activity`, or `Opportunity` models exist). **Tables** — none reused; `database/migrations/` contains only the base Laravel tables (`users`, `cache`, `jobs`). **Routes** — none reused; `routes/web.php` only defines `/` (landing) and `/app` (SPA mount, currently `App.jsx` renders `null`); `routes/api.php` exists but is empty; no `/dashboard` route exists in either file. **Controllers** — none reused; `app/Http/Controllers/` contains only the base `Controller.php`. **New migration:** **No** for Gate 1 (mock-data-first — see Decision 2); the one documented exception (`business_goals`) is deliberately **not built** in this spec, for the reasons explained there.

---

## 1. Purpose

The Dashboard is the **home page of the ScaleUP Business Operating System** — the first screen a user lands on once they finish onboarding and open the app. Per the branding brief, it must read as a **Business OS command center**, not a bookkeeping/accounting dashboard: it gives an entrepreneur or business owner a single, premium view of *how the business is doing right now* and *what to do next*, spanning the five pillars — **Manage, Measure, Plan, Connect, Scale**.

Concretely it surfaces ten sections in one glassmorphic, KPI-driven layout:

1. **Business Health Score** — one composite "how are we doing" signal.
2. **Revenue Overview** — a professional revenue/expense chart, not a ledger.
3. **Business Goals** — progress toward the goals the business set for itself.
4. **Growth Progress** — trend indicators (customers, MRR, headcount, etc.).
5. **Upcoming Plans** — what's scheduled/planned next.
6. **Recent Activities** — a feed of what just happened in the business.
7. **Business Insights** — short, plain-language observations ("Revenue is up 12% this month").
8. **Analytics** — a compact KPI + chart summary (not the full Analytics/Reports module).
9. **Opportunities** — surfaced things worth acting on (leads, matches, suggestions).
10. **Quick Actions** — the fastest paths into the rest of the product.

**Scope boundary (important):** this spec covers **only the page content and widgets that render inside the dashboard's content area** — the top navigation, sidebar, notification center, organization switcher, theme switch, and search/command palette are the surrounding application shell, specified separately in [Global Layout](../global/global_layout.md). This page assumes it is mounted *inside* that shell and does not redesign it.

---

## 2. Design Decisions (Pros & Cons)

### Decision 1: Mount path — `/dashboard` vs. reusing `/app`

`routes/web.php` currently has `Route::get('/app', ...)->name('app')` rendering the same `view('app')` blade as `/`. There is no client-side router in the repo yet (`App.jsx` is a 4-line stub, `react-router` is not in `package.json`) — routing infrastructure itself belongs to the [Global Layout](../global/global_layout.md) spec. This decision is only about *what URL/path the dashboard should live at* once that router exists.

**Option A — Dedicated `/dashboard` path (Recommended)**
- Register a new Laravel route (`Route::get('/dashboard', fn () => view('app'))->name('dashboard')`, same blade, same SPA shell) and a matching client-side route `/dashboard` → `DashboardPage`. `/app` stays as a generic authenticated-SPA alias that redirects to `/dashboard` (or to `/onboarding` if setup isn't finished).

| Pros | Cons |
|---|---|
| Semantic, bookmarkable, shareable URL — matches the pattern implied by the other module folders already present (`module/onboarding`, `module/settings`, `module/organization` each imply their own named route) | One extra trivial Laravel route to add and keep in sync with the client router |
| Keeps `/app` free to mean "the authenticated app shell," which is useful later as a single redirect/entry point that decides *where* to send a user (dashboard vs. onboarding vs. suspended-account screen) | Slightly more to wire in Gate 1 than "just render at `/app`" |
| Matches conventional SaaS URL structure (Stripe/Linear/Notion all have a named `/dashboard` or equivalent) | |

**Option B — Reuse `/app` directly as the dashboard**
- No new Laravel route; the dashboard is simply whatever the client router renders at the `/app` root path.

| Pros | Cons |
|---|---|
| Zero new backend route needed today | `/app` is not a meaningful public URL for "the dashboard" — poor for bookmarking, analytics, and consistency with named sibling routes |
| Simplest possible Gate 1 | Overloads `/app` with two meanings ("the SPA entry point" and "the dashboard specifically"), which becomes awkward the moment a logic gate needs to redirect unfinished-onboarding users away from the dashboard |

**Recommendation:** **Option A.** Make `/dashboard` the canonical URL and the **default landing page immediately after login/onboarding completion** (i.e., the post-auth redirect target once a business setup exists — see the [Onboarding](../onboarding/onboarding.md) precondition). Keep `/app` as a thin alias/redirect, not a second identity for the same page.

---

### Decision 2: Data strategy for Gate 1 — mock-data-first vs. minimal real schema now

The System Awareness Scan found **no** `Organization`, `Sales`, `Expense`, `Goal`, `Plan`, `Activity`, or `Opportunity` model/table anywhere in the repo — only `users`. Critically, there is **no `Organization` model/table yet either**, which the onboarding flow ("Create Business") will presumably introduce. Any table this spec might propose (e.g. `business_goals`) would need an org-scoping column (`idorganization`, per the no-FK/indexed-column convention), but that parent table doesn't exist yet — so even the "one lightweight table" exception has an unresolved dependency today.

**Option A — Mock-data-first, no new tables (Recommended)**
- Every widget renders from realistic, hard-coded fixture data shaped like the eventual real API response (see §5 API contracts). No migrations, no models, no Query/Handler classes in this spec.

| Pros | Cons |
|---|---|
| Matches this project's established design-first, two-gate flow (Gate 1 = static/mock UI, Gate 2 = live wiring) | Business Health Score / Analytics / Opportunities widgets show plausible-looking but fake numbers until Gate 2 |
| Zero dependency on the not-yet-built `Organization` table — nothing to get wrong or later migrate away from | Mock payload shapes are a *proposal*, not a contract yet guaranteed by a real backend |
| Keeps this spec's blast radius to the frontend only, exactly as the `webkit.spec` skill requires (no app code/migrations written by this document) | |
| Every widget can be built and demoed today, independent of Sales/Finance/Goals modules landing later | |

**Option B — Ship a minimal real schema now (e.g. `business_goals` table)**
- Add one lightweight table for goals (since "Business Goals" and "Growth Progress" are core, named sections) while everything else stays mocked.

| Pros | Cons |
|---|---|
| Goals become real/persisted a little sooner | Needs `idorganization` today, but `organizations` doesn't exist — either blocked until the Onboarding/Organization spec lands, or forced into a wrong-shaped `idusers`-only table that would need a breaking migration later |
| Slightly less "throwaway" mock code for one widget | Breaks the "one cohesive Gate 1" story — one widget real, nine mocked, for no strong product reason yet |
| | Contradicts the reuse-over-duplicate-structure rule in [system-awareness.md](../../../rules/conditional/system-awareness.md) — a table should be created when the scan finds nothing to extend, but here the *right* parent (`organizations`) simply isn't built yet, which is a reason to wait, not to work around |

**Recommendation:** **Option A, fully mock, for the whole page.** Defer even `business_goals` to a dedicated future Goals spec that is written *after* an `Organization` model/table exists (from the Onboarding/Organization work). §3 documents the *proposed* `business_goals` shape as a head start for that future spec, clearly marked as not built here.

---

### Decision 3: Business Health Score computation approach

**This is genuinely a product decision, not a technical default — flagging for the user.** The branding brief only says "Business Health Score" must exist as a section; it does not define which metrics feed it or how they're weighted. This spec can only define the **UI contract** (§5); the **scoring formula** requires a product decision the user should make (ideally with input from whoever owns pricing/growth/finance logic) before Gate 2 backend work begins.

**Option A — Qualitative banded indicator (Recommended for now)**
- Show a labeled band (e.g. "Excellent / Good / Needs Attention / At Risk") with a short trend delta, computed later from a simple, transparent rule (e.g. "3 of 4 tracked signals trending up = Good"). For Gate 1, mock both a numeric score *and* its label together (e.g. "82/100 — Good"), since the branding language ("Score") implies a number, while keeping the actual banding rule undecided.

| Pros | Cons |
|---|---|
| Doesn't lock in a weighting formula the business hasn't defined yet | Less "precise-looking" than a single hard number |
| Easy to explain to a business owner ("you're doing well" vs. "62.4 out of 100") | Still needs *some* rule decided before Gate 2, just a simpler one |
| Cheap to compute once real data exists (thresholds, not weighted math) | |

**Option B — Single weighted composite score (0–100)**
- A formula like `score = w1·revenueGrowth + w2·goalCompletion + w3·cashFlowTrend + w4·engagement + ...`, displayed as a big number/gauge with a sub-metric breakdown.

| Pros | Cons |
|---|---|
| Feels premium and "SaaS-native" (Stripe/Linear-style single hero number) | Requires the business to define which sub-metrics count and their relative weights — undefined today, easy to get wrong, and hard to change later without the number appearing to "jump" for users |
| Easy to gamify a growth narrative ("your score went up") | Needs real historical data across several domains (revenue, goals, engagement) that don't exist yet even as tables |

**Recommendation:** Ship the **UI** for a numeric score + qualitative label + short trend delta + a small sub-metric breakdown list (works for either option visually) using **mocked, static values in Gate 1**. Treat the actual weighting formula as **the user's call**, to be decided before any Gate 2 backend Query is written for this widget — do not let an implementer invent weights.

---

### Decision 4: Chart/analytics library for Revenue Overview & Growth Progress

`package.json` currently has no chart library at all (only `react`, `react-dom`, and the Tailwind/Vite toolchain). The [Design System](../design/design_system.md) spec is expected to define a reusable `Charts` primitive that this page should consume rather than redefine.

**Option A — Recharts (Recommended)**
- Add `recharts` as a dependency; build the Design System's `Charts` primitive on top of it (`LineChart`/`AreaChart`/`BarChart` wrappers), themed to the brand palette (`#2563EB` primary, `#10B981` accent).

| Pros | Cons |
|---|---|
| Built on D3, responsive (`ResponsiveContainer`), handles resize/legend/tooltip out of the box | New dependency to add (currently zero chart libs in the project) |
| Fast to produce polished line/area/bar charts that read as "professional" per the brief | Exact glassmorphism/gradient-fill looks sometimes need CSS/SVG defs overrides against Recharts' defaults |
| Large community, good React 19 compatibility, easy to theme with brand colors and dark mode | Adds ~modest bundle weight (acceptable for a dashboard-weight page) |
| One shared implementation other future analytics pages can reuse via the Design System's `Charts` component | |

**Option B — Custom lightweight SVG charts**
- Hand-roll simple line/area/bar charts with inline SVG, no dependency.

| Pros | Cons |
|---|---|
| Zero dependency, smallest possible bundle | Meaningfully more upfront build time (resize handling, tooltips, accessibility, legends all manual) |
| Full pixel-level control over the exact premium look (bespoke gradients/glass strokes) | Every future chart (Analytics, Reports, Growth Progress) re-implements the same primitives instead of reusing one |

**Recommendation:** **Option A (Recharts)**, wired into the Design System's `Charts` component rather than imported ad-hoc inside dashboard widgets, so Analytics/Reports and future specs reuse the same themed primitive. Revisit Option B only for a specific bespoke visual Recharts genuinely can't achieve.

---

### Decision 5: Widget grid/composition strategy

The brief explicitly warns against a "generic admin template" look, which makes the grid strategy itself a design decision, not just implementation detail.

**Option A — Bento-style grid with mixed widget sizes (Recommended)**
- A 12-column CSS grid where widgets span different column counts by importance (Health Score + Revenue Overview as a wide hero row; Goals/Growth/Plans as three even cards; Analytics/Opportunities as a wide pair) — see the layout sketch in §5.

| Pros | Cons |
|---|---|
| Matches the Stripe/Linear/Notion "premium bento" feel the brief asks for; avoids the forbidden "generic admin dashboard" look | Slightly more responsive-breakpoint logic than a uniform grid |
| Visually prioritizes Health Score + Revenue as the hero, matching their importance | |

**Option B — Uniform fixed-column grid (every widget the same size)**
- Every card spans the same fixed column count (e.g. `col-span-4` for all ten widgets).

| Pros | Cons |
|---|---|
| Simplest responsive rules | Monotonous, reads exactly like the "generic admin template" the branding doc explicitly forbids |
| | Doesn't visually prioritize the Health Score/Revenue widgets that matter most |

**Recommendation:** **Option A.** See the layout sketch and breakpoint rules in §5.

---

## 3. Database

**No new tables in this spec** — per Decision 2, Gate 1 is mock-data-only.

For the future Goals spec (**not built here**, and blocked on an `Organization` table existing first), the proposed shape is documented below purely as a head start:

> [!NOTE]
> The table below is **NOT created by this spec**. It is a forward-looking sketch for whichever future spec adds real Goals tracking, once `organizations` (from the Onboarding/Organization work) exists. Do not implement this migration from this document alone.

**`business_goals`** (proposed, future spec)

| Column | Type | Notes |
|---|---|---|
| `id` | `bigIncrements` | PK |
| `idorganization` | `unsignedBigInteger`, `->index()` | No FK per project convention — points at the future `organizations.id`; blocked until that table exists |
| `title` | `string` | e.g. "Reach $100k MRR" |
| `target_metric` | `string` | e.g. `revenue`, `customers`, `mrr` — free-form key, not an enum, to stay flexible |
| `target_value` | `decimal(15,2)` | |
| `current_value` | `decimal(15,2)`, default `0` | |
| `unit` | `string` | `currency`, `count`, `percent` |
| `due_date` | `date`, nullable | |
| `status` | `string`, default `on_track` | `on_track` / `at_risk` / `achieved` / `missed` (status column, not `SoftDeletes`, per convention) |
| `timestamps()` | | |

---

## 4. Backend

**N/A for Gate 1** — mock data lives in the frontend module (see §5 `mocks/`). No controller, Query, Handler, or route is added by this spec.

Forward-looking sketch for **Gate 2** (this dashboard's live-wiring pass, once upstream domain specs — Finance/Sales, Goals, Opportunities — exist and have real tables):

- **Controller**: thin `App\Http\Controllers\dashboard\DashboardController` — one method per widget (or one aggregate method), each calling a Query class and returning `response()->json([...])`, per [project-gate.md](../../../rules/core/project-gate.md) (no API Resources).
- **Query classes** (reads only, no writes on this page): `App\Queries\Dashboard\GetBusinessHealthScoreQuery`, `GetRevenueOverviewQuery`, `GetBusinessGoalsQuery`, `GetGrowthProgressQuery`, `GetUpcomingPlansQuery`, `GetRecentActivitiesQuery`, `GetBusinessInsightsQuery`, `GetAnalyticsSummaryQuery`, `GetOpportunitiesQuery` — each `extends Query`, static `execute($params = [])`, and each pulls from whichever domain table its future spec introduces (Sales/Expenses for Revenue, `business_goals` for Goals, an Activity log for Recent Activities, etc.). `QuickActionsBar` needs no query — its actions are static routes, not data.
- **Routes**: register under a new `routes/api/dashboard.php`, loaded from the `auth:sanctum` group in `routes/api.php` the same way other portals will be, e.g. `Route::prefix('dashboard')->group(base_path('routes/api/dashboard.php'))`. Decide **aggregate vs. per-widget endpoints** at that time (a single `GET /api/dashboard/summary` reduces round-trips for a first paint; per-widget endpoints let slow widgets (e.g. Opportunities matching) load independently without blocking fast ones) — worth its own small decision in that future spec, not resolved here.
- None of this is implemented now; it exists only to give the eventual backend spec a starting point consistent with this page's mock contract in §5.

---

## 5. Frontend

### 5.1 Module layout

```
resources/views/web/src/module/dashboard/home/
├── index.jsx                          # barrel: re-exports DashboardPage + api hook
├── api/
│   └── home.api.js                    # useHomeApi() — http from @/app/axios/axiosInstance (Gate 2 target; Gate 1 calls mocks/ instead)
├── mocks/
│   └── dashboardMocks.js              # fixture data matching the payload shapes below — Gate 1 source of truth
├── pages/
│   └── DashboardPage.jsx              # bento grid shell, composes all widgets, renders inside the Global Layout shell
└── components/
    ├── QuickActionsBar.jsx
    ├── BusinessHealthScoreCard.jsx
    ├── RevenueOverviewChart.jsx
    ├── BusinessGoalsWidget.jsx
    ├── GrowthProgressWidget.jsx
    ├── UpcomingPlansWidget.jsx
    ├── RecentActivitiesFeed.jsx
    ├── BusinessInsightsPanel.jsx
    ├── AnalyticsWidget.jsx
    └── OpportunitiesWidget.jsx
```

- `index.jsx` re-exports `DashboardPage` (and, once it exists, `useHomeApi`) so the [Global Layout](../global/global_layout.md) router registration imports from the module root, not a deep path.
- Every widget component **reuses** the [Design System](../design/design_system.md)'s `Card`, `Badge`, and `Charts` primitives — none of them define their own card chrome, badge pill, or chart axis/tooltip styling from scratch. If the Design System spec doesn't exist yet when this page is implemented, that dependency should be built first (or a temporary local equivalent used and swapped later), not re-invented per-widget.
- `api/home.api.js` is written to the **target Gate 2 shape** now (`import http from '@/app/axios/axiosInstance'`) even though Gate 1 wires components to `mocks/dashboardMocks.js` directly — this keeps the swap in Gate 2 a one-line change per widget rather than a rewrite.

### 5.2 Page composition (bento grid)

```
┌─────────────────────────────── Quick Actions ───────────────────────────────┐
│  [+ Add Expense]  [+ Create Goal]  [+ Invite Teammate]  [→ View Reports]    │
└───────────────────────────────────────────────────────────────────────────────┘
┌───────────────────────┬───────────────────────────────────────────────────┐
│  Business Health       │  Revenue Overview                                │
│  Score  (4 cols)        │  (8 cols)                                        │
├───────────────┬─────────┴───────┬───────────────────────────────────────┤
│ Business Goals │ Growth Progress │ Upcoming Plans                        │
│ (4 cols)       │ (4 cols)        │ (4 cols)                              │
├───────────────────────┬───────────────────────────────────────────────────┤
│ Recent Activities      │ Business Insights                                │
│ (5 cols)               │ (7 cols)                                         │
├───────────────────────────────┬───────────────────────────────────────────┤
│ Analytics                     │ Opportunities                             │
│ (7 cols)                      │ (5 cols)                                  │
└───────────────────────────────┴───────────────────────────────────────────┘
```

- **Desktop (`lg:` and up)**: 12-column CSS grid exactly as sketched above.
- **Tablet (`md:`)**: collapses to a 2-column grid; each widget takes 1 or 2 columns depending on its desktop weight (hero widgets stay wide, the three even cards stack 2-then-1).
- **Mobile (base)**: single column, full-width stack in the same top-to-bottom order; `QuickActionsBar` switches from a wrapped row to a horizontally scrollable pill row (`overflow-x-auto`, drag-to-scroll per [ui-design.md](../../../rules/conditional/ui-design.md)) instead of wrapping to multiple lines.
- **Glassmorphism**: cards use a translucent, blurred surface over the app's background gradient — e.g. `bg-white/70 backdrop-blur-xl border border-white/40 dark:bg-slate-900/50 dark:border-white/10` — layered on top of the Design System's base `Card` (an extra "glass" visual treatment, not a competing card component). Verify text contrast (see §6 edge cases).

### 5.3 API contract (target shape for Gate 2; mocked verbatim in Gate 1)

| Widget | Endpoint (Gate 2 target) | Payload shape (illustrative) |
|---|---|---|
| Business Health Score | `GET /api/dashboard/health-score` | `{ score: 82, maxScore: 100, label: "Good", trend: "up", trendValueLabel: "+4.2 vs last month", subMetrics: [{ key: "revenue_growth", label: "Revenue Growth", value: 78 }, ...] }` |
| Revenue Overview | `GET /api/dashboard/revenue-overview` | `{ currency: "USD", currentPeriod: { label: "This Month", total: 48250, changePercent: 12.4, changeDirection: "up" }, series: [{ date: "2026-02", revenue: 32000, expenses: 21000 }, ...] }` |
| Business Goals | `GET /api/dashboard/goals` | `{ goals: [{ id: 1, title: "Reach $100k MRR", targetValue: 100000, currentValue: 48250, unit: "currency", dueDate: "2026-12-31", status: "on_track" }, ...] }` |
| Growth Progress | `GET /api/dashboard/growth-progress` | `{ overallProgressPercent: 62, metrics: [{ key: "customers", label: "Customers", current: 340, target: 500, unit: "count" }, ...] }` |
| Upcoming Plans | `GET /api/dashboard/upcoming-plans` | `{ plans: [{ id: 1, title: "Launch new pricing", dueDate: "2026-08-20", status: "upcoming", ownerName: "You" }, ...] }` |
| Recent Activities | `GET /api/dashboard/recent-activities` | `{ activities: [{ id: 1, type: "goal_updated", message: "Goal 'Reach $100k MRR' progress updated", actorName: "John Lloyd", timestamp: "2026-08-09T10:32:00Z" }, ...] }` |
| Business Insights | `GET /api/dashboard/insights` | `{ insights: [{ id: 1, type: "positive", title: "Revenue is up 12% this month", description: "...", icon: "trending-up" }, ...] }` |
| Analytics | `GET /api/dashboard/analytics-summary` | `{ kpis: [{ label: "Active Customers", value: 340, changePercent: 5.1 }, ...], chart: { type: "line", series: [...] } }` |
| Opportunities | `GET /api/dashboard/opportunities` | `{ opportunities: [{ id: 1, title: "3 leads ready to close", type: "sales", priority: "high", ctaLabel: "View Leads" }, ...] }` |
| Quick Actions | *(none — static)* | `{ actions: [{ id: "add-expense", label: "Add Expense", icon: "plus-circle", route: "/expenses/new" }, ...] }` |

Client-side route registration (`/dashboard` → `DashboardPage`) is owned by whatever router the [Global Layout](../global/global_layout.md) spec introduces — this spec assumes a route entry will be added there and does not define the router itself.

---

## 6. Business Rules & Edge Cases

| Edge Case | Handling |
|---|---|
| Brand-new organization, zero data everywhere (the realistic Gate 1→2 transition state) | Each widget renders its own friendly empty state (icon + one-line message + CTA) instead of a zero-value chart — e.g. Revenue Overview shows "No revenue recorded yet" + "Record your first sale," not a flat line at $0 |
| Data still loading (Gate 2) | Each widget shows a skeleton shaped like itself (card skeleton, chart skeleton) rather than a spinner overlay, so the bento grid doesn't reflow once real data arrives |
| One widget's API call fails (Gate 2) | Failure is isolated per widget ("Couldn't load this widget" + retry) — one failed request must never blank the whole dashboard |
| Business Health Score with insufficient history (Gate 2, once real computation lands) | Show "Not enough data yet" instead of a misleadingly precise number/band |
| Very large monetary values | Abbreviate with K/M suffixes in KPI tiles (e.g. `$1.2M`); show full precision on hover/tooltip |
| Long goal/plan/activity titles | Truncate with ellipsis + tooltip; never grow the card's height |
| Glassmorphism + dark mode | Verify text/icon contrast against the blurred translucent surface meets WCAG AA in both themes — don't rely on the glass blur alone for legibility |
| Mobile viewport | Grid reflows to a single column in the order shown in §5.2; `QuickActionsBar` becomes a horizontally scrollable row instead of wrapping |
| Widgets with more items than fit (Recent Activities, Opportunities) | Cap visible items (e.g. 5) with a "View all" link to a future dedicated page, rather than growing the card unbounded |
| Currency/locale formatting | All monetary values go through one shared currency formatter (mirroring the currency-helper pattern already used elsewhere in the codebase); currency defaults to `USD` in mock data until an org-level currency setting exists |
| Access before onboarding is complete | Precondition, not solved here: a user without a completed business setup should never reach `/dashboard` — that gate belongs to the [Onboarding](../onboarding/onboarding.md) spec's completion redirect, not to this page |

---

## 7. Build Order

1. **Decision checkpoint** — confirm Decision 1 (route) and Decision 2 (mock-only Gate 1) with the user before writing any code.
2. *(Skip for Gate 1 — only if the user later overrides Decision 2)* create the `business_goals` migration + model, but only once an `Organization` table exists.
3. **(Frontend Gate 1)** Scaffold `resources/views/web/src/module/dashboard/home/` with `index.jsx`, `pages/`, `components/`, `mocks/`, `api/`.
4. **(Frontend Gate 1)** Author `mocks/dashboardMocks.js` with fixture data matching the §5.3 payload shapes for all ten widgets.
5. **(Frontend Gate 1)** Build `DashboardPage.jsx`'s bento grid shell and `QuickActionsBar.jsx`; verify it renders correctly inside the Global Layout content slot (dependency on that spec's shell existing).
6. **(Frontend Gate 1)** Build the remaining nine widget components against mock data, reusing the Design System's `Card` / `Badge` / `Charts` (Recharts-backed, per Decision 4) primitives.
7. **(Frontend Gate 1)** Apply glassmorphism styling, dark-mode classes, and the responsive breakpoints from §5.2.
8. **(Frontend Gate 1)** Implement empty-state and skeleton-loading variants for every widget per §6.
9. **(Frontend Gate 2)** Wire `api/home.api.js` to real endpoints via `http`, swapping each widget from `mocks/` to the live call independently as its backing data becomes real.
10. **(Backend Gate 2 — future specs)** Implement the `App\Queries\Dashboard\*` classes, `DashboardController`, and `routes/api/dashboard.php` per widget as upstream domain specs (Finance/Sales, Goals, Opportunities) land, replacing mocks one widget at a time rather than all at once.
11. **QA pass** — verify responsive reflow, light/dark contrast on glass surfaces, and every widget's empty/loading/error state.

---

## 8. Out of Scope (Future Specs)

- **[Global Layout](../global/global_layout.md)** — the surrounding shell (top nav, sidebar, notification center, org switcher, theme switch, search/command palette) this page renders inside. Not redesigned here.
- **[Design System](../design/design_system.md)** — supplies the `Card`, `Badge`, and `Charts` primitives this page reuses rather than redefines.
- **[Onboarding](../onboarding/onboarding.md)** — a completed business setup is a precondition for ever reaching `/dashboard`; the post-onboarding redirect logic lives there, not here.
- **Deep Analytics/Reports module** — full drill-down analytics, exports, and custom report building are a separate future spec; this page's Analytics widget is a compact summary only.
- **Goals CRUD** — creating/editing/deleting goals, and the real `business_goals` table/lifecycle, are a dedicated future Goals spec (blocked on the `Organization` table existing — see Decision 2).
- **Opportunities/matching logic** — the algorithm behind what qualifies as an "opportunity" (lead scoring, marketplace matching, etc.) is a separate future spec; this page only renders whatever list it's given.
- **Real revenue/finance data ingestion** — Sales/Expenses tables and any accounting-adjacent integrations belong to a future Finance/Sales spec, not this dashboard spec.
- **Real-time/live updates** (websockets, polling cadence) — Gate 2 wiring here is plain request/response; push-based freshness is a future enhancement.
