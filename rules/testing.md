# Testing Standards

## Purpose
This document defines testing architectures, library conventions, and execution rules to verify application correctness and prevent regressions.

## Scope
Applicable to all unit tests, integration tests, end-to-end (E2E) scripts, and testing setups.

## Responsibilities
- **AI Agent**: Discovers existing test frameworks (e.g. PHPUnit, Vitest, Jest) and writes conforming test classes with descriptive assertions.
- **Developer/User**: Runs tests in CI pipelines and maintains coverage rules.

## Actionable Rules
1. **Discover Test Frameworks**: Inspect the folder structure to find testing folders (e.g., `tests/`, `__tests__/`). Match the testing libraries in use.
2. **Standardize Test Types**:
  - **Unit Tests**: Test logic in isolation from database connections or web APIs (e.g., calculations, custom parsers, data models).
  - **Integration/Feature Tests**: Test validation layers, database transactions, route endpoints, and authentication guards.
3. **Database Sandboxing**: Always use testing transactions or database refresh traits to ensure test database sandboxes are kept clean and reset after each test block.
4. **Mock External Integrations**: Mock external APIs, messaging systems, or local file integrations to isolate logic execution.

## Best Practices
- **Edge-Case Validation**: Write assertions covering boundary parameters (e.g. empty arrays, null values, maximum inputs, division-by-zero limits).
- **Core Business Test Cases**: Cover core business computations (calculations, access privileges, transaction workflows) with high-priority tests.

## AI Behavior Expectations
- **Coverage Focus**: When updating calculation engines or logic layers, the agent must check for and update the associated test files.
- **Valid Assertions**: Write explicit assertions rather than generic true/false expectations.
