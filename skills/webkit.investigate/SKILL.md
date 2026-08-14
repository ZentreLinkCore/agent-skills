---
name: webkit-investigate
description: >
  Investigates software issues like a senior software engineer and produces a complete investigation report before any implementation begins.
  Never modifies files or implements fixes unless explicitly instructed.
  Triggered when the user runs the command `/webkit.investigate <target_path> <prompt>` or `/webkit.investigate <prompt>`.
---

# Webkit Investigate

This skill coordinates the investigation and root cause analysis of software issues within the workspace. It acts as the initial **Investigation Phase** of the AI development workflow, ensuring a thorough understanding of issues, context, dependencies, and potential risks before writing any code.

---

## Workflow Integration

When a user reports a bug, error, or requests a feature review, the typical workflow proceeds as follows:

```
          User Request
               │
               ▼
       webkit.investigate
               │
               ▼
  Investigation Report (saved to
   .agents/reports/*.md — see
   Phase 9)
               │
               ▼
         User Decision
  ┌────────────┼────────────┬────────────┐
  ▼            ▼            ▼            ▼
webkit.fix  webkit.    webkit.    webkit.refactor
            backend-   frontend-
            implement  implement
```

The report is a **file on disk**, not just chat output — `webkit.fix`, `webkit.backend-implement`, `webkit.frontend-implement`, and `webkit.refactor` are commonly invoked in a new session with no memory of this conversation, so they can only pick up the investigation's findings if it was actually persisted (see Phase 9).

> [!IMPORTANT]
> **This skill itself MUST NOT modify files or generate code, migrations, routes, or patches.** Its sole responsibility is to analyze, document, and plan.

---

## Supported Investigation Types

The skill automatically detects and handles the following investigation types:

- **Bug Investigation**: Unexpected runtime behavior, edge cases, logic bugs.
- **UI Issues**: Visual glitches, responsive breakages, accessibility (a11y) issues.
- **Backend/API/Database Issues**: Query bottlenecks, invalid API schema shapes, relation issues, migrations mismatch.
- **Performance Problems**: Slow page load (LCP/INP), N+1 queries, memory leaks, unindexed queries.
- **Security Issues**: CSRF vulnerabilities, inadequate gate/policy validation, mass assignment exposure.
- **Architecture & Code Quality**: Code smells, duplication, lack of separation of concerns, refactoring analysis.
- **Feature Enhancements**: Analyzing feasibility, scoping context, and designing interfaces for new requirements.
- **Environment & Build Errors**: PHPUnit / typecheck / build failures, compilation errors, permission issues, Docker orchestration mismatches.

---

## Phase 1 — Understand the Request

Determine and document:
1. **What is happening?** Identify the exact symptom or error.
2. **What should happen?** Define the expected behavior or outcome.
3. **Behavior Comparison**:
   - **Expected behavior**: How the system is designed to behave.
   - **Actual behavior**: How the system currently behaves (with logs, exception details, or visual descriptions).
4. **Project Gate (BLOCKING)**: Run the **[Which Project Am I In?](../../rules/project-profile.md)** resolution at the top of the profile and **state the resolved project**. Then read only that project's sections. An investigation that traces a React bug through Vue conventions — or cites the other project's schema rules as the root cause — produces a confident report that sends `/webkit.fix` to the wrong file.
5. **Scope Identification**:
   - **Affected Module / Domain**: (e.g., `leave_conversion`, `myteam`, `organization`, `community`)
   - **Affected Portal or Domain group**: SubHRMS uses portals (`hr`, `employee`, `manager`, `timekeeping`); **ScaleUP has no portals** — name the domain instead (`auth`, `community`, `dashboard`, `onboarding`, `organization`, `settings`)
   - **Affected Layer**: (e.g., frontend components, API routing, Query/Handler layer, database schema)
   - **Affected Feature**: (e.g., file attachments, timesheet processing)

> [!WARNING]
> If the request is ambiguous or lacks sufficient information, stop and ask the user for additional details, steps to reproduce, or error logs before proceeding further.

---

## Phase 2 — Context Discovery

Only inspect files and directories directly related to the issue. Protect token budgets and avoid unnecessary workspace scans.

### Search Priority Order
1. **Current Module**: Inspect files in the module's folder structure (both frontend and backend).
2. **Similar Module**: Look at how a sibling module handles a similar pattern.
3. **Shared Resources**: Check global helpers, layouts, traits, or components.
4. **Current Project**: Broader repository checks if the issue affects global configurations.
5. **Entire Workspace**: Only as a final resort for structural or tooling questions.

### Guidelines
- Do not perform repository-wide grep searches unless searching for a specific unique string.
- Never load more than 2 files concurrently in your context window.
- Refer to [.agents/rules/context-loading.md](../../rules/context-loading.md) and [.agents/rules/execution-strategy.md](../../rules/execution-strategy.md).

---

## Phase 3 — Root Cause Analysis

Analyze the discovered context to form a chain of reasoning:

`Symptoms → Possible Causes → Evidence → Most Likely Cause`

- **Symptoms**: What triggers the problem, and how does it manifest?
- **Possible Causes**: Formulate hypotheses explaining the symptoms.
- **Evidence**: Provide file links and exact line numbers relative to the repo you are in (e.g., `app/Handlers/Timesheet/HandleTimesheet.php:435`) showing where code is broken or misaligned. Use repo-relative paths — an absolute path from another machine or a sibling repo is not a link the reader can follow, and `app/Domain/` is a retired directory that no longer exists in either project.
- **Confidence Level**: Clearly state your confidence in the diagnosis (High, Medium, Low) and justify it based on the evidence.

---

## Phase 4 — Dependency Analysis

Evaluate the ripple effects of potential changes. Document the impact of fixing the issue on the following areas:
- **Downstream Components & UI Views**: What screens display this data or use this component?
- **API Endpoints & Route Definitions**: Will parameters or schemas change?
- **Database Tables & Models**: Are columns, types, indexes, or relationships affected?
- **Domain Queries, Handlers & Services**: How are validation, authorization (policies), and business logic affected?
- **Users & Permissions**: Does it alter access control rules or require new permissions?

---

## Phase 5 — Search for Existing Solutions

Do not reinvent the wheel. Before recommending a change or scaffolding a new solution:
- Search for existing components, services, queries, handlers, helpers, or traits that solve the same or a similar problem.
- **Hard Rule**: Reuse existing infrastructure. If a utility class or component clearly covers the core need, extend it rather than creating a duplicate file.
- Refer to [.agents/rules/duplicate-prevention.md](../../rules/duplicate-prevention.md).

---

## Phase 6 — Solution Analysis

Propose multiple potential solutions (usually 2-3 alternatives, including a "No Action/Workaround" or "Refactoring" choice if applicable).

For each option, evaluate:
- **Description**: High-level technical summary of the option.
- **Advantages & Disadvantages**: Pros and cons, including complexity.
- **Complexity & Risk Estimate**: Low/Medium/High.
- **Files Affected**: Paths of files that would be modified or created.
- **Other Impacts**: Breaking changes risk, performance implications, maintainability, and backward compatibility.

Conclude by recommending the **best solution** and explaining the exact reasoning behind the recommendation.

---

## Phase 7 — Risk Assessment

Deep-dive into the risks of the recommended solution:
- **Regressions**: What could break that currently works?
- **Database Changes**: Does it need migration or schema changes? Is there data loss risk?
- **Deployment Risks**: Does it require server downtime, job queue flushing, or specific configuration changes?
- **Testing Requirements**: How can we ensure correctness — using the checks the project actually has? PHPUnit exists in both projects; **ScaleUP has no Vitest configured**, so its equivalents are `npm run typecheck` and `npm run build`. Do not prescribe a test command the project cannot run.
- **Rollback Complexity**: How easily can we revert the change if it fails in production?

---

## Phase 8 — High-Level Implementation Plan

Construct an organized implementation checklist. **Do not implement the changes.**

Outline:
1. **Files to Create**: Path names of files to scaffold.
2. **Files to Modify**: Path names and target areas for updates.
3. **Execution Order**: A logical, dependency-first sequencing of steps.
4. **Effort Estimate**: Time or complexity rating.
5. **Testing/Validation Checklist**: A step-by-step list of how the developer/agent can verify the fix (e.g., commands, manual verification scenarios).

---

## Phase 9 — Investigation Report Structure

Compile the findings into a single, cohesive markdown report. The report must use the following standard format:

```markdown
# Investigation Report: [Issue / Feature Name]

## 1. Summary
- **Investigation Type**: [Bug / Performance / Security / UI / API / refactoring]
- **Project**: [SubHRMS | ScaleUP — as resolved by the Project Gate]
- **Target Portal/Domain & Module**: [e.g., HR / Employees — or Organization / Members in ScaleUP]
- **Confidence Level**: [High / Medium / Low]

## 2. Issue Description
- **Expected Behavior**: ...
- **Actual Behavior**: ...
- **Steps to Reproduce**: ...

## 3. Root Cause Analysis
- **Symptom**: ...
- **Discovered Code/Behavior**: ...
- **Evidence**: [File.php:L100](file:///path/to/File.php#L100) (Include details of what is wrong)
- **Root Cause**: ...

## 4. Scope & Dependencies
- **Affected Files**: ...
- **Affected Database Tables / Models**: ...
- **Affected API Endpoints / UI Views**: ...

## 5. Potential Solutions
| Option | Description | Pros | Cons | Risk & Complexity |
|---|---|---|---|---|
| Option A (Recommended) | ... | ... | ... | Low |
| Option B | ... | ... | ... | Medium |

### Recommended Solution Rationale
Explain why the recommended option is superior (e.g., matching existing architecture, DRY compliance, performance benefits).

## 6. Risk Assessment
- **Breaking Changes**: [Yes / No]
- **Regression Potential**: ...
- **Deployment & Migration Notes**: ...

## 7. High-Level Implementation Plan
1. `[ ]` Scaffold/Modify: ...
2. `[ ]` Configure: ...
3. `[ ]` Implement tests: ...

### Testing & Verification Checklist
- [ ] Run PHPUnit tests: `vendor/bin/phpunit --filter ...`
- [ ] Frontend checks — **the ones this project has** (ScaleUP: `npm run typecheck` / `npm run build`; a JS test runner only where one is configured)
- [ ] Manual test case: ...
```

### Persist the Report (MANDATORY)

Displaying the report in chat is not enough — `webkit.fix` and `webkit.refactor` are frequently invoked in a **separate session** and have no access to this conversation's history. If the report isn't written to disk, the handoff silently breaks and the next skill re-investigates from scratch (or worse, guesses).

- Write the full report to `.agents/reports/<portal-or-domain>-<module>-<slug>-<YYYYMMDD>.md` (e.g. `.agents/reports/tk-timesheet-late-log-miscalculation-20260708.md`, or `.agents/reports/organization-member-invite-expiry-20260814.md` in ScaleUP). Create the `.agents/reports/` directory if it doesn't exist.
- Use today's date and a short kebab-case slug of the issue/feature name for the filename so multiple investigations on the same module don't collide.
- If this investigation is a re-run or follow-up on an existing report for the same issue, update that file in place rather than creating a near-duplicate.

---

## Follow-up Commands

At the end of the report, suggest next steps to the user, **always including the saved report path** so the next skill invocation can load it directly instead of relying on chat memory:

- "To apply the recommended fix automatically, you can run: `/webkit.fix <target_path> <prompt> using .agents/reports/<report_file>.md`"
- "To scaffold the frontend implementation, you can run: `/webkit.frontend-implement <target_path> <prompt> using .agents/reports/<report_file>.md`"
- "To scaffold the backend implementation, you can run: `/webkit.backend-implement <target_path> <prompt> using .agents/reports/<report_file>.md`"
- "To refactor or optimize the affected module, run: `/webkit.refactor <target_path> <prompt> using .agents/reports/<report_file>.md`"
