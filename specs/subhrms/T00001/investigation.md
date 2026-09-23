# Investigation Report: Keyboard Transition Sync & "Also Send as" Delay

> **Ticket:** `T00001` (subhrms) — this file is `.agents/specs/subhrms/T00001/investigation.md`; fix it on branch `T00001`.
> **Run:** v1 — 2026-09-23 — initial.

## 1. Summary

- **Investigation Type:** UI / Performance Bug
- **Project:** SubHRMS (React Native / Expo / Reanimated)
- **Target Portal/Domain & Module:** Employee / Messages — `ConversationScreen`, `ThreadModal`, `ChatInputBar`, `useChatKeyboard`
- **Confidence Level:** High

---

## 2. Issue Description

### Issue A — Keyboard Transition Not Synchronized

**Expected Behavior:** When the user taps the message input, both the chat input bar and the native keyboard rise together in a single, smooth animation. The input should remain attached to the top edge of the keyboard at every frame.

**Actual Behavior:**
1. User taps the input.
2. The chat input bar moves **immediately** (reacts to `onFocus`).
3. The native keyboard begins appearing ~60–200 ms later.
4. A visible gap or stutter occurs between the two movements.

**Steps to Reproduce:**
1. Open any conversation.
2. Tap the message input field.
3. Observe the input/keyboard separation on open and on close.
4. Also verify in ThreadModal (slide-up sheet).

---

### Issue B — "Also Send as" Delay

**Expected Behavior:** When the user taps the "Also send to channel / as DM" checkbox in the thread composer and then sends, the UI responds immediately — the new reply appears in the thread list without noticeable latency.

**Actual Behavior:** There is a perceived delay or hesitation between tapping "Also Send as" and the visual reflection of the sent state.

---

## 3. Root Cause Analysis

### Root Cause A — Three Interacting Bugs in `useChatKeyboard.ts`

#### Bug A1 — `handleInputFocus` resets `bottomElevation` to `0` before keyboard opens

**Location:** [`useChatKeyboard.ts:L463-L465`](file:///Users/macbookpro/Desktop/app/projects/DockerTemplate/src/hrms/resources/views/mobapp/src/module/employee/messages/hooks/useChatKeyboard.ts#L463-L465)

```ts
} else if (!skipWhenDrawerOpen) {
  bottomElevation.value = 0;  // CULPRIT: drops bar before keyboard opens
}
```

`onFocus` (a JS-thread event) fires **before** the native keyboard animation starts. At this point `keyboard.height.value` is still `0`. Setting `bottomElevation = 0` collapses the root container's `paddingBottom` for the next frame — creating a drop that the user sees — and then the bar snaps back up when the keyboard event arrives.

#### Bug A2 — `useAnimatedReaction` OPENING branch skips the normal open case

**Location:** [`useChatKeyboard.ts:L188-L200`](file:///Users/macbookpro/Desktop/app/projects/DockerTemplate/src/hrms/resources/views/mobapp/src/module/employee/messages/hooks/useChatKeyboard.ts#L188-L200)

```ts
if (state === KeyboardState.OPENING) {
  isKeyboardActiveSV.value = true;
  if (drawerHeight.value > 0) {     // ONLY runs when drawer was previously open!
    const expected = cachedKeyboardHeight.value > 150
      ? cachedKeyboardHeight.value
      : DEFAULT_KEYBOARD_HEIGHT;
    if (expected > 150) {
      bottomElevation.value = expected;
    }
  }
  return;  // Falls through without pre-setting bottomElevation for normal open
}
```

When the user opens the keyboard from idle (no drawer, `drawerHeight.value === 0`), this reaction does nothing. `bottomElevation` stays at `0` while `keyboard.height` starts ticking from `0` — both values are `0` so the `Max()` in `animatedKeyboardStyle` is also `0`. The container stays collapsed until the keyboard listener fires later.

#### Bug A3 — `handleShow` listener snaps `bottomElevation` to the **final height immediately**

**Location:** [`useChatKeyboard.ts:L264-L272`](file:///Users/macbookpro/Desktop/app/projects/DockerTemplate/src/hrms/resources/views/mobapp/src/module/employee/messages/hooks/useChatKeyboard.ts#L264-L272)

```ts
const calculatedLift = h > 50 ? (navBarOffset > 0 ? h + navBarOffset : h) : 0;
const lift = Math.max(calculatedLift, kbH);
if (lift > 0) {
  bottomElevation.value = lift;   // Snaps to FINAL height before keyboard finishes animating
```

On iOS, `keyboardWillShow` fires with the **final** `endCoordinates.height` before the animation even starts. Setting `bottomElevation` to the final height makes `animatedKeyboardStyle`'s `Max(keyboard.height.value, bottomElevation.value)` always resolve to `bottomElevation` (final height) — the root container instantly jumps to full keyboard height while the keyboard is still sliding up. This is the visual "input moves first, keyboard follows later" symptom.

#### The Full Chain

```
User taps input
  → onFocus fires (JS-thread, immediate, keyboard not started)
  → handleInputFocus: bottomElevation = 0              ← DROP
  → [next frame] KeyboardState.OPENING worklet fires
  → useAnimatedReaction: if (drawerHeight > 0) → false → no-op
  → [iOS: keyboardWillShow, Android: keyboardDidShow]
  → handleShow: bottomElevation = endCoordinates.height ← INSTANT SNAP to full height
  → animatedKeyboardStyle: paddingBottom = finalHeight  ← root container jumps
  → keyboard.height animates 0 → finalHeight over ~350ms ← keyboard lags
```

The chat list compresses instantly (container padding jumped to full height), but the keyboard visual arrives ~350ms later — the inverse of what the user perceives as "input moved first".

---

### Root Cause B — `handleSend` in ThreadModal

**Location:** [`ThreadModal.tsx:L403-L433`](file:///Users/macbookpro/Desktop/app/projects/DockerTemplate/src/hrms/resources/views/mobapp/src/module/employee/messages/components/ThreadModal.tsx#L403-L433)

```ts
const handleSend = (text?: string) => {
  ...
  setIsSending(true);           // React 18 batches this with the next line:
  onSendReply(...);             // Optimistic insert already done in handleSendThreadReply
  composerRef.current?.clear();
  setAlsoSendToChannel(false);
  setReplyingTo(null);
  setIsSending(false);          // Cancels setIsSending(true) — spinner never shows (dead code)
  setTimeout(() => {
    scrollViewRef.current?.scrollToEnd({ animated: true });
    isSendingRef.current = false;
  }, 120);                      // 120ms hard delay before scrolling to new message
};
```

**Issues:**
1. `setIsSending(true)` immediately cancelled by `setIsSending(false)` in the same synchronous call — React 18 automatic batching means the spinner never renders. This is dead code that introduces a confusing false impression the send is pending.
2. The `setTimeout(..., 120)` creates a **hard 120ms delay** before the scroll to reveal the newly sent message. The optimistic insert (`setThreadRepliesMap` in `handleSendThreadReply`) is already immediate — the message IS in the list right away — but the user cannot see it for 120ms because the scroll hasn't happened yet.
3. The "Also Send as" checkbox toggle (`setAlsoSendToChannel`) is already instant — no issue there.

---

## 4. Scope & Dependencies

**Affected Files:**
- `hooks/useChatKeyboard.ts` — primary fix: 3 targeted changes
- `components/ThreadModal.tsx` — fix: scroll timing cleanup, dead code removal
- `components/ChatInputBar.tsx` — no change (already reads `keyboardHeightSV` live correctly)
- `pages/ConversationScreen.tsx` — no change (passes correct SVs, `animatedKeyboardStyle` logic is correct)

**Affected Database Tables / Models:** None.

**Affected API Endpoints / UI Views:** All conversation/thread screens.

---

## 5. Potential Solutions

| Option | Description | Pros | Cons | Risk & Complexity |
|---|---|---|---|---|
| **A (Recommended)** | (1) Remove `bottomElevation.value = 0` from `handleInputFocus`; (2) expand OPENING reaction to always pre-set `bottomElevation` to `cachedKeyboardHeight`; (3) in `handleShow` do NOT set `bottomElevation` — only update cache; (4) fix ThreadModal 120ms delay | Minimal diff — fixes exact root causes | Must re-test all drawer↔keyboard transitions | Low |
| **B** | Remove `bottomElevation` from keyboard-open paths entirely; rely on `keyboard.height` live value only | Cleanest architecture | Major refactor; drawer elevation pattern depends on `bottomElevation` | High |
| **C** | Add `withTiming` to mask jumps | Quick | Custom timing ≠ native curve, still desynced | Medium |

### Recommended Solution Rationale

Option A makes three targeted changes to fix the three specific lines causing desynchronization:

- Removing the `bottomElevation = 0` reset on focus means the bar doesn't drop before the keyboard arrives.
- Pre-setting `bottomElevation` to `cachedKeyboardHeight` on OPENING (always, not just when drawer is open) means `Max(keyboard.height, bottomElevation)` keeps the container at the expected final height while the keyboard animates up to meet it — **native-speed tracking**.
- Not setting `bottomElevation` in `handleShow` (only updating the cache) means the container tracks `keyboard.height` live rather than jumping to the final height on the JS event.

The ThreadModal fix removes the artificial 120ms delay — the scroll happens on the next animation frame after the optimistic insert completes.

---

## 6. Risk Assessment

- **Breaking Changes:** No
- **Regression Potential:** Medium — shared keyboard state. Must test drawer↔keyboard swap paths carefully.
- **Deployment & Migration Notes:** Frontend-only. No server downtime required.

---

## 7. High-Level Implementation Plan

### `useChatKeyboard.ts` — Keyboard sync fixes

1. `[x]` **`handleInputFocus` (L464):** Remove `bottomElevation.value = 0` in the `else if (!skipWhenDrawerOpen)` branch. The bar must not reset on focus — it stays where it is until keyboard animation begins.

2. `[x]` **`useAnimatedReaction` OPENING (L188-L199):** Remove the `if (drawerHeight.value > 0)` guard so `bottomElevation.value` is always pre-set to `cachedKeyboardHeight.value || DEFAULT_KEYBOARD_HEIGHT` when `OPENING` fires and `isInputFocusedSV.value === true`.

3. `[x]` **`handleShow` listener (L264-L272):** Remove `bottomElevation.value = lift`. Replace with only cache update: `if (lift > 150 && lift > cachedKeyboardHeight.value) { cachedKeyboardHeight.value = lift; seedHeight(lift); }`. Let `animatedKeyboardStyle`'s `Max(keyboard.height.value, bottomElevation.value)` drive the container via the live animated keyboard height.

### `ThreadModal.tsx` — "Also Send as" smoothness

4. `[x]` **`handleSend` (L429-L432):** Replace `setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 120)` with `requestAnimationFrame(() => scrollViewRef.current?.scrollToEnd({ animated: true }))`.

5. `[x]` **`handleSend` (L421, L428):** Remove dead `setIsSending(true)` / `setIsSending(false)` synchronous pair. Keep only `isSendingRef.current = true/false` guards.

### Testing & Verification Checklist

- [x] iOS: tap input → keyboard and bar rise together, no gap or jump
- [x] iOS: dismiss keyboard (tap away or swipe) → bar and keyboard fall together
- [x] iOS: drawer open → tap ✕ (switchToKeyboard) → keyboard opens without bar jump
- [x] Android: same three keyboard cases using `keyboardDidShow` path
- [x] Thread modal iOS: tap input → smooth synchronized rise
- [x] Thread modal Android: same
- [x] "Also Send as" toggle: immediate checkbox visual update (already working)
- [x] "Also Send as" send: reply appears immediately, scroll is instant (no 120ms lag)
- [x] Drawer height matches software keyboard height when switching via `+` and `✕` buttons
- [x] "Also send as" row collapses without delay on exit/dismissal
- [x] `npx tsc --noEmit` passes cleanly

---

## 8. Follow-up Fixes: Drawer Height Parity & "Also Send as" Exit Delay

### 1. Drawer Height ≠ Keyboard Height on Toggle (`+` / `✕`)
- **Root Cause:**
  - `calculatedLift` in `useChatKeyboard.ts` was adding `navBarOffset` (48px) to `h` (`e.endCoordinates.height`). On Android, `e.endCoordinates.height` is already the full measured software keyboard height from the bottom of the display. Adding 48px inflated the cached keyboard height and made the tools drawer 48px taller than the keyboard, creating a visible height jump when toggling between them with `+` and `✕`.
  - `getTargetHeight()` did not check `bottomElevation.value > 150` when the keyboard was open on Android, causing it to fall back to hardcoded defaults.
- **Fix:**
  - `useChatKeyboard.ts`: `lift` uses `h` directly without adding `navBarOffset`.
  - `getTargetHeight()` now checks `bottomElevation.value > 150` directly, guaranteeing the drawer adopts the exact live elevation of the bar.
  - Set Android fallback `DEFAULT_KEYBOARD_HEIGHT` to 280dp (standard Android keyboard height).

### 2. "Also Send as" Delayed Exit / Collapse Animation
- **Root Cause:**
  - On Android, `KeyboardState.CLOSED` worklet reaction never fires. In `hideSub`, `isInputFocusedSV` and `isKeyboardActiveSV` remained `true` until a 400ms safety timeout fired.
  - `MessageInputBar.tsx`'s `TextInput.onBlur` did not update `isInputFocused` to `false`, leaving `isExpanded` `true` throughout keyboard dismiss.
  - In `ThreadModal.tsx`, `alsoSendRowStyle` computed `progress = Math.max(kbProgress, alsoSendReveal.value)` even when collapsing. Because `alsoSendReveal.value` took 140ms after React re-renders to reach 0, it clamped the row at 1.0, causing the row to linger long after the keyboard was gone and then delay-collapse.
- **Fix:**
  - In `useChatKeyboard.ts`: On Android, `hideSub` immediately clears `isInputFocusedSV.value = false` and `isKeyboardActiveSV.value = false`. Added `handleInputBlur` callback.
  - In `MessageInputBar.tsx` & `ChatInputBar.tsx`: Wired `onInputBlur` on `TextInput.onBlur` to immediately trigger `setIsInputFocused(false)`.
  - In `ThreadModal.tsx`:
    - `alsoSendReveal` timing duration on collapse set to `0` (immediate).
    - `alsoSendRowStyle`: When collapsing (`!isExpanded`), `progress` uses `Math.min(kbProgress, alsoSendReveal.value)`, preventing `alsoSendReveal` from flooring or delaying the exit animation.
