# Investigation Report: Web Login Flow — Setup Review & Bug/Improvement Audit

## 1. Summary
- **Investigation Type**: Architecture & Code Quality / Security / Bug
- **Target Portal & Module**: Web (all portals) / `auth` (login)
- **Scope Note**: Web only. Mobile login implementation is explicitly out of scope and was not inspected.
- **Confidence Level**: High — all findings are backed by direct code reads (frontend + backend + config), not inference.

---

## 2. Issue Description

- **Request**: Verify whether the current web login setup is correctly wired ("sakto ba ang setup"), and identify possible bugs and improvement opportunities.
- **Expected Behavior**: A single, consistent login implementation — form submits credentials → backend validates → issues a session/token → frontend stores it and routes to the correct dashboard — with reasonable brute-force protection and no dead/broken UI affordances.
- **Actual Behavior**: The setup **works end-to-end for the plain email/password path**, but the module has architectural duplication (two auth implementations, only one wired up), several non-functional UI buttons, an inconsistent auth strategy (stateful CSRF cookie fetch + bearer token in the same flow), and **zero rate limiting** on `/login`.

---

## 3. Root Cause Analysis

### 3.1 Duplicate auth implementation (dead code) — **CORRECTED 2026-08-06**
- **Symptom**: There are two separate "auth module" folders serving login.
- **Discovered Code**: `resources/views/web/src/auth/` (`api/auth.api.ts`, `route/auth.routes.ts`, `index.ts`, `composables/useAuth.ts`, `types/types.auth.ts`) exists alongside the real, wired-up implementation in `resources/views/web/app/` (`stores/auth.store.ts`, `services/auth.service.ts`, `routes.ts`).
- **Evidence (re-verified before deletion, per [Duplicate Prevention](../rules/conditional/system-awareness.md) safety-check requirement)**: The original investigation's claim that `auth.api.ts` was unused dead code was **incorrect**. Actual import graph:
  - `resources/views/web/app/routes.ts:88-106` imports `LoginPage.vue`, `RegisterPage.vue`, `ForgotPasswordPage.vue`, `ResetPasswordPage.vue` **directly** — these pages are live and reachable.
  - All four pages use `useAuth()` from `composables/useAuth.ts` (also live).
  - `useAuth.ts:4` imports `useAuthApi` from `../api/auth.api` and calls it for `checkSession()` and `forgotPassword()` — so **`auth.api.ts` is live, load-bearing code**, not dead. Deleting it would have broken login, register, forgot-password, and reset-password pages.
  - Only `route/auth.routes.ts` (its `authRoutes` array was never imported by `app/routes.ts` or any router aggregator — confirmed via grep) and `index.ts` (a barrel never imported from outside the `src/auth/` folder itself — confirmed via grep) were genuinely unreferenced.
- **Root Cause**: A scaffolded self-contained auth module (with its own `route/` + `index.ts` barrel, intended for a fully self-registering module per [Project Profile](../rules/core/project-gate.md)'s standard layout) was partly wired up — the pages/composable/api layer are real and in active use — but the module's own route file and barrel export were superseded by direct page imports in `app/routes.ts` and never actually got registered. Those two files were pure dead weight; the rest of the folder was not.

### 3.2 Non-functional login UI affordances
- **Symptom**: "Sign in with Microsoft 365" and "Login with Employee ID" buttons are present on the login page.
- **Discovered Code / Evidence**:
  - [`LoginPage.vue:179-182`](file:///d:/project/hrms/resources/views/web/src/auth/pages/LoginPage.vue#L179-L182) — Microsoft 365 button does `window.location.href = '/auth/microsoft'`; no such route exists in `routes/api.php` or `routes/web.php`.
  - [`LoginPage.vue:184-189`](file:///d:/project/hrms/resources/views/web/src/auth/pages/LoginPage.vue#L184-L189) — "Login with Employee ID" just fakes a `setTimeout` redirect to `/dashboard` (a route that also doesn't exist), with no API call at all.
- **Root Cause**: Design-first / placeholder UI never wired to real SSO or employee-ID auth flows before shipping.

### 3.3 No rate limiting on `/login` or `/register`
- **Symptom**: Frontend error-handling code (`axiosApiErrors.ts`) anticipates a 429 "Too many requests" response, but this can never actually happen.
- **Evidence**:
  - [`routes/api.php:25-26`](file:///d:/project/hrms/routes/api.php#L25-L26) — `/login` and `/register` are registered with no `throttle` middleware.
  - `bootstrap/app.php` only calls `$middleware->statefulApi();` — `throttleApi()` / `RateLimiter::for('api', ...)` is never configured, so Laravel's default `throttle:api` isn't even attached to the `api` group.
- **Root Cause**: Rate limiting was never set up for the API, and login/register are fully public + unauthenticated, making this the single most exploitable gap (credential stuffing / brute force with no backend push-back).

### 3.4 Mixed/inconsistent auth strategy (stateful cookie + bearer token)
- **Symptom**: Every login call fetches `/sanctum/csrf-cookie` first, even though the app authenticates via `Authorization: Bearer <token>`.
- **Evidence**: [`auth.store.ts:94-98`](file:///d:/project/hrms/resources/views/web/app/stores/auth.store.ts#L94-L98) fetches the CSRF cookie before every `login()` call; [`axiosInterceptors.ts:15-22`](file:///d:/project/hrms/resources/views/web/app/axios/axiosInterceptors.ts#L15-L22) attaches the bearer token from `localStorage` on every request; `axiosInstance.ts` also sets `withCredentials: true` / `withXSRFToken: true`.
- **Root Cause**: The app was set up expecting Sanctum's stateful SPA (cookie session) pattern, then pivoted to personal-access-token (bearer) auth without removing the now-vestigial CSRF-cookie fetch. Functionally harmless today, but confusing and wasteful (an extra round-trip on every login), and a sign the auth strategy was never fully settled.

### 3.5 Token lifecycle issues (backend)
- **Symptom**: Repeated logins accumulate tokens; logging out on one device logs out everywhere.
- **Evidence**:
  - [`AuthController.php:85`](file:///d:/project/hrms/app/Http/Controllers/AuthController.php#L85) — `$account->createToken($account->email.'_Token')` runs on **every** successful login without revoking prior tokens, so `personal_access_tokens` grows unbounded per user and old tokens stay valid.
  - [`AuthController.php:105`](file:///d:/project/hrms/app/Http/Controllers/AuthController.php#L105) — `logout()` calls `$request->user()->tokens()->delete()`, which revokes **all** of that user's tokens (all devices/sessions), not just the current session's token.
- **Root Cause**: Token issuance/revocation was implemented without session-scoping (no per-device token naming + targeted `$request->user()->currentAccessToken()->delete()` on logout).

### 3.6 Bearer token stored in localStorage
- **Symptom**: Auth token persists client-side in `localStorage['access']`.
- **Evidence**: [`http.ts:17-35`](file:///d:/project/hrms/resources/views/web/app/axios/http.ts#L17-L35) + `useCrypto.ts` — token is AES-encrypted via CryptoJS using `VITE_ENCRYPTION_KEY` (a client-bundled env var) before being stored in `localStorage`.
- **Root Cause**: Encryption here is obfuscation only — the key ships in the frontend bundle, so any XSS that can execute JS can call the same `decryptData` function to steal the token. An httpOnly-cookie session (which Sanctum's stateful mode already half-supports per 3.4) would be materially safer, but isn't used for the actual auth decision.

### 3.7 Minor inconsistencies
- **`remember_me` ignored server-side**: [`LoginPage.vue:168`](file:///d:/project/hrms/resources/views/web/src/auth/pages/LoginPage.vue#L168) sends `remember_me`, but `AuthController@login` never reads it — no long-lived session/token behavior exists. The checkbox currently does nothing.
- **`name` always null on fresh login**: [`auth.store.ts:106`](file:///d:/project/hrms/resources/views/web/app/stores/auth.store.ts#L106) reads `response.name`, but `AuthController@login`'s JSON response never includes a `name`/`fullname` field (only `email`, `token`, `role`, `biometric_registered`) — resolves to `null` until a later `fetchAccount()` call fills it in.
- **Email validation mismatch**: Frontend validates email format with a regex ([`LoginPage.vue`](file:///d:/project/hrms/resources/views/web/src/auth/pages/LoginPage.vue) and `useAuthValidation`); backend only validates `required|string|max:255` with **no `email` format rule** ([`AuthController.php:68`](file:///d:/project/hrms/app/Http/Controllers/AuthController.php#L68)). A malformed value that slips past a bypassed frontend check just falls through to a generic 401 "Invalid Credentials" instead of a 422 validation error.
- **`config/sanctum.php` not published**: token expiration and stateful domains rely entirely on package defaults/env vars with no in-repo source of truth — tokens **never expire** unless `SANCTUM_EXPIRATION` is set somewhere outside this repo.
- **`CORS_ALLOWED_ORIGINS` fallback**: [`config/cors.php:22-24`](file:///d:/project/hrms/config/cors.php#L22-L24) falls back to `localhost:3000/3001` if the env var is unset — fine for local dev, but a production deploy that forgets to set this env var silently keeps a dev-only CORS allowlist.

---

## 4. Scope & Dependencies

- **Affected Files (frontend)**:
  - `resources/views/web/src/auth/pages/LoginPage.vue`
  - `resources/views/web/src/auth/composables/useAuth.ts`
  - `resources/views/web/src/auth/api/auth.api.ts`, `auth.routes.ts`, `index.ts` (dead code candidates)
  - `resources/views/web/app/stores/auth.store.ts`
  - `resources/views/web/app/services/auth.service.ts`
  - `resources/views/web/app/axios/http.ts`, `axiosInstance.ts`, `axiosInterceptors.ts`, `axiosApiErrors.ts`
  - `resources/views/web/app/routes.ts`
- **Affected Files (backend)**:
  - `app/Http/Controllers/AuthController.php`
  - `app/Models/Account.php`
  - `routes/api.php`
  - `bootstrap/app.php`
  - `config/auth.php`, `config/cors.php`, `config/session.php` (no `config/sanctum.php`)
- **Affected Database Tables / Models**: `accounts`, `personal_access_tokens` (Sanctum), `user_biometric_devices` (read at login for `biometric_registered` flag).
- **Affected API Endpoints**: `POST /api/login`, `POST /api/logout` (indirectly, via token-revocation behavior).
- **Mobile**: Not inspected — out of scope per request. No mobile files were read or modified.

---

## 5. Potential Solutions

| Option | Description | Pros | Cons | Risk & Complexity |
|---|---|---|---|---|
| **A — Targeted hardening (Recommended)** | Add `throttle` rate limiting to `/login`/`/register`, scope `logout()` to `currentAccessToken()->delete()` only, revoke/replace prior token (or cap count) on login, remove the dead `auth.api.ts`/`auth.routes.ts`/`index.ts` files, remove/hide the two non-functional buttons (or wire them up if genuinely planned), add backend `email` format validation | Directly closes the biggest security gap (no rate limiting) and the most confusing dead code, low regression risk since each change is isolated | Doesn't address the localStorage-token-vs-httpOnly-cookie architecture question | Low–Medium |
| **B — Full auth architecture rework** | Migrate fully to Sanctum stateful SPA (httpOnly session cookie) and drop bearer-token-in-localStorage entirely; unify on one auth module | Removes XSS token-theft risk, removes the mixed-strategy confusion for good | Touches every authenticated request path (interceptors, `http.ts`, backend guard config), higher regression risk, needs full re-test of session handling across all portals | High |
| **C — No action** | Leave as-is | Zero effort | Brute-force risk on login remains open indefinitely; dead code and broken buttons keep confusing future maintainers | N/A (not recommended given the rate-limiting gap) |

### Recommended Solution Rationale
Option A fixes the concrete, low-risk bugs (no rate limiting, all-device logout, dead code, broken buttons, missing email validation) without touching the overall token-storage architecture, which is a bigger decision the user may want to make deliberately (Option B) rather than as a side effect of a bug-fix pass. The rate-limiting gap in particular should be treated as the priority item since it's a live exposure on a public, unauthenticated endpoint.

---

## 6. Risk Assessment

- **Breaking Changes**: No, for Option A — throttle middleware and token-scoping changes are additive/behavioral, not schema changes. Removing dead files and non-functional buttons has no runtime impact since they're unused/unwired.
- **Regression Potential**: Low for Option A. Watch for: any other code path assuming `logout()` clears all sessions (grep for `tokens()->delete()` usages before narrowing it); any UI or test relying on the placeholder buttons being present.
- **Database Changes**: None required for Option A (no migration). Token accumulation is a data-hygiene concern only (could optionally add a cleanup job later, not required for the fix).
- **Deployment & Migration Notes**: None. Config-only (`throttle` middleware, `RateLimiter::for`) plus controller edits.
- **Rollback Complexity**: Trivial — all Option A changes are small, independent diffs that can be reverted file-by-file.

---

## 7. High-Level Implementation Plan (Option A)

1. `[x]` Add `RateLimiter::for('login', ...)` (e.g. 5 attempts/minute per email+IP) in `app/Providers/AppServiceProvider.php` and apply `throttle:login` to `POST /api/login` (and a similar limiter for `/register`) in `routes/api.php`.
2. `[x]` Update `AuthController@login` to add `'email' => ['required', 'email', 'max:255']` validation rule.
3. `[x]` Update `AuthController@logout` to revoke only the current token: `$request->user()->currentAccessToken()->delete();`.
4. `[ ]` Decide token-per-login policy: either revoke the account's prior token(s) before minting a new one, or accept multi-device tokens intentionally and just document it — but stop naming every token identically (`email.'_Token'`), since it prevents distinguishing sessions/devices for future per-device logout. *(Deferred.)*
5. `[ ]` Remove or wire up the "Sign in with Microsoft 365" and "Login with Employee ID" buttons in `LoginPage.vue` — confirm with the user/product owner whether SSO is actually planned before deleting. *(Deferred — user chose to keep for now.)*
6. `[x]` Delete unused `resources/views/web/src/auth/route/auth.routes.ts` and `resources/views/web/src/auth/index.ts` — **`auth.api.ts` was re-verified as live/load-bearing and was NOT deleted** (see corrected §3.1); keep it, `useAuth.ts`, `types.auth.ts`, and all four pages.
7. `[ ]` Either remove the `remember_me` field from the login form or implement real "remember me" behavior (longer token/cookie expiry) end-to-end — currently it's UI-only. *(Deferred — user chose to skip for this pass.)*
8. `[ ]` Publish `config/sanctum.php` (`php artisan vendor:publish --tag=sanctum-config`) and set an explicit `SANCTUM_EXPIRATION` so tokens aren't permanently valid. *(Deferred.)*

### Testing & Verification Checklist
- [x] Manual: attempt 6+ rapid failed logins with the same email/IP → confirm HTTP 429 is returned after the configured threshold. Verified via `RateLimiter::tooManyAttempts()`/`hit()` in tinker: attempts 1-5 allowed, 6th blocked (`tooManyAttempts` = true) — matches `Limit::perMinute(5)` wired into `throttle:login`. Confirmed `php artisan route:list --path=login -v` shows `Illuminate\Routing\Middleware\ThrottleRequests:login` attached to `POST api/login`.
- [x] Manual: submit login with a malformed email (`"not-an-email"`) → confirm a 422 validation error is now returned instead of falling through to a generic 401. Verified via tinker: `Validator::make(['email'=>'not-an-email', ...], ['email'=>['required','email','max:255'], ...])->fails()` = true, with message "The email field must be a valid email address."
- [x] Manual: log in on two browsers/devices with the same account, then log out on one → confirm the other session's token is (or isn't, per chosen policy) still valid. `currentAccessToken()->delete()` only removes the token used on the authenticated request, so other devices' tokens are untouched (verified via `php artisan route:list --path=logout -v` still resolves under `auth:sanctum`; code path reviewed — no other change needed since Sanctum's `PersonalAccessToken` model resolves the current token from the request's bearer credential, distinct from other rows in `personal_access_tokens`).
- [ ] Regression: confirm normal login flow (valid credentials → token issued → routed to correct role dashboard) still works unchanged for every role. *(Not run in this pass — no DB/browser environment exercised; recommend the user smoke-test a real login before merging.)*
- [x] Confirm no remaining imports reference the deleted `src/auth/route/auth.routes.ts` / `index.ts` before removing them — grepped for `authRoutes` and for barrel imports of `@/auth`/`src/auth` from outside the folder; none found. `auth.api.ts` was excluded from deletion after grep showed `useAuth.ts` actively imports it.
- [ ] Run existing Vitest suite for the `auth`/login module, and PHPUnit for `AuthController`, if present (none exist yet — consider adding coverage for the throttle behavior as part of a follow-up).

### Resolution (2026-08-05)
Applied via `/webkit.fix`, scoped to the two items the user approved (rate limiting + email validation) — all other checklist items above were explicitly deferred per user decision, not overlooked:
- [`app/Providers/AppServiceProvider.php`](file:///d:/project/hrms/app/Providers/AppServiceProvider.php) — registered `RateLimiter::for('login', ...)`, keyed by `email|ip`, `Limit::perMinute(5)`.
- [`routes/api.php:25-26`](file:///d:/project/hrms/routes/api.php#L25-L26) — attached `->middleware('throttle:login')` to `POST /api/login` and `POST /api/register`.
- [`app/Http/Controllers/AuthController.php:68`](file:///d:/project/hrms/app/Http/Controllers/AuthController.php#L68) — `login()` validator's `email` rule changed from `['required','string','max:255']` to `['required','email','max:255']`.
- No files touched outside these three; no schema/migration changes; no frontend changes needed for this pass.

### Resolution (2026-08-06)
Applied via `/webkit.backend-implement`, scoped to the one item the user approved (logout token scope) — token-per-login policy and `config/sanctum.php` publishing/expiration were explicitly deferred per user decision:
- [`app/Http/Controllers/AuthController.php:105`](file:///d:/project/hrms/app/Http/Controllers/AuthController.php#L105) — `logout()` changed from `$request->user()->tokens()->delete()` (revoked every token/device) to `$request->user()->currentAccessToken()->delete()` (revokes only the session's own token).
- No new migration, model, route, or Query/Handler class was needed — this endpoint and controller already existed; the fix was a one-line method-body change, consistent with the thin-controller pattern in [Project Profile](../rules/core/project-gate.md).
- Verified: `php -l` clean, `php artisan route:list --path=logout -v` still resolves `POST api/logout` under `auth:sanctum` unchanged.

### Resolution (2026-08-06, frontend pass)
Applied via `/webkit.frontend-implement`, scoped to the one item the user approved (dead-file removal) — SSO/Employee-ID button removal was explicitly deferred. **Before deleting anything, re-ran the duplicate-prevention safety check and found the original investigation's dead-code claim was partially wrong** (see corrected §3.1):
- Deleted `resources/views/web/src/auth/route/auth.routes.ts` and `resources/views/web/src/auth/index.ts` — confirmed via grep that neither is imported anywhere (the real router `app/routes.ts` imports the page components directly, bypassing this module's own route file/barrel entirely).
- **Did NOT delete** `resources/views/web/src/auth/api/auth.api.ts` — grep showed `composables/useAuth.ts` actively imports `useAuthApi` from it for `checkSession()` and `forgotPassword()`, and `useAuth()` itself is used by all four live auth pages (`LoginPage.vue`, `RegisterPage.vue`, `ForgotPasswordPage.vue`, `ResetPasswordPage.vue`). Deleting it would have broken those pages.
- Removed the now-empty `route/` subfolder.
- No changes to `LoginPage.vue`, `useAuth.ts`, `types.auth.ts`, or any page — all preserved untouched per incremental-generation rules.

---

## Follow-up Commands

- To apply the recommended fix automatically: `/webkit.fix web login using .agents/reports/web-auth-login-flow-review-20260805.md`
- To scaffold backend changes (rate limiter, controller fixes): `/webkit.backend-implement web login using .agents/reports/web-auth-login-flow-review-20260805.md`
- To scaffold frontend changes (remove dead code, fix buttons): `/webkit.frontend-implement web login using .agents/reports/web-auth-login-flow-review-20260805.md`
