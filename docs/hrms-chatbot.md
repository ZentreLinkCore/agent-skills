# HRMS Chatbot (HRMS AI Copilot)

## What is it

The HRMS Chatbot — branded in the UI as **HRMS Copilot** — is a role-aware AI assistant embedded in every SubHRMS web portal. It is a floating launcher button (bottom-right) that opens a side drawer where an employee can ask HR questions in plain language ("what's my leave balance?", "show my schedule", "apply for overtime") and get answers computed from live HRMS data, plus interactive application forms rendered inside the chat.

It is **not** a generic LLM wrapper. Three things make it HRMS-specific:

1. **Tool calling over real HRMS data.** The model cannot invent an answer about your leave credits — it must call a named tool (`leave.balance`, `attendance.logs`, `payroll.payslip`, …) that queries the actual models, and answer from what comes back.
2. **Role-based access control on every tool call.** [`McpToolPolicy`](../../app/Policies/McpToolPolicy.php) decides whether the logged-in user's role may run the requested tool at all, and whether the arguments stay inside their own data. Every attempt — allowed or denied — is written to `ai_audit_logs`.
3. **Context awareness.** Each message carries the portal, page, and record the user is currently looking at, so the assistant knows "you're on the Payslips page viewing EMP001" without being told.

> [!IMPORTANT]
> The same tool classes are exposed **twice**: to the in-app chatbot, and over the **Model Context Protocol (MCP)** at `/mcp/hrms`, so an external MCP client (Claude Desktop, `php artisan mcp:start hrms`) can use the same role-checked HRMS tools. Tool definitions deliberately live in exactly one place — [`app/Mcp/Tools/`](../../app/Mcp/Tools/) — so the two never drift.

## Where to find it

| Surface | Location | File |
|---|---|---|
| Web portals (all roles) | Floating launcher, every page except `/messages` | [`components/Chatbot/HRMSChatbot.vue`](../../resources/views/web/src/components/Chatbot/HRMSChatbot.vue), mounted in [`DashboardLayout.vue:107`](../../resources/views/web/src/layout/DashboardLayout.vue#L107) |
| Chat state / API calls | — | [`components/Chatbot/script/useHRMSChatbot.js`](../../resources/views/web/src/components/Chatbot/script/useHRMSChatbot.js) |
| HTTP API | `POST /api/ai/chat` (+ 3 more, see [API endpoints](#api-endpoints)) | [`AI/ChatbotController.php`](../../app/Http/Controllers/AI/ChatbotController.php) |
| MCP endpoint (external clients) | `POST /mcp/hrms` (`auth:sanctum`) | [`routes/ai.php`](../../routes/ai.php), [`Mcp/Servers/HrmsServer.php`](../../app/Mcp/Servers/HrmsServer.php) |
| MCP over stdio (CLI) | `php artisan mcp:start hrms` | [`routes/ai.php`](../../routes/ai.php) |
| Mobile | **Not wired up** — [`AiChatPanel.vue`](../../resources/views/mobile/src/layout/components/AiChatPanel.vue) is a hardcoded mock and its usage is commented out in [`EmployeeMobileLayout.vue:92`](../../resources/views/mobile/src/layout/EmployeeMobileLayout.vue#L92) |

## How it works end-to-end

### 1. The request path

```
HRMSChatbot.vue                       user types "what's my leave balance?"
  └─ useHRMSChatbot.sendMessage()     attaches portal + page + active_record_id
       └─ POST /api/ai/chat           (auth:sanctum)
            └─ ChatbotController::chat()
                 ├─ create/update row in ai_chat_sessions   (holds the UI context)
                 └─ AIService::chat()
                      ├─ load last 15 turns from ai_chat_messages
                      ├─ build the tool catalog (MCP tools + legacy inline defs)
                      ├─ build the role-aware system prompt (CopilotInstructions)
                      └─ loop (max 5 turns) against Gemini generateContent:
                           model asks for a tool  →  execute it  →  feed result back
                           model returns text     →  stop
                      └─ persist both turns to ai_chat_messages
            └─ { session_id, text, rich_data }
  └─ append AI bubble; if rich_data.tool is set, render that rich card
```

### 2. Backend — two engines, one prompt and one tool layer

There are currently **two** chat implementations running side by side. This is deliberate: the SDK one is a pilot.

| | `POST /api/ai/chat` (production) | `POST /api/ai/agent-chat` (pilot) |
|---|---|---|
| Orchestrator | [`App\Services\AIService`](../../app/Services/AIService.php) — hand-rolled Gemini function-calling loop over `Http::post` | [`App\Ai\Agents\HrmsCopilot`](../../app/Ai/Agents/HrmsCopilot.php) — Laravel AI SDK (`laravel/ai ^0.9.1`) |
| Tools available | All of them — 3 MCP tool classes **plus** 27 legacy inline definitions | Only the 3 migrated MCP tool classes |
| Returns | `text` + `rich_data` | `text` + `engine: "laravel-ai-sdk"` (no `rich_data`) |
| Used by the UI | Yes | No — not called from any frontend today |

Both share the same two pieces, so behavior can't diverge on the parts that matter:

- **System prompt**: [`App\Ai\Support\CopilotInstructions::for()`](../../app/Ai/Support/CopilotInstructions.php) — injects the user's name, `empid`, resolved role label, active portal/page/record, and the security + tone rules.
- **Conversation history**: both read prior turns from the existing `ai_chat_messages` table (`HrmsCopilot` does it via the SDK's `Conversational` contract), so no SDK-specific conversation tables exist.

**Provider**: Google Gemini. Model defaults to `gemini-2.0-flash` (`config('ai.model')`), called at `https://generativelanguage.googleapis.com/{api_version}/models/{model}:generateContent`.

### 3. The tool layer (mid-migration)

Tool execution is split across two mechanisms, and this split is the single most important thing to understand about the codebase:

| | **Migrated** — Laravel MCP tool classes | **Legacy** — inline definitions + switch |
|---|---|---|
| Tools | `employee.profile`, `leave.balance`, `leave.history` | everything else (27) |
| Schema defined in | The tool class itself (`#[Name]`, `#[Description]`, `schema()`) | A hand-written array in [`AIService::fetchMcpTools()`](../../app/Services/AIService.php#L174) |
| Executed by | [`AIService::executeMcpServerTool()`](../../app/Services/AIService.php#L344) → `HrmsTool::handle()` | [`AIService::executeMcpTool()`](../../app/Services/AIService.php#L308) → internal HTTP-shaped call to [`McpInternalController::runToolLogic()`](../../app/Http/Controllers/AI/McpInternalController.php#L114) |
| RBAC + audit done in | [`HrmsTool::handle()`](../../app/Mcp/Tools/HrmsTool.php#L30) | [`McpInternalController::execute()`](../../app/Http/Controllers/AI/McpInternalController.php#L40) |
| Also reachable over MCP (`/mcp/hrms`) | **Yes** | No |

`AIService::$mcpTools` is the registry that decides which path a tool takes — a name listed there goes through its MCP class, anything else falls through to the legacy switch. Adding a tool to that array is the whole migration step.

[`HrmsTool`](../../app/Mcp/Tools/HrmsTool.php) is the abstract base that centralises the cross-cutting work, so concrete tools only implement `run()`:

1. Resolve the authenticated `Account` (`$request->user()`).
2. Authorize via `McpToolPolicy`.
3. Insert an `ai_audit_logs` row (`status = pending`).
4. Run `run()`, then flip the audit row to `success`, `failed` (RBAC denial), or `error` (exception).

### 4. RBAC and audit

[`McpToolPolicy::authorize()`](../../app/Policies/McpToolPolicy.php) is a two-step check:

1. **Role → tool allowlist.** A role's `rolePermissions` entry lists exactly which tool names it may call; roles `1` and `7` (Admin) hold the `*` wildcard.
2. **Ownership/scope validation.** For role `3` (Employee), a request whose `empid` argument isn't the caller's own `empid` (or whose `employee_id` isn't their own `id`) is rejected outright.

Every attempt lands in `ai_audit_logs` with the tool name, JSON arguments, the authorize verdict, final status, and any error message — this is the audit trail for anything the AI did on a user's behalf.

> [!WARNING]
> Manager scope validation is a **stub**. [`validateOwnershipAndScope()`](../../app/Policies/McpToolPolicy.php) has a comment saying a production system should verify the target `empid` reports to this manager, then `return true` unconditionally for role `2`. A manager can currently pass any `empid` to their allowed tools.

### 5. Frontend

[`HRMSChatbot.vue`](../../resources/views/web/src/components/Chatbot/HRMSChatbot.vue) (~1,640 lines) is the drawer; [`useHRMSChatbot.js`](../../resources/views/web/src/components/Chatbot/script/useHRMSChatbot.js) holds the state and the API call. Notable behaviors:

- **Role comes from the URL, not the account.** [`getRoleFromPath()`](../../resources/views/web/src/components/Chatbot/script/useHRMSChatbot.js#L71) maps the route prefix (`/admin`, `/manager`, `/hr`, `/timekeeping`, `/payroll`, `/employee`) to a role ID, falling back to `authStore.role`. This drives the greeting, badge colour, quick-action pills, and the `portal` sent to the backend. It does **not** grant permission — the backend still authorizes off `Account.role`.
- **History is per-role in `localStorage`** under `hrms_chat_history_{role}`; the unread badge count is persisted under `hrms_chat_unread_{role}` so "read" survives a refresh.
- **Proactive contextual nudges.** A route watcher pushes an unprompted AI bubble when the user navigates to a payslip / finalpay / roster / approval page, and increments the badge if the drawer is closed.
- **Rich cards.** When the response includes `rich_data`, the bubble's `type` is `rich_data.tool` and the matching card template renders instead of plain text — this is what turns "apply for leave" into an actual embedded form.
- **Interactive forms submit through the normal HRMS endpoints**, not through the AI. `triggerLeaveSubmit()` and friends `POST /api/employee/submit_application` with the same payload shape the regular application pages use, so filings go through the standard approver matrix.
- **Local mock fallback.** If the API call throws (or returns no `text`), a `setTimeout` keyword matcher fabricates a role-appropriate reply from hardcoded mock data. See [Known issues](#known-issues-and-limitations) — this is why the chatbot looks like it works with no Gemini key configured.
- **Lazy data loading.** Opening the drawer fires `GET /api/employee/shift_schedule` and `GET /api/employee/dashboard` to populate the roster/attendance/payslip cards.

### 6. Database tables

All three are created by [`2026_06_25_102600_create_ai_tables.php`](../../database/migrations/2026_06_25_102600_create_ai_tables.php).

| Table | Purpose | Key columns |
|---|---|---|
| `ai_chat_sessions` | One conversation thread; also stores the UI context of the last message | `user_id` → `accounts`, `active_portal`, `active_page`, `active_record_id` |
| `ai_chat_messages` | Transcript, read back as model history (last 15 turns) | `session_id`, `sender` (`user`/`ai`), `text`, `tool_calls` (json, unused), `rich_data` (json) |
| `ai_audit_logs` | Every tool-call attempt, allowed or denied | `user_id`, `tool_name`, `arguments`, `authorized`, `status` (`success`/`failed`/`error`), `error_message` |

> [!NOTE]
> These tables use real FK constraints (`constrained('accounts')`), which is against the SubHRMS "zero DB-level FKs" convention. They're an exception that already shipped — don't take them as the pattern to copy.

## API endpoints

All under `auth:sanctum` except `/api/mcp/execute` (see the warning below).

| Method | Route | Purpose |
|---|---|---|
| `POST` | `/api/ai/chat` | Send a message. Body: `message` (required), `session_id`, `portal`, `page`, `active_record_id`. Returns `{ session_id, text, rich_data }`; `503` + `{ error }` on failure. |
| `POST` | `/api/ai/agent-chat` | Same contract, Laravel AI SDK pilot engine. Returns `{ session_id, text, engine }`. |
| `GET` | `/api/ai/history/{session_id}` | Full transcript for a session. |
| `DELETE` | `/api/ai/history/{session_id}` | Deletes the session row (messages cascade). |
| `POST` | `/mcp/hrms` | MCP endpoint for external clients — only the 3 migrated tools. |
| `POST` | `/api/mcp/execute` | Internal tool-execution bridge. Auth is an `X-MCP-Token` header matched against `config('ai.mcp_internal_token')`. |

> [!WARNING]
> `/api/mcp/execute` sits **outside** the `auth:sanctum` group ([`routes/api.php:76`](../../routes/api.php#L76)) and takes `user_id` straight from the request body. Anyone holding the shared token can execute any tool as any user. The token also has a hardcoded default in [`config/ai.php`](../../config/ai.php) (`mcp_secure_access_secret_token_2026`), so an unset `MCP_INTERNAL_TOKEN` still yields a working, publicly-guessable token.

## Tool catalog

Tool names are `domain.action`. **MCP** marks the three migrated to tool classes (also available over `/mcp/hrms`); the rest run through the legacy switch.

| Tool | What it does | Roles allowed |
|---|---|---|
| `employee.profile` **MCP** | Employment details from `AccountDetailVW` | Employee, HR, TK, Payroll, Admin |
| `employee.search` | Name/department search, 10 results | HR, TK, Admin |
| `leave.balance` **MCP** | Sick/Vacation/Emergency credits from `AccountLeave` | Employee, HR, Admin |
| `leave.history` **MCP** | Last 10 `AppLeave` records | Employee, Manager, HR, TK, Admin |
| `leave.apply` | Files a leave application (with approver matrix) | Employee, Admin |
| `leave.approve` | Approve/reject a leave application | Manager, HR, Admin |
| `leave.cancel` | Cancel a pending leave | Employee, Admin |
| `changeshift.apply` / `.cancel` | File / cancel a shift-change request | Employee, Admin |
| `overtime.apply` / `.cancel` | File / cancel an overtime request | Employee, Admin |
| `businesstrip.apply` / `.cancel` | File / cancel an official business trip | Employee, Admin |
| `leave.show_form`, `changeshift.show_form`, `overtime.show_form`, `businesstrip.show_form` | Render the interactive form in the chat instead of filing directly | Employee, Admin |
| `attendance.logs` | Biometric time-in/out logs for a date range | Employee, Manager, TK, Admin |
| `attendance.summary` | Rate, hours worked, absences, late minutes | Employee, Manager, TK, Admin |
| `attendance.missing_logs` | Timesheet rows missing a time-in/out | Employee, TK, Admin |
| `attendance.adjustments` | File a timesheet correction | Employee, TK, Admin |
| `roster.view` | Shift schedule / duty roster | Employee, Manager, HR, TK, Admin |
| `roster.assign` | Assign or update a shift | TK, Admin |
| `payroll.payslip` | Payslip figures for a pay period | Employee, Payroll, Admin |
| `payroll.summary` | Payroll computation analytics | Payroll, Admin |
| `payroll.run_status` | Active computation runs and validation flags | Payroll, Admin |
| `incident.create` | Report an incident / policy deviation | Employee, HR, Admin |
| `incident.list` / `.details` | Search / open incident reports | Manager, HR, Admin |
| `audit.logs` | Recent admin + AI-triggered operation logs | Admin only |

The write tools (`*.apply`) exist but the system prompt **forbids the model from calling them**: rule 3 of [`CopilotInstructions`](../../app/Ai/Support/CopilotInstructions.php) instructs it to invoke the matching `show_form` tool instead, so a human always confirms the details before anything is filed.

### Role → portal mapping

Used identically in the policy, the system prompt, and the frontend.

| Role ID | Role | Portal shown in chat header |
|---|---|---|
| 1 | Super Admin | Admin Portal |
| 2 | Manager | Manager Portal |
| 3 | Employee | Employee Portal |
| 4 | HR Specialist | HR Portal |
| 5 | Timekeeper | Timekeeping Portal |
| 6 | Payroll Auditor | Payroll Portal |
| 7 | Admin | Admin Portal |

## Setup

Add to `.env` (none of these are in `.env.example` yet):

```dotenv
GEMINI_API_KEY=your-google-ai-studio-key   # required — without it /api/ai/chat 503s
GEMINI_MODEL=gemini-2.0-flash              # optional
GEMINI_API_VERSION=v1beta                  # optional
MCP_INTERNAL_TOKEN=                        # set this — see the warning above
AI_DEFAULT_PROVIDER=gemini                 # only used by the laravel/ai pilot
```

Then run the migration (`php artisan migrate`) so the three `ai_*` tables exist. No Node.js sidecar or external MCP server process is needed — tool execution is in-process.

To use the tools from an external MCP client, point it at `POST /mcp/hrms` with a Sanctum bearer token, or run the stdio server locally with `php artisan mcp:start hrms`.

## How to use it

### As an employee

1. Click the **HRMS Copilot** button at the bottom-right of any portal page.
2. Either tap a **quick-action pill** or type a question. Quick actions per role:

| Role | Quick actions |
|---|---|
| Employee | Apply Leave · Apply Change Shift · Apply Overtime · Apply Business Trip · Leave Balance · Attendance Summary · My Schedule · My Payslips |
| Manager | Pending Approvals · Team Attendance · Team Leave Requests · Overtime Requests |
| HR | Employee Lookup · Leave Monitoring · Incident Reports · Policy Search |
| Timekeeping | Missing Logs Form · Timesheet Adjustments · Roster Overlaps · Rules Verification |
| Payroll | Payroll Run Status · Final Pay Processing · Payslips Schedule · Contribution Reports |
| Admin | User Accounts · Permission Matrix · Audit Logs · System Settings |

3. **To file something**, say "apply for overtime" (or tap the pill). The assistant loads the form *inside the chat* — pick your dates, add a reason, submit. It goes to your normal approvers, exactly as if you'd used the Applications page.
4. Ask follow-ups; the last 15 turns are kept as context. **Clear chat** (settings icon → clear) resets the thread.

Example prompts that work today: *"what's my leave balance?"* · *"show my schedule this week"* · *"do I have any missing time logs?"* · *"show my latest payslip"* · *"apply for sick leave next Monday"*.

### Header controls

Search (filter the current transcript) · Settings (dev role override + clear chat) · Minimize (shrink to a 350×450 corner card) · Close.

### As a manager / HR / TK / payroll user

Same drawer, but the greeting, quick actions, and allowed tools follow the portal you're in. Note that most non-employee rich cards currently render **mock data** — see below.

### From an external MCP client

Once `/mcp/hrms` is reachable and you've authenticated with a Sanctum token, the client sees three tools — `employee.profile`, `leave.balance`, `leave.history` — all read-only, all scoped to the token's own account unless that account holds a wider role.

## Known issues and limitations

These are verified current behaviors, not proposals.

> **Updated 2026-08-27** — items 1-5 below were **fixed** on `feature/ai-chatbot-hardening`
> (spec: [`hrms_chatbot.md`](../specs/subhrms/global/hrms_chatbot.md)). Each is struck through
> with what replaced it. Items 6-10 are unchanged and still open.

1. ~~**The silent mock fallback hides real failures.**~~ **FIXED.** The fallback and every `mock*` constant are deleted. A failure now renders a rose error bubble carrying the server's `error_code` (`provider_unconfigured` · `provider_error` · `provider_timeout` · `tool_loop_exhausted`) and a **Retry** button, and is persisted as an `ai_chat_messages` row with `status='error'|'empty'`. Original:  If `/api/ai/chat` errors — no Gemini key, quota exhausted, network failure — [`sendMessage()`](../../resources/views/web/src/components/Chatbot/script/useHRMSChatbot.js#L290) swallows it to `console.warn` and produces a plausible fabricated reply from hardcoded data after a 1.2s fake "typing" delay. The user cannot tell a real AI answer from a mock one. This is the highest-impact issue in the feature.
2. ~~**Most rich cards render mock data even on the success path.**~~ **FIXED.** `leave-balance` now renders the real `leave.balance` tool result; the ten cards with no wired tool result were deleted and those answers render the model's plain-text summary. `roster`, `payslip`, and `attendance-summary` are unchanged. Original:  `leave-balance` renders `mockLeaveBalances` (hardcoded 12/8/5), and every manager/HR/timekeeping/payroll/admin card (`approval-list`, `team-attendance`, `employee-lookup`, `incident-management`, `logs-adjustment`, `roster-validation`, `payroll-run`, `contributions-review`, `admin-permissions`, `audit-logs`) is built from `mock*` constants. Only `roster`, `payslip`, and `attendance-summary` use live data, and that comes from separate dashboard endpoints rather than from the tool result.
3. ~~**`rich_data` only ever renders for the 4 `show_form` tools.**~~ **FIXED.** `AIService::toRichDataEnvelope()` normalises both execution paths to one `{tool, result}` envelope, so migrated MCP tools populate `rich_data` too. Original:  The frontend reads `rich_data.tool` as the card type, but only the `*.show_form` cases return a `tool` key ([`McpInternalController:117-139`](../../app/Http/Controllers/AI/McpInternalController.php#L117-L139)). Every other legacy tool returns bare data, so `type` is `undefined` and the card never shows. The three migrated MCP tools don't populate `rich_data` at all — `AIService` reads `$toolResult['result']`, which their unwrapped return shape doesn't have.
4. ~~**`/api/mcp/execute` is unauthenticated**~~ **FIXED.** The route is deleted and `McpInternalController::executeFor()` is in-process only, taking a resolved `Account`; the hardcoded `MCP_INTERNAL_TOKEN` default is removed from `config/ai.php`. Original:  apart from a shared token with a hardcoded default, and trusts `user_id` from the body. See the warning in [API endpoints](#api-endpoints).
5. ~~**Manager data scoping is not enforced**~~ **FIXED.** `McpToolPolicy` now resolves role-2 scope through `App\Queries\Team\GetManagedEmployeesQuery::managesEmpid()`, the shared definition extracted from the five copy-pasted `units.idhead` walks. A manager heading no unit is denied. Original:  — `validateOwnershipAndScope()` returns `true` for role 2 with a comment admitting the check is unimplemented.
6. **Policy lookup doesn't exist.** The system prompt tells the model to "retrieve all policy details … using the policy resources", but `HrmsServer::$resources` is empty, no policy tool is registered, and `config('ai.policies')` — pointing at [`resources/markdown/policies/`](../../resources/markdown/policies/) — is read nowhere in the codebase. Policy questions get answered from the model's own priors, or from `mockPolicies` on the fallback path.
7. **Two engines, one unused.** `/api/ai/agent-chat` is called by no frontend. Until the remaining 27 tools migrate to MCP tool classes, the SDK path can't replace `AIService`, and both copies of the tool catalog must be kept in sync by hand.
8. **The mobile chatbot is not implemented.** `AiChatPanel.vue` is a hardcoded keyword mock and its mount is commented out.
9. **Frontend role comes from the URL.** *(largely mitigated 2026-08-27 — roles 2/4/5/6 now hold the self-service tools, so the employee-portal quick actions a manager sees do work on their own records. The persona label is still URL-derived.)* Navigating to another portal's path switches the chat's persona and quick actions even if the account lacks that role. Harmless for permissions (the backend authorizes off `Account.role`), but confusing — the assistant will offer actions the tool call then refuses.
10. **`ai_chat_messages.tool_calls` is never written.** Tool invocations are recorded in `ai_audit_logs` only, so a transcript replayed via `GET /api/ai/history` loses which tools produced which answer.

11. **The launcher no longer covers page controls.** *(fixed 2026-08-27)* It is icon-only (~56px, was ~200x60px), its decorative rings and badge are `pointer-events-none`, it sits at `z-30` with the drawer at `z-[60]` so modals can cover it, and `DashboardLayout` reserves an `80px` bottom gutter wherever it is mounted — so bottom-right pagination is clickable again.
12. **It mounts only where it can help.** *(fixed 2026-08-27)* Mounting is driven by `meta.chatbot` merged from the portal record in `routes.ts`, replacing the hardcoded `/messages` path check. Employee / manager / timekeeping default on; hr / payroll / admin default off with per-route overrides. Roughly 70 of 206 routes mount the launcher, versus 205 before.
13. **Two contextual nudges never fired.** *(fixed 2026-08-27)* The matcher tested `finalpay` and `approval`, but the routes are `final-pay` and `approvers-menu`, so neither ever matched; a bare `schedule` test fired the duty-roster nudge on the BIR alphalist and control-total pages. The matcher now tests real path segments, all of which land on mounted routes.

14. **Every role can now reach its own records.** *(2026-08-27)* `McpToolPolicy` previously treated roles as mutually exclusive: role 2 held no self-service tool at all, so a manager asking "show my payslip" was refused outright. Roles 2, 4, 5 and 6 now carry `leave.balance` / `payroll.payslip` / the four `*.show_form` tools (plus `attendance.summary` and `roster.view` where they lacked them), constrained to the caller's own `empid` by `$selfOnlyByRole`. Team and audit scope are unchanged — `payroll.payslip` stays audit-wide for Payroll, `attendance.summary` and `roster.view` stay team-wide for Manager and Timekeeper.
15. **Tool declarations are filtered by role.** *(2026-08-27)* `fetchMcpTools()` used to advertise all ~30 tools to every caller, so the model reached for tools the role could not run and relayed the denial as "unable to access". It now takes the caller and filters by `McpToolPolicy::allowedTools()`.
16. **Employee IDs are zero-padded but read back as integers.** *(2026-08-27)* `accounts.empid` is `varchar` holding `'00342'`, while the app-wide [`CastNumericStrings`](../../app/Traits/CastNumericStrings.php) trait (61 models) returns `342`. The system prompt advertised the unpadded form, the model passed it back, and every `empid` string comparison missed — denying users their own records. Worked around in `CopilotInstructions` (raw value), `AIService::canonicaliseEmpid()`, `McpToolPolicy::sameEmpid()`, and `GetManagedEmployeesQuery::managesEmpid()`. **The trait itself is untouched** — changing it would affect 61 models.

17. **`payroll.payslip` read the wrong table.** *(fixed 2026-08-27)* The tool queried `ytd_details` — the year-end BIR annualisation table (`prev_employername`, `tax_due`), not a payslip — so it returned nothing for everyone. The hardcoded fallback beneath it (a fixed pay period and net-pay figure) meant nobody ever saw the miss: every user got the same invented payslip. It now reuses [`GetEmployeePayslipListQuery`](../../app/Queries/Payroll/GetEmployeePayslipListQuery.php) and [`GetEmployeePayslipQuery`](../../app/Queries/Payroll/GetEmployeePayslipQuery.php) — the same queries behind `/api/employee/payslips` and the Payslip page — reading released `payroll_run_detail` rows. Verified against a live account: 0 rows before, 4 released payslips after.

    The other legacy tools were smoke-tested against live data at the same time (`leave.balance`, `leave.history`, `roster.view`, `attendance.summary`, `attendance.logs`, `incident.list`) and all read the correct tables.

18. **Assistant replies were rendered unescaped into `v-html` (stored XSS).** *(fixed 2026-08-27)* `parseMessageText()` applied bold/italic markup to the model's reply and handed the result to `v-html` with no HTML escaping. The model routinely echoes database content — employee names, incident titles — so an incident titled `<img src=x onerror=...>` executed in the browser of every user who asked the assistant to list incidents. The renderer now escapes before adding any markup. **Note this is an output-encoding gap; the spec's §6.3 checklist covers input validation only, and adversarial verification missed it.**
19. **Reply formatting is now specified and rendered.** *(2026-08-27)* The prompt's only guidance was "summarize the findings clearly in plain language", so multi-record answers came back as prose blobs. `CopilotInstructions` now carries an explicit Response Format section (lead sentence, `- ` bullets, pipe tables for 3+ like records, **bold** figures, PHP currency, ~120-word cap, no raw JSON or internal field names), and `parseMessageText()` was extended to render exactly that subset: headings, `-`/`*`/`•` and numbered lists, pipe tables (horizontally scrollable in the narrow bubble), bold, italic, and `code`. Previously only `* ` bullets and `**bold**` rendered — a `-` bullet, which models emit at least as often, fell through as a plain paragraph.

20. **Payslip detail lookup used the wrong identifier, and was unscoped.** *(fixed 2026-08-27)* The listing exposes `payroll_run_detail.id`, but the tool passed that value as `period_id` to [`GetEmployeePayslipQuery`](../../app/Queries/Payroll/GetEmployeePayslipQuery.php), which matches `idpayperiod` — so asking for a specific period always returned "no payslip". The tool now resolves the reference against the caller's own released `payroll_run_detail` rows (accepting either a payslip id or a pay-period id) before fetching. **That resolution is also a security fix:** `GetEmployeePayslipQuery`'s id branch is not account-scoped, and a request carrying only an id has no `empid` for `McpToolPolicy`'s self-only gate to check — so before this, any employee could have fetched another's payslip by id. Verified: another account's payslip id is now refused. The returned payload is trimmed to what a chat answer needs (coverage, gross/deductions/net, earnings and deduction line items, YTD); company details and signatories belong to the printed payslip, not the conversation.

21. **In-chat application forms built their own payload instead of using the real filing flow.** *(fixed 2026-08-27)* The Applications page files in two steps — `POST api/employee/generate_schedule` returns the employee's actual rostered rows for the date range, and those rows are submitted as `data`. The chat forms skipped step one and hand-built the rows with `idshift: 1`, `stime: '08:00'`, `etime: '17:00'`, `reghrs: 8`, and `idpayperiod: activePayPeriodId || 1`. For a night-shift employee (verified live: shift 49, 23:30-07:30, pay period 53) every chat-filed leave and OBT was recorded against the wrong shift, the wrong times, and potentially pay period 1. It also bypassed [`BuildScheduleQuery::generate`](../../app/Queries/TKApplication/BuildScheduleQuery.php)'s approval-matrix guard, so a request could be filed with no approver configured. All four forms now go through the same two-step flow via a shared `fileApplication()` helper, with per-type stamping (`idleave`, `newshift`, `planhrs`, OBT type) mirroring each Applications tab. The chat form's "Current Shift" picker was removed — the server resolves it, so offering a choice that gets overwritten only invites a wrong one. The dead attendance-adjustment handler went with its deleted card.

22. **Attendance adjustment can be filed from chat again.** *(2026-08-27)* `aa` was the one application type with no chat filing path: its card rendered mock data and was deleted in the Decision 8 cleanup, and its orphaned handler went with the §13 rewrite. Added `adjustment.show_form` (tool declaration, controller case, `adjustment-form` card mapping, and the same per-role grant the other four `*.show_form` tools carry), an in-chat form (date, time in, time out, remarks), and a submit handler on the shared `fileApplication()` two-step flow. `hrs` is derived with the Applications module's own [`calculateHours()`](../../resources/views/web/src/module/employee/timekeeping_applications/utils/timekeeping_applications.utils.ts) rather than a second implementation — it handles the midnight wrap a night-shift correction depends on (verified: 11:30 PM → 7:30 AM = 8.00 hrs). Two Timekeeping quick actions that pointed at read-only tools and never opened a form were repointed.

23. **Leave balances always read zero, and leave types were hardcoded to the wrong ids.** *(fixed 2026-08-27)* Two defects in one area.

    **Balance.** `LeaveBalanceTool` read `account_leaves.balance` — a column that **does not exist** on that table (its columns are `entitle`, `carry_over`, `prev_used`, `conversion`). `(float) null` is `0.0`, so every leave balance the assistant reported was zero. A balance is `entitle - (approved + pending)`, which only [`HandleAccountLeave::getLeaves()`](../../app/Handlers/AccountLeave/HandleAccountLeave.php) knows; the tool now reuses it and returns `entitle`/`used`/`pending`/`balance` per type. Verified live: account 106 now reports Sick 5, Vacation 7, Emergency 3 — previously 0, 0, 0.

    **Type ids.** The tool mapped `idleave` 1/2/3 to Sick/Vacation/Emergency, and the chat leave form mapped the reverse with a ternary over three hardcoded `<option>` values. There are **21 active leave types**, and **`idleave` 3 is "Leave Without Pay" — Emergency Leave is 9**. So choosing "Emergency Leave" in the chat form filed an *unpaid* leave. (No rows were mis-filed: `app_leave` holds zero rows for either type.) The form now populates its types, ids, and balances from the employee's own credits, which `/api/employee/shift_schedule` already returns — no new endpoint, and the ternary is gone.

## Related features

- **Employee Messages** (`/messages`) — the human-to-human chat module, entirely separate ([`module/employee/messages/`](../../resources/views/web/src/module/employee/messages/)). The Copilot launcher is absent there — now because the route carries no `meta.chatbot` flag, not because of a hardcoded path check.
- **Applications** (Leave / Change Shift / Overtime / Business Trip) — the standard filing pages; the chatbot's in-chat forms post to the same `POST /api/employee/submit_application` endpoint.
- **Manager Dashboard → Approvals widget** — where the requests the chatbot files actually get approved.
- [`duty-roster.md`](duty-roster.md) — the roster feature behind `roster.view` / `roster.assign`.
