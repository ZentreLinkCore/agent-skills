# Performance Standards

## Purpose

This document establishes efficiency standards, loading priorities, and performance guidelines to keep frontend rendering fast and backend query executions scalable.

## Scope

Applicable to all frontend views, scripts, API request functions, and backend queries, routes, and migrations.

## Responsibilities

- **AI Agent**: Implements N+1 query prevention on the backend, debounces user inputs on the frontend, and cancels pending requests during unmount events.
- **Developer/User**: Identifies server bottlenecks, indexing requirements, and performance profile evaluations.

## Actionable Rules

1. **Frontend Optimization**:
   - **Lazy Loading**: Lazy-load dynamic routes (e.g. `() => import(...)` in Vue/React routing setup) and asynchronous components for heavy modals/views.
   - **Input Debouncing**: Apply debounce (typically 300ms) to text inputs that fire requests (e.g., search text inputs) to minimize redundant database queries.
   - **Memory Cleanup**: Clean up timeouts, intervals, resize observers, and custom event listeners in the component unmount lifecycles (`onUnmounted` or `useEffect` return function).
2. **Backend Query Optimization**:
   - **Eager Loading**: Eager-load relationships (e.g. using `with()` in Eloquent) in list views to prevent N+1 query loops.
   - **Column Selectivity**: Do not execute wide scans (`select *`) if only a few key columns are needed.
   - **Data Pagination**: Implement page-based or cursor-based pagination for tables containing more than a few dozen records.
   - **Batch Chunking**: Chunk, lazy load, or iterate large dataset operations to avoid server memory exhaustion.

## Best Practices

- **Query Caching**: Store repetitive queries inside local or redis caches.
- **Virtual Scrolling**: Implement virtual scrolls for very long scroll areas (hundreds of items).

## AI Behavior Expectations

- **Optimization Scoping**: The agent must proactively review model connections and loops to prevent N+1 queries.
- **Snippet-Based Analysis**: Avoid loading massive payload tables when checking performance patterns.
