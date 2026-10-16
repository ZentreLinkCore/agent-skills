# Touched Files — {{FEATURE_NAME}}

<!--
TEMPLATE: touched-files (touched-files.md — written by /webkit-context; rewritten on every run)

Generic fill rules: .agents/rules/conditional/skill-protocol.md §3.
1. Every file appears in exactly one section. Paths are verified (git ls-files), except Create (candidate).
2. One row per file. Reason in a few words; evidence as file:line or the search that found nothing.
3. /webkit-implement treats "Do NOT touch" as binding: a needed change there is a spec clarification, not an edit.
-->

| Field | Value |
| --- | --- |
| Ticket | {{T#####}} ({{project}}) |
| Context Run | v{{N}} — {{YYYY-MM-DD}} |

## 1. Modify

| Path | Construct | Why | Evidence |
| --- | --- | --- | --- |
| {{app/Queries/Leave/GetLeaveQuery.php}} | {{execute()}} | {{add filter}} | {{file:line}} |

## 2. Create (candidate)

| Path | Why nothing existing fits | Search run |
| --- | --- | --- |
| {{path following the sibling layout}} | {{reason}} | {{graphify query "..." / rg "..." → no match}} |

## 3. Reuse (read-only)

| Path | What it provides | Why it fits |
| --- | --- | --- |
| {{resources/views/web/src/components/Modal.vue}} | {{modal shell}} | {{same pattern as sibling feature}} |

## 4. Do NOT Touch

| Path | Reason |
| --- | --- |
| {{resources/views/web/app/axios/axiosInstance.ts}} | {{shared HTTP client: interceptors used by every module}} |

## 5. Tests

| Path | Status | Covers |
| --- | --- | --- |
| {{tests/Feature/Leave/LeaveRequestTest.php}} | {{exists — extend / new}} | {{endpoint and authorization}} |
