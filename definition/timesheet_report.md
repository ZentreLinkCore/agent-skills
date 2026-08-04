# Redesign Timesheet Report Pages Using Standardized Global Components

## Overview

Redesign the existing Timesheet Report pages — **Absences**, **Tardiness**, **Undertime**, **Overtime**, and **Night Premium** — to improve consistency, maintainability, and user experience across the Timekeeping module.

The current pages will be updated to use a shared and reusable component structure similar to the **Application module**, where common UI patterns are centralized and reused instead of implementing separate designs per page.

The objective is to establish a standardized **Timesheet Report** component that follows the HRMS global UI standards while allowing each report type to display its own specific data and business information.

---

## Objectives

- Redesign the existing Timesheet Report pages using global reusable components.
- Create a single shared component that can support multiple timesheet report types.
- Ensure consistent layout, filtering, tables, actions, and user interactions across all reports.
- Apply the established HRMS UI standards for spacing, typography, colors, buttons, forms, and data presentation.
- Improve maintainability by reducing duplicated UI implementations.

---

## Scope of Work

Create a reusable **Timesheet Report Component** that will be used by the following pages:

- Absences Report
- Tardiness Report
- Undertime Report
- Overtime Report
- Night Premium Report

The shared component should support configurable data sources and report-specific settings while maintaining a consistent structure.

---

## Common Component Features

### Report Header
- Report title
- Description or summary information
- Report actions
- Date range display

### Filters
- Date range filter
- Employee filter
- Department filter
- Employment status filter
- Shift/Schedule filter (if applicable)
- Search functionality

### Summary Section
Display report-specific summary information such as:
- Total employees affected
- Total occurrences
- Total hours/days
- Total amount (if applicable)

### Data Table
The component should support:
- Dynamic columns based on report type
- Sorting
- Pagination
- Search
- Export functionality
- Detail viewing

---

## Report-Specific Requirements

### Absences Report
Display employee absence records.

Possible information:
- Employee Name
- Date
- Absence Type
- Number of Days/Hours
- Reason
- Status

### Tardiness Report
Display employee late attendance records.

Possible information:
- Employee Name
- Date
- Scheduled Time
- Actual Time In
- Late Minutes
- Total Late Hours

### Undertime Report
Display employee undertime records.

Possible information:
- Employee Name
- Date
- Scheduled Time Out
- Actual Time Out
- Undertime Minutes
- Total Undertime Hours

### Overtime Report
Display employee overtime records.

Possible information:
- Employee Name
- Date
- Regular Hours
- Overtime Hours
- Overtime Type
- Approval Status

### Night Premium Report
Display employee night differential records.

Possible information:
- Employee Name
- Date
- Night Premium Hours
- Applicable Schedule
- Computed Amount (if applicable)

---

## Global UI Standards

The redesigned pages should follow the HRMS design system, including:

- Standard page layout
- Reusable cards and panels
- Consistent filter components
- Standard table design
- Common status badges
- Standard action buttons
- Consistent empty states
- Responsive layout behavior
- Consistent loading and error states

---

## Expected Outcome

The Timesheet Report module should provide a unified and scalable reporting experience where Absences, Tardiness, Undertime, Overtime, and Night Premium reports use a common component structure.

The implementation should reduce duplicated UI code, improve consistency across Timekeeping pages, and ensure that future timesheet-related reports can easily be added using the same standardized component approach.