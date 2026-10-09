# Security Standards

## Purpose

This document defines security parameters and guidelines to prevent vulnerabilities (e.g. XSS, SQL injection, bypass authorization) and protect sensitive records.

## Scope

Applicable to all input parameters, data queries, frontend templates, backend validation layers, and authentication/authorization endpoints.

## Responsibilities

- **AI Agent**: Enforces validation on every write path, integrates authorization policies in controllers/routers, and escapes user inputs.
- **Developer/User**: Controls access rules, credentials management, and production encryption settings.

## Actionable Rules

1. **Frontend Safety (XSS Prevention)**:
   - Escape raw variables. Never use direct HTML injection triggers (e.g. `v-html` in Vue or `dangerouslySetInnerHTML` in React) unless the output is explicitly sanitized.
   - Do not save sensitive credentials, tokens, or PII in clear text inside `localStorage` or `sessionStorage`.
2. **Backend Safety (Injection & Authentication)**:
   - **Input Validation**: Validate every parameter through form validators, schema checks, or dedicated Request classes.
   - **Authorization**: Never bypass authorization checks. Apply policies, gates, or route middlewares to ensure users can only modify their own resources.
   - **SQL Injection Prevention**: Bind parameters for all custom or dynamic queries. Avoid raw database evaluations.
   - **Encryption**: Encrypt personally identifiable information (PII) before storage.

## Best Practices

- **Least Privilege Principle**: Ensure API routes are protected by default and only exposed via middleware groupings (e.g., auth sanitizing).
- **Secure File Uploads**: Validate file sizes and extensions when saving attachments to server directories.

## AI Behavior Expectations

- **Strict Validation checks**: The agent must reject writing logic that receives dynamic request arrays without validating them first.
- **Bypass Detection**: Refuse suggestions that disable authorization flags for convenience.
