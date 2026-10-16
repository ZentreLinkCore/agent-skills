---
name: webkit-summarize
description: |
  Compresses a ticket's history (spec, plan, task, context, investigation, verify, code-review, design-review, refactor, and the fix passes recorded in them) into one `summary.md`: feature purpose, files changed, architecture decisions, constraints, open items, and future improvements, each line citing its source. Later sessions read it first instead of the old reports. Edits nothing else.
  Trigger: "/webkit-summarize", "summarize the ticket", "compress the ticket history", "ticket summary", "what did T##### change"
  Use when: a ticket is Done, or its reports have grown long enough that re-reading them costs more than a summary.
---

# Webkit Summarize

Turns a ticket's accumulated documents into one short `summary.md`, so the next session (a follow-up feature, a bug in the same area, a review months later) reads one page instead of every report and run history.

> [!IMPORTANT]
> **Never modify application code, the spec, the plan, or any report.** Outputs: `summary.md` in the ticket folder and one `task.md` §5 line. A summary compresses; it never reinterprets, re-reviews, or closes anything. An open finding stays open and is listed as open.

Shared steps follow [skill-protocol.md](../../rules/conditional/skill-protocol.md). **Authority:** compressing a ticket's history. Any change to a source document → the skill that owns it; new findings → the review skills; reopening work → `/webkit-specify`.

## Inputs

| Form | Meaning |
| --- | --- |
| `/webkit-summarize T#####` | Summarize that ticket. |
| `/webkit-summarize` | The ticket named by the current branch (protocol §1). |

Run it when the ticket is **Done**, or when `task.md` shows several review runs or fix passes. Re-running after new work updates `summary.md` in place. It never replaces `/webkit-verify`: a summary of a ticket that was never verified says so.

## Context Loading Priority

1. **`task.md`**: which documents exist, their latest runs and statuses (§1), open findings (§3), what the ticket waits on (§4), and the timeline (§5). The previous `summary.md` on a re-run.
2. **`context.md` and `touched-files.md`** (if they exist): the intended scope and the do-not-touch list.
3. **Only the sections that carry the summary**:
   - `spec.md`: Metadata, §1–§4 (purpose, objective, background, scope incl. Not Included), §8 Technical Design headings with their Reused / Extended / New markers, §13 Security, §14 Implementation Notes (incl. **Review findings**), §15 Assumptions, Decisions (`D-xx`), and Open Questions, §16 Change Log.
   - `plan.md`: Metadata, §3 File Change Map, Plan Status, §10 Plan Change Log.
   - Each report: Metadata, status / verdict, summary, and each finding's number, severity, title, and **Resolution** line. Not the evidence blocks.
   - `investigation.md`: root cause and its status, the recommended solution, §8 Other Findings.
4. **Source: the diff stat only.** `git diff --stat "$base"..."origin/<branch>"` (branch analyzed read-only, [ticket-numbering.md §8](../../rules/conditional/ticket-numbering.md#8-resolving-a-ticket-argument-to-its-branch) Steps 1–4) for the files actually changed. Never the files' contents.

Rules: none beyond the always-on set; the template at write time. **Avoid:** evidence sections in full, source files, other tickets, the blueprint.

## Phase 1 — Resolve

Per protocol §1. The ticket must hold at least one document; an empty or missing ticket folder → stop and say so. A ticket with no spec (a bug ticket) is summarized from `investigation.md` and its fix records.

## Phase 2 — Collect

Read in the priority order above. Take each document's status **from the document itself**: `task.md` is a view, so where it disagrees with its source, the source wins and the summary notes the mismatch.

## Phase 3 — Reconcile files changed

Files changed = the branch's diff stat ∪ plan §3. Mark each **planned and changed**, **changed but not planned**, or **planned but not changed**. With no reachable branch, use plan §3 and the fix Resolution lines, and say the list is unconfirmed.

## Phase 4 — Write `summary.md`

Fill [ticket-summary.md](../../template/ticket-summary.md) per protocol §3. Re-run: update in place, bump **Summary Run**, and append the previous run under `<!-- Run history -->`.

- **Every line cites its source**: `spec §15 D-03`, `verify v3 #2`, `code-review v2 #5 (✅ FIXED 2026-10-14)`, `plan §3`.
- **Compress, never reinterpret.** No new findings, opinions, or recommendations of your own. Where sources disagree, give both and name the one that wins.
- **Future Improvements** come only from the sources: spec §4 Not Included, unfixed IMPROVEMENT / MEDIUM / LOW findings, design-review Modern Enhancement Ideas, investigation §8 Other Findings, open questions.
- **Short**: one line per item, no pasted code. The **Source Index** tells a later session when it must open an original document.
- **`task.md`** (protocol §5): one §5 line, e.g. `2026-10-16 · /webkit-summarize T00003 · summary.md v1 (12 files, 4 decisions, 2 open items) · spec Done`. Nothing else in `task.md` changes.

## Follow-up commands

State the saved path and that future sessions start from `summary.md`. Then, only where the summary shows a need:

- Open required findings: `/webkit-fix <ticket> --<source>`
- Never verified: `/webkit-verify <ticket>`
- A Future Improvement to build: `/webkit-context <request>`, then `/webkit-specify`
