---
name: webkit-fix
description: >
  Applies targeted bug fixes to files based on an investigation report, reproducing steps, or explicit user prompt, maintaining minimal diffs and strictly following project rules.
  Triggered when the user runs the command `/webkit.fix <target_path> <prompt>` or `/webkit.fix <prompt>`.
---

# Webkit Fix

This skill coordinates the application of bug fixes, logic corrections, and issue resolutions across frontend and backend layers within the workspace. It acts as the **Execution/Implementation Phase** for bugs, typically run after `/webkit.investigate`.

---

## Workflow Integration

When a bug or issue has been investigated and a fix is approved, the developer/agent runs this skill:

```
  Investigation Report (.agents/reports/*.md)
        / Approved Plan / Direct Prompt
                     │
                     ▼
                webkit.fix
                     │
                     ▼
           Applied Minimal Diffs
                     │
                     ▼
           Testing & Verification
```

A saved report is optional input, not a hard prerequisite — this skill also runs directly from a plain bug description or an explicit user prompt.

---

## Phase 1 — Target & Context Discovery

Before writing any code:
0. **Project Gate (BLOCKING)**: Run the **[Which Project Am I In?](../../rules/project-profile.md)** resolution at the top of the profile and **state the resolved project**, then read only its sections. A fix applied with the other project's conventions in mind — its schema rules, its component names, its file layout — lands looking idiomatic and is wrong, and this skill writes to application code.
1. **Locate and Load the Investigation Report (if any)**: If the prompt names or links a report file, read it directly. Otherwise, check `.agents/reports/` for a report matching the target path or feature described in the prompt. If found, treat its Root Cause Analysis, Evidence, and Recommended Solution sections as the primary source of truth instead of re-deriving them — this skill is commonly invoked in a fresh session with no memory of a `webkit.investigate` run that happened earlier. If no report is referenced or found, proceed directly from the prompt/target path — a report is not required to run this skill.
2. **Locate Target Files**: Parse the command argument path, the report's "Affected Files" section (if loaded), or search the workspace to identify the exact files needing the fix.
3. **Review Existing Context**: View the target files at the relevant line ranges (e.g., matching the investigation report's evidence section).
4. **Verify Constraints**: Review relevant project rules in `.agents/rules/` (e.g., [Laravel Standards](../../rules/laravel-standards.md), [Vue.js Standards](../../rules/vue-standards.md), [HRMS Domain Rules](../../rules/hrms-rules.md)).
5. **Branch Gate (BLOCKING)**: Run the [Mandatory Branch Gate](../../rules/git-workflow.md#mandatory-branch-gate-for-implementing-skills) **before editing any file**. If on `main`/`master`, **create and switch to a `bugfix/` (or `hotfix/`) branch now** — do not merely confirm one is needed and proceed. Already on a correctly-named branch for this issue? Continue there. On a branch for different work, or detached HEAD? Stop and ask. State the branch before you edit.

---

## Fix Playbook

Match the layer of the bug to the right file, using this project's known structure ([Project Profile](../../rules/project-profile.md)):

| Symptom is in… | Fix lives in… |
|---|---|
| Wrong data returned / query logic | The `Get<X>Query` in `app/Queries/<Domain>/` (**not** `app/Domain/`, which is retired) |
| Wrong write / save / calculation | The `Save<X>Handler` in `app/Handlers/<Domain>/` (keep it in `DB::transaction`) |
| Wrong HTTP status / response shape | The controller method — keep `try/catch` + `response()->json(...)`, no API Resource |
| 404 / wrong endpoint | `routes/api/<group>.php` — SubHRMS groups by portal (Timekeeping = `timekeeping`, not `tk`), ScaleUP by domain; `php artisan route:list --path=api` to confirm |
| Wrong value on screen / UI glitch | The module's `pages/` or `components/` file (`.vue` in SubHRMS, `.tsx`/`.jsx` in ScaleUP) |
| Wrong API call / mock still in use | The module's api layer — confirm the client and path against the profile before editing |
| Wrong payroll/OT/leave number | Verify the formula against [HRMS Domain Rules](../../rules/hrms-rules.md) before editing |

Then apply the smallest diff that resolves it (Phase 2), verify (Phase 3), close the loop (Phase 4).

---

## Phase 2 — Implementation Principles (Strict Safety)

### 1. Minimal Footprint & Incremental Generation
- Do not overwrite entire files. Generate the smallest possible diff that correctly resolves the bug.
- Preserve all existing imports, unrelated methods, developer comments, formatting, and business logic.
- Refer to [.agents/rules/incremental-generation.md](../../rules/incremental-generation.md).

### 2. Duplicate Prevention
- Never write duplicate functions or logic. Check if a helper, utility, service, or query already exists.
- If a class can be extended or refactored slightly to support the fix, do so instead of duplicating code.
- Refer to [.agents/rules/duplicate-prevention.md](../../rules/duplicate-prevention.md).

### 3. Architecture Consistency
- Strictly adhere to the project's design patterns:
  - Backend: Domain Query/Handler Pattern, Form Requests, API Resources.
  - Frontend: Vue Composition API, Tailwind/Vanilla CSS variables.
- Do not introduce new libraries, packages, or architectural patterns unless explicitly instructed.

### 4. System Awareness (If the Fix Touches Data Structures)
- If the fix requires adding a column, route, model, or table (not just editing existing logic), run the scan defined in [System Awareness](../../rules/system-awareness.md) first. A bug fix is not exempt from duplicate-prevention — it's easy to "fix" a symptom by fabricating a parallel column or endpoint instead of reusing the one that's already there but misused.
- If the scan turns up an existing structure that's simply being read/written incorrectly, fix the usage, not the schema.

---

## Phase 3 — Verification

Immediately after applying the code changes:
1. **Lint & Static Analysis Check**: Fix any syntax or lint errors introduced by the edits.
2. **Execute Tests**:
   - For backend fixes: Run PHPUnit filter tests (`vendor/bin/phpunit --filter <test_name>`).
   - For frontend fixes: run the checks the project actually has — **ScaleUP has no Vitest configured**, so use `npm run typecheck` (`tsc --noEmit`) and `npm run build`. Only run a JS test suite where one exists; a command that fails because it was never configured is not a failing test.
3. **Manual Verification**: Specify step-by-step instructions for the developer/user to verify that the fix resolves the issue without introducing side effects.

---

## Phase 4 — Close the Loop

1. **Update the Report (if one was loaded)**: Check off the corresponding item(s) in the report's "High-Level Implementation Plan" checklist (`[ ]` → `[x]`) and append a short "Resolution" note (what changed, and the date) so `.agents/reports/<file>.md` reflects current status instead of going stale for whoever reads it next.
2. **Suggested Next Step**: Point the user to the project's own checks (`vendor/bin/phpunit`; `npm run typecheck`/`npm run build` in ScaleUP) if not already run in Phase 3, and to [Git Workflow Standards](../../rules/git-workflow.md) for a Conventional Commit message (e.g. `fix(tk): correct late computation grace period`). Do not stage or commit automatically — that decision belongs to the user.
