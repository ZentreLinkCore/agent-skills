# Spec — Global Layout (Authenticated App Shell)

> **Kind:** Greenfield
> **Portal:** Global
> **Route:** N/A — cross-cutting shell mounted around all authenticated routes under `/app`.
> **Conventions:** [project-profile.md](../../../rules/project-profile.md), [ui-design.md](../../../rules/ui-design.md), [duplicate-prevention.md](../../../rules/duplicate-prevention.md) — these were authored against the SubHRMS Vue codebase; this spec applies their *architectural intent* (thin-controller + Query/Handler/Action, no API Resources, responsive/dark-mode discipline) translated to ScaleUP's actual stack: **React 19 + Tailwind CSS v4**, module folders using `.jsx`/`.js` instead of `.vue`/`.ts`.
> **System Awareness:** Models — **reused** `App\Models\User.php` only (already `use Notifiable`), none created. Tables — **reused** the framework's stock, not-yet-published `notifications` table (via `Notifiable`); no custom table created. Routes — **created** `routes/api/global.php` (new file, loaded from `routes/api.php`); the existing `routes/web.php` `/app` route needs **extending** to a catch-all so client-side deep links survive a full-page refresh (see §6). New migration: **yes** — the stock `php artisan notifications:table` publish only; no custom schema is authored by this spec.

---

## 1. Purpose

ScaleUP is a Business Operating System, not an accounting tool — every screen after login (Dashboard, Settings, and every future module) needs to live inside one consistent, premium application frame so the product reads as a single coherent OS rather than a stitched-together set of pages. This spec defines that frame: the **reusable authenticated shell/chrome** — Top Navigation, Left Sidebar, Workspace (content slot), Notification Center, User Profile, Organization Switcher, Theme Switch, Search, and Command Palette — fully responsive across Desktop, Tablet, and Mobile, per §7 "Global Layout" of the branding bible.

This is deliberately a **chrome-only** spec:
- It does **not** design what appears inside the Workspace — that's the Dashboard content, Settings content, and every future module, each a sibling spec.
- It does **not** touch the unauthenticated surfaces (public Landing Page, Auth screens) — those have no shell.
- Its only precondition is: **the user is authenticated and has an active organization.** How that state is established (login, Sanctum vs. session guard, organization membership resolution) belongs to the Auth and Onboarding specs; this shell only *consumes* the resolved current user + active organization.

Today `resources/views/web/App.jsx` renders `null` and `routes/web.php` exposes a single catch-all `/app` mount with no router — this spec is what turns that placeholder into the actual application frame every future page mounts inside.

---

## 2. Design Decisions (Pros & Cons)

### Decision: Client-Side Routing Approach

**Option A — React Router (Recommended)**
- Add `react-router-dom` to `package.json`. `App.jsx` wraps a `<BrowserRouter basename="/app">`; `AppShell` becomes a **layout route** (`<Route element={<AppShell/>}>`) rendering `TopNavbar` + `Sidebar` + `<Outlet/>` (the Workspace), with child routes (`index` → Dashboard, `settings/*`, future modules) nested underneath.

| Pros | Cons |
|---|---|
| Real, deep-linkable URLs (`/app/settings/billing`) with working browser back/forward and refresh | New dependency not yet in `package.json` |
| Native layout-route + `<Outlet/>` support — exactly the "shell wraps page content" shape this spec needs | Version choice matters (v6 stable API vs. v7's data-router paradigm, which this shell doesn't need) |
| Built-in nested routing scales cleanly to Settings sub-tabs, Onboarding steps, future modules | Small learning curve for anyone unfamiliar with the library |
| Route-based code-splitting (`lazy()` + `Suspense`) fits Gate 1 → Gate 2 build flow (static shell first, wire pages later) | ~20kb gzip added to the bundle |

**Option B — Minimal custom state-based router**
- A single top-level `activeView` state (or manual `history.pushState` calls) switched in `App.jsx` with no library.

| Pros | Cons |
|---|---|
| Zero new dependency | No real URLs unless hand-rolled — reinvents what React Router already solved (back/forward, refresh-to-same-page, bookmarking) |
| Trivial for exactly one or two views | Doesn't scale: Settings sub-tabs, Onboarding steps, and every future module each need their own addressable path, and nested layouts (a Settings page with its own sub-nav) aren't naturally supported |
| Full control | Every new page requires hand-wiring — this is the shell every future spec composes inside, so the cost compounds |

**Recommendation:** **Option A.** This decision directly determines how Dashboard, Settings, and every future page get addressed inside the `/app` mount — React Router's layout-route pattern is the exact mechanism this shell needs, and the "reinvent routing" cost of Option B only grows as more sibling specs land.

---

### Decision: Shell State Management

**Option A — React Context + hooks (Recommended)**
- A handful of small providers composed inside `AppShell` (`ShellUIContext` for sidebar/palette-open state, `ThemeContext`), each exposing a `use<X>()` hook. `Organization`/current-user state is likely provided further up (by Onboarding/Auth) and simply consumed here.

| Pros | Cons |
|---|---|
| Zero new dependency — built into React 19, matches the project's current footprint (no state library in `package.json`) | Multiple providers can nest ("provider pyramid") if not composed carefully |
| Enough for shell-scoped state, which is a handful of booleans/strings, not deep app-wide data | Context re-renders all consumers on change unless values are split/memoized |
| Simple to test/mock in isolation | No built-in devtools/time-travel |

**Option B — External state library (Zustand/Redux Toolkit)**

| Pros | Cons |
|---|---|
| Fine-grained subscriptions avoid re-render fan-out | New dependency, not present today |
| Devtools, easier to share state beyond the shell later | Overkill for the shell's actual state surface (sidebar open/collapsed, palette open, theme) |

**Recommendation:** **Option A** now. Revisit a state library only if a *later* spec (e.g. Dashboard) needs state shared across many independent modules beyond what Context comfortably handles — don't pre-empt that here.

---

### Decision: Sidebar Behavior & Responsive Strategy

**Option A — Persistent collapsible rail (desktop) → overlay/drawer (tablet & mobile) (Recommended)**
- **Desktop (≥1024px):** sidebar always visible, toggles between full (≈240px, icon+label) and icon-only rail (≈68px); state persisted in `localStorage`; pushes Workspace content margin.
- **Tablet (768–1023px):** sidebar defaults to the icon-only rail; tapping expands it as a temporary overlay (doesn't push content) that closes on outside click or navigation.
- **Mobile (<768px):** sidebar fully hidden by default; a hamburger in `TopNavbar` opens it as a full-height slide-in drawer with backdrop; closes on navigation or backdrop tap.
- The Organization Switcher is pinned at the top of the sidebar (above nav links): full name + chevron when expanded, org-avatar-only when the rail is collapsed, part of the drawer header on mobile.

| Pros | Cons |
|---|---|
| Matches the Linear/Notion/Vercel-caliber reference products named in the brand doc | More states to build than a single toggle (expanded / rail / overlay-open / drawer-open) |
| Desktop users (the primary Business-OS work surface) get zero-click navigation | Overlay/drawer variants need careful focus-trap + backdrop-click handling |
| One responsive `Sidebar.jsx` with breakpoint-driven props avoids duplicating markup | Org switcher trigger needs 3 distinct visual states across breakpoints |

**Option B — Fully collapsible overlay at every breakpoint**
- Sidebar is always an overlay (hamburger-triggered), defaulting closed, on desktop too.

| Pros | Cons |
|---|---|
| One interaction model everywhere — simplest to build | Desktop loses always-visible primary navigation — a regression against the exact reference products the brand doc names |
| Maximizes Workspace width by default | Extra click for every navigation action on the device with the most screen space to spare; reads as a mobile-style menu, not a "full app shell" — works against the "premium enterprise" feel |

**Recommendation:** **Option A.** It's what the branding doc's own reference products (Stripe, Linear, Notion, Vercel) do, and it gives desktop users frictionless navigation while still collapsing gracefully where space is scarce.

---

### Decision: Search Bar ↔ Command Palette Relationship

**Option A — Unified entry point (Recommended)**
- `SearchBar` in `TopNavbar` is a static trigger (placeholder text + a `⌘K` hint badge) that opens the same `CommandPalette` overlay; all typing happens inside the palette's own input.

| Pros | Cons |
|---|---|
| One query/result implementation instead of two | Clicking the navbar search always opens a modal rather than filtering inline |
| Matches the Linear/Vercel/Notion/Raycast pattern the brand doc's inspirations use | |
| Single keyboard-shortcut surface to build and maintain | |

**Option B — Two separate mechanisms**
- `SearchBar` does its own live/type-ahead search inline; `CommandPalette` is a distinct, commands-only overlay with no overlap.

| Pros | Cons |
|---|---|
| Inline search feels faster for pure lookup (no modal hop) | Two result-ranking implementations to build and keep consistent |
| Clear separation of "search data" vs. "run a command" | No searchable entities are even defined yet (Dashboard/Settings content specs haven't shipped) — building a second search path now has no immediate payoff |

**Recommendation:** **Option A.** There's no dedicated search backend yet, so one Cmd+K palette that doubles as search (pages, settings, future entities) and commands (toggle theme, switch org, etc.) is the leaner build and the one consistent with the named reference products.

---

### Decision: Command Palette Implementation

**Option A — Adopt `cmdk` (Recommended)**
- A small (~5kb gzip), unstyled, headless command-menu primitive; styled entirely with Tailwind + this project's Design System tokens.

| Pros | Cons |
|---|---|
| Accessible keyboard nav (arrow keys, wrap-around, type-ahead, groups, Escape) out of the box | New dependency, not yet in `package.json` |
| Unstyled/headless — doesn't fight the Design System, only supplies the list/keyboard engine | Ties the palette's DOM structure to `cmdk`'s API |
| Used by exactly the class of product (Linear/Vercel/Raycast-style) the brand doc wants ScaleUP to feel like | |
| Saves reimplementing non-trivial a11y logic | |

**Option B — Build a custom command palette**
- Hand-rolled `Dialog` + input + filtered list + keyboard handlers.

| Pros | Cons |
|---|---|
| Zero new dependency | Reimplements solved, easy-to-get-subtly-wrong a11y/keyboard-nav logic (wrap-around, groups, focus return) |
| Full control | More code to build and maintain for a problem `cmdk` already solves well |

**Recommendation:** **Option A.** `cmdk` is a thin primitive, not a heavy UI kit — the palette's *visual* shell (the Modal wrapper, item styling, colors) still comes from the Design System; `cmdk` only supplies the list/keyboard-nav engine, so "reuse Design System primitives rather than redefining them" still holds.

---

### Decision: Notification Center — Data Storage

**Option A — Reuse Laravel's built-in database notifications (Recommended)**
- `App\Models\User` **already** has `use HasFactory, Notifiable;`. Publish the stock, framework-provided `notifications` migration (`php artisan notifications:table`) — a polymorphic table (`notifiable_type`/`notifiable_id`, `type`, `data` JSON, `read_at`) Laravel maintains, not a bespoke schema this spec designs.

| Pros | Cons |
|---|---|
| Zero custom schema to design — avoids inventing a parallel table (exactly what [duplicate-prevention.md](../../../rules/duplicate-prevention.md) warns against, and the `Notifiable` trait is already sitting on `User` unused) | `data` is a schemaless JSON blob — every future producer (Dashboard, Onboarding, Settings) must agree on a shape by convention, not DB constraints |
| Framework-idiomatic: any future domain can `->notify(...)` without this shell needing to know about it | One migration still needs to be run before real data exists |
| Read/unread + polymorphic source already solved (`unreadNotifications()`, `markAsRead()`) | |

**Option B — Custom `notifications` table with explicit typed columns**
- Hand-designed columns: `title`, `body`, `icon`, `action_url`, `org_id`, `user_id`, `read_at`.

| Pros | Cons |
|---|---|
| Typed, filterable columns (e.g. `WHERE org_id = ?`) | Duplicates functionality the framework already provides via the trait already present on `User` — a clear duplicate-prevention violation |
| No JSON parsing | Every future feature must remember to write to this bespoke table instead of the standard `Notification::send()` API |

**Recommendation:** **Option A.** `User` already carries `Notifiable`; standing up a parallel bespoke table would be exactly the duplication the project's own rules flag.

---

### Decision: Notification Center — Delivery Transport

**Option A — Polling (Recommended)**
- Frontend polls `GET /api/global/notifications` on an interval (e.g. 30–60s) plus on window focus.

| Pros | Cons |
|---|---|
| Zero new infrastructure — no broadcasting driver, queue, or websocket server is configured anywhere in this repo today (no Reverb/Pusher/Echo config, no `laravel/sanctum` even installed yet) | Not instant; staleness bounded by the poll interval |
| Trivial to implement and test | Some wasted requests when nothing changed |
| Acceptable for a first version of a Business-OS notification feed (not a chat product) | |

**Option B — Real-time (Laravel Echo + Reverb/Pusher)**

| Pros | Cons |
|---|---|
| Instant delivery, feels premium | Requires standing up broadcasting infra (driver, server/service, Echo client, channel auth) — none of which exists in this codebase; disproportionate lift for a shell spec |

**Recommendation:** **Option A** now. Write the `useNotifications` hook so the transport is swappable later — `NotificationCenter.jsx` should only ever call `useNotifications()`, never know whether the data underneath is polled or pushed, so a future real-time upgrade only touches the hook's internals.

---

### Decision: Theme Switch Persistence

**Option A — `localStorage` (client-only) (Recommended for this spec)**

| Pros | Cons |
|---|---|
| Works immediately with zero backend dependency | Doesn't follow the user across devices/browsers |
| A tiny inline `<head>` script can read it and set the theme class before React mounts, avoiding a flash of the wrong theme | Lost if storage is cleared |
| No coupling to a table that doesn't exist yet in this repo | |

**Option B — DB-persisted via `user_preferences.theme`**

| Pros | Cons |
|---|---|
| Cross-device consistency | **No `user_preferences` table exists anywhere in this repo yet** — System Awareness confirms `app/Models/` has only `User.php` and migrations only cover `users`/`cache`/`jobs`. That table is owned by the Onboarding/Settings specs; defining it here would pre-empt/duplicate it |
| Single source of truth alongside other future preferences | Adds an API round trip that risks a theme-flash unless carefully sequenced before first paint |

**Recommendation:** **Option A** now, with an explicit upgrade path: once the Onboarding/Settings spec defines `user_preferences.theme`, extend `useTheme` to write-through to that column on change and read it on login to seed `localStorage` — **do not define that table in this spec.** Shape `useTheme` as `{ theme, setTheme }` now so the storage backend is swappable later without touching any consuming component. Note also: `resources/css/app.css` already sets `color-scheme: dark` as the document default — so when no `localStorage` value exists yet, the resolved initial theme should be **dark**, not `prefers-color-scheme`; only fall back to the system preference if a future decision explicitly chooses to honor it (see Business Rules).

---

### Decision: Frontend Module Location for the Shell

**Option A — `resources/views/web/src/layouts/AppShell/` (new top-level `layouts/` folder) (Recommended)**

| Pros | Cons |
|---|---|
| Matches the common React convention of separating cross-cutting layout/chrome from domain feature modules | Introduces a new top-level convention not yet documented in the repo — this spec establishes it |
| The shell isn't a "feature" with its own backend domain/API the way `organization/` or `settings/` are — forcing it into `module/<domain>/<feature>/` (which expects `api/`, `pages/`, etc.) is a shape mismatch | |
| Keeps `module/` reserved for things that map to an actual backend domain | |

**Option B — `resources/views/web/src/module/global/layout/` (fits the existing `module/<domain>/<feature>/` pattern)**

| Pros | Cons |
|---|---|
| Zero new top-level convention — stays consistent with `organization/`, `settings/`, `auth/`, `onboarding/` | The shell doesn't fit the `index.jsx` + `api/` + `pages/` shape — it has no single "page", it's the frame everything else renders inside; would produce an awkward, empty `pages/`/`api/` folder |

**Recommendation:** A **hybrid, closest to Option A.** Layout-only chrome that owns no API calls (`AppShell`, `TopNavbar`, `Sidebar`, `ThemeToggle`, `CommandPalette`, `SearchBar`, `UserProfileMenu`) lives under `resources/views/web/src/layouts/AppShell/`. The one piece of this shell that *does* own real backend calls — Notifications — gets its own conventional feature module at `resources/views/web/src/module/global/notifications/` (`index.jsx`, `api/notifications.api.js`, `components/`), which `AppShell` imports and mounts. This keeps `module/` reserved for backend-backed domains while giving layout-only chrome a home that doesn't force an artificial API layer onto it. `OrganizationSwitcherDropdown` stays in `layouts/AppShell/` as a thin wrapper that *consumes* whatever org data/hook the Onboarding spec's module exposes — it must not redefine org fetch/switch logic.

---

## 3. Database

No new custom tables are designed by this spec.

| Concern | Disposition |
|---|---|
| Notifications | **Reuse** Laravel's stock, framework-provided `notifications` table. Publish it via `php artisan notifications:table` (migration not yet run — none exists beyond `users`/`cache`/`jobs`). No custom columns are authored here; schema is the framework default (`id`, `type`, `notifiable_type`, `notifiable_id`, `data` JSON, `read_at`, timestamps). |
| Theme preference | **None now** (see Decision above) — persisted client-side in `localStorage`. A future `user_preferences.theme` column is owned by the Onboarding/Settings spec; **do not duplicate it here.** |
| Active organization | **Reused, not owned here.** This shell only reads "current user + active organization" from whatever session/API the Auth + Onboarding specs establish (e.g. `active_organization_id` on the user/session). No table is proposed here. |
| Sidebar/theme UI state | Client-only (Context + `localStorage`), no persistence needed server-side. |

---

## 4. Backend

This is primarily a **frontend-chrome spec** — the only backend surface truly needed for the shell itself is the Notification Center's read/mark-read endpoints. Everything else (Organization Switcher data, active org, theme preference table) is deliberately **not** owned here; it's consumed from the Auth/Onboarding specs once written.

**Portal / namespace** (per [project-profile.md](../../../rules/project-profile.md)'s Global row): controller namespace `global`, route prefix `global` (explicit, unlike SubHRMS's top-level Global — chosen for clarity as more portals land; see note below).

**Query**
```php
// app/Queries/Global/GetNotificationsQuery.php
namespace App\Queries\Global;

use App\Queries\Query;

class GetNotificationsQuery extends Query
{
    public static function execute($params = [])
    {
        $user = $params['user'];

        return $user->notifications()
            ->latest()
            ->paginate($params['per_page'] ?? 20);
    }
}
```

**Handlers**
```php
// app/Handlers/Global/MarkNotificationReadHandler.php
namespace App\Handlers\Global;

use App\Handlers\Handler;
use Illuminate\Support\Facades\DB;

class MarkNotificationReadHandler extends Handler
{
    public static function execute($params = [])
    {
        return DB::transaction(function () use ($params) {
            $notification = $params['user']->notifications()->findOrFail($params['id']);
            $notification->markAsRead();
            return $notification;
        });
    }
}
```
- A sibling `MarkAllNotificationsReadHandler::execute(['user' => $user])` calling `$user->unreadNotifications->markAsRead()`.

**Controller (thin dispatcher, no API Resources — matches `App\Handlers\Inquiry\StoreInquiryHandler`'s existing pattern in this repo)**
```php
// app/Http/Controllers/global/NotificationController.php
namespace App\Http\Controllers\global;

use App\Http\Controllers\Controller;
use App\Queries\Global\GetNotificationsQuery;
use App\Handlers\Global\MarkNotificationReadHandler;
use App\Handlers\Global\MarkAllNotificationsReadHandler;
use Illuminate\Http\Request;
use Exception;

class NotificationController extends Controller
{
    public function index(Request $request)
    {
        try {
            $data = GetNotificationsQuery::execute(['user' => $request->user(), ...$request->all()]);
            return response()->json(['data' => $data]);
        } catch (Exception $e) {
            return response()->json(['message' => $e->getMessage()], 400);
        }
    }

    public function markRead(Request $request, $id)
    {
        try {
            $data = MarkNotificationReadHandler::execute(['user' => $request->user(), 'id' => $id]);
            return response()->json(['data' => $data]);
        } catch (Exception $e) {
            return response()->json(['message' => $e->getMessage()], 400);
        }
    }

    public function markAllRead(Request $request)
    {
        try {
            MarkAllNotificationsReadHandler::execute(['user' => $request->user()]);
            return response()->json(['message' => 'ok']);
        } catch (Exception $e) {
            return response()->json(['message' => $e->getMessage()], 400);
        }
    }
}
```

**Routes** — new `routes/api/global.php`, loaded from `routes/api.php` inside the authenticated group (that group doesn't exist yet either — `routes/api.php` today only has a comment block; standing up `auth:sanctum` — or the session guard, whichever the Auth spec chooses — is itself a prerequisite this spec depends on but does not own):
```php
// routes/api/global.php
use App\Http\Controllers\global\NotificationController;

Route::get('/notifications', [NotificationController::class, 'index']);
Route::post('/notifications/{id}/read', [NotificationController::class, 'markRead']);
Route::post('/notifications/read-all', [NotificationController::class, 'markAllRead']);
```
```php
// routes/api.php — inside the (future) auth group
Route::prefix('global')->group(base_path('routes/api/global.php'));
```

**Organization Switcher data** — **not defined here.** `OrganizationSwitcherDropdown.jsx` expects something like `GET /api/global/organizations` (orgs the user belongs to) and `POST /api/global/organizations/{id}/activate` (switch active org), but the exact ownership, location, and payload shape are for the Onboarding spec to define — coordinate before backend implementation rather than duplicating that Query/Handler here.

---

## 5. Frontend

### Module layout
```
resources/views/web/src/layouts/AppShell/
├── AppShell.jsx                      # layout route: TopNavbar + Sidebar + <Outlet/> (Workspace) + CommandPalette (mounted once)
├── TopNavbar.jsx                     # logo, sidebar toggle, SearchBar trigger, ThemeToggle, NotificationCenter trigger, UserProfileMenu, OrganizationSwitcherDropdown
├── Sidebar.jsx                       # nav links; rail/overlay/drawer variants per breakpoint; org switcher slot at top
├── UserProfileMenu.jsx               # avatar + dropdown (profile, settings link, sign out)
├── OrganizationSwitcherDropdown.jsx  # thin wrapper — consumes the Onboarding spec's org data/hook, does not redefine fetch/switch logic
├── ThemeToggle.jsx                   # reads/writes useTheme()
├── SearchBar.jsx                     # static trigger — opens CommandPalette (see Decision)
├── CommandPalette.jsx                # cmdk-based, Cmd+K/Ctrl+K, groups: Navigate / Actions / Search
├── context/
│   ├── ShellUIContext.jsx            # sidebar collapsed/open, palette open
│   └── ThemeContext.jsx              # theme + setTheme, localStorage-backed
├── hooks/
│   ├── useShellUI.js
│   ├── useTheme.js
│   └── useKeyboardShortcut.js        # generic Cmd+K / Escape binder
└── index.js                          # barrel: export { AppShell } etc.

resources/views/web/src/module/global/notifications/
├── index.jsx
├── api/notifications.api.js          # getNotifications(), markRead(id), markAllRead()
├── hooks/useNotifications.js         # polling interval + focus-refetch, exposes {items, unreadCount, markRead, markAllRead}
└── components/
    ├── NotificationCenter.jsx        # bell icon + badge + panel/dropdown
    └── NotificationItem.jsx
```

### `App.jsx` wiring (replaces the current `return null`)
```jsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppShell } from './src/layouts/AppShell';
// Sibling-spec pages are lazy-imported once they exist:
// const DashboardPage = lazy(() => import('./src/module/dashboard/pages/DashboardPage'));

export default function App() {
    return (
        <BrowserRouter basename="/app">
            <Routes>
                <Route element={<AppShell />}>
                    <Route index element={<div>Dashboard placeholder</div>} />
                    {/* <Route path="settings/*" element={<SettingsRoutes />} /> */}
                </Route>
            </Routes>
        </BrowserRouter>
    );
}
```

### API contract (frontend ↔ backend)
| Action | Method & path | Notes |
|---|---|---|
| List notifications | `GET /api/global/notifications` | paginated, `?per_page=` |
| Mark one read | `POST /api/global/notifications/{id}/read` | |
| Mark all read | `POST /api/global/notifications/read-all` | |
| List organizations | `GET /api/global/organizations` | **owned by Onboarding spec** — consumed only |
| Switch active org | `POST /api/global/organizations/{id}/activate` | **owned by Onboarding spec** — consumed only |

### Reused Design System primitives (not redefined here)
`Modal`/`Dialog` wrapper (for `CommandPalette`'s shell), `Avatar`, `Badge` (unread count), `Dropdown`, `EmptyState` (no notifications), `Skeleton`/`Spinner` (loading org list, loading notifications) — all supplied by the Design System spec (`.agents/specs/scaleup/design/design_system.md`); this spec composes them, it does not define their visual styling from scratch.

---

## 6. Business Rules & Edge Cases

| # | Rule / Edge Case | Handling |
|---|---|---|
| 1 | **Deep-link / refresh under `/app/*`** | `routes/web.php` currently registers only the exact path `/app`. Once React Router owns sub-paths (`/app/settings`), a hard refresh on `/app/settings` will 404 unless the Laravel route is broadened to a catch-all, e.g. `Route::get('/app/{any?}', fn () => view('app'))->where('any', '.*')->name('app');`. This is a **required prerequisite**, called out in Build Order. |
| 2 | **Breakpoints** | Desktop ≥1024px (persistent rail), Tablet 768–1023px (rail default, overlay on expand), Mobile <768px (hidden, drawer on demand). Match Tailwind's `lg`/`md` breakpoints, don't invent custom ones. |
| 3 | **Cmd/Ctrl+K conflicts** | Some browsers bind `Ctrl+K`/`Cmd+K` to their own address-bar search. The palette's key handler must `preventDefault()` on capture; `SearchBar`'s click is always a working fallback trigger regardless of shortcut success. |
| 4 | **Overlay stacking** | Only one modal-like overlay open at a time. Opening the Command Palette while the mobile sidebar drawer is open must close the drawer first (no stacked overlays/backdrops). |
| 5 | **Notification staleness** | Transport is polling-only (see Decision) — a new server-side notification is not guaranteed visible until the next poll tick or window-focus refetch. This is an accepted, explicit gap until a future real-time upgrade; do not imply instant delivery in the UI copy. |
| 6 | **Notification badge overflow** | Unread counts above a threshold (e.g. 9) display as `"9+"` rather than the exact number. |
| 7 | **Single-organization users** | The switcher still renders (with the org name, no dropdown of alternatives) so "create/join another organization" stays discoverable — it isn't hidden just because there's only one org. |
| 8 | **Organization list fetch failure** | Shell must still render with the shell showing the last-known/session org name and a disabled switcher — a failed org-list call must never block the whole Workspace from rendering. |
| 9 | **Theme flash on load** | Because `resources/css/app.css` sets `color-scheme: dark` as the document default, an inline, render-blocking `<head>` script (added to `app.blade.php` at implementation time) must read `localStorage` and apply the resolved theme class before React mounts, defaulting to **dark** when no stored value exists — not `prefers-color-scheme`. |
| 10 | **Focus management** | Closing the Command Palette (Escape, backdrop click, or selecting an item) returns focus to the `SearchBar` trigger that opened it — never leaves focus stranded. |
| 11 | **Sidebar/org-switcher coexistence in rail mode** | When the sidebar is collapsed to the icon rail, the Organization Switcher trigger collapses to just the org avatar/initial but must remain independently clickable/reachable (not just visible) — it doesn't disappear or get absorbed into the nav list. |

---

## 7. Build Order

1. **Prerequisite (backend):** broaden `routes/web.php`'s `/app` route to a catch-all so client-side deep links survive a refresh (Rule 1). Confirm with whoever owns the Auth spec whether the eventual auth guard is session- or Sanctum-based, since that also gates the `routes/api.php` auth group this shell's notification routes will sit inside.
2. Add `react-router-dom` and `cmdk` to `package.json`; install.
3. **Gate 1 (static design, hard-coded data):** scaffold `resources/views/web/src/layouts/AppShell/` — `AppShell`, `TopNavbar`, `Sidebar`, `UserProfileMenu`, `ThemeToggle`, `SearchBar`, `CommandPalette`, a stub `OrganizationSwitcherDropdown` — with mock user/org/nav-item data, and the `ShellUIContext`/`ThemeContext` providers.
4. Wire `App.jsx` with `BrowserRouter` + the `AppShell` layout route + a placeholder index element, so `/app` renders the full chrome around empty content.
5. Implement responsive rail/overlay/drawer behavior and the Cmd+K / Escape shortcut wiring against the mock data — Gate 1 complete once the shell looks and behaves right at all three breakpoints with no live data.
6. **Gate 2 (backend + live wiring):** run `php artisan notifications:table` (and migrate); add `GetNotificationsQuery`, `MarkNotificationReadHandler`, `MarkAllNotificationsReadHandler`, `NotificationController`, and `routes/api/global.php` per §4.
7. Build `resources/views/web/src/module/global/notifications/` (api + `useNotifications` hook with polling + focus-refetch); swap `AppShell`'s mock notification data for the live hook.
8. Once the Onboarding spec is written and its organization endpoints exist, wire the real `OrganizationSwitcherDropdown` to them, replacing the Gate-1 stub.
9. Add the theme-flash-prevention inline script to `app.blade.php`'s `<head>`; finalize `useTheme` reading/writing `localStorage` per the persistence Decision.
10. Cross-breakpoint / cross-browser QA pass: verify the Cmd/Ctrl+K shortcut doesn't fight browser defaults, overlay-stacking rule (Edge Case 4), and focus-return behavior (Edge Case 10).

---

## 8. Out of Scope (Future Specs)

- **Dashboard content** — the first page rendered inside this shell's Workspace: `.agents/specs/scaleup/dashboard/dashboard_concept.md`.
- **Design System** — supplies the visual primitives (`Modal`, `Avatar`, `Badge`, `Dropdown`, `EmptyState`, buttons, etc.) this shell composes rather than redefines: `.agents/specs/scaleup/design/design_system.md`.
- **Onboarding** — supplies the Organization Switcher's underlying data/API (`GET/POST /api/global/organizations...`) and any future `user_preferences` table (theme, notification prefs): `.agents/specs/scaleup/onboarding/onboarding.md`.
- **Logo Concepts** — supplies the mark used in the Top Navigation: `.agents/specs/scaleup/brand/logo_concepts.md`.
- **Authentication / session mechanism** — how the current user + active organization are actually resolved (login, guard choice, Sanctum installation — not present in `composer.json` today). This shell only assumes that state exists; a future Auth spec under `.agents/specs/scaleup/auth/` owns it.
- **Settings pages content** — notification preferences UI, profile-editing forms, etc. This shell only provides the chrome/menu entry points into Settings, not its content.
- **Real-time notification delivery** — websocket/broadcasting infrastructure (Laravel Echo + Reverb/Pusher) is an explicit future extension once that infra exists; this spec ships polling only.
- **Public Landing Page and Auth screens** — unauthenticated, no shell; both are separate sibling specs.
