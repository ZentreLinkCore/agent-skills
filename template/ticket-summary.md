# Ticket Summary — {{FEATURE_NAME}}

<!--
TEMPLATE: ticket-summary (summary.md — written by /webkit-summarize; read FIRST by later sessions, before task.md's
sources and instead of the old reports)

Generic fill rules: .agents/rules/conditional/skill-protocol.md §3.
1. A compression of the sources: no new findings, no opinions. Every line cites its source in parentheses.
2. One line per item; no pasted code. Where sources disagree, give both and name the one that wins.
3. A section with nothing to say keeps its heading and says "None."
-->

## Metadata

| Field | Value |
| --- | --- |
| Ticket | {{T#####}} ({{project}}) |
| Feature | {{FEATURE_NAME}} |
| Branch | `{{branch}}` (base `{{base}}`) |
| Spec | {{spec.md v1.2 — Done / "None — bug ticket"}} |
| Plan | {{plan.md rev 3 — Done (14/14 tasks) / "None"}} |
| Summary Run | v{{N}} — {{YYYY-MM-DD}} — {{what changed since the previous run, or "initial"}} |
| Sources | {{e.g. "spec v1.2, plan rev 3, task.md, verify v3.1, code-review v2.1, design-review v1"}} |

---

## 1. Feature Purpose

{{Two to four sentences: what it does and why (spec §1–§3). Bug ticket: the symptom and the proven root cause (investigation).}}

## 2. Status

{{One line per stage that ran, e.g. "Verify: ✅ PASS (after fix pass v3.1) (verify.md)". Then "Done" or what the ticket waits on (task.md §4).}}

## 3. Files Changed

<!-- Branch diff stat ∪ plan §3. Change: A / M / D. Match: planned + changed / changed, not planned / planned, not changed. -->

| Path | Change | Layer | Why | Match |
| --- | --- | --- | --- | --- |
| {{app/Handlers/Leave/SaveLeaveHandler.php}} | {{M}} | {{backend}} | {{two-step approval (plan TASK-04)}} | {{planned + changed}} |

## 4. Architecture Decisions

- {{decision — why — (spec §15 D-01)}}
- {{decision made during review or fix — (verify v2 Case 1 / code-review v1 #3)}}

## 5. Important Constraints

<!-- What any later change in this area must keep: review findings recorded as rules (spec §14 Review findings),
     security and authorization rules, DB conventions applied, do-not-touch files, known drift avoided. -->

- {{constraint — (source)}}

## 6. Open Items

- {{unfixed required finding / open question / pending manual check — (source)}}

**Optional, not scheduled:** {{counts, e.g. "code-review: 2 MEDIUM, 1 LOW", or "None"}}

## 7. Future Improvements

<!-- Only from the sources: spec §4 Not Included, unfixed IMPROVEMENT / MEDIUM / LOW, Modern Enhancement Ideas,
     investigation §8 Other Findings. -->

- {{improvement — (source)}}

## 8. Source Index

<!-- When a later session needs detail the summary does not carry, this says which file to open. -->

| Document | Run / Version | Status | Open it for |
| --- | --- | --- | --- |
| [spec.md](./spec.md) | {{v1.2}} | {{Done}} | {{exact API contracts and acceptance criteria}} |

<!-- Run history -->
