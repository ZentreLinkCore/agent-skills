# Webkit Verification Report

<!--
TEMPLATE: verification-report (used by /webkit-verify)

Fill rules. Delete this comment and every other guide comment from the finished report — except the
"Run history" marker at the bottom, which stays.
1. Follow this structure exactly. Do not create a custom format, add sections, remove sections, or reorder them.
2. Replace every {{PLACEHOLDER}}. A finished report contains no "{{".
3. Never leave a field blank. If it does not apply, write "N/A — <reason>". A finding category with no entries
   keeps its heading and says "None."
4. Only actual issues, each with evidence: file:line, command output, or the code path traced. No opinions.
5. Finding numbers are unique across BLOCKER and REQUIRED FIX (#1, #2, … continuing from one category into the
   next), so "Finding #3" always names one issue.
6. Every FAIL in §2, §4, and §5 names the finding in §3 that explains it.

The verifier must NOT:
- create new features or expand scope,
- rewrite the specification or create a new spec version,
- suggest architecture changes without evidence.

The verifier must:
- reference the existing specification (section and FR / AC / EC id),
- explain findings clearly,
- separate bugs (BLOCKER, REQUIRED FIX) from improvements,
- identify whether spec changes are truly required (§7).
-->

## Metadata

<!-- Link the spec by its real file name: spec.md, or specs.md on tickets created before /webkit-specify. -->

| Field | Value |
| --- | --- |
| Ticket | {{T#####}} ({{project}}) |
| Branch | {{branch}} (base `{{base}}`, {{n}} commits, {{m}} files changed) |
| Specification File | [spec.md](./spec.md) — version {{x.y}}, status {{SPEC_STATUS}} |
| Verification Date | {{YYYY-MM-DD}} |
| Verification Run | v{{N}} — {{what changed since the previous run, or "initial"}} |

**Implementation Scope**

- **Frontend:** {{changed pages / components / stores, or "None"}}
- **Backend:** {{changed controllers / classes / routes, or "None"}}
- **Database:** {{migrations / tables / columns, or "None"}}
- **Other:** {{config, environment, tests, scripts, or "None"}}

---

## 1. Verification Summary

### Overall Status

<!-- Choose one, derived from §3:
     any BLOCKER → ❌ FAILED · REQUIRED FIX but no BLOCKER → ⚠ PASS WITH FIXES · neither → ✅ PASS.
     If an AC could only be verified by hand (§6), write "✅ PASS (n AC pending manual check)". -->

{{✅ PASS | ⚠ PASS WITH FIXES | ❌ FAILED}}

### Summary

{{One to three sentences: how closely the implementation follows the specification, and what must change before merge. Example: "The implementation mostly follows the specification. Two required validation rules are missing and must be fixed before merge."}}

---

## 2. Specification Compliance

<!-- Review every major section. An area is FAIL when any BLOCKER or REQUIRED FIX references it.
     Acceptance Criteria notes give the count, then each AC not met (with its finding) and each AC verified only
     by hand (with its §6 scenario). -->

| Specification Area | Status | Notes |
| --- | --- | --- |
| Scope | {{PASS / FAIL}} | {{explanation}} |
| User Flow | {{PASS / FAIL}} | {{explanation}} |
| Technical Design | {{PASS / FAIL}} | {{explanation}} |
| Acceptance Criteria | {{PASS / FAIL}} | {{n}}/{{total}} met. {{Not met: AC-xx (Finding #n). Manual: AC-xx (§6).}} |
| Edge Cases | {{PASS / FAIL}} | {{explanation}} |
| Security Requirements | {{PASS / FAIL}} | {{explanation}} |

---

## 3. Findings

<!-- Only actual issues. No opinions. Within each category, list in fix order (dependency-first). -->

### BLOCKER

<!-- Issues that prevent release or can cause serious problems: the feature does not work, a security
     vulnerability, a data corruption risk. A blocker the spec never mentions still counts; its
     Specification Reference is "N/A — release blocker (<reason>)". -->

#### Finding #1

- **Category:** BLOCKER
- **Location:** {{`path/to/file.php:42`, component, API, or table}}
- **Specification Reference:** {{section name and id, e.g. "§10 Acceptance Criteria — AC-03"}}
- **Problem:** {{what is wrong: inputs or state → wrong outcome}}
- **Expected Behavior:** {{what the specification requires}}
- **Actual Behavior:** {{what the implementation does, with evidence}}
- **Impact:** {{why this matters}}
- **Required Action:** {{exact fix: file, construct, and what it becomes}}

### REQUIRED FIX

<!-- The implementation does not fully satisfy the specification. Fix the implementation, not the spec.
     Numbering continues from BLOCKER. -->

#### Finding #2

- **Category:** REQUIRED FIX
- **Location:** {{`path/to/file.php:42`, component, API, or table}}
- **Specification Reference:** {{section name and id}}
- **Problem:** {{what is wrong: inputs or state → wrong outcome}}
- **Expected:** {{what the specification requires}}
- **Actual:** {{what the implementation does, with evidence}}
- **Required Action:** {{exact fix: file, construct, and what it becomes}}

### IMPROVEMENTS

<!-- Optional suggestions. They do not block merge and do not require a spec update. -->

#### Improvement #1

- **Area:** {{area}}
- **Current Situation:** {{what exists now}}
- **Suggestion:** {{the change}}
- **Reason:** {{why it is worth doing}}

### OUT OF SCOPE

<!-- Suggestions that are not part of the current ticket. Never part of the required fixes; never a spec update. -->

#### Suggestion #1

- **Suggestion:** {{suggestion}}
- **Reason Not Included:** {{why it is outside the current specification}}
- **Future Consideration:** {{when or where it could be picked up, e.g. a separate ticket}}

---

## 4. Security Review

<!-- PASS / FAIL per check; N/A only with a reason. Every FAIL is a finding in §3. -->

| Check | Status |
| --- | --- |
| Authentication | {{PASS / FAIL}} |
| Authorization | {{PASS / FAIL}} |
| Input Validation | {{PASS / FAIL}} |
| Data Exposure | {{PASS / FAIL}} |
| API Security | {{PASS / FAIL}} |

**Issues:** {{"Finding #n — <one line>" per issue, or "No security issues found."}}

---

## 5. Performance Review

<!-- PASS / FAIL per check; N/A only with a reason. Every FAIL is a finding in §3. -->

| Check | Status |
| --- | --- |
| Database Queries | {{PASS / FAIL}} |
| API Performance | {{PASS / FAIL}} |
| Frontend Performance | {{PASS / FAIL}} |
| Resource Usage | {{PASS / FAIL}} |

**Issues:** {{"Finding #n" or "Improvement #n — <one line>" per issue, or "No performance concerns found."}}

---

## 6. Testing Review

### Existing Tests

- **Status:** {{passing / failing / not run — with the command used}}
- **Implemented:** {{YES / NO}}
- **Coverage:** {{which FR / AC the tests cover, and which have none}}

### Manual Verification

<!-- One row per scenario checked by hand, plus one per AC that could not be verified automatically.
     Use "Not run — <reason>" when a scenario still needs a person to run it. -->

| Scenario | Expected | Result | Status |
| --- | --- | --- | --- |
| {{AC-xx: steps}} | {{expected result}} | {{observed result}} | {{PASS / FAIL / Not run — reason}} |

---

## 7. Specification Impact Decision

<!-- Mandatory. Keep exactly one of the two options below and delete the other.
     SPEC UPDATE REQUIRED only for:
       Case 1 — specification error: the spec conflicts with an existing business rule, is impossible, or
                contradicts itself → corrected in place with /webkit-specify (Minor, no new version);
       Case 2 — approved requirement change: a stakeholder changed the requirement → new spec version (Major).
     Bug fixes (missing validation, wrong API response, UI alignment, typo, query optimization) never change the spec. -->

### NO SPEC CHANGE REQUIRED

**Reason:** {{e.g. "All findings are implementation issues and do not change the original requirements."}}

### SPEC UPDATE REQUIRED

**Reason:** {{Case 1 or Case 2, and why. e.g. "The original requirement conflicts with the approved business rule."}}

**Changed Sections:**

- {{section name}} — {{reason}}

---

## 8. Final Recommendation

<!-- Keep exactly one option. READY FOR MERGE only when there is no BLOCKER and no REQUIRED FIX. -->

### READY FOR MERGE

**Conditions:**

- No blockers
- No required fixes

### FIX REQUIRED BEFORE MERGE

**Required fixes:**

1. {{Finding #n — one-line action}}
2. {{Finding #n — one-line action}}

<!-- Run history -->
