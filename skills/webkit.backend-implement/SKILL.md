---
name: webkit-backend-implement
description: >
  Generates and implements modular backend setup for Vue.js modules using Laravel, creating controllers,
  domain query/handler classes, registering routes in routes/api.php, and integrating the backend endpoints with the frontend components.
  Supports dragging folder or file paths into the command to specify the target module.
  Triggered when the user runs the command `/webkit.backend-implement <target_path> <prompt>` or `/webkit.backend-implement <prompt>`.
---

# Webkit Backend Implement

This skill coordinates the backend implementation of a standard Laravel module, setting up controllers, database tables, validations, logic classes, and route entries matching the existing project's architecture, conventions, and patterns.

---

## Overview

When the user requests to implement or scaffold the backend structure of a module (e.g., using `/webkit.backend-implement <target_path> <prompt>` or `/webkit.backend-implement <prompt>`), the agent must:
1. Check if a folder or file path was dragged/passed into the command.
2. If a path is provided, parse it to extract the `<portal_name>` (e.g., `hr`, `employee`, `manager`, `admin`, `payroll`, `timekeeping`) and `<module_name>`.
3. If no path is provided, dynamically resolve the portal and module names from the prompt text or context.
4. **Mandatory Architecture Discovery**: Before generating any backend code or migrations, perform the Architecture Discovery step to identify the project's Laravel design pattern.
5. **Verify Frontend Existence**: Check if the frontend UI components, page files, or request composables/hooks exist. If the frontend structure/UI has not been created yet, **stop and instruct the user to run the frontend implementation first**, as the backend relies on the frontend fields and logic to design optimized database schemas and endpoints.
6. Check if the database table for the module exists. If the table does not exist, create the Laravel migration, model, and ensure the Eloquent model is created.
7. Scaffold and optimize the queries, controller logic, validations, and routes matching the detected architecture.
8. Update the frontend composable or React API request layer to replace mock data with live HTTP requests.
9. **Strict Rules Adherence**: The generated code and files must strictly adhere to the guidelines defined in the [.agents/rules/](../../rules/) directory, specifically [Laravel Standards](../../rules/laravel-standards.md), [Naming Convention Standards](../../rules/naming-convention.md), and [HRMS Domain Rules](../../rules/hrms-rules.md).

---

## Execution Strategy (Performance Optimized)

The agent MUST minimize workspace scanning and token consumption.

- **Targeted Scanning**: Search only relevant backend files in the current module's namespace and directories.
- **Early Exit**: Stop searching immediately once a suitable implementation is found.
- **Hard Stop Rule**: If a reusable component/class with $\ge 80\%$ feature match is found, stop searching and reuse it immediately unless the user explicitly requests a new/separate implementation.
- **No Global Scans**: Never perform repository-wide or project-wide analysis unless explicitly requested.
- **Inspect Module-Related Files Only**: Limit file inspection strictly to files that are directly related to the requested module or related domain schemas.

---

## Context Loading Strategy

Only load context that is required.

### Search Priority
1. Current module (controllers, queries, handlers)
2. Related model (e.g., `app/Models/<ModelName>.php`)
3. Related domain classes (in `app/Domain/`)
4. Controller
5. Routes (`routes/api.php` or custom route groups)
6. Request classes (FormRequests)
7. API Resources
8. Policies & Gates
9. Existing frontend API layer (to match field shapes)
10. Entire backend (ONLY if explicitly requested by the user)

- **Token Protection**: Never load more than 2 full files simultaneously unless performing a merge or refactor operation. Prefer targeted snippets over full-file context whenever possible.
- **Scope Restriction**: Never inspect unrelated modules or inspect frontend UI files beyond the request layer.

---

## Workspace Inspection Budget

To reduce unnecessary token usage, limit the number of files scanned in a single turn.

### Maximum Files to Inspect:
- **Controllers**: 10 files
- **Models**: 10 files
- **Domain Queries / Service classes**: 15 files
- **Domain Handlers / Action classes**: 15 files
- **Routes**: 3 files
- **Request Classes (FormRequests)**: 5 files
- **API Resources**: 5 files
- **Policies**: 5 files
- **Migrations**: 5 files

If the budget is exceeded:
1. Stop scanning.
2. Use the best matching implementation already discovered.

---

## Duplicate Prevention & Incremental Generation

### Duplicate Prevention
Before creating any controller, model, request, resource, helper, action, query, policy, service, or migration, check if it already exists.
- Reuse or extend existing classes instead of duplicating logic. Never create parallel duplicates.

### Incremental Generation
If a file already exists:
- Update only the required sections (e.g. adding a method, field validation, or route binding).
- **Preserve**: Developer comments, business logic, formatting, existing imports, existing methods, and custom configurations.
- Generate the smallest possible diff. Never overwrite working files.

---

## Architecture & Convention Detection

### Laravel Architecture Detection
Before generating new classes, inspect the existing project setup. Detect whether the project implements:
- **Domain Query/Handler Pattern** (Query/Handler classes in `app/Domain/`)
- **Service Layer**
- **Repository Pattern**
- **Action Classes**
- **Jobs / Queues**
- **API Resources**
- **Form Requests**

Always follow the discovered architecture. Do not introduce new architectural patterns or layers unless requested.

### Naming Convention Detection
Follow existing backend casing and class suffixes (e.g., standardizing on `<ModuleName>Controller.php`, `Store<ModelName>Request.php`, `<ModelName>Resource.php`, `<QueryName>Query.php`).

---

## Path Parsing Rules (Dragged Folder / File Support)

If a path parameter is passed in the command (e.g. `/webkit.backend-implement @[/Users/.../web/src/module/hr/employees] <prompt>`):
- **Extract Portal Name**: Identify the folder segment immediately following `resources/views/web/src/module/` (e.g., `hr`, `admin`, `employee`, `manager`, `payroll`, `timekeeping`).
- **Extract Module Name**: Identify the next folder segment (e.g., `employees`, `sick_leave_monitoring`).
- **Sub-folder resolution**: If the path points to a component, page, or script inside a module (e.g., `.../module/hr/employees/components`), traverse upwards to resolve the module directory name (`employees`) and the portal name (`hr`).

---

## Target Backend Directory Structure & Setup

The backend logic for the module is structured inside the Laravel framework.

```
database/migrations/           # Database migrations
app/Models/                    # Eloquent models
└── <ModelName>.php            # The Eloquent model representation
app/Http/Controllers/
└── <Namespace>/               # e.g., hr, payroll, tk, employee, manager, admin
    └── <ModuleName>Controller.php # The Laravel controller handling the endpoints
app/Http/Requests/
└── <Namespace>/               # Dedicated FormRequests
    └── Store<ModuleName>Request.php
app/Domain/
├── Handlers/                  # Business logic actions/handlers
└── Queries/                   # Database queries classes
routes/
└── api.php                    # Route definitions for all endpoints
```

---

## Backend Implementation Guidelines

### 1. Database Safety & Optimization
- **Do NOT Run Migrations Automatically**: Generate migration files and Eloquent models. Explain that migrations must only be run upon explicit request.
- **Optimization Standard**: Add indices on foreign keys and frequently filtered columns. Incorporate foreign key constraints, `SoftDeletes`, and timestamps. Avoid duplicate schema definitions.

### 2. Validation Detection & Standards
- Detect if the project standard is FormRequests, inline validations, DTO validations, or custom validators. Follow the discovered pattern.
- If FormRequests are used, search for and extend existing requests if possible.

### 3. API Response & Exception Formatting
- Detect whether the project uses Eloquent API Resources, custom JSON helper methods, success/error wrappers, or traits. Reuse the existing response formats.
- Match existing custom exception handlers and validation error formats.

### 4. Route Grouping
- Inspect existing API routes grouping. Detect prefix rules, version groupings, middleware namespaces, and naming styles.
- Insert new routes in the correct groups. Do not create duplicate routes.

### 5. Performance Standards
- Eager load relationships (`with()`) on queries.
- Select only required columns.
- Eagerly apply pagination for listings.
- Chunk large datasets (`chunk()`, `lazy()`) for batch operations.

---

## Technical Standards & Code Templates (Reference Examples)

*Note: These templates are reference patterns. If the project implements a different architecture, follow the project blueprint.*

### Pattern A: Domain Query/Handler Pattern (If Discovered)

#### 1. Domain Query
```php
<?php

namespace App\Domain\Queries\<DomainName>;

use App\Domain\Queries\Query;
use App\Models\<ModelName>;

class Get<ModuleName>Query extends Query
{
    public static function execute($params = [])
    {
        return <ModelName>::query()
            ->with(['relations'])
            ->paginate($params['entries'] ?? 10);
    }
}
```

#### 2. Controller Boilerplate
```php
<?php

namespace App\Http\Controllers\<Namespace>;

use App\Http\Controllers\Controller;
use App\Http\Requests\<Namespace>\Store<ModuleName>Request;
use App\Domain\Queries\<DomainName>\Get<ModuleName>Query;
use App\Domain\Handlers\<DomainName>\Save<ModuleName>Handler;

class <ModuleName>Controller extends Controller
{
    public function index(Request $request)
    {
        $results = Get<ModuleName>Query::execute($request->all());
        return response()->json(['data' => $results]);
    }

    public function store(Store<ModuleName>Request $request)
    {
        $result = Save<ModuleName>Handler::execute($request->validated());
        return response()->json(['success' => true, 'data' => $result]);
    }
}
```

### Pattern B: Service / Action Pattern (If Discovered)

If the project uses service and actions layers (e.g. `app/Services/` or `app/Actions/`), conform to that pattern:

#### 1. Service/Action Class
```php
<?php

namespace App\Actions\<DomainName>;

use App\Models\<ModelName>;

class Create<ModelName>Action
{
    public function execute(array $data): <ModelName>
    {
        return \DB::transaction(function () use ($data) {
            return <ModelName>::create($data);
        });
    }
}
```

---

## Target Frontend Connection Setup

- **Preserve Frontend Logic**: Do not rewrite or modify frontend page scripts or UI layouts.
- **Update Request Layer Only**: Update the API integration layer (`useApiRequest.js`, React hooks, or service layers) to replace mock responses with live parameters:

```javascript
export function useApiRequest() {
  return {
    getData: async (params = {}) => {
      const response = await http.get("api/<portal_name>/<module_endpoint>", { params });
      return response.data;
    },
    saveData: async (params = {}) => {
      const response = await http.post("api/<portal_name>/<module_endpoint>/save", params);
      return response.data;
    }
  };
}
```
