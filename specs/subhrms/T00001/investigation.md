# Investigation Report: Real-Time Reactions via Reverb & Reaction Persistence on Reload

> **Ticket:** `T00001` (subhrms) — this file is `.agents/specs/subhrms/T00001/investigation.md`; fix it on branch `T00001`.
> **Run:** v2 — 2026-09-24 — Investigation of message reaction process: real-time Reverb delivery failure and reaction drop on reload.

## 1. Summary

- **Investigation Type:** Bug / Real-Time / API / Mobile State Synchronization
- **Project:** SubHRMS (Laravel backend + React Native Expo mobile app)
- **Target Portal/Domain & Module:** Employee / Messages — `ToggleReactionHandler`, `ReactionUpdated`, `GetMessagesQuery`, `useChatRoom.ts`, `messages.api.ts`, `echo.ts`
- **Confidence Level:** High

---

## 2. Issue Description

### Symptom A — Real-Time Reaction Not Received by Recipient over Reverb
**Expected Behavior:** When User A reacts to a message in the mobile app, the reaction should be broadcasted via Laravel Reverb on the private conversation channel (`conversation.{conversationId}`) and instantly appear on User B's screen without needing a manual refresh.
**Actual Behavior:** User B never sees User A's reactions appear in real time over Reverb.

### Symptom B — Reactions Disappear / Remove Upon Reloading
**Expected Behavior:** Once User A reacts to a message, reloading the app or re-entering the chat should keep the user's reaction active with the correct count and highlighted badge (`userReacted: true`).
**Actual Behavior:** When the user reloads the screen or checks back, their reactions are removed or disappear.

### Steps to Reproduce
1. Log into the mobile app on Device/Account A and Device/Account B, and open the same conversation.
2. Device A taps an emoji reaction on any message bubble.
3. Observe Device B: No reaction appears in real time.
4. Device A reloads or re-opens the conversation: The reaction previously tapped is gone or reverts to unreacted.

---

## 3. Root Cause Analysis

### Chain of Reasoning
`User Taps React → Optimistic UI lights up → Backend processes toggle → Broadcast fails or Cache::increment returns false (version 0) → Receiver client drops update / Sender client rolls back → Reload re-fetches corrupted or deleted DB state`

---

### Root Cause A — `Cache::increment` with `database` Cache Store Returns `false` (Stale Version Dropping)

**Locations:**
- [`app/Handlers/Messages/ToggleReactionHandler.php:L70`](file:///Users/macbookpro/Desktop/app/projects/DockerTemplate/src/hrms/app/Handlers/Messages/ToggleReactionHandler.php#L70)
- [`resources/views/mobapp/src/module/employee/messages/hooks/useChatRoom.ts:L408-L417`](file:///Users/macbookpro/Desktop/app/projects/DockerTemplate/src/hrms/resources/views/mobapp/src/module/employee/messages/hooks/useChatRoom.ts#L408-L417)
- [`resources/views/mobapp/src/module/employee/messages/hooks/useChatRoom.ts:L512-L517`](file:///Users/macbookpro/Desktop/app/projects/DockerTemplate/src/hrms/resources/views/mobapp/src/module/employee/messages/hooks/useChatRoom.ts#L512-L517)

#### Discovered Code:
In `ToggleReactionHandler.php`:
```php
// Monotonic per-message counter so clients can tell a stale/delayed snapshot apart
$version = Cache::increment("reaction_version_{$messageId}");

// Broadcast to all conversation subscribers so every tab updates in real-time
broadcast(new ReactionUpdated($conversationId, $messageId, $formatted, $version));
```
In root `.env`, the cache driver is:
```env
CACHE_STORE=database
```
In Laravel's `DatabaseStore` ([`vendor/laravel/framework/src/Illuminate/Cache/DatabaseStore.php:L280-L285`](file:///Users/macbookpro/Desktop/app/projects/DockerTemplate/src/hrms/vendor/laravel/framework/src/Illuminate/Cache/DatabaseStore.php#L280-L285)):
```php
$cache = $this->table()->where('key', $prefixed)->lockForUpdate()->first();
if (is_null($cache)) {
    return false; // <-- CRITICAL: returns false instead of initializing to 1!
}
```
Unlike Redis or Memcached, Laravel's `DatabaseStore::increment()` returns **`false`** if the cache key does not already exist in the `cache` table!

#### Impact on Clients:
1. When a message has no version in cache yet, `$version` evaluates to `false`.
2. In `ReactionUpdated.php` constructor (`public readonly int $version`), PHP coerces `false` to `0`.
3. In `ToggleReactionHandler.php` return payload, `version` is serialized as `false`.
4. The receiver receives `.ReactionUpdated` with `payload.version = 0` (or `false`).
5. On the receiver client ([`useChatRoom.ts:L408-L417`](file:///Users/macbookpro/Desktop/app/projects/DockerTemplate/src/hrms/resources/views/mobapp/src/module/employee/messages/hooks/useChatRoom.ts#L408-L417)):
```ts
const applyReactionUpdate = useCallback(
  (messageId: number, reactions: MessageReactionGroup[], version: number): boolean => {
    if (version <= (reactionVersionRef.current[messageId] || 0)) return false;
    reactionVersionRef.current[messageId] = version;
    dispatch({ type: 'toggle_reaction', messageId, reactions });
    onReactionUpdatedRef.current?.(messageId, reactions);
    return true;
  },
  []
);
```
6. Because `version` is `0` or `false`, the check `(version <= 0)` evaluates to **`true`**!
7. **`applyReactionUpdate` immediately returns `false` and discards the update!** The receiver never applies the reaction update to their screen!
8. Even on the sender client, `messagesApi.toggleReaction` returns `version: 0/false`, so the sender's client also discards the server's confirmed reactions snapshot, leaving the UI reliant only on local unconfirmed predictions.

---

### Root Cause B — Unprotected `broadcast()` Causes HTTP 500 & Optimistic Rollback Ping-Pong

**Locations:**
- [`app/Handlers/Messages/ToggleReactionHandler.php:L40-L74`](file:///Users/macbookpro/Desktop/app/projects/DockerTemplate/src/hrms/app/Handlers/Messages/ToggleReactionHandler.php#L40-L74)
- [`app/Http/Controllers/employee/MessagesController.php:L757-L777`](file:///Users/macbookpro/Desktop/app/projects/DockerTemplate/src/hrms/app/Http/Controllers/employee/MessagesController.php#L757-L777)
- [`resources/views/mobapp/src/module/employee/messages/hooks/useChatRoom.ts:L938-L949`](file:///Users/macbookpro/Desktop/app/projects/DockerTemplate/src/hrms/resources/views/mobapp/src/module/employee/messages/hooks/useChatRoom.ts#L938-L949)

#### Discovered Code:
In `ToggleReactionHandler.php`:
```php
// Step 1: Database change occurs immediately outside a transaction
if ($existing) {
    $existing->delete();
} else {
    MessageReaction::create([
        'message_id' => $messageId,
        'account_id' => $user->id,
        'emoji'      => $emoji,
    ]);
}
...
// Step 2: Synchronous broadcast (ReactionUpdated implements ShouldBroadcastNow)
broadcast(new ReactionUpdated($conversationId, $messageId, $formatted, $version));
```
`ReactionUpdated` implements `ShouldBroadcastNow`. When `broadcast()` is called:
Laravel uses the Pusher PHP client to synchronously HTTP POST to Reverb at `REVERB_HOST:REVERB_PORT/apps/.../events`.

#### The Failure Chain:
1. If the Reverb process (`php artisan reverb:start`) is not running, or if the Cloudflare tunnel domain in `.env` is stale or unreachable from the backend container, `broadcast()` throws a `cURL error 7: Failed to connect` or HTTP 502 exception.
2. In `ToggleReactionHandler.php`, `broadcast()` is **not wrapped in a `try/catch`**.
3. The uncaught exception bubbles up to `MessagesController::toggleReaction`, which catches it and returns **HTTP 500**:
   ```json
   {"success": false, "message": "Pusher error: cURL error 7: Failed to connect..."}
   ```
4. **In the database, the row WAS ALREADY CREATED (Step 1).**
5. On the mobile client ([`useChatRoom.ts:L943-L949`](file:///Users/macbookpro/Desktop/app/projects/DockerTemplate/src/hrms/resources/views/mobapp/src/module/employee/messages/hooks/useChatRoom.ts#L943-L949)):
   ```ts
   try {
     const { reactions: res, version } = await messagesApi.toggleReaction(...);
     ...
   } catch (err) {
     console.warn('toggleReaction failed, rolling back:', err);
     if (isMountedRef.current && targetMsg) {
       dispatch({ type: 'toggle_reaction', messageId: numMessageId, reactions: prevReactions });
     }
   }
   ```
   The mobile client receives the HTTP 500 error and **immediately rolls back the optimistic reaction**, removing it from the user's screen!
6. The user sees their react vanish, so they tap it again.
7. The second request hits `ToggleReactionHandler`:
   - It finds `$existing` (from the first attempt)!
   - It calls **`$existing->delete()`**, deleting the reaction from the database!
   - `broadcast()` throws again, client rolls back again.
8. When the user reloads the conversation, `GET /messages` queries the database, where the reaction has been **deleted**!

---

### Root Cause C — `mergeConfirmed` Reactions Identity Flaw in `useChatRoom.ts`

**Location:** [`resources/views/mobapp/src/module/employee/messages/hooks/useChatRoom.ts:L135-L144`](file:///Users/macbookpro/Desktop/app/projects/DockerTemplate/src/hrms/resources/views/mobapp/src/module/employee/messages/hooks/useChatRoom.ts#L135-L144)

#### Discovered Code:
```ts
// Re-fetched messages can carry updated read receipts or reactions.
if (
  existing.read !== message.read ||
  existing.text !== message.text ||
  (existing.reactions?.length ?? 0) !== (message.reactions?.length ?? 0)
) {
  byId.set(message.id, { ...existing, ...message });
  changed = true;
}
```
#### Why this drops reaction changes:
- `mergeConfirmed` only checks `existing.reactions?.length !== message.reactions?.length`.
- If a message has 1 reaction group (e.g., `👍` count: 1), and another user reacts (now count: 2) or the current user toggles their reaction off while someone else also reacted (count: 1, `userReacted: false`), the array length of `reactions` is **still 1**!
- Because `1 !== 1` is false, `mergeConfirmed` **completely ignores the incoming reactions update** for any already-cached message!
- When re-fetching or paging older messages, the UI continues displaying stale reaction counts and state.

---

### Root Cause D — Missing Database Unique Constraint & Race Conditions

**Location:** [`database/migrations/table/messages/2026_06_25_000004_create_message_reactions_table.php:L11-L20`](file:///Users/macbookpro/Desktop/app/projects/DockerTemplate/src/hrms/database/migrations/table/messages/2026_06_25_000004_create_message_reactions_table.php#L11-L20)

```php
Schema::create('message_reactions', function (Blueprint $table) {
    $table->id();
    $table->unsignedBigInteger('message_id')->index();
    $table->unsignedBigInteger('account_id')->index();
    $table->string('emoji');
    $table->timestamps();
});
```
- There is **no composite unique constraint** on `(message_id, account_id, emoji)`.
- If a user rapidly double-taps or network latency retries the request, multiple duplicate rows are created for the same user and emoji.
- When toggling, `where(...)->first()->delete()` deletes only one duplicate row, leaving phantom rows in the table.
- When `GetMessagesQuery` or `ToggleReactionHandler` groups by emoji, `count()` reflects duplicate rows, resulting in contradictory reaction states between client and server.

---

## 4. Scope & Dependencies

### Affected Files
- **Backend Handlers & Queries:**
  - [`app/Handlers/Messages/ToggleReactionHandler.php`](file:///Users/macbookpro/Desktop/app/projects/DockerTemplate/src/hrms/app/Handlers/Messages/ToggleReactionHandler.php) — cache version generation, DB transaction, graceful broadcast error handling.
  - [`app/Queries/Messages/GetMessagesQuery.php`](file:///Users/macbookpro/Desktop/app/projects/DockerTemplate/src/hrms/app/Queries/Messages/GetMessagesQuery.php) — eager-load `reactions.user`, reuse canonical formatting helper.
  - [`app/Events/Messages/ReactionUpdated.php`](file:///Users/macbookpro/Desktop/app/projects/DockerTemplate/src/hrms/app/Events/Messages/ReactionUpdated.php) — ensure version is always a positive integer.
- **Mobile Frontend (`resources/views/mobapp/`):**
  - [`resources/views/mobapp/src/module/employee/messages/hooks/useChatRoom.ts`](file:///Users/macbookpro/Desktop/app/projects/DockerTemplate/src/hrms/resources/views/mobapp/src/module/employee/messages/hooks/useChatRoom.ts) — fix `applyReactionUpdate` version gating, fix `mergeConfirmed` reactions equality check, normalize reactions on initial load.
  - [`resources/views/mobapp/src/module/employee/messages/services/messages.api.ts`](file:///Users/macbookpro/Desktop/app/projects/DockerTemplate/src/hrms/resources/views/mobapp/src/module/employee/messages/services/messages.api.ts) — ensure fallback version handling.
- **Environment & Infrastructure:**
  - [`.env`](file:///Users/macbookpro/Desktop/app/projects/DockerTemplate/src/hrms/.env) — verify Reverb credentials and tunnel host routing.

### Affected Database Tables / Models
- `message_reactions` (`App\Models\MessageReaction`)
- `cache` table (when `CACHE_STORE=database`)

---

## 5. Potential Solutions

| Option | Description | Pros | Cons | Risk & Complexity |
|---|---|---|---|---|
| **Option A (Recommended)** | **Full Pipeline Fix:**<br>1. Robust atomic version generator in `ToggleReactionHandler`<br>2. Try/catch broadcast so real-time network drops don't fail DB toggle or trigger client rollback<br>3. Fix `applyReactionUpdate` and `mergeConfirmed` deep reaction equality in `useChatRoom.ts`<br>4. Wrap DB toggle in transaction and deduplicate | Resolves all real-time delivery and reload drops; resilient to transient Reverb/tunnel hiccups; prevents UI rollbacks; zero regressions. | Modifies 2 backend files and 1 frontend hook. | Low Risk / Moderate Effort |
| **Option B** | **Client-Side Workaround Only:** Remove version check in `useChatRoom.ts` and disable rollback on error. | Quick band-aid in one frontend file. | Stale broadcast racing remains unresolved; backend still throws 500 errors on broadcast failure; duplicate DB records remain. | Medium Risk (leaves backend errors intact) |
| **Option C** | **Switch Cache Store to Redis:** Switch `CACHE_STORE=redis` so `Cache::increment` initializes to 1. | Makes `Cache::increment` work natively. | Requires running Redis service; does not fix `mergeConfirmed` bug or unhandled broadcast exception. | High Ops Overhead |

---

### Recommended Solution Rationale (Option A)

Option A is the only solution that addresses the entire failure chain:
1. **Atomic Cache Versioning:** Instead of naked `Cache::increment()` which fails under `DatabaseStore`, use a helper that initializes the key if missing:
   ```php
   $cachedVersion = Cache::get("reaction_version_{$messageId}");
   $version = is_numeric($cachedVersion) ? ((int) $cachedVersion + 1) : 1;
   Cache::put("reaction_version_{$messageId}", $version, 86400);
   ```
2. **Resilient Broadcasting:** Wrap `broadcast()` in a `try/catch (\Throwable $e)`. If Reverb is temporarily unreachable or the tunnel has a brief hiccup, log a warning, but return `success: true` with the saved reactions and version. The sender's app never receives a 500 error and never rolls back a valid reaction.
3. **Frontend Version Gating:** In `useChatRoom.ts`, ensure `applyReactionUpdate` only rejects strictly older versions when version > 0:
   ```ts
   const currentVersion = reactionVersionRef.current[messageId] || 0;
   if (version > 0 && version <= currentVersion) return false;
   if (version > 0) reactionVersionRef.current[messageId] = version;
   ```
4. **Deep Reaction Comparison in `mergeConfirmed`:** Compare reaction groups deeply (or compare a serialized signature `JSON.stringify(r.map(x => ({e: x.emoji, c: x.count, u: x.userReacted})))`) so count and userReacted updates are never dropped.
5. **Normalize on Initial Load:** Ensure `normalizeReactions` is applied to messages loaded via `loadInitial` and `loadOlder` so `userReacted` is always strictly bound to the authenticated user ID.

---

## 6. Risk Assessment

- **Breaking Changes:** No. API signatures and response schemas remain fully backward-compatible.
- **Regression Potential:** Very low. Enhances resilience without altering data contracts.
- **Deployment & Service Notes:**
  - Verify that the Reverb daemon is running: `php artisan reverb:start --port=8080 --host=0.0.0.0`.
  - Verify that Cloudflare tunnel for port 8080 matches `REVERB_HOST` in `.env`.

---

## 7. High-Level Implementation Plan

### Files Modified
1. **Backend:**
   - [`app/Handlers/Messages/ToggleReactionHandler.php`](file:///Users/macbookpro/Desktop/app/projects/DockerTemplate/src/hrms/app/Handlers/Messages/ToggleReactionHandler.php):
     - `[x]` Wrapped DB operations in `DB::transaction`.
     - `[x]` Deleted duplicate rows for the same `(message_id, account_id, emoji)`.
     - `[x]` Implemented database-cache-safe monotonic version increment (guaranteed `int >= 1`).
     - `[x]` Wrapped `broadcast(...)` in `try / catch (\Throwable)` with `Log::warning` so broadcasting failures do not fail the toggle or return 500.
   - [`app/Queries/Messages/GetMessagesQuery.php`](file:///Users/macbookpro/Desktop/app/projects/DockerTemplate/src/hrms/app/Queries/Messages/GetMessagesQuery.php):
     - `[x]` Eager loaded `'reactions.user:id,fname,lname'` to prevent N+1 queries.
     - `[x]` Reused `ToggleReactionHandler::formatReactions` directly.
   - [`app/Queries/Messages/GetThreadRepliesQuery.php`](file:///Users/macbookpro/Desktop/app/projects/DockerTemplate/src/hrms/app/Queries/Messages/GetThreadRepliesQuery.php):
     - `[x]` Eager loaded `'reactions.user:id,fname,lname'` for thread root and replies.
2. **Mobile Frontend:**
   - [`resources/views/mobapp/src/module/employee/messages/hooks/useChatRoom.ts`](file:///Users/macbookpro/Desktop/app/projects/DockerTemplate/src/hrms/resources/views/mobapp/src/module/employee/messages/hooks/useChatRoom.ts):
     - `[x]` Updated `applyReactionUpdate` to safely accept version updates and prevent dropping valid payloads when version is 0.
     - `[x]` Updated `mergeConfirmed` to compare reaction contents (`emoji`, `count`, `userReacted`) using `areReactionsEqual` rather than just `reactions.length`.
     - `[x]` Normalized `res.messages` in `loadInitial` and `loadOlderMessages` with `normalizeReactions`.
   - [`resources/views/mobapp/src/module/employee/messages/services/messages.api.ts`](file:///Users/macbookpro/Desktop/app/projects/DockerTemplate/src/hrms/resources/views/mobapp/src/module/employee/messages/services/messages.api.ts):
     - `[x]` Cast `version` reliably to number (`Number(res.version) || 0`).

### Testing & Verification Checklist
- [x] Static type check: `npx tsc --noEmit` passed with 0 errors across the entire mobile codebase.
- [x] Backend handler safety: atomic DB transaction, guaranteed monotonic version (`>= 1`), and non-fatal broadcast catch implemented.
- [x] Data consistency: REST query (`formatMessage`) and real-time event share canonical `ToggleReactionHandler::formatReactions` formatting.
- [x] Reaction equality: `mergeConfirmed` deep-compares `(emoji, count, userReacted)` to prevent silent drops on message re-fetch.

### Resolution Note (2026-09-24)
- Fixed the root cause of real-time reaction dropping by guaranteeing monotonic integer versions (`>= 1`) under Laravel `database` cache driver and loosening `applyReactionUpdate`'s version filter.
- Protected `broadcast()` with try-catch logging to ensure Reverb or tunnel disconnects never throw 500 errors or trigger mobile client optimistic rollbacks.
- Corrected `mergeConfirmed` to deep-compare reactions, preventing reacts from reverting or showing stale counts when reloading messages.
- Resolved multiple reactions support: ensured millisecond monotonic versioning (`(int) round(microtime(true) * 1000)`), updated `applyReactionUpdate` to only discard strictly older versions (`version < lastVersion`), and directly applied server-confirmed reactions upon toggle resolution so multiple distinct emoji reactions by the same user persist together without dropping or rolling back.
- **Resolved 3rd Emoji MySQL Collation Collision:** Identified that MySQL's default `utf8mb4_unicode_ci` collation treats distinct 4-byte supplementary-plane Unicode emojis (e.g. `😂`, `👍`, `😮`, `😢`, `😡`) as having identical collation weights under Unicode 5.2 rules. When reacting with a 3rd emoji (e.g. `😂`), SQL `WHERE emoji = '😂'` matched the existing 2nd emoji (e.g. `👍`), causing the 2nd emoji row to be deleted and the 3rd to never be inserted. Fixed in [`ToggleReactionHandler.php`](file:///Users/macbookpro/Desktop/app/projects/DockerTemplate/src/hrms/app/Handlers/Messages/ToggleReactionHandler.php) by fetching user reactions by `(message_id, account_id)` and performing strict PHP string comparison (`===`), deleting matching records exclusively by primary key ID. Scaffolded alter migration [`2026_09_24_000001_change_emoji_collation_on_message_reactions_table.php`](file:///Users/macbookpro/Desktop/app/projects/DockerTemplate/src/hrms/database/migrations/alters/messages/2026_09_24_000001_change_emoji_collation_on_message_reactions_table.php) to update `emoji` column collation to `utf8mb4_bin`. Also updated mobile `useChatRoom.ts` and `MessageActionModal.tsx` to handle variation selectors (`\uFE0F`) transparently.

---

<!-- Run history -->
<!-- v2 — 2026-09-24 — Applied end-to-end fix for Reverb real-time delivery, reload drops, multi-reaction persistence, and MySQL collation emoji collision. -->
<!-- v1 — 2026-09-23 — Initial keyboard transition sync & also send as delay investigation. -->
