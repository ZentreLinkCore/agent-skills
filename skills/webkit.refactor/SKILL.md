---
name: webkit-refactor
description: >
  Restructures existing code to improve maintainability, readability, performance, or DRY compliance without changing its external behavior. Follows project architecture and standards.
  Triggered when the user runs the command `/webkit.refactor <target_path> <prompt>` or `/webkit.refactor <prompt>`.
---

# Webkit Refactor

This skill coordinates the safe refactoring of existing source code within the workspace. Its primary goal is to improve code cleanliness, maintainability, performance, and compliance with project design patterns without altering external application behavior.

---

## Workflow Integration

When code duplication, architectural drift, or complex logic needs cleanup:

```
   Target Selection / Investigation Report
       (.agents/reports/*.md, optional)
                 │
                 ▼
          webkit.refactor
                 │
                 ▼
       Behavior-Preserving Edits
                 │
                 ▼
       Regression Verification
```

This skill is also the natural follow-up `webkit.investigate` suggests for "Architecture & Code Quality" findings — see that report's "Recommended Solution" and "High-Level Implementation Plan" sections when one exists.

---

## Target & Context Discovery

Before restructuring anything:
1. **Locate and Load the Investigation Report (if any)**: If the prompt names or links a report, or `.agents/reports/` has one matching the target module, read it — its scope, dependency analysis, and risk assessment save re-deriving that context. Since this skill may run in a fresh session, do not assume prior conversation turns are available. A report is optional; proceed directly from the prompt/target path if none exists.
2. **Locate Target Files**: Parse the command argument path, or the report's "Affected Files" section if one was loaded, or search the workspace for the described duplication/drift.
3. **Verify Constraints**: Review relevant project rules in `.agents/rules/`, particularly [Laravel Standards](../../rules/laravel-standards.md), [Vue.js Standards](../../rules/vue-standards.md), and [Duplicate Prevention](../../rules/duplicate-prevention.md).
4. **Branch Gate (BLOCKING)**: Run the [Mandatory Branch Gate](../../rules/git-workflow.md#mandatory-branch-gate-for-implementing-skills) **before editing any file**. If on `main`/`master`, **create and switch to a `refactor/` branch now** — do not merely confirm one is needed and proceed. Already on a correctly-named branch for this cleanup? Continue there. On a branch for different work, or detached HEAD? Stop and ask. State the branch before you edit.

---

## Principles of Safe Refactoring

### 1. Behavior Preservation
- **Contract Integrity**: Do not change public API endpoints, return payloads, database column structures, model event behavior, or visible UI features unless explicitly instructed.
- **Side-Effects Check**: Ensure that changes do not affect state management reactivity (Vue) or database transactions (Laravel).

### 2. Incremental Steps
- Refactor in small, independent commits or diffs. Avoid large "rewrite all" changes that complicate regression tracking.
- Test continuously at each minor step.

### 3. Maintain Comments & Documentation
- Preserve developer annotations, copyright markers, and business reasoning comments.
- Update PHPDoc/JSDoc types and schemas to reflect signature adjustments.

---

## Common Refactoring Scenarios

### 1. Extracting Reusable Logic (DRY compliance)
- If similar validation, computation, or query patterns are repeated in multiple controllers or pages, extract them:
  - Backend: Extract to custom Traits, Query classes, or Helpers.
  - Frontend: Extract to shared Vue Composables or utility functions.

### 2. Moving Inline Controller Logic to Domain Queries/Handlers
- In accordance with [.agents/rules/laravel-standards.md](../../rules/laravel-standards.md), migrate heavy inline controller logic into modular Query/Handler files under `app/Domain/`.

### 3. Component Extraction (Vue.js)
- Extract massive template blocks (e.g. nested modal views, forms) into standalone reusable components inside the module's `components/` subfolder.
- Adhere to [.agents/rules/vue-standards.md](../../rules/vue-standards.md).

---

## Phase 3 — Regression Testing & Verification

Refactoring is only successful if no functionality is broken:
1. **Pre-Check**: Run existing Vitest or PHPUnit tests before modifying anything to establish a baseline.
2. **Post-Check**: Execute the same tests after applying changes. Ensure 100% pass rate.
3. **Compare Response Payloads**: If API structures were refactored, verify that the before-and-after JSON shapes are identical.

---

## Phase 4 — Close the Loop

1. **Update the Report (if one was loaded)**: Check off the corresponding item(s) in the report's "High-Level Implementation Plan" checklist (`[ ]` → `[x]`) and append a short "Resolution" note (what changed, and the date) so `.agents/reports/<file>.md` stays current for whoever reads it next.
2. **Suggested Next Step**: Point the user to [Git Workflow Standards](../../rules/git-workflow.md) for a Conventional Commit message (e.g. `refactor(hr): extract shared leave-credit calculation`). Do not stage or commit automatically.
