---
name: webkit-migrate
description: >
  Migrates functionality FROM a legacy project INTO the current project (the one this skill lives in),
  adapting it to the current project's architecture, framework, conventions, and design system — migrate
  the functionality, not the legacy files. Backend-first: traces the full chain (route → controller →
  handler/action/service → query → model → database) and searches the current project for equivalent
  functionality to Reuse → Extend → Refactor before Creating anything. Optimizes during migration and
  removes only confirmed redundancy. Project-agnostic. The legacy project is read-only.
  Triggered by `/webkit.migrate <legacy-route>`, where the route is the page's route in the legacy app
  (e.g. `/pages/dashboard`), resolved through the legacy router — not a file path.
---

# WebKit Migration Skill

## Purpose

The Migration Skill is responsible for migrating functionality from a **legacy project** into a **current project**.

This skill is **project-agnostic**. Do not mention, assume, or hardcode any specific project name, application, business domain, or framework.

The primary goal is:

> **Migrate the required functionality from the legacy project into the current project while adapting it to the current project's architecture, technology, conventions, and design system.**

The migration must not be treated as a simple copy-and-paste operation.

The legacy project provides the reference for:

* Existing functionality
* Business behavior
* Business rules
* Data requirements
* Existing workflows
* Legacy dependencies

The current project provides the source of truth for:

* Architecture
* Framework
* Packages
* Folder structure
* Coding conventions
* Database conventions
* API conventions
* Frontend conventions
* UI/UX design system

---

# Project Structure

The migration environment contains two project folders:

```text
<legacy-project-folder>
<current-project-folder>
```

The `<legacy-project-folder>` contains the original implementation.

The `<current-project-folder>` contains the project where the functionality will be migrated.

The migration skill is located inside the current project:

```text
<current-project-folder>
```

The skill must be able to inspect both projects.

Do not assume that the current project uses the same framework or architecture as the legacy project.

> **Write scope.** The legacy project is **read-only**. Every write goes into the current project. If the legacy project carries its own agent rules, they describe the legacy project — they never govern the migrated code.

## Resolving the Legacy Route

The argument is a **route of the legacy app, not a file path**: only the route, starting with `/`.

```text
/webkit.migrate /pages/dashboard
```

1. **Read the route.** If it carries a query string or `#hash`, set that aside: it is not part of the route, but note it, since it often shows which filter, tab, or record the page was opened with.
2. **Match the route against the router definitions**, never against folder or file names. Either side can own a route, so check both:
   * **Backend web routes** (e.g. Laravel `routes/web.php` and the files it includes). Apply group prefixes. If the only match is a catch-all that serves a single-page app (e.g. `/{any}`), the real route lives in the frontend router.
   * **Frontend router** (e.g. Vue Router or React Router definitions, including route modules and nested children). Join parent and child paths to get the full path.
   * **File-based routing** (e.g. a `pages/` directory), where the folder structure is the route.

   A route with real values matches a parameterized route: `/employees/15/edit` → `/employees/:id/edit` or `/employees/{id}/edit`. Prefer the most specific match.
3. **Find the legacy project.** If the user's message names the legacy folder, use it. Otherwise search the sibling folders of the current project for one whose routes match (step 2). Exactly one → that is the legacy project. None, or more than one → ask the user which folder is the legacy project. Do not guess.
4. **Take the entry point.** The matched route names a page component or a controller; that is where **Trace** starts. From a page component, also follow every API call it makes back to the backend routes that serve them.

State what was resolved before tracing:

```text
Route:   /pages/dashboard
Legacy:  <legacy-project-folder>, defined in <router file>:<line>
Entry:   <page component or controller>
Current: <current-project-folder>
```

If no router defines the route, say so and ask. Do not fall back to guessing a file from the words in the route.

---

# Migration Command

The migration command is:

```text
/webkit.migrate <legacy-route>
```

Example:

```text
/webkit.migrate /pages/dashboard
```

The supplied route identifies the functionality/page to migrate from the legacy project. Give only the route, starting with `/`.

For example:

```text
/webkit.migrate /pages/dashboard
```

means:

```text
Route:
/pages/dashboard

Legacy:
the page the legacy app serves at /pages/dashboard
(found through <legacy-project-folder>'s route definitions)

Current:
<current-project-folder>
```

The skill must locate the actual implementation behind the requested route rather than assuming that the route maps to a file or folder with the same name.

The route may lead to a:

* Page
* Module
* Feature
* API endpoint
* Backend functionality
* Frontend functionality

The skill should trace the implementation from the route's entry point (see **Resolving the Legacy Route**).

---

# Core Migration Principle

The skill must follow:

> **Migrate the functionality, not the legacy implementation itself.**

Do not blindly copy legacy files into the current project.

Instead:

```text
Legacy functionality
        ↓
Analyze behavior
        ↓
Trace dependencies
        ↓
Inspect current project
        ↓
Find reusable functionality
        ↓
Map to current architecture
        ↓
Optimize
        ↓
Implement
        ↓
Validate
```

The final implementation should behave correctly while being a native part of the current project.

---

# Backend-First Migration

The primary focus of this skill is the **backend side of migration**.

When migrating a page or feature, inspect the complete backend functionality required by that feature.

This includes, when applicable:

* Routes
* Controllers
* Services
* Handlers
* Actions
* Queries
* Query builders
* Repositories
* Models
* Model relationships
* Model scopes
* Database tables
* Migrations
* API endpoints
* API resources
* Request validation
* Form Requests
* Policies
* Authorization
* Authentication
* Jobs
* Events
* Listeners
* Notifications
* Commands
* Helpers
* Utilities
* Other backend dependencies

Do not migrate only the controller or API endpoint.

Trace the complete functionality.

For example:

```text
Page
 └── Route
      └── Controller
           └── Action / Handler / Service
                └── Query / Repository
                     └── Model
                          └── Relationship
                               └── Database
```

The actual structure may differ depending on the current project.

Follow the architecture that already exists in the current project.

---

# Frontend Migration

Frontend migration is supported, but the frontend should **not simply reproduce the legacy UI**.

The legacy frontend should primarily be used to understand:

* User flow
* Required functionality
* Required data
* Interactions
* Validation
* Actions
* States
* Permissions
* Existing behavior

The visual implementation should follow the current project's design system.

The skill must:

* Inspect the current frontend structure.
* Determine the frontend framework being used.
* Identify existing layouts.
* Identify shared components.
* Identify styling conventions.
* Identify existing UI patterns.
* Reuse existing components whenever possible.
* Adapt the legacy functionality to the current UI/UX.

For example, if the legacy project uses one UI design but the current project has a completely different design system, do not copy the legacy visual design.

Instead:

```text
Legacy UI
   ↓
Understand functionality
   ↓
Current frontend architecture
   ↓
Current design system
   ↓
Current UI implementation
```

The migrated page should feel like it belongs to the current application.

---

# Framework and Package Detection

Before implementing the migration, inspect the current project.

Do not assume its technology stack.

Check relevant files such as:

```text
package.json
composer.json
package-lock.json
pnpm-lock.yaml
yarn.lock
vite.config.*
tsconfig.json
```

and other project configuration files when applicable.

If the current project has its own agent rules (for example a project profile under `.agents/rules/`), read them as well — they are the current project's conventions written down, and they override anything this skill would otherwise infer. State the resolved project before generating anything.

Determine:

* Backend framework
* Backend version
* Frontend framework
* Frontend version
* Installed packages
* Build system
* Routing system
* State management
* Database layer
* Existing architecture
* Existing project conventions

The current project may use:

* React
* Vue
* Laravel Blade
* Other frontend technologies
* Different backend frameworks
* Different architectural patterns

The skill must adapt to whatever the current project actually uses.

Do not force a framework-specific implementation unless the current project uses that framework.

---

# Existing Functionality Reuse

This is a critical requirement.

Before creating any new implementation, the skill **must first search the current project for existing functionality that can be reused**.

This applies to both backend and frontend.

Search for existing:

* Functions
* Methods
* Handlers
* Actions
* Services
* Queries
* Query builders
* Repositories
* Controllers
* Models
* Relationships
* Model scopes
* API resources
* Form Requests
* Validation rules
* Policies
* Traits
* Helpers
* Utilities
* Events
* Listeners
* Jobs
* Notifications
* Components
* Hooks
* Composables
* Stores
* API clients
* Shared frontend components
* Existing routes
* Existing APIs

## Reuse Before Create

Follow this priority:

```text
1. Reuse existing implementation
        ↓
2. Extend existing implementation
        ↓
3. Refactor existing implementation
        ↓
4. Create new implementation only when necessary
```

Do not create a new function simply because the legacy project has its own version.

The existence of a legacy implementation does not mean it should be copied.

---

# Functional Equivalence

Do not determine reuse only by comparing names.

Two implementations may have completely different names but perform the same responsibility.

When checking whether something can be reused, compare:

* Responsibility
* Inputs
* Outputs
* Business rules
* Database requirements
* Relationships
* Validation
* Authorization
* Side effects
* Error handling
* Expected behavior

For example:

Legacy:

```text
ProcessEmployeeLeaveHandler
```

Current:

```text
LeaveApplicationAction
```

Even though the names differ, determine whether they perform the same responsibility.

If the current implementation can support the migrated functionality, reuse it instead of creating another handler.

---

# Extend Existing Functionality

If the current project already has something similar but it does not completely support the legacy functionality, determine whether it can be safely extended.

Example:

```text
Current:
AttendanceQuery
```

Legacy requires:

```text
AttendanceQuery + additional filtering
```

Prefer:

```text
Extend/refactor AttendanceQuery
```

instead of creating:

```text
LegacyAttendanceQuery
```

However, do not force unrelated functionality into an existing class merely to avoid creating a new file.

Create a new implementation when:

* Responsibilities are genuinely different.
* Existing implementation cannot reasonably support the functionality.
* Extending it would create excessive coupling.
* Extending it would violate the current architecture.
* The new functionality represents a separate domain responsibility.

---

# Function Reuse

Before creating a new function:

1. Search the current project.
2. Check related services/actions/handlers.
3. Check helper and utility classes.
4. Check existing methods.
5. Determine whether an equivalent function already exists.
6. Reuse or extend it when appropriate.

Avoid duplicate business logic.

---

# Handler / Action / Service Reuse

Before creating a new Handler, Action, or Service:

1. Search the current project for related implementations.
2. Inspect their responsibilities.
3. Compare their behavior with the legacy implementation.
4. Determine whether they can be reused.
5. Extend/refactor if necessary.
6. Create a new implementation only when genuinely required.

Do not create parallel implementations simply because the legacy architecture uses different class names or patterns.

---

# Query Reuse

Before creating a new query, inspect:

* Existing Query classes
* Repository methods
* Model scopes
* Existing relationships
* Query builders
* Existing data access services
* Existing API data retrieval methods

If the current project already retrieves the required data, reuse it.

If the legacy query performs something slightly different, determine whether the existing query can be extended or composed.

Avoid duplicated database logic.

---

# Frontend Reuse

Before creating a new frontend implementation, check for:

* Existing components
* Shared components
* Layouts
* Tables
* Forms
* Modals
* Buttons
* Inputs
* Hooks
* Composables
* Stores
* API services
* Utilities
* Existing page patterns

Reuse current components instead of copying equivalent components from the legacy project.

---

# Database Reuse

Before creating a new database table:

1. Check whether the current project already has an equivalent table.
2. Check related models.
3. Check relationships.
4. Check existing migrations.
5. Check whether the existing structure can support the migrated functionality.

Do not create duplicate tables simply because the legacy project has a table with a different name.

If the current project's table already provides the required functionality, use it.

---

# Database Migration

If a database change is actually required:

* Create the appropriate migration.
* Follow the current project's migration conventions.
* Check foreign keys.
* Check indexes.
* Check relationships.
* Check nullable/default behavior.
* Avoid unnecessary columns.
* Preserve required legacy functionality.

Do not blindly copy the legacy table structure.

Map the legacy data requirements to the current project's database design.

Write the migration file, but **do not run it** — list it in the output for the user to run.

---

# Backend Optimization

Migration should include optimization where appropriate.

Review migrated functionality for:

* Duplicate logic
* Duplicate database queries
* N+1 queries
* Unnecessary joins
* Unnecessary database calls
* Repeated query conditions
* Inefficient relationships
* Unnecessary selected columns
* Redundant validation
* Repeated business logic
* Poor separation of responsibilities
* Unnecessary API calls
* Unnecessary data processing

Optimization must preserve the expected behavior.

Do not optimize by changing business behavior without verifying the consequences.

---

# Query Optimization

Inspect legacy queries for:

* Duplicate queries
* N+1 queries
* Unnecessary joins
* Repeated queries
* Repeated filtering
* Unnecessary database calls
* Unused selected columns
* Redundant conditions
* Inefficient relationship loading
* Queries that can be reused
* Queries that can be consolidated

Prefer the current project's existing query patterns when they are appropriate.

---

# Redundancy Removal

The skill must actively identify unnecessary duplication introduced during migration.

Check for:

* Duplicate functions
* Duplicate handlers
* Duplicate actions
* Duplicate services
* Duplicate queries
* Duplicate repositories
* Duplicate controllers
* Duplicate API endpoints
* Duplicate validation
* Duplicate business rules
* Duplicate frontend components
* Duplicate database structures

However:

> **Do not remove something simply because it appears unused.**

Before removing anything, determine whether it may be:

* Used by another feature
* Referenced indirectly
* Required by a route
* Required by an API
* Used through configuration
* Used by another module
* Required by a framework/package mechanism

Only remove confirmed unnecessary or redundant code.

---

# Legacy Code Is Not Automatically the Source of Truth

The legacy implementation is a reference, not the architecture to copy.

Use the legacy project to understand:

```text
What does this feature do?
What business rules does it have?
What data does it require?
What behavior should be preserved?
```

Use the current project to determine:

```text
How should this be implemented?
Where should it live?
Which existing functionality should be reused?
Which architecture should it follow?
Which packages/components should be used?
```

---

# Migration Comparison

Before implementation, compare the two projects.

Identify:

### Legacy

* Existing functionality
* Business rules
* Dependencies
* Queries
* Tables
* APIs
* Frontend behavior

### Current

* Existing equivalent functionality
* Existing architecture
* Existing database structures
* Existing APIs
* Existing components
* Existing services
* Existing queries

Then determine:

```text
Reuse
Extend
Refactor
Create
Remove
```

---

# Ambiguity and Recommendations

If the migration encounters uncertainty, the skill may ask the user for clarification.

Examples:

* Two current implementations could support the same functionality.
* Legacy behavior conflicts with current business rules.
* Database mapping is unclear.
* The current architecture provides multiple possible approaches.
* Removing legacy code may affect unknown functionality.
* A migration would require a potentially destructive change.

Before asking the user, inspect the available code thoroughly.

When appropriate, provide a recommendation with:

* What was found
* Why it is ambiguous
* Available approaches
* Recommended approach
* Potential impact

Do not make destructive assumptions.

---

# Migration Workflow

Every migration should follow this workflow.

## 1. Identify

Resolve the requested route (see **Resolving the Legacy Route**): find the router definition that serves it and the legacy project it belongs to, and take its entry point.

Example:

```text
/webkit.migrate /pages/dashboard
```

Locate the corresponding functionality in the legacy project.

---

## 2. Trace

Trace the complete dependency chain.

For example:

```text
Page
 ↓
Route
 ↓
Controller
 ↓
Action / Handler / Service
 ↓
Query / Repository
 ↓
Model
 ↓
Database
```

Also trace frontend dependencies where applicable.

---

## 3. Inspect Current Project

Inspect the current project architecture and technology.

Determine:

* Framework
* Packages
* Architecture
* Routing
* Database
* Existing services
* Existing actions
* Existing handlers
* Existing queries
* Existing components
* Existing UI patterns

---

## 4. Search for Reusable Functionality

Before creating anything, search the current project for equivalent functionality.

Determine:

```text
Can it be reused?
Can it be extended?
Can it be refactored?
Does a new implementation actually need to exist?
```

---

## 5. Compare

Compare the legacy implementation with the current implementation.

Identify:

```text
Existing equivalent
Missing functionality
Reusable code
Required changes
Redundancies
Database differences
Query differences
Architecture differences
```

---

## 6. Plan

Create a migration approach based on:

```text
Reuse → Extend → Refactor → Create
```

rather than:

```text
Copy → Paste → Duplicate
```

---

## 7. Migrate Backend

**Before the first write:** if the current project defines a branch gate (for example in `.agents/rules/git-workflow.md`), run it now. Never implement on `main`/`master`.

Implement the required backend functionality using the current project's architecture.

Prioritize reuse of:

* Functions
* Handlers
* Actions
* Services
* Queries
* Models
* Repositories
* APIs
* Validation
* Existing database structures

---

## 8. Migrate Frontend

Implement the required frontend functionality using the current project's:

* Framework
* Components
* Layout
* Styling
* UX patterns
* State management
* API patterns

Do not blindly copy the legacy UI.

---

## 9. Optimize

Review the implementation for:

* Duplicate logic
* Inefficient queries
* Redundant database operations
* Duplicate components
* Duplicate services
* Unnecessary code
* Opportunities to reuse existing functionality

---

## 10. Validate

Verify:

* Routes
* APIs
* Backend logic
* Database relationships
* Queries
* Validation
* Authorization
* Frontend behavior
* Existing functionality
* Current architecture compliance

Use the current project's own checks where they exist (syntax lint, test suite, typecheck, build). Report any that were not run, or that failed.

---

## 11. Final Redundancy Check

After implementation, perform another search for duplicate functionality.

Ensure the migration did not introduce:

* Duplicate handlers
* Duplicate actions
* Duplicate services
* Duplicate queries
* Duplicate APIs
* Duplicate components
* Duplicate business logic
* Duplicate tables

If duplication exists and can safely be consolidated, refactor it.

---

# Migration Output

After completing the migration, provide a concise summary containing:

## Migrated

What functionality was migrated.

## Reused

Existing functions, handlers, actions, services, queries, models, components, or other implementations that were reused.

## Extended / Refactored

Existing implementations that were modified to support the migrated functionality.

## Created

New files or implementations that were genuinely necessary.

## Optimized

Important optimizations performed during migration.

## Removed

Confirmed redundant or unnecessary code that was removed.

## Database Changes

Any required database migrations, table changes, indexes, relationships, or other database modifications — and which migrations the user still needs to run.

## Notes

Important assumptions, limitations, unresolved issues, or recommendations.

Do not stage or commit — that decision belongs to the user.

---

# Important Rules

The migration skill must always follow these principles:

### 1. Reuse Before Create

> Search the current project before creating new functionality.

### 2. Extend Before Duplicate

> If an existing implementation can reasonably support the functionality, extend or refactor it instead of creating another implementation.

### 3. Migrate Functionality, Not Files

> Do not blindly copy legacy files.

### 4. Current Architecture Wins

> The current project determines how the functionality should be implemented.

### 5. Legacy Behavior Matters

> Preserve required business behavior unless the current project explicitly requires different behavior.

### 6. Backend First

> Prioritize complete backend migration and dependency tracing.

### 7. Frontend Adapts

> Preserve functionality while adapting the UI to the current project's design system.

### 8. Optimize During Migration

> Migration is also an opportunity to improve functions, queries, database access, and code organization.

### 9. Remove Confirmed Redundancy

> Remove duplication only after verifying that it is genuinely unnecessary.

### 10. Do Not Over-Engineer

> Do not introduce unnecessary abstractions or new architecture merely to make the migration more complex.

### 11. Ask When Necessary

> If the correct implementation cannot be determined safely, inspect first and then ask the user with a clear recommendation.

### 12. Legacy Is Read-Only

> Never edit the legacy project. Every write lands in the current project.

### 13. Never Invent

> Every table, column, route, model, and permission the migration references must be verified in the code — legacy or current. If it cannot be verified, ask.

---

# Final Migration Principle

The complete migration process should follow:

```text
                LEGACY PROJECT
                      │
                      ▼
              Identify Feature
                      │
                      ▼
              Trace Functionality
                      │
                      ▼
             Understand Behavior
                      │
                      ▼
              CURRENT PROJECT
                      │
                      ▼
          Inspect Existing Code
                      │
                      ▼
           Find Reusable Logic
                      │
          ┌───────────┼───────────┐
          ▼           ▼           ▼
        Reuse       Extend      Refactor
          │           │           │
          └───────────┼───────────┘
                      ▼
               Create Only
              When Necessary
                      │
                      ▼
              Backend Migration
                      │
                      ▼
             Frontend Migration
                      │
                      ▼
                 Optimize
                      │
                      ▼
            Remove Redundancy
                      │
                      ▼
                 Validate
                      │
                      ▼
             Final Migration
```

The skill should always aim for:

> **A clean, maintainable, optimized implementation that preserves the required legacy functionality while fully following the current project's architecture and design.**
