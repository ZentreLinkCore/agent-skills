# Realtime: broadcasting, channels, Echo clients

Applies to broadcast events, channel authorization, and the Echo / Pusher / Reverb clients. Also read the rule for the side you touch: [backend.md](./backend.md) for events, [frontend.md](./frontend.md) or [mobile.md](./mobile.md) for listeners.

## 1. Verified setups

| | (Vue) | (Expo) | (React) |
| :--- | :--- | :--- | :--- |
| Server | `laravel/reverb` + `pusher/pusher-php-server` | `laravel/reverb` (in `backend/`) | **none**: no broadcasting package, no `routes/channels.php` |
| Connection switch | `BROADCAST_CONNECTION` (`pusher` or `reverb`), mirrored by `VITE_BROADCAST_CONNECTION` (web) and `EXPO_PUBLIC_BROADCAST_CONNECTION` (mobile) | per its `.env` | — |
| Channel auth | `routes/channels.php`, every pattern registered on **both** connections | `backend/routes/channels.php` | — |
| Events | `app/Events/<Domain>/` (`Messages/`, `Notifications/`) | `backend/app/Events/*Event.php` | — |
| Web client | `resources/views/web/app/echo.ts` (`getEcho()`) | — | — |
| Mobile client | `resources/views/mobapp/src/services/realtime/echo.ts` | `mobapp/src/services/echo.ts` | — |

(Vue): the switch is a **kill switch, not auto-detection**. The server and each client pick one broker each, set by hand to match; there is no runtime fallback. Changing brokers means changing all three variables together.

(React): realtime is a new capability there. Adding it is a spec decision (`/webkit-specify`), not an implementation detail.

## 2. Rules

- **Match the existing events.** Copy the shape of a sibling in the same `app/Events/<Domain>/`: (Vue)'s `NotificationCreated` implements `ShouldBroadcastNow`, broadcasts on `new PrivateChannel("user.{idacct}")`, and sets `broadcastAs()` and an explicit `broadcastWith()`.
- **Every private or presence channel is authorized** in `channels.php`, with the same ownership rule the matching REST endpoint enforces. A channel that any authenticated user can join is a finding.
- **Broadcast only what the listener may see**: an explicit `broadcastWith()` payload, never a whole model; no PII beyond the receiver's authorization ([security-baseline.md](../core/security-baseline.md)).
- **Broadcast after the write commits.** An event fired inside `DB::transaction(...)` can reach clients for rows that are then rolled back: dispatch it after the transaction returns.
- **The event name is a contract**: a renamed `broadcastAs()` or a changed payload breaks every web and mobile listener; change server and clients together.
- **Clients**: get the shared Echo instance from the project's `echo.ts`; never construct a second one. Leave channels and remove listeners on unmount ([performance.md](./performance.md)).
- **Tests**: a feature test asserts the event is dispatched with its channel and payload, and the channel authorization both ways (owner allowed, others rejected) ([testing.md](./testing.md)).
