# Spec — Authentication

> **Kind:** Greenfield
> **Portal:** Auth
> **Route:** /login (auth_login), /register (auth_register), /forgot-password (auth_forgot_password), /reset-password/{token} (auth_reset_password), /verify-email (auth_verify_email)
> **Conventions:** [project-gate.md](../../../rules/core/project-gate.md), [security-baseline.md](../../../rules/core/security-baseline.md), [code-quality.md](../../../rules/conditional/code-quality.md), [system-awareness.md](../../../rules/conditional/system-awareness.md).
> **System Awareness:** Models: `User` (reused, extended). Tables: `users` (reused, extended via new migration), `password_reset_tokens` (reused as-is), `sessions` (reused as-is). Routes: none exist yet for auth — all new (`routes/web.php` + new `routes/api/auth.php`). New migration: **yes** — one alter-table migration adding `status`, `last_login_at`, `onboarding_completed_at` to `users`. `laravel/sanctum` is **not yet in `composer.json`** — installing it is a Build Order prerequisite.

---

## 1. Purpose

This spec defines the complete authentication surface of ScaleUP: **Login, Register, Forgot Password, Email Verification, and Reset Password.** It is the front door of the Business OS — the first thing every user sees, and the moment ScaleUP has to prove it is "Apple × Stripe × Linear × Notion" premium rather than a generic admin template.

Functionally, this spec covers only account creation and credential/session mechanics for a single `users` row. It deliberately stops at the door: routing a freshly-authenticated user into the multi-step "Create Business / Join Business" wizard, and everything about Organizations/RBAC/multi-tenancy, belongs to the sibling **Onboarding** spec (see §8). This split keeps each spec focused on one branding-doc section and avoids re-litigating multi-tenant schema decisions here.

Business problem solved: without this, there is no way to create a ScaleUP account, sign back in, recover a lost password, or prove ownership of an email address — nothing else in the product (onboarding, dashboard, global layout) is reachable.

---

## 2. Design Decisions (Pros & Cons)

### Decision: Auth strategy & token transport

**Option A — Laravel Sanctum, stateful cookie-based SPA session (Recommended)**
- The React SPA is served **first-party** by the same Laravel app (`resources/views/app.blade.php` via `@vite`), so Sanctum's SPA mode applies cleanly: the browser first `GET`s `/sanctum/csrf-cookie`, then every `POST` (login/register/logout) rides on the `web` session guard via an httpOnly, `SameSite` session cookie + an `X-XSRF-TOKEN` header read from the non-httpOnly `XSRF-TOKEN` cookie Laravel already sets.

| Pros | Cons |
|---|---|
| No access/refresh token ever touches JS-readable storage — directly satisfies [security-baseline.md](../../../rules/core/security-baseline.md)'s "no PII/tokens in `localStorage`" rule, since the auth cookie is httpOnly | Requires the `EnsureFrontendRequestsAreStateful` middleware on the `api` group and correct `SANCTUM_STATEFUL_DOMAINS`/`SESSION_DOMAIN` env config |
| Reuses the `sessions` table that already exists in the base migration — zero new schema | `fetch`/axios calls must send `credentials: 'include'` and the CSRF header — the current `axiosInstance.js` stub does neither yet (see §7 build order) |
| Logout is a true server-side session kill (`session()->invalidate()`), not just "forget a token" | Doesn't by itself support a future native mobile app or third-party API consumer (those need Sanctum's token-ability mode) |
| Matches Laravel's own idiomatic SPA pattern (same one Breeze/Jetstream ship) — least custom code | |

**Option B — Stateless token (Sanctum personal access tokens, or JWT) stored client-side**
- Server issues an opaque bearer token on login; the SPA attaches it as an `Authorization: Bearer <token>` header, storing it in `localStorage`/`sessionStorage` (or an in-memory store that dies on refresh).

| Pros | Cons |
|---|---|
| Trivially portable to a future native/mobile client or third-party API integration | Storing the token anywhere JS can read it (`localStorage`) is exactly what [security-baseline.md](../../../rules/core/security-baseline.md) forbids for tokens/PII — an XSS bug becomes full account takeover |
| No CSRF header/cookie plumbing needed | Requires a `personal_access_tokens` migration + manual expiry/rotation logic that Sanctum's stateful mode gives for free |
| | Logout ("forget the token") can't force-invalidate a token already exfiltrated, unlike killing a server session |

**Recommendation:** **Option A.** ScaleUP's SPA is first-party and same-origin with the API, which is the exact scenario Sanctum's stateful mode is built for, and it directly satisfies the project's own XSS/localStorage security rule. Revisit Option B only if/when a separate native app or public API consumer needs to authenticate independently — track that as a future extension (§8), not a reason to weaken this decision now.

---

### Decision: Password policy & hashing strategy

**Option A — Laravel's built-in `Password` validation rule object + default `bcrypt` hasher (Recommended)**
- `Password::min(10)->letters()->mixedCase()->numbers()->uncompromised()` in the Register/Reset FormRequests; hashing stays on the `'password' => 'hashed'` cast already present on `User` (bcrypt via `config('hashing.driver')`).

| Pros | Cons |
|---|---|
| `uncompromised()` checks the password against the "Have I Been Pwned" breach corpus via the k-anonymity API — real-world credential-stuffing defense for free | One extra outbound HTTP call per registration/reset (Laravel caches/handles this gracefully, but note it as a dependency on an external service being reachable) |
| Zero new dependency — ships in Laravel core | |
| Centralized in one rule object reused across Register + Reset (single source of truth per [system-awareness.md](../../../rules/conditional/system-awareness.md)) | |

**Option B — Custom regex/length validation**
- Hand-rolled `regex:` rules (e.g. requiring a symbol) in the FormRequest.

| Pros | Cons |
|---|---|
| No external network dependency at all | Reinvents what Laravel already ships; regex password rules are notoriously easy to get subtly wrong (Unicode, false negatives) |
| | No breach-corpus check — weaker real-world security posture |

**Recommendation:** **Option A.** It is the framework-native, already-imported mechanism, and its `uncompromised()` check is a materially stronger real-world defense than a hand-rolled regex. Policy: minimum 10 characters, at least one letter, one uppercase, one number, checked against known breaches. (No symbol requirement — Stripe/Linear-style products generally don't force it; adjust if the business wants stricter policy.)

---

### Decision: Email verification approach

**Option A — Signed URL, one-click (Laravel native `MustVerifyEmail`) (Recommended)**
- `User implements MustVerifyEmail` (currently commented out in the model); Laravel's `Registered` event auto-fires the default `SendEmailVerificationNotification` listener, which mails a `URL::temporarySignedRoute()` link. Clicking it hits a signed route the SPA intercepts to call the verify API.

| Pros | Cons |
|---|---|
| Zero extra UI to build — one tap from the email client finishes verification, lowest friction | If a user's email client "click-scans" links (some corporate security gateways pre-fetch links) the link can get consumed before the real user clicks it — mitigated by making the endpoint idempotent |
| Fully native to Laravel — `verified` middleware, `Illuminate\Auth\Events\Verified` event, no custom expiry/attempt-counting code to write | Doesn't work if the user is checking email on a different device than the one mid-registration (not actually a con vs. OTP — OTP has the same cross-device requirement to type the code back on the registering device) |
| Signature (`sha1($email)` + `expires`) is tamper-evident and time-boxed out of the box | |

**Option B — 6-digit OTP code entered manually**
- Mail a short-lived numeric code; a `VerifyEmailPage` input collects it and posts it to an API endpoint.

| Pros | Cons |
|---|---|
| Works even when the email is read on a different device (user just re-types the code on the registering device) | Requires custom code generation, storage (cache/DB), attempt-throttling, and expiry logic — none of it ships in Laravel |
| Feels "app-like" (common in mobile-first products) | Extra typing step = more friction than a single click |

**Recommendation:** **Option A.** It reuses Laravel's built-in verification pipeline entirely (no bespoke OTP storage/expiry to invent), and one-click verification is lower friction, which matters for a premium, low-friction SaaS onboarding funnel. Revisit OTP only if product research shows meaningful cross-device drop-off.

---

### Decision: Split-layout KPI illustration approach

**Option A — Static SVG/HTML composition with subtle CSS-only float animation (Recommended)**
- The right pane is a fixed arrangement of 3–5 "floating" card shapes (Revenue, Growth %, Active Goals, Team, etc.) built as plain JSX + Tailwind (rounded-2xl, soft shadow, thin border, small Lucide icon + number + sparkline), each given a slow `@keyframes float` (translateY drift, staggered delays) and a light radial-gradient backdrop blob. No numbers are live-wired — they are display-only illustration content.

| Pros | Cons |
|---|---|
| Zero new runtime dependency (no `framer-motion`/`gsap` in `package.json` today) — ships with what's already installed (React 19 + Tailwind v4) | Less "wow" than physics-based motion; feels calmer, more Notion/Linear than flashy |
| Cheap to render — matters because the auth page is the highest-traffic, first-impression, must-load-fast page in the app | Card positions are hand-tuned per breakpoint rather than physically simulated |
| Easy to keep accessible: animation respects `prefers-reduced-motion` by disabling the keyframe, no JS-driven layout thrash | |
| Matches the branding doc's "elegant micro-interactions" (subtle) rather than "look at me" motion | |

**Option B — Library-driven animated/interactive composition (`framer-motion`)**
- Cards drift with spring physics and react to pointer position (parallax-on-mousemove), using a new `framer-motion` dependency.

| Pros | Cons |
|---|---|
| Richer, more interactive feel; easy spring/parallax primitives | New dependency to add, review, and keep updated for a page whose job is to load instantly and get out of the way |
| Nice showcase of "modern SaaS" polish | Mouse-parallax adds JS work on every pointer move; needs its own reduced-motion escape hatch |

**Recommendation:** **Option A.** No illustration library or photography per the branding doc ("Do not use photos", "abstract business illustrations", "floating UI cards") — a hand-built CSS/SVG composition satisfies that literally, costs nothing in bundle size, and keeps the highest-traffic page in the app fast. `framer-motion` can be layered in later (Design System spec) as a shared animation primitive if the product wants richer motion app-wide, rather than a one-off dependency added just for this page.

**Theme note (not a live decision, a flag):** the branding doc's palette for this section is unambiguously **light** (`#FFFFFF` background, `#2563EB` primary, `#0F172A` text) — Stripe/Linear/Notion daylight aesthetic, not dark. `resources/css/app.css` currently sets `html { color-scheme: dark; }` and dark scrollbar colors, which appears to be leftover styling scoped for the marketing landing page's dark hero. The Auth layout must **locally force light** (`color-scheme: light` on its own root wrapper) so it does not inherit that global dark treatment — this is a scoping detail for whoever implements the Auth layout wrapper, not a redesign of `app.css` (that file's ownership is the Design System spec, §8).

---

### Decision: Unverified-email login handling

> This one is a genuine **business policy call**, not a technical default — flagging it explicitly per the spec skill's guidance rather than silently picking.

**Option A — Allow login immediately; gate specific actions behind `verified` middleware (Recommended default)**
- `Registered` fires the verification email, but the user is logged in right away (session created) and dropped into a lightweight "Verify your email" gate/banner with a **Resend** button. They cannot proceed into Onboarding/the app shell until verified, but they aren't stuck on a dead-end screen either.

| Pros | Cons |
|---|---|
| Standard Laravel/Breeze/Jetstream pattern — `verified` middleware exists for exactly this | A logged-in-but-unverified session exists briefly, which is a marginally larger attack surface than "no session until verified" |
| Lower friction: the user is never abandoned on a bare "check your email" screen with no way back in if the tab closes | |
| Resend is trivial (`Auth::user()->sendEmailVerificationNotification()`) since the user object is already the authenticated one | |

**Option B — Block login entirely until verified**
- Registration does **not** create a session. The user sees a static "check your email" screen only; attempting `/login` before verifying returns an explicit "please verify your email first" error.

| Pros | Cons |
|---|---|
| No unverified session ever exists — simplest security story | If the verification email is lost/delayed, the user has no logged-in context to click "resend" from — needs a separate unauthenticated resend flow (email lookup) |
| Slightly reduces fake-account noise before any session/business data is touched | Extra friction; most modern SaaS (Stripe, Notion, Linear) do **not** block login this way |

**Recommendation:** Default to **Option A** for the reasons above, but confirm with product/business — if ScaleUP wants to keep unverified accounts from ever touching Onboarding/business creation (spam/fraud concern), Option A still satisfies that by gating Onboarding behind `verified`, which is why it's the recommended default either way.

---

### Decision: Login rate limiting & lockout strategy

**Option A — Cache-backed throttling via Laravel's `RateLimiter`/`throttle` middleware (Recommended)**
- `RateLimiter::for('login', ...)` keyed by `email|ip`, applied as `throttle:login` on the login route; no new DB columns.

| Pros | Cons |
|---|---|
| Zero schema — uses the existing cache driver (the `cache` table/migration already exists in this project) | Lockout state resets if the cache store is flushed; no permanent audit trail of lockouts |
| Framework-native 429 response with `Retry-After` header the frontend can read directly | |
| Trivial to tune (attempts/decay) without a migration | |

**Option B — Persistent `failed_login_attempts` / `locked_until` columns on `users`**
- Handler increments a counter and sets a lockout timestamp column on every failed attempt.

| Pros | Cons |
|---|---|
| Permanent, queryable audit trail (useful for an admin "security" view later) | New columns + a write on every failed login (including malicious brute-force traffic) — more DB load exactly when you don't want it |
| Survives a cache flush | Duplicates what `RateLimiter` already does correctly; violates [system-awareness.md](../../../rules/conditional/system-awareness.md)'s "no duplicate logic" for something the framework ships |

**Recommendation:** **Option A** for this spec's scope. It's the lower-risk, zero-migration option and the framework-idiomatic one. If a future Admin/Security spec wants a persistent lockout audit trail, that's an additive change to `users` at that time — not something to pre-build here.

---

## 3. Database

All changes are to the **existing** `users` table — reused and extended, no new tables. `password_reset_tokens` and `sessions` (both already created by the base `0001_01_01_000000_create_users_table.php` migration) are reused exactly as-is; Laravel's default password-reset broker and the `web` session guard already point at them via `config/auth.php`.

### `users` — reused columns (no change)
| Column | Type | Notes |
|---|---|---|
| `id` | bigint, PK | |
| `name` | string | Single full-name field kept as-is (not split into first/last) — reuses the existing column and matches Stripe/Linear/Notion-style single-field signup; revisit only if per-field personalization (e.g. "Hi John,") becomes a real requirement. |
| `email` | string, unique | |
| `email_verified_at` | timestamp, nullable | Already cast to `datetime` on the model |
| `password` | string | Already cast `'hashed'` — bcrypt applied automatically |
| `remember_token` | string, nullable | Backs the "Remember me" checkbox on Login |
| `created_at` / `updated_at` | timestamp | |

### `users` — new columns (new migration, alter table)
| Column | Type | Nullable/Default | Notes |
|---|---|---|---|
| `status` | string (`active`, `disabled`) | default `'active'`, indexed | Per [project-gate.md](../../../rules/core/project-gate.md) convention: this project uses a `status` column instead of `SoftDeletes`/hard delete for account-level enable/disable. Set only by handlers, **never** mass-assignable from a register/update request payload (security: prevents a client from POSTing `status` in a signup body). |
| `last_login_at` | timestamp, nullable | null by default | Set by `LoginHandler` on every successful login. |
| `onboarding_completed_at` | timestamp, nullable | null by default | Set by the Onboarding flow (owned by the sibling spec, §8) once the wizard finishes. This spec only **reads** it, to decide whether a just-authenticated user is routed to `/onboarding` or the app shell — it does not define the wizard's own progress schema. |

No column is added to `$fillable` purely for convenience — `status`, `last_login_at`, and `onboarding_completed_at` are written explicitly by Handler code (`$user->update([...])` with an explicit, hard-coded key set), not by passing raw request input through mass assignment, per [security-baseline.md](../../../rules/core/security-baseline.md)'s validation rule.

### Sanctum-related schema note
Sanctum's stateful SPA cookie mode (the recommended Decision A above) needs **no new migration** — it rides on the `sessions` table that already exists. Do **not** publish/run Sanctum's `personal_access_tokens` migration as part of this spec; that table is for bearer-token API consumers (mobile apps, third-party integrations), which is explicitly out of scope (§8).

---

## 4. Backend

### Model
`app/Models/User.php` (reused, extended):
- Implement `Illuminate\Contracts\Auth\MustVerifyEmail` (the `use` import already exists, commented out — uncomment and add to the `class User extends Authenticatable implements MustVerifyEmail` signature).
- Extend the `#[Fillable([...])]` attribute only with genuinely user-submitted register fields — it already covers `name`, `email`, `password`; no change needed there since `status`/`last_login_at`/`onboarding_completed_at` are intentionally excluded from mass assignment (see §3).
- Add `'last_login_at' => 'datetime'` and `'onboarding_completed_at' => 'datetime'` to the `casts()` method.

### Query / Handler / Action classes (domain: `Auth`)

**Queries** (`app/Queries/Auth/`, namespace `App\Queries\Auth`):
- `GetAuthenticatedUserQuery::execute($params = [])` — returns the current `Auth::user()` shaped for the frontend's session bootstrap (`id`, `name`, `email`, `email_verified_at`, `onboarding_completed_at`), used by `GET /api/auth/me`.

**Handlers** (`app/Handlers/Auth/`, namespace `App\Handlers\Auth`):
- `RegisterUserHandler::execute($data)` — wraps `DB::transaction`: creates the `User` (`status = 'active'` explicit, not from input), fires `event(new Registered($user))` (triggers the built-in verification email listener), logs the user in via the `web` guard, returns the user.
- `LoginHandler::execute($data)` — attempts `Auth::attempt()`; on success: rejects if `status !== 'active'` (explicit disabled-account error, logs the user back out immediately if the guard already authenticated them), regenerates the session, updates `last_login_at`.
- `LogoutHandler::execute($request)` — `Auth::guard('web')->logout()`, `$request->session()->invalidate()`, `$request->session()->regenerateToken()`.
- `SendPasswordResetLinkHandler::execute($data)` — thin wrapper over `Password::sendResetLink($data)`.
- `ResetPasswordHandler::execute($data)` — thin wrapper over `Password::reset($data, ...)`, re-hashes and saves the new password, fires `PasswordReset` event.
- `ResendVerificationEmailHandler::execute($user)` — guards against an already-verified user, calls `$user->sendEmailVerificationNotification()`.
- `VerifyEmailHandler::execute($data)` — validates the signed payload (`id`, `hash`, `expires`, `signature`) against a temporary signed-route check performed server-side, marks `email_verified_at`, fires `Verified` event. Idempotent: verifying an already-verified email returns success rather than an error (defends against email-scanner pre-fetch, see Decision above).

No Action classes are needed yet — none of these Handlers' logic is large enough or reused by another Handler to warrant splitting out (per [project-gate.md](../../../rules/core/project-gate.md), Actions are optional and only added when a Handler grows past a cohesive ~40-line block).

### Controller
`app/Http/Controllers/Auth/AuthController.php` (new, namespace `App\Http\Controllers\Auth`), thin dispatcher, one method per endpoint below, each `try/catch` → `response()->json([...], $code)` per the project's no-API-Resources convention:

| Method | Calls |
|---|---|
| `register(Request $request)` | validates via `RegisterRequest` (new `app/Http/Requests/RegisterRequest.php`, flat per convention) → `RegisterUserHandler::execute()` |
| `login(Request $request)` | validates via `LoginRequest` → `LoginHandler::execute()` |
| `logout(Request $request)` | `LogoutHandler::execute($request)` |
| `me(Request $request)` | `GetAuthenticatedUserQuery::execute()` |
| `forgotPassword(Request $request)` | validates `email` → `SendPasswordResetLinkHandler::execute()` |
| `resetPassword(Request $request)` | validates via `ResetPasswordRequest` (uses the `Password` rule object, Decision above) → `ResetPasswordHandler::execute()` |
| `verifyEmail(Request $request)` | `VerifyEmailHandler::execute($request->all())` |
| `resendVerification(Request $request)` | `ResendVerificationEmailHandler::execute($request->user())` |

### Routes

`routes/api.php` (orchestrator) — add one line alongside the existing comment block:
```php
Route::prefix('auth')->group(base_path('routes/api/auth.php'));
```

`routes/api/auth.php` (new file) — unlike the tenant portal files, this one is intentionally public-by-default with its own inner `auth:sanctum` group for the two endpoints that need an authenticated session:
```php
// Public
Route::post('register', [AuthController::class, 'register'])->middleware('throttle:6,1');
Route::post('login', [AuthController::class, 'login'])->middleware('throttle:login');
Route::post('forgot-password', [AuthController::class, 'forgotPassword'])->middleware('throttle:3,1');
Route::post('reset-password', [AuthController::class, 'resetPassword'])->middleware('throttle:6,1');
Route::post('verify-email', [AuthController::class, 'verifyEmail'])->middleware('throttle:6,1');

// Authenticated (session cookie required)
Route::middleware('auth:sanctum')->group(function () {
    Route::get('me', [AuthController::class, 'me']);
    Route::post('logout', [AuthController::class, 'logout']);
    Route::post('email/resend', [AuthController::class, 'resendVerification'])->middleware('throttle:3,1');
});
```
`GET /sanctum/csrf-cookie` is registered automatically by the Sanctum service provider once installed — no manual route needed; the SPA must `GET` it once before the first `POST`.

`routes/web.php` (add the 5 public SPA entry points, all rendering the same `view('app')` shell exactly like the existing `/` and `/app`):
```php
Route::get('/login', fn () => view('app'))->name('auth_login');
Route::get('/register', fn () => view('app'))->name('auth_register');
Route::get('/forgot-password', fn () => view('app'))->name('auth_forgot_password');
Route::get('/reset-password/{token}', fn () => view('app'))->name('auth_reset_password');
Route::get('/verify-email', fn () => view('app'))->name('auth_verify_email');
Route::get('/verify-email/{id}/{hash}', fn () => view('app'))
    ->middleware('signed')
    ->name('auth_verify_email.confirm');
```
The last route is the actual link mailed to the user (Laravel's default `VerifyEmail` notification points at a named `verification.verify` route by convention — repoint it at `auth_verify_email.confirm`, or keep both names pointing at the same URI). It still just renders the SPA shell — the React `VerifyEmailPage` reads `id`/`hash`/`expires`/`signature` straight from `window.location` and calls `POST /api/auth/verify-email` itself. This keeps the actual verification **business logic in the API layer** (thin-controller convention) instead of splitting it between a web route and an API route, and lets the page show a branded "Verifying your email…" state instead of a bare server redirect.

### Sanctum installation (infra prerequisite, not a route/migration change)
- `composer require laravel/sanctum` (not present in `composer.json` today).
- `php artisan vendor:publish --tag=sanctum-config` (skip `--tag=sanctum-migrations`; no `personal_access_tokens` table needed, see §3).
- Add `Laravel\Sanctum\Http\Middleware\EnsureFrontendRequestsAreStateful` to the `api` middleware group in `bootstrap/app.php`'s `->withMiddleware()` callback (currently empty).
- `.env`: set `SESSION_DRIVER=database` (table already exists) and `SANCTUM_STATEFUL_DOMAINS`/`SESSION_DOMAIN` to the app's own domain (first-party/same-origin, so this is typically just the app's host).

---

## 5. Frontend

Module root (already scaffolded as an empty stub, per the System Awareness scan): `resources/views/web/src/module/auth/`.

```
module/auth/
├── index.jsx                     # Barrel: re-exports the route list + useAuth hook + auth.api
├── routes/auth.routes.jsx        # Array of {path, element} for the 5 pages (see routing note below)
├── api/auth.api.js               # useAuthApi() — thin wrapper over `http` from '@/app/axios/axiosInstance'
├── hooks/useAuth.js              # login/register/logout/resendVerification actions + current-user state
├── pages/
│   ├── LoginPage.jsx
│   ├── RegisterPage.jsx
│   ├── ForgotPasswordPage.jsx
│   ├── ResetPasswordPage.jsx
│   └── VerifyEmailPage.jsx
└── components/
    ├── AuthLayout.jsx             # The split layout shell: left slot = form, right slot = AuthBrandSidebar
    ├── AuthBrandSidebar.jsx       # The right-pane KPI-card illustration (Decision above)
    ├── AuthCard.jsx               # Left-pane white card wrapper: logo, heading, form slot, footer link
    └── PasswordStrengthMeter.jsx  # Live strength bar for Register/Reset (mirrors the backend Password rule bands)
```
The stub folders already on disk (`types/`, `composables/`) are leftover from a Vue-oriented scaffold and are **not** part of the React convention this spec follows — this spec uses `hooks/` (React idiom) instead of `composables/`, and skips `types/` (plain `.jsx`, not TypeScript), matching the task's explicit React module convention (`index.jsx`, `api/<feature>.api.js`, `pages/`, `components/`).

**Design System reuse:** `AuthCard`, form `Input`/`Button`/`Checkbox`, and `PasswordStrengthMeter`'s visual chrome should come from the Design System spec's shared components (`.agents/specs/scaleup/design/design_system.md`, §8) once that spec exists and is implemented — it doesn't exist yet (empty stub folder confirmed during the scan). Until then, build minimal local `Input`/`Button` primitives inside `module/auth/components/` scoped to this module, and note them explicitly as **temporary** so whoever implements the Design System spec swaps these call sites over to the canonical components rather than leaving two parallel Button implementations (per [system-awareness.md](../../../rules/conditional/system-awareness.md)).

**Pages (each composed as `<AuthLayout><AuthCard>...form...</AuthCard></AuthLayout>`):**
- `LoginPage` — email, password, "Remember me" checkbox, "Forgot password?" link, submit → `useAuth().login()`. On success: redirect to `/onboarding` if `onboarding_completed_at` is null, else to the app shell root (Global Layout spec, §8).
- `RegisterPage` — name, email, password, confirm password, `PasswordStrengthMeter` live under the password field, terms acknowledgment text, submit → `useAuth().register()`, then routes into the "verify your email" gated state per the Unverified-Login Decision above.
- `ForgotPasswordPage` — email only, submit → always shows the same "if that email exists, a reset link is on its way" confirmation state (avoids email enumeration on this screen specifically, regardless of the Register-time enumeration choice below).
- `ResetPasswordPage` — reads `{token}` from the URL param + email + new password + confirm, `PasswordStrengthMeter` reused here too, submit → `useAuth().resetPassword()`. Handles the expired/invalid-token case as a distinct friendly state (see §6), not a raw error toast.
- `VerifyEmailPage` — two states driven by the URL: (a) "check your inbox" placeholder (plain `/verify-email` with a Resend button, shown right after register) and (b) "Verifying…" spinner that fires the confirm API call when the URL carries `id`/`hash`/`expires`/`signature` (the `/verify-email/{id}/{hash}` link from the email), then shows success/expired.

**Routing note:** `react-router-dom` is not yet in `package.json` and `App.jsx` is currently a stub returning `null` — wiring an actual router is a real prerequisite this spec depends on (see Build Order). Until the Global Layout spec (§8) defines the app's final route-aggregation strategy, this spec's `routes/auth.routes.jsx` is a plain static array imported directly into the root router config — simplest thing that works, swappable later without touching page components.

**API contract** (`api/auth.api.js`, using `http` from `@/app/axios/axiosInstance`):
```js
import http from '@/app/axios/axiosInstance';

export function useAuthApi() {
  return {
    getCsrfCookie: () => http.get('sanctum/csrf-cookie'),
    register: (payload) => http.post('api/auth/register', payload),   // {name, email, password, password_confirmation}
    login: (payload) => http.post('api/auth/login', payload),         // {email, password, remember}
    logout: () => http.post('api/auth/logout'),
    me: () => http.get('api/auth/me'),
    forgotPassword: (payload) => http.post('api/auth/forgot-password', payload), // {email}
    resetPassword: (payload) => http.post('api/auth/reset-password', payload),   // {token, email, password, password_confirmation}
    verifyEmail: (payload) => http.post('api/auth/verify-email', payload),       // {id, hash, expires, signature}
    resendVerification: () => http.post('api/auth/email/resend'),
  };
}
```

**Known gap to close before this can work live** (flag, not a fix made by this spec): the current `resources/views/web/app/axios/axiosInstance.js` is a bare `fetch` wrapper with no `credentials: 'include'` and no XSRF header attachment. Sanctum's cookie-based session (Decision A) will not authenticate without both. This is a shared, cross-cutting piece of infra (every future authenticated module depends on it too), so fixing it belongs to whichever spec/build step owns the app-shell HTTP layer — called out here because Auth is the **first** feature that actually needs it to function, not because this spec redesigns the shared axios instance.

### Layout sketch (Login/Register/Forgot/Reset — all share `AuthLayout`)
```
┌───────────────────────────────┬───────────────────────────────┐
│  LEFT  (white, #FFFFFF)       │  RIGHT (soft gradient blob bg) │
│                                │                                │
│   [ScaleUP logo mark]          │      ┌──────────────┐          │
│                                │      │ Revenue  ▲12%│  (float) │
│   Heading ("Welcome back")     │      └──────────────┘          │
│   Sub-copy (secondary text)    │            ┌──────────────┐    │
│                                │            │ Growth  92   │    │
│   [ AuthCard: form fields ]    │            └──────────────┘    │
│   [ Primary button, full-w ]   │      ┌──────────────┐          │
│                                │      │ Goals  4/6    │          │
│   Footer link (switch flow)    │      └──────────────┘          │
└───────────────────────────────┴───────────────────────────────┘
     (stacks to single column, illustration hidden below `md`)
```
`VerifyEmailPage` reuses the same `AuthLayout` but the left slot is a centered status card (spinner/success/expired icon) rather than a form.

---

## 6. Business Rules & Edge Cases

- A fresh account is always created with `status = 'active'` — there is no admin-approval step in this spec (would be a future Admin spec concern).
- After a **successful** register or login where `onboarding_completed_at IS NULL`, the frontend redirects to the Onboarding module's entry route rather than the app shell — this spec only reads that flag; the wizard itself is the sibling Onboarding spec (§8).
- Unverified users can log in (Decision above) but are held on the `VerifyEmailPage`/banner state until `email_verified_at` is set; Onboarding and the app shell are gated behind Laravel's `verified` middleware server-side (defense in depth — not just a frontend redirect).

| Edge Case | Handling |
|---|---|
| Wrong email/password | Generic "Invalid credentials" (never reveal whether the email exists) |
| Disabled account (`status = 'disabled'`) attempts login | Same generic "Invalid credentials" message — do not reveal account existence or disabled-state via a distinct message (avoids account enumeration) |
| Too many login attempts | `429` from `throttle:login`; frontend surfaces the `Retry-After` seconds in a countdown, not a raw error |
| Register with an email already taken | `422` with an explicit "email already in use" field error — accepted enumeration tradeoff for lower-friction UX (flag as a policy choice if the business wants a generic message instead) |
| Forgot-password for a non-existent email | Always the same generic "check your email" success state (no enumeration on this screen — see Frontend §5) |
| Reset-password link expired (> `config('auth.passwords.users.expire')`, default 60 min) or already used | Distinct "This link has expired" state with a CTA straight back to Forgot Password — never a raw Laravel exception page |
| Email-verification link expired or tampered signature | Distinct "This verification link is invalid or expired" state with a Resend action (works because Option A logs the user in already) |
| Verification link clicked twice (e.g. email scanner pre-fetch) | Idempotent: second click still reports success, does not error |
| Password confirmation mismatch | Field-level validation error, no API round-trip needed if caught client-side first |
| Already-authenticated user visits `/login` or `/register` | Redirect immediately to Onboarding or the app shell (whichever the `onboarding_completed_at` check dictates) — no need to re-show the form |
| CSRF cookie missing/expired mid-session (`419`) | Axios response interceptor (once the axios gap in §5 is closed) redirects to `/login` with a "please sign in again" notice |
| `prefers-reduced-motion` | The `AuthBrandSidebar` float keyframes are disabled via a media query — the cards render static instead |

---

## 7. Build Order

1. **Backend infra**: `composer require laravel/sanctum`; add `EnsureFrontendRequestsAreStateful` to the `api` middleware group in `bootstrap/app.php`; set `SESSION_DRIVER`, `SANCTUM_STATEFUL_DOMAINS`, `SESSION_DOMAIN` in `.env`.
2. **Migration**: new alter-table migration adding `status`, `last_login_at`, `onboarding_completed_at` to `users`.
3. **Model**: `User implements MustVerifyEmail`; add new casts.
4. **Backend classes**: `app/Queries/Auth/*`, `app/Handlers/Auth/*`, `app/Http/Requests/RegisterRequest.php` + `LoginRequest.php` + `ResetPasswordRequest.php` (flat, per convention), `app/Http/Controllers/Auth/AuthController.php`.
5. **Routes**: new `routes/api/auth.php` + orchestrator line in `routes/api.php`; the 6 new entries in `routes/web.php`.
6. **Frontend prerequisite**: install `react-router-dom`; wire a minimal router into `App.jsx` (currently a stub); confirm `main.jsx` mounts it.
7. **Frontend Gate 1 (static, hard-coded)**: scaffold the full `module/auth/` folder tree; build `AuthLayout`, `AuthBrandSidebar` (KPI illustration), `AuthCard`, `PasswordStrengthMeter`, and all 5 pages pixel-matched to the branding split-layout, with local minimal `Input`/`Button` and mock submit handlers (no live API calls yet).
8. **Frontend Gate 2 (live wiring)**: implement `api/auth.api.js` for real; close the axios `credentials`/CSRF gap (or confirm it's been closed by whatever owns the shared axios instance by this point); implement `hooks/useAuth.js` state + redirects; wire loading/error states and the edge cases in §6.
9. **QA pass**: exercise every row of the §6 edge-case table manually (expired reset link, expired verification link, disabled account, rate-limit 429, reduced-motion).

---

## 8. Out of Scope (Future Specs)

- **Onboarding wizard** (Welcome → Create/Join Business → Business Info → Industry → Size → Invite Team → Finish) and all multi-tenant Organization/RBAC/Invitation schema — `.agents/specs/scaleup/onboarding/onboarding.md`. This spec only reads `onboarding_completed_at` to decide where to redirect after auth; it does not design the wizard's own data model.
- **Design System components** (canonical `Input`/`Button`/`Card`/`Checkbox` this module's local primitives should eventually be swapped for) — `.agents/specs/scaleup/design/design_system.md`.
- **Global Layout** (the authenticated app shell — top nav, sidebar, org switcher — that a user lands in after auth/onboarding, plus the final route-aggregation strategy this spec's routes should eventually plug into) — `.agents/specs/scaleup/global/global_layout.md`.
- **OAuth/SSO (Google/Microsoft), Passkeys/WebAuthn, and 2FA/hardware security keys** remain explicit future extensions — not designed in this spec. Sanctum's stateful session model doesn't preclude adding them later as additional login methods feeding the same session.
- **Sanctum bearer-token mode** (`personal_access_tokens`) for a future native mobile app or third-party public API consumer — only the stateful cookie mode is in scope here.
- **Admin-facing account management** (force-disable a user, view login/lockout audit history) — a future Admin spec; this spec only adds the `status` column it needs, not an admin UI for it.
