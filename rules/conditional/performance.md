# Performance

Keep rendering fast and queries scalable. The agent prevents N+1s and leaks proactively; the user owns profiling and indexing decisions on production data.

## Frontend

- **Lazy-load** dynamic routes (`() => import(...)`) and heavy modals or views.
- **Debounce** inputs that fire requests (typically 300 ms).
- **Clean up** timeouts, intervals, resize observers, event listeners, and realtime subscriptions on unmount (`onUnmounted` / the `useEffect` cleanup).
- **Virtual scrolling** for lists of hundreds of items.

## Backend

- **Eager-load** relationships in list views (`with()`); review loops over queries for N+1s.
- **Select only the columns needed**; no wide `select *` scans.
- **Paginate** (page or cursor) any table that can exceed a few dozen rows.
- **Chunk or lazy-iterate** large dataset operations (`chunk()`, `lazy()`) to avoid memory exhaustion.
- **Cache** repeated, expensive queries (local or Redis), invalidated on write.
- Index newly filtered or joined columns ([database.md](./database.md)).

Report a performance problem only with a measurable impact: query count, rows loaded, requests per action, render count.
