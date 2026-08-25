# Spec — HRMS Chatbot (AI Copilot): Reliability, Trust & Failure Visibility

> **Kind:** **Extension / Hardening** — the chatbot already works end-to-end (Gemini + tool calling + RBAC + audit). This spec defines the deltas required to make it *trustworthy*: real failures must become **visible** instead of being masked by a fabricated reply, cross-user data access must be closed, the conversation context must actually follow the conversation, **the launcher must stop covering the page underneath it**, and **it must stop mounting on pages it cannot serve**. No new feature surface.
> **Portal:** **Global** — `/api/ai/*` (top-level, inside `auth:sanctum`), global Vue component `components/Chatbot/` mounted in `DashboardLayout.vue` for every portal.
> **Version:** v3 — 2026-08-25 — added Decision 12 (the chatbot should not mount on all 206 routes; portal-level `meta.chatbot` defaults + per-route override) plus AC-39…AC-45, and rewired §5.5's `showChatbot` from a path check to route meta.
> **Route:** `POST /api/ai/chat` · `POST /api/ai/agent-chat` · `GET|DELETE /api/ai/history/{session_id}` (all reused) · `POST /api/mcp/execute` (**to be removed** — Decision 5) · `POST /mcp/hrms` (reused, unchanged).
> **Conventions:** [project-profile.md](../../../../.claude/rules/project-profile.md), [hrms-rules.md](../../../../.claude/rules/hrms-rules.md), [duplicate-prevention.md](../../../../.claude/rules/duplicate-prevention.md), [security.md](../../../../.claude/rules/security.md), [vue-standards.md](../../../../.claude/rules/vue-standards.md).
> **System Awareness:** Models **none created** — reuses [`Account`](../../../../app/Models/Account.php), [`AccountDetailVW`](../../../../app/Models/AccountDetailVW.php), [`AccountLeave`](../../../../app/Models/AccountLeave.php), [`AppLeave`](../../../../app/Models/AppLeave.php). Tables **`ai_chat_sessions`, `ai_chat_messages`, `ai_audit_logs` (all reused)**. Routes **all reused; one deleted (`/api/mcp/execute`)**. **New migration: YES — two `alters/` migrations only** (`alters/ai_chat_messages/`, `alters/ai_audit_logs/`); no new table, no new model.

---

## 1. Purpose

The HRMS Chatbot ("HRMS Copilot") is the role-aware AI assistant embedded in every SubHRMS portal. An employee asks a question in plain language and the assistant answers from **live HRMS data** by calling a named, RBAC-checked tool — it is never supposed to answer HR questions from the model's own priors.

That guarantee is currently broken in a way the user cannot see, and three related classes of defect were confirmed by reading the code:

**A. Failures are invisible — the system fabricates an answer instead of reporting an error.**
[`useHRMSChatbot.sendMessage()`](../../../../resources/views/web/src/components/Chatbot/script/useHRMSChatbot.js#L290) catches *any* API failure into `console.warn` and then, after a 1.2-second fake "typing" delay, produces a role-appropriate reply built from **hardcoded mock constants**. A missing `GEMINI_API_KEY`, an exhausted quota, a 500, a dead network, an expired session — all of them render as a confident answer about the user's leave balance. There is no visual difference between a real answer and an invented one. Two backend paths reach the same fallback even on HTTP 200:

- **Tool-loop exhaustion:** [`AIService::chat()`](../../../../app/Services/AIService.php#L46) initialises `$aiResponseText = ''` and only assigns it inside the *no-function-call* branch. If the model requests a tool on all 5 permitted iterations, the loop exits by exhaustion, an **empty** AI message is persisted, and `text: ""` is returned. The frontend's `if (res.data && res.data.text)` treats `""` as falsy → mock reply.
- **No timeout:** `Http::post` to Gemini is called with no `->timeout()` or `->retry()` anywhere in the app. A hanging provider holds a PHP-FPM worker until the server's own limit kills it, then the request surfaces as a generic failure → mock reply.

**B. Any authenticated user can read, poison, and delete any other user's conversation.**
`user_id` is written when a session is created and **never checked again**. All four endpoints trust a caller-supplied `session_id`:

| Endpoint | Missing check | Consequence |
|---|---|---|
| `POST /api/ai/chat` | update path has no `where('user_id', …)` | Appends the attacker's message to a victim's session, and `loadSessionHistory()` feeds the **victim's prior turns** into the prompt — so the victim's payslip/leave conversation is returned to the attacker |
| `POST /api/ai/agent-chat` | same | same, via `HrmsCopilot::messages()` |
| `GET /api/ai/history/{id}` | no ownership check | Full transcript of any session by incrementing an integer |
| `DELETE /api/ai/history/{id}` | `where('id', $sessionId)->delete()` only | Deletes any user's conversation |

`ai_chat_messages.text` holds payslip figures, salary, and leave detail in plaintext, so this is an HR-data disclosure, not just a nuisance. Compounding it, [`/api/mcp/execute`](../../../../routes/api.php#L76) sits **outside** `auth:sanctum`, takes `user_id` from the request body, and its shared token has a working hardcoded default in [`config/ai.php`](../../../../config/ai.php) — so an unset `MCP_INTERNAL_TOKEN` yields a publicly-guessable key to execute any tool as any employee.

**C. The assistant's memory is stuck on the oldest turns, and half its answers are decoration.**
Both history readers ([`AIService:410`](../../../../app/Services/AIService.php#L406), [`HrmsCopilot:88`](../../../../app/Ai/Agents/HrmsCopilot.php)) use `orderBy('id','asc')->limit(15)` — the **oldest** 15 messages. Past turn 15 the model's context is frozen on the start of the conversation and never sees what was just said. Separately, `rich_data` only ever renders for the four `*.show_form` tools (only they return a `tool` key), and the cards that do render are largely built from `mock*` constants — `leave-balance` shows a hardcoded 12/8/5 regardless of the tool result.

**D. The launcher covers page controls and makes them unclickable.**
The floating launcher is not a compact icon button — [`HRMSChatbot.vue:5`](../../../../resources/views/web/src/components/Chatbot/HRMSChatbot.vue#L5) is `fixed bottom-6 right-6 z-999`, and its inner core wraps a `w-8 h-8` avatar **plus two text lines** ("HRMS Copilot" / "Active: {role}") at `px-4 py-3` — roughly **200 × 60 px** of permanently occluded screen at the bottom-right of every page except `/messages`. Three things compound it:

- **No gutter is reserved.** The scroll wrapper in [`DashboardLayout.vue:91`](../../../../resources/views/web/src/layout/DashboardLayout.vue#L91) (`<div class="flex flex-col min-h-full">`) has no bottom padding, so content scrolls underneath the launcher. [`Pagination.vue:15`](../../../../resources/views/web/src/components/Pagination.vue#L15) renders its `<nav>` right-aligned under `justify-between` with `w-9 h-9` (36 px) buttons — so on every paginated list the **last page buttons sit directly under the launcher and cannot be clicked**.
- **The hit area is larger than the button looks.** The two decorative rings (`absolute inset-0`, `absolute -inset-1.5 animate-ping`) and the unread badge (`-top-2 -right-2`) are **children of `<button>`**, so clicks on them still activate it — the dead zone extends ~6 px past the visible edge on all sides.
- **`z-999` outranks the whole app.** The real layer scale is sidebar `z-10`/`z-50`, navbar `z-20`, modals and dropdowns `z-50`/`z-[100]`/`z-[110]`. At `z-999` the launcher paints **over modals**, and the drawer's `z-1000` sits above them too — so a modal cannot cover the chat, which is backwards.

**E. It mounts on 205 of 206 routes, and can serve roughly 40 of them.**
The mount condition is a single hardcoded path comparison — `v-if="route.path !== '/messages'"` at [`DashboardLayout.vue:107`](../../../../resources/views/web/src/layout/DashboardLayout.vue#L107) — so the launcher is present everywhere except one route. Route counts per portal against the tool catalog (tool counts estimated from the catalog in [`.agents/docs/hrms-chatbot.md`](../../../docs/hrms-chatbot.md)):

| Portal record | Routes | Tools serving those pages | Character of the pages |
|---|---|---|---|
| payroll (`roles: [6]`) | **83** | 3 — `payroll.summary`, `payroll.payslip`, `payroll.run_status` | Mostly reference/maintenance tables (SSS · PhilHealth · BIR tables, transaction types, loan types, account classification) |
| hr (`roles: [4]`) | 46 | ~7 — `employee.profile/search`, `leave.*`, `incident.*`, `roster.view` | Mixed: masterfile + setup tables |
| timekeeping (`roles: [5]`) | 32 | ~7 — `attendance.*`, `roster.view/assign`, `leave.history` | Applications + attendance, good overlap |
| employee (`roles: [3]`) | 23 | ~15 — the bulk of the catalog is self-service | Self-service — highest coverage |
| manager (`roles: [2]`) | 12 | ~6 — approvals, team attendance, leave history | Approvals + team views |
| admin (`roles: [1, 7]`) | 10 | 1 — `audit.logs` | System configuration |

Payroll alone is **40% of the app's routes** and is served by three read tools. Two effects compound: Decision 8 deletes the ten fabricated rich cards, so the portals with the most pages (payroll 83, hr 46) end up with the *thinnest* real capability; and the proactive nudges in [`useHRMSChatbot.js:209`](../../../../resources/views/web/src/components/Chatbot/script/useHRMSChatbot.js#L209) fire on only four route substrings (`payslip`, `finalpay`, `roster`/`schedule`, `approval`), so on the rest the proactive value is zero by construction. Supporting evidence that payroll/TK coverage is thinner still: `McpToolPolicy` grants role 6 `finalpay.compute/checklist/summary` and role 5 `roster.generate` — **none of those tools exist** in either catalog.

**This spec's goal:** a user (and an admin) can always tell whether the assistant answered from real HRMS data, from nothing, or not at all; no user can reach another user's conversation; and the assistant never renders a page control unreachable. Explicitly **not** a goal: new tools, new portals, or a mobile chatbot.

---

## 2. Design Decisions (Pros & Cons)

### Decision 1: What replaces the silent mock fallback

The load-bearing decision. Everything else in section A depends on it.

**Option A — Delete the fallback; render an explicit, typed error state (Recommended)**
- `sendMessage()` stops catching-and-inventing. On failure it appends a message with `sender: 'ai'`, `type: 'error'`, carrying the normalized `ApiError` from [`axiosApiErrors`](../../../../resources/views/web/app/axios/axiosApiErrors.ts) (`{status, message, validation}`). The bubble renders in an error style with the reason and a **Retry** button that re-sends the same text. All `mock*` constants that exist only to feed the fallback are deleted.

| Pros | Cons |
|---|---|
| A wrong answer can no longer be mistaken for a right one — the entire point | The chatbot visibly stops working wherever `GEMINI_API_KEY` is unset (demo/staging environments included) |
| Users self-report real outages instead of quietly trusting invented HR data | Removes the "always looks alive" demo behaviour someone may be relying on |
| ~350 lines of dead mock branching leave the composable | Needs one new error bubble style + Retry handler |
| Retry handles the common transient case without a page reload | |

**Option B — Keep the fallback but gate it behind an explicit dev flag**
- Same error state in production; mock replies only when `import.meta.env.DEV` (or a `VITE_AI_MOCK=true` flag) is set, and every mock bubble is stamped with a visible **"SIMULATED"** badge.

| Pros | Cons |
|---|---|
| Frontend work continues with no API key and no backend running | Two code paths to keep in sync forever |
| The badge makes simulation unmistakable | A misconfigured build ships the fallback to production — the exact failure being fixed |
| Smallest diff | Mock constants (and their drift from the real contract) stay in the tree |

**Option C — Status quo**

| Pros | Cons |
|---|---|
| No work | Fabricated HR data presented as fact; the defect this spec exists to remove |

**Recommendation: Option A.** An HRMS assistant that invents leave balances and payslip figures is worse than one that is visibly down; a fabricated answer is un-auditable and indistinguishable from a real one. Keep Option B only if the team confirms an active demo dependency — in which case the `VITE_AI_MOCK` flag must default to `false` and the badge is non-negotiable.

### Decision 2: How failures get *found*, not just displayed

Surfacing an error to the one user who hit it is necessary but not sufficient — nobody is watching.

**Option A — Persist failed turns + an admin health panel over `ai_audit_logs` (Recommended)**
- Add `status` + `error_code` to `ai_chat_messages` (Decision 3), so a failed turn is a **row**, not a lost request. Add `duration_ms` + `engine` to `ai_audit_logs`. Expose `GET /api/admin/ai-health` (new `GetAiHealthQuery`) returning, for a date range: total turns, failure count by `error_code`, RBAC-denial count by tool and role, p95 `duration_ms`, and the last 20 failures. Surface it on the existing Admin dashboard, and make the existing `audit.logs` tool read the same query.

| Pros | Cons |
|---|---|
| Failures become countable and trendable — "it broke twice last week" is answerable | One new Query class + one new endpoint + one admin panel |
| Reuses tables that already exist; no new infra | Admin panel is UI work outside the chatbot itself |
| RBAC denials become visible — reveals both attacks and a too-tight policy | Retention/PII: failure rows hold the user's message text (mitigated in §6) |
| Gives the `audit.logs` tool something real to return instead of `mockAuditLogs` | |

**Option B — Log-only (`Log::error` + existing audit rows)**
| Pros | Cons |
|---|---|
| Nearly zero work — partly already there | Nobody reads `laravel.log`; failures stay effectively invisible |
| No schema change | Cannot answer "how often", "which tool", "which role" without grepping |

**Option C — External APM (Sentry/Telescope)**
| Pros | Cons |
|---|---|
| Best alerting, no bespoke UI | New dependency + infra approval; nothing comparable is installed today |
| | Sends HR conversation text to a third party — a privacy review this spec cannot pre-approve |

**Recommendation: Option A.** It is the only option that turns "find real failures" into data the team can query, and it does so entirely on tables and patterns that already exist. Option C is a good later addition, not a substitute.

### Decision 3: Where a turn's failure state lives

**Option A — Add `status` + `error_code` to `ai_chat_messages` (Recommended)**
- `status enum('ok','error','empty')` default `'ok'`, `error_code varchar(64) nullable`.

| Pros | Cons |
|---|---|
| A failed turn is durable and replayable; `GET /history` can render it | One `alters/` migration |
| Distinguishes *empty* (loop exhaustion) from *error* (provider failure) — different bugs, different fixes | Existing rows backfill to `'ok'`, which is correct for them |
| Enables the failure counts in Decision 2 with no extra table | |

**Option B — Infer failure from `text = ''`**
| Pros | Cons |
|---|---|
| No migration | Cannot tell "provider down" from "model legitimately returned nothing"; exactly the ambiguity that produced the current bug |

**Recommendation: Option A.** Two nullable/defaulted columns for an unambiguous failure signal is the cheapest possible fix for the highest-impact defect.

### Decision 4: How session ownership is enforced

**Option A — Ownership check in the controller on every session-addressed endpoint (Recommended)**
- One private `resolveOwnedSession(int $sessionId, Account $user): ?object` on `ChatbotController` used by `chat`, `agentChat`, `history`, and `clear`. Miss → `404` (not `403`, so session IDs can't be enumerated).

| Pros | Cons |
|---|---|
| Closes all four IDORs in one place | Must not be forgotten by a future fifth endpoint |
| `404` leaks nothing about which IDs exist | |
| Thin-controller convention preserved; no model needed | |

**Option B — Route-model binding + a Laravel Policy on an `AiChatSession` model**
| Pros | Cons |
|---|---|
| Idiomatic Laravel; enforcement can't be skipped per-endpoint | Requires a new model for tables currently accessed via `DB::table()` |
| | Larger diff across all four endpoints; policy indirection for a single `user_id` comparison |

**Recommendation: Option A** for this hardening pass — smallest change that closes a live HR-data leak. Option B is the better long-term shape and is listed in §8.

### Decision 5: What happens to `/api/mcp/execute`

**Option A — Delete the route; call the controller in-process only (Recommended)**
- `AIService::executeMcpTool()` already resolves `McpInternalController` from the container and fabricates a `Request` — the HTTP route is never needed by the app. Delete the route line and the `X-MCP-Token` check, and pass the resolved `Account` directly instead of `user_id` in a body.

| Pros | Cons |
|---|---|
| Removes an unauthenticated execute-as-any-user endpoint outright | Any undiscovered external caller breaks (grep shows none in-repo) |
| Kills the hardcoded-token-default problem at the root | |
| Removes the body-supplied `user_id` impersonation vector | |

**Option B — Move it inside `auth:sanctum` and require a non-default token**
| Pros | Cons |
|---|---|
| Keeps an HTTP entry point if something external does use it | Still an execute-as-any-user endpoint if the token leaks |
| Small diff | Keeps `user_id`-from-body impersonation unless separately fixed |

**Recommendation: Option A.** External MCP clients already have a properly-authenticated door (`POST /mcp/hrms`, `auth:sanctum`); this second one exists only as an internal-call artefact. Confirm with the team that no external integration calls it before deleting.

### Decision 6: How manager scope stops being a stub

[`validateOwnershipAndScope()`](../../../../app/Policies/McpToolPolicy.php) admits in a comment that a production system should verify the target `empid` reports to this manager, then returns `true` unconditionally for role 2.

**Option A — Reuse the `units.idhead` pattern via a new shared helper (Recommended)**
- The managed-units query is copy-pasted in **four** places ([`MyTeamController:44`](../../../../app/Http/Controllers/manager/MyTeamController.php#L44), [`GetDutyRosterQuery:32`](../../../../app/Queries/Shift/GetDutyRosterQuery.php#L32), [`GetManagementReportsQuery:17`](../../../../app/Queries/ManagementReports/GetManagementReportsQuery.php#L17), [`tk/DutyRosterController:51`](../../../../app/Http/Controllers/tk/DutyRosterController.php#L51)). Per [duplicate-prevention.md](../../../../.claude/rules/duplicate-prevention.md), extract `App\Queries\Team\GetManagedEmployeesQuery::managedUnitIds(int $userId): array` (+ `managesEmpid(int $userId, string $empid): bool`), point the policy at it, and refactor the four existing call sites to use it.

| Pros | Cons |
|---|---|
| Uses the app's real, already-proven definition of "my team" | Touches four files outside the chatbot (mechanical, no behaviour change) |
| Removes a 5th copy-paste instead of adding one | A manager whose unit lacks `idhead` loses access — surfaces existing data gaps as denials |
| One definition of team scope for policy and reports alike | |

**Option B — Chatbot-local team check inside the policy**
| Pros | Cons |
|---|---|
| Diff confined to one file | A 5th copy of the query, guaranteed to drift — the exact anti-pattern the rules name |

**Option C — Leave open, document it**
| Pros | Cons |
|---|---|
| No work | A manager can read any employee's attendance and leave history by passing an `empid` |

**Recommendation: Option A.** This is also the reuse the project rules explicitly demand. Note the **business question for the user**: should a manager's scope be *their units only* (Option A as written) or *their units plus all descendant units* via `units.idunder`? The recursive walk exists in [`OrgStructureController`](../../../../app/Http/Controllers/hr/OrgStructureController.php); the four current call sites use direct units only, so this spec follows them. Confirm before implementing.

### Decision 7: The `rich_data` contract

Today the frontend reads `rich_data.tool` as the card type, but only the four `*.show_form` cases return a `tool` key, and the three migrated MCP tools don't populate `rich_data` at all (`AIService` reads `$toolResult['result']`, which their unwrapped shape lacks).

**Option A — Normalize one envelope at the boundary (Recommended)**
- Every tool result becomes `{'tool' => '<card-type>|null', 'result' => <payload>}`, normalized in `AIService` for **both** execution paths so tool classes stay unaware of UI card names. Cards with no real payload are deleted (Decision 8).

| Pros | Cons |
|---|---|
| One contract for both paths; the MCP-vs-legacy split stops leaking into the UI | Card-name mapping lives in `AIService` — a UI concern in a service |
| Fixes rich cards for migrated tools without touching tool classes | Needs a `tool → card` map kept current as tools migrate |
| Frontend logic is unchanged | |

**Option B — Frontend maps tool name → card type**
| Pros | Cons |
|---|---|
| Backend stays purely about data; card naming lives with the cards | Requires the executed tool name in the response (a new field) |
| | Two places to update when a card is added |

**Recommendation: Option A** — smaller diff, no response-shape change, and it removes a user-visible inconsistency immediately. Revisit if the card set grows substantially.

### Decision 8: The mock rich cards

Ten cards (`approval-list`, `team-attendance`, `employee-lookup`, `incident-management`, `logs-adjustment`, `roster-validation`, `payroll-run`, `contributions-review`, `admin-permissions`, `audit-logs`) plus `leave-balance` render `mock*` constants even on the success path.

**Option A — Delete unwired cards now; wire them per-tool later (Recommended)**
- Wire `leave-balance` to the real `leave.balance` result (its tool exists and works). Delete the ten cards with no wired tool result; those answers render as the model's plain-text summary, which is real data.

| Pros | Cons |
|---|---|
| Nothing on screen is fabricated once shipped | Manager/HR/TK/payroll chats visibly lose their pretty cards |
| Large reduction in dead template code | Feels like a regression to anyone who saw the mock cards as built |
| Plain-text answers are still real tool output | |

**Option B — Wire all eleven cards in this pass**
| Pros | Cons |
|---|---|
| Best end state; nothing lost | Much larger scope — each needs a verified tool payload shape and per-role testing; several tools return shapes no card can render yet |
| | Delays the security and failure-visibility fixes behind UI work |

**Option C — Keep them, badge them "sample data"**
| Pros | Cons |
|---|---|
| No deletion, honest labelling | Ships knowingly fake HR figures inside a real answer; label will be missed |

**Recommendation: Option A.** It matches Decision 1's principle — remove fabrication rather than dress it up — and keeps this pass shippable. Wiring each card is a per-tool follow-up (§8).

### Decision 9: Gemini call resilience

**Option A — Bounded synchronous call: timeout + retry + explicit exhaustion error (Recommended)**
- `Http::timeout(30)->connectTimeout(5)->retry(2, 500, throw: false)` on the Gemini call. On tool-loop exhaustion, return an explicit `error_code = 'tool_loop_exhausted'` with a plain-language message instead of `text: ''`.

| Pros | Cons |
|---|---|
| Fixes the empty-text→mock path and the unbounded-hang path directly | Long legitimate generations could hit 30s (no streaming today, so a full answer already waits) |
| No new infra; matches the existing synchronous request/response contract | Retries cost tokens on a genuinely failing provider (capped at 2) |
| `duration_ms` in the audit log makes slow calls visible (Decision 2) | |

**Option B — Queue the call and poll**
| Pros | Cons |
|---|---|
| No worker held during generation; survives long runs | `QUEUE_CONNECTION=database` is configured but `app/Jobs/` doesn't exist — greenfield infra + a worker to operate |
| | Frontend becomes polling/websocket; far beyond a hardening pass |

**Option C — Stream (SSE)**
| Pros | Cons |
|---|---|
| Best perceived latency | Largest change to both ends; tool-calling loop + streaming is a redesign |

**Recommendation: Option A.** Options B and C are worthwhile once the assistant is trustworthy; neither is a reliability fix.

### Decision 10: The two engines

`POST /api/ai/agent-chat` ([`HrmsCopilot`](../../../../app/Ai/Agents/HrmsCopilot.php), Laravel AI SDK) is called by no frontend, exposes only the 3 migrated tools, and duplicates history-loading and session handling.

**Option A — Keep the pilot, apply the same fixes to both (Recommended)**
- The ownership check, history window fix, timeout, and failure persistence are applied to both paths. The pilot stays reachable for evaluating the SDK migration.

| Pros | Cons |
|---|---|
| Preserves the migration path off the hand-rolled loop | Every fix must be made twice until the migration completes |
| The endpoint is already authenticated and audited; leaving it *unfixed* would keep an IDOR alive | Two code paths remain |

**Option B — Delete `agent-chat` until the tool migration is ready**
| Pros | Cons |
|---|---|
| One path to fix and reason about | Discards a working SDK integration and its evaluation value |
| Removes an unused, IDOR-carrying endpoint | Rebuilding it later costs more than fixing it now |

**Recommendation: Option A**, with a hard condition: the pilot gets the **same** ownership and failure-handling fixes. An unused endpoint is still an exploitable one. If the team has no near-term plan to finish the MCP migration, Option B is the honest choice — this is a roadmap call for the user.

### Decision 11: How the launcher stops blocking page controls

Failure class **D**. Note that **shrinking the launcher alone does not fix it** — even a 56 px circle still covers a 36 px pagination button at the same corner. The gutter is the load-bearing half.

**Option A — Reserve a layout gutter + icon-only launcher + corrected z-index (Recommended)**
- Three coordinated changes: (1) bottom padding on the `DashboardLayout` scroll wrapper, bound to whether the chatbot is mounted, so no page content can ever end underneath it; (2) drop the two text labels so the launcher becomes a ~56 px circle, and mark the decorative rings/badge `pointer-events-none` so the hit area equals the visible circle; (3) move the launcher to `z-30` and the drawer to `z-[60]`, inside the app's existing scale.

| Pros | Cons |
|---|---|
| Pagination, footer, and page content become reachable on **every** page at once — one layout change, no per-page work | Adds ~80–96 px of empty space below the footer on every portal page |
| Modals (`z-[100]`+) can finally cover the chat, which is the correct stacking | The removed "HRMS Copilot / Active: {role}" labels reduce at-a-glance discoverability |
| Occluded area drops ~200 × 60 px → ~56 × 56 px, and the phantom 6 px hit ring disappears | Does not fully clear `sticky bottom-0` table bars (see §6.2 and §8) |
| The labels are redundant — the drawer header already shows "HRMS Copilot" and the portal badge | |

**Option B — Move the launcher into the navbar; delete the floating element**
- The chat opens from an icon button in [`NavbarLayout.vue`](../../../../resources/views/web/src/layout/NavbarLayout.vue) (`z-20`); nothing floats over the content area at all.

| Pros | Cons |
|---|---|
| Structurally impossible to occlude content — no gutter needed, and `sticky bottom-0` bars are clear too | Loses the persistent, always-visible affordance a FAB provides |
| Removes the launcher from the stacking-order problem entirely | Larger diff: new navbar slot, and the launcher's role avatar/badge must be redesigned to navbar scale |
| No wasted vertical space | Discoverability drops — a navbar icon competes with existing navbar actions |

**Option C — Auto-hide the launcher on scroll-down, restore on scroll-up**
| Pros | Cons |
|---|---|
| Keeps the FAB and its full label; no layout change | The control is missing exactly when the user reaches the bottom of a list — where pagination is |
| Familiar mobile pattern | Scroll listeners on the SimpleBar container; a stateful animation to maintain and test |
| | Timing-dependent: a fast scroll can still leave it covering the target |

**Recommendation: Option A.** It fixes the reported symptom everywhere in one layout change, corrects the stacking bug as a side effect, and keeps the FAB affordance the design relies on. Option B is the strictly more robust end state and is the right call **if** the team is willing to give up the floating launcher — that is a design decision for the user, not a technical default. Option C treats the symptom and fails at the one scroll position that matters.

### Decision 12: Which pages the chatbot mounts on

Failure class **E**. The enabling fact: [`routes.ts:111-159`](../../../../resources/views/web/app/routes.ts#L111-L159) nests every portal under its own parent record already carrying `meta: { roles: [...], portal: "..." }`, and Vue Router merges parent `meta` into `route.meta` for all descendants. So a portal-wide default costs **one line per portal**, and the portal record *is already the role boundary* — which maps 1:1 onto `McpToolPolicy`, since tool permissions are keyed by the same role IDs.

**Option A — Portal-level default via parent `meta`, with per-route override (Recommended)**
- Add `chatbot: true|false` to the six portal records in `routes.ts`; individual routes override with their own `meta.chatbot`. `showChatbot` reads the merged `route.meta.chatbot`.

| Pros | Cons |
|---|---|
| ~6 lines for portal-wide behaviour + a handful of overrides — the cheapest mechanism by an order of magnitude | Two places to look (portal record, then route) when reasoning about one page |
| The flag lands on the record that already defines the role, and tool permissions are role-keyed — the grain matches | Portal-level granularity is coarse: an "on" portal still mounts on its own setup pages |
| Replaces the hardcoded `/messages` path check with the same mechanism | Requires knowing Vue Router merges parent meta — non-obvious to a reader who doesn't |
| A new page inherits its portal's default, so nothing silently regresses | |

**Option B — Flat per-route opt-in (`meta: { chatbot: true }` on each qualifying route)**
| Pros | Cons |
|---|---|
| Explicit at every call site; no inheritance to reason about | ~40 route records to edit across 68 route files, and it grows with the app |
| Finest possible granularity | A new page defaults to *off* and silently lacks the assistant until someone notices |

**Option C — Opt-out (`meta: { hideChatbot: true }` on pages that must not show it)**
| Pros | Cons |
|---|---|
| Mirrors the `hideFooter` / `hideSidebar` / `lockViewport` flags already on `/messages` | Requires marking ~165 routes — 4× the work of Option B for the same outcome |
| Nothing regresses by omission | Default-on is the wrong default: an unmarked new page gets an assistant that can't help it *and* covers its controls |
| | The convention is barely used — `hideFooter` is read in two places and set on exactly one route out of 206 |

**Option D — Status quo (mount on all 206 routes)**
| Pros | Cons |
|---|---|
| Maximum discoverability; zero work | ~165 routes pay the occlusion cost (Decision 11) for no capability |
| One code path | Users learn the assistant is useless on the pages they spend most time in — payroll is 40% of routes and has 3 tools |

**Recommendation: Option A.** It is the cheapest by a wide margin, and the flag sits on the record that already carries the role — the same key `McpToolPolicy` uses to decide what the assistant can do. Option C is the pattern the codebase gestures at, but at 4× the edits for a worse default.

**Proposed defaults** — the *values* are a product call, not a technical one; the team should confirm before implementing:

| Portal record | Default | Rationale |
|---|---|---|
| employee (`roles: [3]`) | `chatbot: true` | 23 routes, ~15 tools — the catalog is built for this portal |
| manager (`roles: [2]`) | `chatbot: true` | 12 routes, approvals + team attendance are covered |
| timekeeping (`roles: [5]`) | `chatbot: true` | **The one genuine judgment call** — 32 routes, ~7 tools; good overlap on applications/attendance, thin on setup pages. Recommend on, but this is the row most worth debating |
| hr (`roles: [4]`) | `chatbot: false` | 46 routes, ~7 tools — override on for employee profile/search and incident pages |
| payroll (`roles: [6]`) | `chatbot: false` | 83 routes, 3 tools — override on for payslip and run-status pages |
| admin (`roles: [1, 7]`) | `chatbot: false` | 10 routes, 1 tool — override on for the audit-log page |
| `/messages` (direct child) | *(no flag)* | Absent by default — retires the hardcoded path check |

Roughly **65–75 of 206 routes** mount the launcher, versus 205 today. Every route matched by the four contextual-nudge substrings must fall on the "on" side, or that feature dies silently (AC-44).

---

## 2.5 Acceptance Criteria

| # | Given | When | Then |
|---|-------|------|------|
| **AC-1** | `GEMINI_API_KEY` is unset | Employee sends "what's my leave balance?" | `503` with `{"session_id": <id>, "error_code": "provider_unconfigured", "message": "The AI assistant is not configured. Contact your administrator."}`; the chat shows an **error bubble** with that message and a Retry button; **no** leave figures of any kind appear |
| **AC-2** | `GEMINI_API_KEY` is unset | The turn from AC-1 completes | An `ai_chat_messages` row exists with `sender='ai'`, `status='error'`, `error_code='provider_unconfigured'`, `text=''` |
| **AC-3** | Gemini returns HTTP 500 on all 3 attempts (1 + 2 retries) | Employee sends any message | `502` with `error_code='provider_error'`; error bubble shown; `ai_audit_logs` has no new row (no tool ran); `ai_chat_messages` has one `status='error'` row |
| **AC-4** | Gemini does not respond within 30s | Employee sends any message | Request returns within ~35s with `504` and `error_code='provider_timeout'`; no PHP-FPM worker is held past that |
| **AC-5** | The model requests a tool on all 5 permitted loop iterations | Employee sends any message | `502` with `error_code='tool_loop_exhausted'` and a plain-language message; the AI row is `status='empty'`; **the frontend never renders a mock reply** (regression test for the `text: ""` path) |
| **AC-6** | Any API failure occurs (AC-1 … AC-5) | The error bubble is shown | No `mock*` constant is present in the rendered DOM; `grep -c "mockLeaveBalances\|mockApprovals\|mockEmployees\|mockIncidents\|mockAnomalies\|mockPermissions\|mockAuditLogs\|mockChartData\|mockPolicies\|mockRoster" HRMSChatbot.vue useHRMSChatbot.js` returns `0` |
| **AC-7** | An error bubble is displayed | User clicks **Retry** | The same message text is re-sent to `POST /api/ai/chat` with the same `session_id`; no duplicate user message is appended to the transcript |
| **AC-8** | Employee A owns session `101`; Employee B is authenticated | B sends `POST /api/ai/chat` with `session_id=101` | `404` with `{"message":"Session not found."}`; session `101` is unmodified (`updated_at` unchanged); no message row is added to `101`; **none of A's prior turns reach the model or B's response** |
| **AC-9** | Employee A owns session `101` | B calls `GET /api/ai/history/101` | `404`; none of A's message text is returned |
| **AC-10** | Employee A owns session `101` | B calls `DELETE /api/ai/history/101` | `404`; session `101` and its messages still exist |
| **AC-11** | Employee A owns session `101` | A calls `GET /api/ai/history/101` | `200` with A's full transcript, each message carrying `status` and `error_code` |
| **AC-12** | Employee B is authenticated | B sends `POST /api/ai/agent-chat` with A's `session_id=101` | `404`; identical guarantees to AC-8 (the pilot endpoint is fixed too) |
| **AC-13** | A session has 40 messages (ids 1…40) | A new turn is sent | The Gemini payload contains messages **26–40** (newest 15, chronological), and **not** 1–15 |
| **AC-14** | Role 3 (Employee) `EMP001` is authenticated | The model calls `leave.balance` with `empid='EMP002'` | Tool returns a permission error; `ai_audit_logs` row has `authorized=false`, `status='failed'`, `error_message` naming `leave.balance`; no `EMP002` figure reaches the reply |
| **AC-15** | Role 2 (Manager) heads unit `5`; `EMP009` is in unit `9` (not headed by them) | The model calls `attendance.logs` with `empid='EMP009'` | Tool returns a permission error; `ai_audit_logs` row `authorized=false`, `status='failed'` (regression test for the returns-`true` stub) |
| **AC-16** | Role 2 (Manager) heads unit `5`; `EMP005` is in unit `5` | The model calls `attendance.logs` with `empid='EMP005'` | `200`; audit row `authorized=true`, `status='success'`; logs for `EMP005` are returned |
| **AC-17** | Role 2 (Manager) heads **no** unit (`units.idhead` matches no row) | The model calls `attendance.logs` with any `empid` | Permission error, audit `authorized=false` — no implicit all-employee access |
| **AC-18** | Any role, any tool | The tool executes successfully | `ai_audit_logs` row has `status='success'`, a non-null `duration_ms`, and `engine` set to `'gemini-loop'` or `'laravel-ai-sdk'` |
| **AC-19** | Admin (role 1 or 7) is authenticated | `GET /api/admin/ai-health?start=2026-08-01&end=2026-08-25` | `200` with keys `total_turns`, `failures_by_code`, `denials_by_tool`, `p95_duration_ms`, `recent_failures` (max 20) |
| **AC-20** | Role 3 (Employee) is authenticated | `GET /api/admin/ai-health` | `403` with `{"message":"You do not have permission to perform this action."}` |
| **AC-21** | The route file is deployed | `POST /api/mcp/execute` is called with a valid `X-MCP-Token` and any `user_id` | `404` — the route no longer exists (Decision 5, Option A) |
| **AC-22** | Employee asks "apply for overtime" | The model responds | It calls `overtime.show_form` (not `overtime.apply`); the response carries `rich_data = {"tool":"overtime-form","result":null}`; the in-chat form renders; **no** `app_overtime` row is created until the user submits |
| **AC-23** | Employee asks "what's my leave balance?" and `AccountLeave` holds VL 11.5 / SL 3 | The model calls `leave.balance` | The `leave-balance` card displays **11.5** and **3** — the values from the tool result, not `12`/`8` |
| **AC-24** | A migrated MCP tool (`employee.profile`) executes | The response is returned | `rich_data` is a `{tool, result}` envelope (not `null`) — same shape as legacy tools |
| **AC-25** | User double-clicks **Send** on one message | Both clicks register | Exactly one `POST /api/ai/chat` is issued; the input and Send button are disabled while `isLoading` is true; exactly one user row and one AI row are persisted |
| **AC-26** | A `POST /api/ai/chat` succeeds but the response is lost in transit and the client retries the identical body | The retry arrives | A second user + AI message pair **is** created (the endpoint is intentionally non-idempotent); no tool with side effects is re-executed, because write tools are unreachable per AC-22 |
| **AC-27** | `message` is `""` or absent | `POST /api/ai/chat` | `422` with `{"errors":{"message":["The message field is required."]}}` |
| **AC-28** | `message` is 20,001 characters | `POST /api/ai/chat` | `422` with `{"errors":{"message":["The message field must not be greater than 20000 characters."]}}`; no Gemini call is made |
| **AC-29** | `session_id` is `"abc"` (non-integer) | `POST /api/ai/chat` | `422` with a `session_id` validation error; no session is created |
| **AC-30** | `portal`/`page`/`active_record_id` are absent | `POST /api/ai/chat` | `200`; the session records the defaults `'Employee Portal'` / `'Dashboard'` / `null` |
| **AC-31** | An unauthenticated client | `POST /api/ai/chat` | `401`; no `ai_chat_sessions` row is created |
| **AC-32** | Any paginated list page (e.g. HR → Employees) scrolled fully to the bottom, chatbot **closed** | The rightmost pagination control (last-page `»` button) is clicked at its centre point | The click reaches the pagination button — the page advances; the chat drawer does **not** open |
| **AC-33** | Any portal page with the chatbot mounted | The page is rendered | The scroll wrapper carries bottom padding ≥ the launcher's occupied height + offset (≥ 80 px), so the last row of page content and the footer both sit fully above the launcher |
| **AC-34** | Route is `/messages` (chatbot not mounted) | The page is rendered | **No** bottom gutter is applied — no empty strip below the footer |
| **AC-35** | Chatbot closed; unread badge visible | A click lands 10 px outside the visible circle of the launcher (over the `animate-ping` ring's former area) | Nothing happens — the drawer does not open; the decorative rings and badge are `pointer-events-none` |
| **AC-36** | Any modal in the app is open (e.g. a `z-[100]` or `z-[110]` dialog) | The modal overlaps the bottom-right corner | The **modal** renders above the launcher; the launcher is not visible through or over it |
| **AC-37** | The chat drawer is open at full height, mobile viewport (`< sm`) | The mobile sidebar (`z-50`) is also triggered | The drawer (`z-[60]`) renders above the sidebar, and any modal (`z-[100]`+) still renders above the drawer |
| **AC-38** | Chatbot closed | The launcher is measured in the browser | Its rendered box is ≤ 64 × 64 px (icon-only; no "HRMS Copilot" / "Active: {role}" text nodes in the launcher's DOM subtree) |
| **AC-39** | A route whose merged `route.meta.chatbot` is absent or `false` (e.g. payroll → SSS Contribution Table) | The page is rendered | The launcher is **absent from the DOM** (not merely hidden), and no bottom gutter is applied — the footer sits at the bottom with no empty strip |
| **AC-40** | A route inside a portal record carrying `meta: { chatbot: true }` (e.g. employee → Payslips) | The page is rendered | The launcher renders and the gutter is applied — inherited from the parent record, with no `chatbot` key on the route's own `meta` |
| **AC-41** | A route inside a `chatbot: true` portal that sets its own `meta: { chatbot: false }` | The page is rendered | The launcher is absent — the child override beats the inherited parent value |
| **AC-42** | Route `/messages` | The page is rendered | The launcher is absent; `grep -c "route.path !== '/messages'" DashboardLayout.vue` returns `0` — exclusion now comes from the absent meta flag, not a path comparison |
| **AC-43** | An authenticated role-6 (Payroll) user | They navigate across all payroll routes | The launcher appears only on the routes explicitly overridden to `chatbot: true` (payslip, run status); it is absent on every reference/maintenance table |
| **AC-44** | The four contextual-nudge substrings (`payslip`, `finalpay`, `roster`/`schedule`, `approval`) | Each matching route is visited | Every one resolves to a route where the launcher is mounted, so the proactive nudge still fires and increments the unread badge |
| **AC-45** | User is on a `chatbot: true` route with the drawer **open** | They navigate to a `chatbot: false` route | The launcher and drawer unmount and the gutter is removed in the same navigation — no orphaned padding and no drawer left floating over the new page |

---

## 3. Database

No new tables and no new models. Three tables reused as-is from [`2026_06_25_102600_create_ai_tables.php`](../../../../database/migrations/2026_06_25_102600_create_ai_tables.php); two `alters/` migrations add columns.

**`ai_chat_messages`** — new migration `database/migrations/alters/ai_chat_messages/2026_08_25_000001_add_status_to_ai_chat_messages.php`

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `status` | `enum('ok','error','empty')` | no | `'ok'` | **NEW** — Decision 3. Existing rows backfill to `ok` |
| `error_code` | `varchar(64)` | yes | `null` | **NEW** — `provider_unconfigured` · `provider_error` · `provider_timeout` · `tool_loop_exhausted` |
| *(index)* | `(session_id, id)` | — | — | **NEW** — serves the newest-15 window (AC-13) and history reads |
| `id`, `session_id`, `sender`, `text`, `tool_calls`, `rich_data`, `created_at`, `updated_at` | — | — | — | reused, unchanged. `tool_calls` stays unwritten (§8) |

**`ai_audit_logs`** — new migration `database/migrations/alters/ai_audit_logs/2026_08_25_000002_add_metrics_to_ai_audit_logs.php`

| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| `duration_ms` | `unsignedInteger` | yes | `null` | **NEW** — tool wall-clock, for p95 (AC-18, AC-19) |
| `engine` | `varchar(32)` | yes | `null` | **NEW** — `gemini-loop` \| `laravel-ai-sdk` \| `mcp-endpoint` |
| *(index)* | `(created_at)`, `(tool_name, authorized)` | — | — | **NEW** — serves the health query's date-range and denial aggregates |
| `id`, `user_id`, `tool_name`, `arguments`, `authorized`, `status`, `error_message`, timestamps | — | — | — | reused, unchanged |

**`ai_chat_sessions`** — unchanged. `user_id` already exists; this spec only starts *reading* it (Decision 4).

> [!NOTE]
> These three tables carry real FK constraints (`constrained('accounts')`), against the SubHRMS zero-DB-FK convention. They already shipped that way; **the alters must not add more FKs** — index only, per [project-profile.md](../../../../.claude/rules/project-profile.md).

**Seed rows:** none.

---

## 4. Backend

### 4.1 Files changed

| File | Change |
|---|---|
[`app/Http/Controllers/AI/ChatbotController.php`](../../../../app/Http/Controllers/AI/ChatbotController.php) | Ownership resolution on all 4 endpoints; validation bounds; typed error responses |
[`app/Services/AIService.php`](../../../../app/Services/AIService.php) | Newest-15 history window; Gemini timeout/retry; loop-exhaustion error; `rich_data` envelope; failure persistence; `duration_ms`/`engine` |
[`app/Ai/Agents/HrmsCopilot.php`](../../../../app/Ai/Agents/HrmsCopilot.php) | Newest-15 history window (`messages()`) |
[`app/Mcp/Tools/HrmsTool.php`](../../../../app/Mcp/Tools/HrmsTool.php) | Record `duration_ms` + `engine` on the audit row |
[`app/Policies/McpToolPolicy.php`](../../../../app/Policies/McpToolPolicy.php) | Real manager scope via the new team query |
[`routes/api.php`](../../../../routes/api.php) | **Delete** `POST /api/mcp/execute` (Decision 5); register `GET /api/admin/ai-health` in `routes/api/admin.php` |
[`app/Http/Controllers/AI/McpInternalController.php`](../../../../app/Http/Controllers/AI/McpInternalController.php) | Drop the `X-MCP-Token` / `user_id`-from-body path; accept a resolved `Account` for in-process calls |

### 4.2 New classes

**`App\Queries\Team\GetManagedEmployeesQuery`** *(new — Decision 6, and the de-duplication of 4 existing copies)*
```
public static function managedUnitIds(int $userId): array      // units.idhead = $userId AND status = 1 → ids
public static function managesEmpid(int $userId, string $empid): bool
public static function execute(int $userId, array $params = []) // AccountDetailVW scoped to managed units
```
Then refactor [`MyTeamController:44`](../../../../app/Http/Controllers/manager/MyTeamController.php#L44), [`GetDutyRosterQuery:32`](../../../../app/Queries/Shift/GetDutyRosterQuery.php#L32), [`GetManagementReportsQuery:17`](../../../../app/Queries/ManagementReports/GetManagementReportsQuery.php#L17), and [`tk/DutyRosterController:51`](../../../../app/Http/Controllers/tk/DutyRosterController.php#L51) onto `managedUnitIds()` — behaviour-preserving.

**`App\Queries\Ai\GetAiHealthQuery`** *(new — Decision 2)* — `execute(array $params): array` aggregating `ai_audit_logs` + `ai_chat_messages` over a date range into `total_turns`, `failures_by_code`, `denials_by_tool`, `p95_duration_ms`, `recent_failures`. Also becomes the source for the `audit.logs` tool, replacing `mockAuditLogs`.

### 4.3 Session ownership (Decision 4)

```php
// ChatbotController — used by chat(), agentChat(), history(), clear()
private function resolveOwnedSession(?int $sessionId, Account $user): ?object
{
    if (! $sessionId) return null;
    return DB::table('ai_chat_sessions')
        ->where('id', $sessionId)
        ->where('user_id', $user->id)   // the check that is missing today
        ->first();
}
```
A supplied-but-unowned (or non-existent) `session_id` → `404 {"message":"Session not found."}` on all four endpoints. A **absent** `session_id` on `chat`/`agentChat` still creates a new session, as today.

### 4.4 Route registration

```php
// routes/api.php — inside the existing auth:sanctum group, unchanged block
Route::prefix('ai')->group(function () {
    Route::post('/chat',                [ChatbotController::class, 'chat']);
    Route::post('/agent-chat',          [ChatbotController::class, 'agentChat']);
    Route::get('/history/{session_id}', [ChatbotController::class, 'history']);
    Route::delete('/history/{session_id}', [ChatbotController::class, 'clear']);
});

// routes/api.php — DELETE this line entirely (Decision 5)
- Route::post('/mcp/execute', [McpInternalController::class, 'execute']);

// routes/api/admin.php — new (inherits the /api/admin prefix + auth:sanctum)
Route::get('/ai-health', [AiHealthController::class, 'index']);   // roles 1, 7 only
```

### 4.5 Response contract

```
200  { "session_id": 12, "text": "...", "rich_data": {"tool":"leave-balance","result":{...}}|null }
422  { "errors": { "message": ["The message field is required."] } }
401  { "message": "Unauthenticated." }
403  { "message": "You do not have permission to perform this action." }
404  { "message": "Session not found." }
502  { "session_id": 12, "error_code": "provider_error|tool_loop_exhausted", "message": "<plain language>" }
503  { "session_id": 12, "error_code": "provider_unconfigured", "message": "<plain language>" }
504  { "session_id": 12, "error_code": "provider_timeout", "message": "<plain language>" }
```
Raw `response()->json(...)` inside `try/catch` — no API Resources, per project convention. Note the change from today's blanket `503 {error: <exception message>}`: raw exception text is replaced by a stable `error_code` plus a user-safe message, so provider internals stop leaking to the browser.

---

## 5. Frontend

**Module:** none created. This is the existing **global component** `resources/views/web/src/components/Chatbot/` (not a portal module, so the `index.ts + api/ composables/ pages/…` module layout does not apply). Files:

```
resources/views/web/src/components/Chatbot/
├── HRMSChatbot.vue                 (edit — error bubble; delete 10 mock cards; wire leave-balance;
│                                            icon-only launcher; pointer-events; z-index)
└── script/
    └── useHRMSChatbot.js           (edit — delete the mock fallback; typed error state; retry)

resources/views/web/src/layout/
└── DashboardLayout.vue             (edit — `showChatbot` computed + bound bottom gutter — Decisions 11 & 12)

resources/views/web/app/
└── routes.ts                       (edit — `chatbot` flag on the 6 portal records — Decision 12)

resources/views/web/src/module/<portal>/*/route/*.routes.ts
                                    (edit — per-route `meta.chatbot` overrides only; ~8 files)
```

> [!NOTE]
> `useHRMSChatbot.js` is JavaScript in a TS codebase, and `HRMSChatbot.vue` is ~1,640 lines. Converting to `.ts` and splitting the card templates into child components is **out of scope** here (§8) — this pass keeps the diff reviewable. Per [vue-standards.md](../../../../.claude/rules/vue-standards.md), any *new* file must be `.ts`.

### 5.1 Composable changes

- **Delete** the `setTimeout` keyword-matcher fallback and every `mock*` constant that only fed it (Decision 1).
- Treat a `200` with empty `text` as a **failure**, not a fallback trigger (AC-5).
- On failure append `{ sender:'ai', type:'error', errorCode, text: <ApiError.message>, retryOf: <user text> }`, using the normalized `ApiError` already produced by [`axiosApiErrors`](../../../../resources/views/web/app/axios/axiosApiErrors.ts) — `{status, original, validation, message}`.
- `401` is **not** rendered as a chat error: the interceptor already dispatches `auth:unauthorized` once and the auth store handles logout. Skip appending a bubble for `status === 401`.
- Add `retry(message)`; guard `sendMessage` on `isLoading` so a double-click can't double-post (AC-25).
- Keep the per-role `localStorage` transcript (`hrms_chat_history_{role}`) and badge (`hrms_chat_unread_{role}`) as-is. **Do not** persist `type:'error'` bubbles across reloads — a stale error is its own kind of lie.

### 5.2 Component changes

- **Error bubble:** rose/red-tinted variant of the AI bubble — warning icon, the message, a small `error_code` chip, and a **Retry** button. Follows the existing dark-mode token pattern in the file ([ui-design.md](../../../../.claude/rules/ui-design.md)).
- **Delete** these `v-if="msg.type === …"` blocks and their `mock*` sources: `approval-list`, `team-attendance`, `employee-lookup`, `incident-management`, `logs-adjustment`, `roster-validation`, `payroll-run`, `contributions-review`, `admin-permissions`, `audit-logs` (Decision 8).
- **Wire** `leave-balance` to `msg.data` from the `leave.balance` tool result; delete `mockLeaveBalances`, `mockPolicies`, `mockRoster` (AC-23).
- **Keep** `roster`, `payslip`, `attendance-summary` (already live from `/api/employee/shift_schedule` + `/api/employee/dashboard`), and all four `*-form` cards (already post to `/api/employee/submit_application`).
- Quick-action pills for roles whose cards were deleted still work — they produce real plain-text tool answers.
- **Launcher → icon-only** (Decision 11): delete the `<div class="flex flex-col items-start pr-1 text-left">` block holding the "HRMS Copilot" and "Active: {role}" labels, so the button collapses to the `w-8 h-8` role avatar inside its ring (~56 px total). The role avatar `v-if` chain and the unread badge stay. If discoverability needs preserving, re-introduce the label as a `group-hover` tooltip **outside** the button element — never as a child of it. → AC-38
- **Decoration must not be clickable:** add `pointer-events-none` to the gradient ring (`absolute inset-0`), the ping ring (`absolute -inset-1.5`), and the unread badge (`absolute -top-2 -right-2`). They are children of `<button>`, so today a click up to ~6 px outside the visible circle still opens the drawer. → AC-35

### 5.3 API contract consumed

| Call | Payload | Success | Failure |
|---|---|---|---|
| `POST /api/ai/chat` | `{message, session_id?, portal, page, active_record_id?}` | `{session_id, text, rich_data}` | `422/404/502/503/504` → error bubble (401 → auth store) |
| `GET /api/ai/history/{id}` | — | `{session_id, messages[{id,sender,text,rich_data,status,error_code,created_at}]}` | `404` |
| `DELETE /api/ai/history/{id}` | — | `{success:true}` | `404` |

### 5.4 Layout sketch — error state

```
┌──────────────────────────────────────────┐
│ 🤖 HRMS Copilot        [Employee Portal] │
│ ● Online • role-aware assistant          │
├──────────────────────────────────────────┤
│  ┌────────────────────────────────┐      │
│  │ Hi Jane! Ask me about your…    │      │  ← welcome (unchanged)
│  └────────────────────────────────┘      │
│      ┌──────────────────────────────┐    │
│      │ what's my leave balance?     │    │  ← user
│      └──────────────────────────────┘    │
│  ┌────────────────────────────────┐      │
│  │ ⚠  The AI assistant is not     │      │  ← NEW error bubble
│  │    configured. Contact your    │      │     (rose tint)
│  │    administrator.              │      │
│  │  [provider_unconfigured]  ↻ Retry │   │
│  └────────────────────────────────┘      │
├──────────────────────────────────────────┤
│ [Apply Leave][Leave Balance][My Payslips]│
│ ┌──────────────────────────────┐  ┌────┐ │
│ │ Ask me anything…             │  │ ➤  │ │
│ └──────────────────────────────┘  └────┘ │
└──────────────────────────────────────────┘
```
Previously this exact scenario rendered a confident leave-balance card with hardcoded 12/8/5 figures.

### 5.5 Overlay geometry & layering (Decision 11)

**The gutter** — [`DashboardLayout.vue`](../../../../resources/views/web/src/layout/DashboardLayout.vue). Extract the mount condition into a computed so it drives both the mount *and* the gutter (today the condition is inline at line 107 and the gutter does not exist). Per Decision 12 the condition reads the **merged route meta**, not a path comparison:

```vue
// script setup — Vue Router merges parent `meta` into `route.meta`,
// so a portal record's `chatbot: true` reaches every child route.
const showChatbot = computed(() => route.meta?.chatbot === true)
```

```ts
// resources/views/web/app/routes.ts — one line per portal record (Decision 12)
{
    // employee access
    path: "/",
    meta: { roles: [3], portal: "employees_portal_access", chatbot: true },
    children: [...employeesRoutes, ...createApproverRoutes("employee")],
},
```

`=== true` is deliberate: an absent flag is falsy, so **off is the default** and `/messages` needs no special case. A route overrides its portal with its own `meta: { chatbot: false }` (AC-41).
```vue
<!-- template: the SimpleBar scroll wrapper, currently `<div class="flex flex-col min-h-full">` -->
<div class="flex flex-col min-h-full" :class="{ 'pb-20': showChatbot }">
  ...
  <FooterLayout v-if="!route.meta?.hideFooter" />
</div>
...
<HRMSChatbot v-if="showChatbot" />
```

The gutter goes on the **outer** wrapper (below the footer), not on the router-view wrapper — otherwise the footer itself stays under the launcher. Sizing: `pb-20` = 80 px clears the icon-only launcher (56 px) + its `bottom-6` offset (24 px). **If Decision 11's icon-only change is deferred and the wide pill ships, this must be `pb-24` (96 px)** to clear the ~60 px pill. → AC-32, AC-33, AC-34

**The layer scale** — the app's real stacking order, and where the chatbot belongs in it:

| Layer | Current | Target | Note |
|---|---|---|---|
| Page content | `z-10`…`z-30` | unchanged | — |
| Sidebar (desktop) | `z-10` | unchanged | — |
| Navbar | `z-20` | unchanged | — |
| **Chat launcher (FAB)** | **`z-999`** | **`z-30`** | Above content, below every overlay |
| Sidebar (mobile drawer) | `z-50` | unchanged | — |
| **Chat drawer** | **`z-1000`** | **`z-[60]`** | Above the mobile sidebar, below modals |
| Modals / dropdowns | `z-50`, `z-[100]`, `z-[110]` | unchanged | Must be able to cover the chat |
| Toasts / top-most | `z-9999`…`z-99999` | unchanged | — |

Both chatbot values are arbitrary Tailwind escapes far outside this scale, which is why the launcher currently paints over modals. → AC-36, AC-37

---

## 6. Business Rules & Edge Cases

### 6.1 HRMS domain rules

| Rule | Where enforced |
|---|---|
| **No AI-initiated writes.** The assistant must never file an application itself; `*.apply` tools stay unreachable and filing goes through `*.show_form` → the user confirms → `POST /api/employee/submit_application` with the standard approver matrix | Rule 3 of [`CopilotInstructions`](../../../../app/Ai/Support/CopilotInstructions.php); AC-22 |
| **Personal scope.** An employee sees only their own leave, attendance, schedule, and payslip | [`McpToolPolicy`](../../../../app/Policies/McpToolPolicy.php) role-3 ownership branch; AC-14 |
| **Portal separation.** Manager/HR/TK/Payroll scopes never widen an employee's access; the frontend's URL-derived role is cosmetic — authorization is always off `Account.role` | `McpToolPolicy`; AC-15…AC-17 |
| **Team scope = units headed by the manager** (`units.idhead`, `status = 1`) — the app's existing definition, now shared | `GetManagedEmployeesQuery`; AC-15, AC-16 |
| **Audit trail.** Every tool attempt, allowed or denied, is recorded — satisfies the [hrms-rules.md](../../../../.claude/rules/hrms-rules.md) audit requirement for payroll/attendance access | `HrmsTool::handle()`; AC-18 |
| **No fabricated HR data.** Any figure shown to a user must trace to a tool result | Decisions 1 & 8; AC-6, AC-23 |

### 6.2 Edge cases

| Edge case | Handling |
|---|---|
| Gemini key unset | `503 provider_unconfigured`; error bubble; failure row (AC-1, AC-2) |
| Gemini 4xx/5xx | 2 retries, 500ms apart, then `502 provider_error` (AC-3) |
| Gemini hangs | `connectTimeout(5)`, `timeout(30)` → `504 provider_timeout` (AC-4) |
| Model loops on tools 5× | `502 tool_loop_exhausted`, AI row `status='empty'` (AC-5) |
| Model returns text but no tool ran | Normal `200`; `rich_data: null` — a policy/greeting answer is legitimate |
| Tool returns `['error' => …]` | Fed back to the model, which explains it in prose; audit row `status='success'` (the tool ran); no error bubble |
| Session > 15 messages | Newest 15 sent, chronological (AC-13) |
| Session belongs to another user | `404` everywhere (AC-8…AC-12) |
| Session deleted mid-conversation | Next turn's `session_id` misses → `404`; frontend clears `session_id` and retries as a new session |
| Manager heads no unit | All `empid`-scoped tools denied (AC-17) — no implicit global access |
| Employee omits `empid` | Defaults to the caller's own `empid` in every tool — unchanged |
| Role not in `rolePermissions` (e.g. role 0/8) | Empty allowlist → every tool denied, audited |
| Double-clicked Send | `isLoading` guard disables input + button (AC-25) |
| `active_record_id` from another employee's page | Injected into the prompt as *context only*; it grants nothing — tool calls are still policy-checked (AC-14) |
| Payslip/salary text in `ai_chat_messages` | Accepted for now; retention/redaction deferred (§8) — `GET /history` is owner-only after AC-9 |
| `arguments` in `ai_audit_logs` may hold an `empid` | Acceptable (audit needs the target); no free-text message is stored there |
| Pagination controls at the bottom-right of a scrolled list | Cleared by the layout gutter — content can no longer end under the launcher (AC-32, AC-33) |
| Route `/messages` (chatbot not mounted) | Gutter is bound to `showChatbot`, so no dead space is reserved (AC-34); after Decision 12 this follows from the absent meta flag, not a path check (AC-42) |
| A route in an "off" portal that genuinely needs the assistant | Per-route `meta: { chatbot: true }` override; the reverse override also works (AC-41) |
| Navigating from an "on" route to an "off" route with the drawer open | Launcher and drawer unmount, gutter removed, in the same navigation (AC-45) |
| A new page added to an "on" portal | Inherits `chatbot: true` — gets the assistant and the gutter with no extra edit; a new page in an "off" portal stays off until explicitly overridden |
| `createApproverRoutes(<portal>)` generated routes | Inherit their portal record's flag; approvals are genuine coverage (`leave.approve`, `incident.list`), so they should land on the "on" side |
| A user whose `Account.role` does not match the portal they reached | Irrelevant to the flag — mounting is route-driven, authorization stays role-driven in `McpToolPolicy` (§6.1) |
| A click just outside the launcher's visible circle | Ignored — decorative rings and badge are `pointer-events-none` (AC-35) |
| A modal opens over the bottom-right corner | Modal (`z-[100]`+) renders above the launcher (`z-30`) and the drawer (`z-[60]`) (AC-36) |
| **`sticky bottom-0` / `fixed bottom-0` table bars** — [`PayrollRegisterTable.vue`](../../../../resources/views/web/src/module/payroll/reports/pages/prooflist/payroll_register/components/PayrollRegisterTable.vue), [`YTDReportTable.vue`](../../../../resources/views/web/src/module/payroll/reports/pages/payroll_reports/ytd_report/components/YTDReportTable.vue), [`ControlTotalScheduleTable.vue`](../../../../resources/views/web/src/module/payroll/reports/pages/prooflist/control_total_schedule/components/ControlTotalScheduleTable.vue), [`ThirteenthMonthTable.vue`](../../../../resources/views/web/src/module/payroll/reports/pages/payroll_reports/13th_month_pro_rate/components/ThirteenthMonthTable.vue), [`PayrollSummaryTable.vue`](../../../../resources/views/web/src/module/payroll/reports/pages/payroll_reports/payroll_summary/components/PayrollSummaryTable.vue), [`TimesheetTable.vue`](../../../../resources/views/web/src/module/manager/myteam/pages/timesheet/components/TimesheetTable.vue) | **Partially handled — known residual.** These pin to the bottom of the scrollport, so the wrapper's padding does not move them; the icon-only launcher shrinks the overlap from ~200 px to ~56 px of their right edge, but does not eliminate it. Full fix = per-component right padding, deferred to §8. Accepted because these bars carry read-only totals, not controls — **verify this per component before closing** |
| Mobile viewport (`< sm`) | The drawer is already `w-full`; the launcher's gutter is unchanged, and the minimized card (`h-[450px] w-[350px]`) is unaffected |

### 6.3 Non-Functional & Failure-Mode Checklist

| Category | Answer |
|---|---|
| **Authorization** | `/api/ai/*`: any authenticated employee (all roles) — but strictly **their own sessions**; an unowned or unknown `session_id` → `404 {"message":"Session not found."}` (never `403`, to prevent ID enumeration). Unauthenticated → `401 {"message":"Unauthenticated."}`. Per-tool authorization is unchanged in shape and stays with `McpToolPolicy` off `Account.role`, with role-3 ownership and role-2 team scope enforced; denial → tool-level permission error + `ai_audit_logs` row `authorized=false, status='failed'`. `GET /api/admin/ai-health`: roles **1 and 7 only** → others `403 {"message":"You do not have permission to perform this action."}`. `POST /api/mcp/execute` is **removed** — no unauthenticated tool execution remains (AC-21). `POST /mcp/hrms` keeps `auth:sanctum` and the same policy. The frontend's URL-derived role changes only greeting/pills/`portal` text and grants nothing. **AC-8…AC-12, AC-14…AC-17, AC-20, AC-21, AC-31.** |
| **Concurrency / double-submit** | Guard is **UI-level**: `isLoading` disables the input and Send button for the in-flight turn, so a double-click issues one request (AC-25). Two *genuinely* concurrent turns on one session are permitted — both append rows and each sees whatever history existed when it started; no lock, because a chat turn creates no financial or state-machine record. Session creation is not racy: an absent `session_id` always inserts a new row, and `insertGetId` returns that row's own id. No DB unique constraint is needed. **AC-25.** |
| **Idempotency on retries** | **Deliberately non-idempotent** and safe: a replayed `POST /api/ai/chat` creates a second user+AI message pair — duplicated *conversation*, never duplicated business records, because every write tool is unreachable (AC-22) and the only side effects are transcript and audit rows. Filing an application *is* idempotency-sensitive, and that path is the existing `POST /api/employee/submit_application`, unchanged by this spec and governed by its own guards. The **Retry** button re-sends the failed text without re-appending the user bubble, so a retry after a failure yields exactly one user message (AC-7). Gemini-level retries (2×) happen before any AI row is written, so a retried provider call cannot duplicate a message row. **AC-7, AC-26.** |
| **Error response shape & status codes** | Exactly as §4.5: `422 {"errors":{"<field>":["<msg>"]}}` (validation) · `401 {"message":"Unauthenticated."}` · `403 {"message":"You do not have permission to perform this action."}` · `404 {"message":"Session not found."}` · `502/503/504 {"session_id", "error_code", "message"}` with `error_code` ∈ `provider_error` \| `tool_loop_exhausted` \| `provider_unconfigured` \| `provider_timeout`. Raw exception text is **never** returned (today's `503 {error: $e->getMessage()}` leaks provider internals); the detail goes to `Log::error` and `ai_chat_messages.error_code`. Every failure also persists an AI row with `status='error'|'empty'`. **AC-1…AC-5, AC-27…AC-31.** |
| **Input validation boundaries** | `message`: `required|string|min:1|max:20000` — null/absent/`""` → `422` (AC-27); >20,000 chars → `422` **before** any Gemini call (AC-28); a whitespace-only string is trimmed and treated as empty. `session_id`: `nullable|integer|min:1` — non-integer → `422` (AC-29); valid-but-unowned → `404` (AC-8). `portal`, `page`: `nullable|string|max:100` — absent → defaults `'Employee Portal'` / `'Dashboard'` (AC-30); oversized → `422`. `active_record_id`: `nullable|string|max:64` — absent → `null`; it is prompt **context only** and is never used as an authorization input (AC-14). `GET /api/admin/ai-health`: `start`/`end` `required|date`, `end >= start`, range ≤ 90 days → `422` otherwise; malformed date → `422`. Tool arguments are validated by each MCP tool's own `schema()` and by `McpToolPolicy` before execution. **AC-27…AC-30.** |

---

## 7. Build Order

Dependency-first. Steps 1–5 are the security and failure-visibility core and are independently shippable; 6–9 are the trust/UX pass.

1. **Migrations** — `alters/ai_chat_messages/` (`status`, `error_code`, `(session_id, id)` index) and `alters/ai_audit_logs/` (`duration_ms`, `engine`, indexes). No FKs. *(§3)*
2. **`GetManagedEmployeesQuery`** — new shared team query, then refactor the 4 existing copy-paste sites onto it (behaviour-preserving, no chatbot dependency). *(Decision 6)*
3. **`McpToolPolicy`** — real role-2 scope via `managesEmpid()`. → AC-15…AC-17
4. **`ChatbotController`** — `resolveOwnedSession()` on all 4 endpoints; validation bounds; typed error responses. → AC-8…AC-12, AC-27…AC-31
5. **Remove `POST /api/mcp/execute`** — delete the route; convert `McpInternalController` to in-process-only with a resolved `Account`. → AC-21
6. **`AIService`** — newest-15 window; `timeout`/`connectTimeout`/`retry`; loop-exhaustion error; failure persistence with `status`/`error_code`; `{tool, result}` envelope for both execution paths; `duration_ms`/`engine`. → AC-1…AC-5, AC-13, AC-18, AC-24
7. **`HrmsCopilot` + `HrmsTool`** — same newest-15 window and the same audit metrics for the pilot path. → AC-12, AC-13, AC-18
8. **Frontend Gate 1 (static)** — error bubble + Retry rendered from hard-coded fixtures; delete the mock fallback and the 10 unwired cards. Validate the error design before wiring. → AC-6, AC-7
9. **Frontend Gate 2 (live)** — wire the error state to real `ApiError`s and `leave-balance` to the real tool result. → AC-1, AC-23
10. **`GetAiHealthQuery` + `AiHealthController` + admin panel** — the failure-finding surface; repoint the `audit.logs` tool at it. → AC-19, AC-20
11. **Overlay fix — layout gutter** *(Decision 11; independent of steps 1–10, ship first if the blocked pagination is the priority)*: `showChatbot` computed + bound `pb-20` on the `DashboardLayout` scroll wrapper. → AC-32, AC-33, AC-34
12. **Overlay fix — icon-only launcher** — delete the two label lines; add `pointer-events-none` to both rings and the badge. → AC-35, AC-38
13. **Overlay fix — z-index** — launcher `z-999` → `z-30`, drawer `z-1000` → `z-[60]`; regression-check a modal, a dropdown, and the mobile sidebar against the §5.5 table. → AC-36, AC-37
14. **Mount scope — `showChatbot` reads route meta** *(Decision 12)*: swap the path comparison for `route.meta?.chatbot === true`; must land **with** step 15 or the launcher disappears everywhere. → AC-42
15. **Mount scope — portal flags + overrides** — `chatbot` on the 6 portal records in `routes.ts` per the confirmed defaults table, then the per-route overrides. Verify the four nudge substrings all fall on the "on" side. → AC-39, AC-40, AC-41, AC-43, AC-44, AC-45

---

## 8. Out of Scope (Future Specs)

- **Finish the MCP tool migration** — the remaining 27 legacy tools moved to `app/Mcp/Tools/` classes, retiring the duplicated catalog in `AIService::fetchMcpTools()` and the `McpInternalController` switch. Prerequisite for retiring the hand-rolled loop in favour of `HrmsCopilot`.
- **Wire the 10 deleted rich cards** to real tool payloads, one per tool, once each shape is verified (Decision 8, Option B).
- **Split `HRMSChatbot.vue`** (~1,640 lines) into card child components and convert `useHRMSChatbot.js` → `.ts`.
- **Policy-document retrieval** — register `resources/markdown/policies/*.md` as MCP resources or a `policy.search` tool, so the system prompt's "use the policy resources" instruction is true. `config('ai.policies')` is currently read nowhere.
- **Streaming responses (SSE)** and/or **queued generation** (Decision 9, Options B/C).
- **Mobile chatbot** — `AiChatPanel.vue` is a hardcoded mock with its mount commented out; wiring it to `/api/ai/chat` is its own spec.
- **`ai_chat_messages` retention & redaction** — TTL/purge policy and PII redaction for transcripts holding salary and payslip figures.
- **`ai_chat_messages.tool_calls`** — never written today; populating it would let `GET /history` show which tool produced which answer.
- **`AiChatSession` model + route-model binding + Laravel Policy** (Decision 4, Option B) as the long-term ownership shape.
- **Document the AI env keys in `.env.example`** — `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_API_VERSION`, `MCP_INTERNAL_TOKEN`, `AI_DEFAULT_PROVIDER` are all undocumented; `MCP_INTERNAL_TOKEN`'s hardcoded default in `config/ai.php` should also be removed once Decision 5 lands.
- **Rate limiting** per user on `/api/ai/*` to cap token spend from an automated caller.
- **Move the launcher into the navbar** and delete the floating element (Decision 11, Option B) — the structurally airtight fix; a design decision, not a bug fix.
- **Right-side padding on the 6 `sticky bottom-0` table bars** so the icon-only launcher clears them completely (see the residual in §6.2).
- **A shared z-index scale** (Tailwind theme tokens instead of ad-hoc `z-999` / `z-9999` / `z-99999` / `z-10001` escapes) — the chatbot is one symptom of an app-wide convention gap.
- **Per-page (not per-portal) mount granularity** — an "on" portal still mounts the launcher on its own setup pages; tightening that means Decision 12 Option B's per-route flags, or deriving the flag from tool coverage.
- **Admin-configurable mount allowlist** — making the `chatbot` flag a runtime preference instead of a route-file constant.
- **Retire the dead permissions** — `finalpay.compute/checklist/summary` (role 6) and `roster.generate` (role 5) are granted by `McpToolPolicy` but have no tool in either catalog.
- **Consolidate the pagination components** — [`Pagination.vue`](../../../../resources/views/web/src/components/Pagination.vue), `CenterPaginationComponent.vue`, and 5+ per-module copies (`UserManagementPagination.vue`, `IncidentReportPagination.vue`, …) all reimplement the same control; a gutter fix has to be verified against each today.

---

## 9. Definition of Done

- [ ] Every row in the **Acceptance Criteria** table passes (AC-1 … AC-31)
- [ ] Every category in the **Non-Functional & Failure-Mode Checklist** is addressed — answered or explicitly `N/A because ...`
- [ ] `grep -rn "mockLeaveBalances\|mockApprovals\|mockEmployees\|mockIncidents\|mockAnomalies\|mockPermissions\|mockAuditLogs\|mockChartData\|mockPolicies\|mockRoster" resources/views/web/src/components/Chatbot/` returns nothing
- [ ] `grep -n "mcp/execute" routes/api.php` returns nothing
- [ ] `where('idhead'` appears in exactly one place (`GetManagedEmployeesQuery`) across `app/`
- [ ] `grep -n "z-999\|z-1000" resources/views/web/src/components/Chatbot/HRMSChatbot.vue` returns nothing
- [ ] `grep -c "HRMS Copilot" resources/views/web/src/components/Chatbot/HRMSChatbot.vue` counts only the drawer header — not the launcher
- [ ] On a paginated list scrolled to the bottom, every pagination button is clickable with the chatbot closed (AC-32) — checked on at least one page per portal
- [ ] `grep -c "route.path !== '/messages'" resources/views/web/src/layout/DashboardLayout.vue` returns `0` (AC-42)
- [ ] All 6 portal records in `resources/views/web/app/routes.ts` carry an explicit `chatbot` value — none left implicit (AC-39, AC-40)
- [ ] The defaults table in Decision 12 has been confirmed by the team, timekeeping row included
- [ ] `.agents/docs/hrms-chatbot.md` "Known issues" section updated to reflect what was fixed
- [ ] No open findings from adversarial verification — see the latest `.agents/reports/global-hrms_chatbot-verify-<date>.md`

---

<!-- Changelog -->
- `v2 — 2026-08-25 — added Decision 11 (chatbot launcher overlaps page controls — pagination unclickable) plus AC-32…AC-38, §5.5 overlay geometry, and the `DashboardLayout.vue` gutter.`
- `v1 — 2026-08-25 — initial.`
