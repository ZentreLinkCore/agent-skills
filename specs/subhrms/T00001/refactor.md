# Webkit Refactor Record

## Metadata

| Field | Value |
| --- | --- |
| Ticket | T00001 (subhrms) — target is the `mobapp` React Native / Expo app, filed under this ticket as in [`design-review.md` §0](design-review.md) |
| Branch | `T00001` (`resources/views/mobapp` repo; this record in the `hrms` repo, also on `T00001`) |
| Refactor Goal | Make `useChatKeyboard` the single owner of the composer's keyboard / drawer state: one lift formula, hook actions instead of screens editing its refs and shared values, dead options and returns removed — design and behavior unchanged |
| Source | User request (`/webkit-refactor`): "refactor all the input → keyboard → drawer code, keep the design, delete the scripts and redesign them so we can see the real bug" — the redesign part is outside this skill (§7) |
| Refactor Date | 2026-10-09 |
| Refactor Run | v1 — initial |

---

## 1. Summary

### Refactor Status

⚠ PRESERVED WITH UNVERIFIED AREAS

### Summary

The composer's bottom-area logic was spread over four files: two identical lift formulas in the hook plus a third copy in `ChatInputBar`, eleven hand-written copies of the same "drop the keyboard claim" block in `ConversationScreen`, and two copies of the drawer-or-focus block. They now go through one `computeBottomLift()` worklet and three hook actions, the screens no longer write the hook's refs or shared values for these flows, and dead options and returns are gone. Typecheck and lint pass with no rule count higher than baseline; on-device behavior was not exercised.

---

## 2. Scope

- **In scope:** `mobapp/src/module/employee/messages/hooks/useChatKeyboard.ts`, `components/ChatInputBar.tsx`, `components/ThreadModal.tsx`, `pages/ConversationScreen.tsx`.
- **Out of scope:** `components/MessageInputBar.tsx` (its own focus state and keyboard listeners — removing them changes behavior), the visual design, and every behavior change listed in §7.

---

## 3. What Moved Where

| Before | After | Why |
| --- | --- | --- |
| `hooks/useChatKeyboard.ts` `animatedKeyboardStyle` + `animatedSlotStyle` — the same lift computed inline twice | `hooks/useChatKeyboard.ts:110` `computeBottomLift()` worklet, called by both styles | One formula, one place (duplicate-prevention.md) |
| `components/ChatInputBar.tsx` `animatedContainerStyle` — a third lift copy fed by `bottomElevation`, `isKeyboardActiveSV`, `keyboardHeightSV` props | `useChatKeyboard.ts:409` `bottomLift` (`useDerivedValue` of `computeBottomLift`) → `ChatInputBar.tsx:312` reads the `bottomLift` prop | The code comment already required the two to "agree frame for frame"; now they read the same value |
| `pages/ConversationScreen.tsx` 11 inline copies (pre-refactor lines 1150, 1175, 1187, 1268, 1281, 1338, 1354, 1369, 2222, 2274, 3789) of `isInputFocusedRef / isInputFocusedSV / isKeyboardOpenRef / isKeyboardActiveSV / bottomElevation` resets | `useChatKeyboard.ts:633` `releaseKeyboardClaim()` | The hook owns its state; screens call an action instead of writing its internals |
| `pages/ConversationScreen.tsx` `handleReply` and `handleEditMessage` drawer-or-focus block (2 copies, incl. the 120 ms repeat) | `useChatKeyboard.ts:622` `focusComposer()`; call sites are `focusComposer(); setTimeout(focusComposer, 120);` | Same as above |
| `useChatKeyboard.ts` `resetKeyboardState` first five statements | `releaseKeyboardClaim()` inside `resetKeyboardState` | Reuse within the hook |
| `useChatKeyboard.ts` header comment (stated the live height "is never max()'d against bottomElevation", while the code does exactly that) | Header rewritten to describe the code as it runs: lift inputs, who updates them, the actions | documentation.md — comments match the code |

---

## 4. Duplication Removed

| Removed Copy | Replaced By | Coverage Check |
| --- | --- | --- |
| Inline lift in `animatedKeyboardStyle` and `animatedSlotStyle` | `computeBottomLift()` | Algebraically identical: old `kbLift` equals `keyboard.height` whenever it is used (`isKb` requires height > 0); the `navBarOffset` term was 0 (option had no callers) |
| `ChatInputBar` lift formula | `bottomLift` | The two formulas differ only when the input is unfocused, no keyboard is ours and the drawer is up; then both lifts are ≥ `drawerHeight` (> 150 — `openDrawer` sizes it from `getTargetHeight`, default ≥ 260) and `paddingBottom = max(extraBottomInset − lift, 0)` is 0 either way (`extraBottomInset = max(inset − 12, 0)`, far below 150) |
| 11 claim-release blocks in `ConversationScreen` | `releaseKeyboardClaim()` | Same five assignments; their order within each block is irrelevant (synchronous JS writes). The developer comment inside the thread-open effect is kept above the call |
| 2 drawer-or-focus blocks in `ConversationScreen` | `focusComposer()` | Same two branches; the 120 ms repeat still re-reads `isDrawerOpenRef` when it fires |

---

## 5. Regression Evidence

| Check | Command | Before | After |
| --- | --- | --- | --- |
| TypeScript | `npx tsc --noEmit -p .` (in `mobapp`) | PASS — 0 errors | PASS — 0 errors |
| Lint (project `expo lint` config) | `npx eslint` on the 5 composer files | ChatInputBar 0e/0w · MessageInputBar 0e/0w · ThreadModal 1e/7w · useChatKeyboard 18e/2w · ConversationScreen 58e/37w | ChatInputBar 0e/0w · MessageInputBar 0e/0w · ThreadModal 1e/7w · useChatKeyboard 18e/2w · ConversationScreen 22e/28w — no rule's count increased (ConversationScreen: immutability 52→16, exhaustive-deps 19→15, no-unused-vars 16→11) |
| JS tests | — | Not run — `mobapp` defines no test runner (scripts: start, android, ios, web, lint, reset-project) | Not run — same |
| On-device behavior | — | Not run — no device or emulator session; the app needs a native build and a backend login | Not run — same |

- **API payloads:** N/A — no endpoint touched (frontend only).
- **Behavior change:** None intended. Two side effects with no visible result: ThreadModal no longer passes a new no-op `onKeyboardShow` arrow each render, so the hook stops re-subscribing its keyboard listeners on every ThreadModal render; `ChatInputBar` reads the lift from a derived value instead of computing it.
- **Unverified areas:** keyboard / drawer behavior on Android and iOS (needs a device run: tap input, (+) → X, rapid (+)/X, open/close thread); `bottomLift` is a `useDerivedValue` — Reanimated runs it before the styles that read it in the same frame, but that was not observed on a device.

---

## 6. Files Changed

- **Modified:** `resources/views/mobapp/src/module/employee/messages/hooks/useChatKeyboard.ts`, `resources/views/mobapp/src/module/employee/messages/components/ChatInputBar.tsx`, `resources/views/mobapp/src/module/employee/messages/components/ThreadModal.tsx`, `resources/views/mobapp/src/module/employee/messages/pages/ConversationScreen.tsx`
- **Added:** `.agents/specs/subhrms/T00001/refactor.md`
- **Deleted:** None.

Removed from the hook's API (no consumer read them): options `navBarOffset` (no caller passed it) and `useStateReaction` (every caller passed `true`); returns `isKeyboardActiveSV`, `isInputFocusedSV`, `cachedKeyboardHeight`, `measuredKeyboardHeight`, `keyboardWaitTimeout`, `setIsInputFocused`, `setIsKeyboardVisible`, `setFocusRequestId`, `keyboard`, `DEFAULT_KEYBOARD_HEIGHT`. Unused destructured members removed from both screens.

---

## 7. Deliberately Not Done

- **Deleting the keyboard / drawer code and redesigning it to expose the real bug** — Authority boundary: a rewrite with new behavior belongs to `/webkit-investigate` (prove the root cause) then `/webkit-fix`, or `/webkit-specify` → `/webkit-implement` for a new design. Not done here. The suspected causes below are the starting points.
- **State tracked in many places that must agree** — focus and keyboard live in the hook's `isInputFocused` (state) + `isInputFocusedRef` + `isInputFocusedSV` + `isKeyboardOpenRef` + `isKeyboardActiveSV`, the drawer in `isDrawerOpen` + `isDrawerOpenRef`, plus `isSwitchingToKeyboardRef` and `isDismissingDrawerRef`; `MessageInputBar` keeps another copy (`isInputFocused` / `isKeyboardVisible`) with its own `Keyboard` listeners (`MessageInputBar.tsx:331-345`). Keyboard events arriving out of order leave them disagreeing — the likely source of the "sometimes" bugs (card collapsing, bar held with no keyboard). One explicit mode (idle / keyboard / drawer / swapping) would remove the class — would change behavior → `/webkit-investigate`.
- **Time-based guards** — `isDismissingDrawerRef` 300 ms (`useChatKeyboard.ts:463`, `:490`), `isSwitchingToKeyboardRef` 500 ms (`:500`), focus retries at rAF / 60 / 180 ms, drawer-retire fallback 600 ms (`:259`), no-keyboard safety net 1000 ms (`:549`). Outcomes depend on how fast the device and JS thread are — would change behavior → `/webkit-investigate`.
- **Keyboard height cached three ways plus a guess** — `measuredKeyboardHeight` (ref), `cachedKeyboardHeight` (shared value), the module `keyboardHeightCache`, and `DEFAULT_KEYBOARD_HEIGHT`. `seedHeight` (`useChatKeyboard.ts:271`) stores the raw Android event height, which excludes the navigation bar, unlike the lift (`h + insets.bottom`). A drawer sized from the guess or the seed differs from the real keyboard, so the bar moves when the keyboard settles. Kept as-is: removing `seedHeight` changes the case where it is the only write → `/webkit-investigate`.
- **Partial claim release** — `handleForward` (`ConversationScreen.tsx:2141`) and `handlePressReplyQuote` (`:2752`) reset only `isKeyboardOpenRef` and `bottomElevation`, unlike the eleven full releases; there the bar follows the closing keyboard instead of dropping. Unifying changes the closing animation — needs a decision.
- **Two ways to focus the composer for reply / edit** — ThreadModal (`ThreadModal.tsx:251-283`) uses `composerRef.focus()` with rAF / 80 ms; ConversationScreen uses `focusComposer()`. Not identical, so not merged.
- **`handleBack`** sets `drawerHeight` to 0 but leaves `isDrawerOpen` true until the blur cleanup — kept, since changing it collapses the composer during the back transition.
- **Unrelated lint findings in touched files** (ThreadModal unused `X` / `messagesApi`, ConversationScreen `preserve-manual-memoization` on `handleCreateChannelWithUser`, pre-existing `isDrawerOpenRef` missing-dependency warnings) — out of scope.

<!-- Run history -->
