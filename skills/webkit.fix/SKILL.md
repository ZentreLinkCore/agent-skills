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
1. **Locate and Load the Investigation Report (if any)**: If the prompt names or links a report file, read it directly. Otherwise, check `.agents/reports/` for a report matching the target path or feature described in the prompt. If found, treat its Root Cause Analysis, Evidence, and Recommended Solution sections as the primary source of truth instead of re-deriving them — this skill is commonly invoked in a fresh session with no memory of a `webkit.investigate` run that happened earlier. If no report is referenced or found, proceed directly from the prompt/target path — a report is not required to run this skill.
2. **Locate Target Files**: Parse the command argument path, the report's "Affected Files" section (if loaded), or search the workspace to identify the exact files needing the fix.
3. **Review Existing Context**: View the target files at the relevant line ranges (e.g., matching the investigation report's evidence section).
4. **Verify Constraints**: Review relevant project rules in `.agents/rules/` (e.g., [Laravel Standards](../../rules/laravel-standards.md), [Vue.js Standards](../../rules/vue-standards.md), [HRMS Domain Rules](../../rules/hrms-rules.md)).

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

---

## Phase 3 — Verification

Immediately after applying the code changes:
1. **Lint & Static Analysis Check**: Fix any syntax or lint errors introduced by the edits.
2. **Execute Tests**:
   - For backend fixes: Run PHPUnit filter tests (`vendor/bin/phpunit --filter <test_name>`).
   - For frontend fixes: Run Vitest tests (`npm run test -- <file_name>`).
3. **Manual Verification**: Specify step-by-step instructions for the developer/user to verify that the fix resolves the issue without introducing side effects.
