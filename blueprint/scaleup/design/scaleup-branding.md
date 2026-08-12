# ScaleUP Design Brief

> Design brief for the ScaleUP product foundation. Aligned with [`docs/PRODUCT_VISION.md`](../docs/PRODUCT_VISION.md) and [`docs/PLATFORM_ARCHITECTURE.md`](../docs/PLATFORM_ARCHITECTURE.md).

---

## Brief

You are a Senior Product Designer and UX/UI Designer.

Your task is to design the complete product foundation for a modern SaaS platform called **ScaleUP**.

---

## Project Overview

ScaleUP is a Business Operating System (Business OS) and Business Community Platform, developed by ZentreLink, that helps entrepreneurs, startups, small businesses, and organizations manage their operations, understand their performance, plan strategically, and scale sustainably.

ScaleUP is NOT an accounting software.

Accounting and financial tracking are only part of the platform.

The product is built on two connected experiences (see `docs/PLATFORM_ARCHITECTURE.md`):

- **Community Platform (Free)** — every registered user's default home: profile, network, feed, connections, messaging, and opportunity discovery. No Organization required.

- **Organization Workspace (Subscription)** — an optional, subscription-based layer unlocked when a user creates an Organization: dashboard, business management, planning, reports, analytics, and team collaboration.

Every design decision must keep this split legible: what is free and open, versus what requires an active Organization subscription.

The platform's mission is to help businesses:

- Manage
- Measure
- Plan
- Connect
- Scale

Every design decision should reinforce these five pillars.

The overall experience should feel premium, trustworthy, modern, and enterprise-ready.

The design should compete with world-class SaaS products.

Never make it look like a traditional ERP, bookkeeping software, or admin dashboard.

Instead, create a premium Business Operating System.

---
## Design Inspiration

Use the design language inspired by:

- Stripe
- Linear
- Notion
- Vercel
- Arc Browser
- Apple
- Slack

Avoid Bootstrap-looking interfaces.

Avoid crowded layouts.

Prioritize whitespace.

Use large typography.

Rounded corners.

Soft shadows.

Minimal gradients.

Elegant micro-interactions.

---
## Brand Identity

Brand Name

ScaleUP

Tagline

"The Business Operating System for Growing Companies."

Brand Personality

Professional

Innovative

Confident

Clean

Reliable

Modern

Enterprise

Growth-focused

---
## Color Palette

Primary

#2563EB

Accent

#10B981

Background

#FFFFFF

Secondary Background

#F8FAFC

Text

#0F172A

Secondary Text

#64748B

Border

#E2E8F0

---
## Typography

Use

Inter

Modern spacing

Large headlines

Minimal text

---
## Icons

Lucide Icons

---
## 1. Landing Page

Design a premium marketing website.

Sections:

Hero

Features

Business Journey

Why ScaleUP

Business Ecosystem

Call To Action

Footer

Hero headline

"The Business Operating System for Growing Companies."

Hero description

ScaleUP helps businesses manage operations, understand performance, plan strategically, connect with opportunities, and achieve sustainable growth.

Primary Button

Get Started

Secondary Button

Learn More

Instead of screenshots, create a premium Business Operating System illustration.

Use floating business modules connected together.

Modules include:

Business

Finance

Analytics

Planning

Goals

Community

Growth

Reports

Organization

Do not use people.

Do not use stock photos.

---
## 2. Logo Concepts

Create multiple modern logo concepts.

Minimal.

Professional.

Scalable.

Suitable for:

Website

Mobile App

Desktop App

Favicon

Possible concept:

Arrow

Growth

Network

Business Nodes

Abstract "S"

Modern geometric mark

---
## 3. Design System

Create a complete design system.

Buttons

Inputs

Cards

Tables

Badges

Dropdowns

Modals

Sidebar

Navigation

Tabs

Charts

Typography

Spacing

Grid System

Radius

Elevation

Dark Mode Ready

Responsive

---
## 4. Authentication

Design

Login

Register

Forgot Password

Email Verification

Reset Password

Modern onboarding flow.

Use split layout.

Left

Authentication

Right

Business illustration

Show floating business KPI cards.

Do not use photos.

---
## 5. Onboarding

After registration, every user completes the **Individual onboarding** — this is the only onboarding required to use ScaleUP.

Step 1

Welcome

Step 2

Build Your Profile (identity, experience, interests)

Step 3

Follow Organizations & Find Connections

Step 4

Finish Setup → Land in the Community Feed

Creating an Organization is a separate, optional flow triggered later from within the product — never a forced step in registration.

### Organization Setup (Optional, Subscription Flow)

Triggered when an Individual chooses to create an Organization.

Step 1

Create Organization or Join Existing Organization

Step 2

Business Information

Step 3

Choose Industry

Step 4

Business Size

Step 5

Choose Subscription Plan

Step 6

Invite Team

Step 7

Finish Setup → Land in the Business Dashboard

---
## 6. Dashboard Concept

Two distinct home views, matching the two experiences. Do not blend them into one screen.

### Community Home (Individual — Free)

The default landing view for every user, with or without an Organization.

Sections:

Community Feed

Profile Summary & Network Growth

Suggested Connections

Followed Organizations

Opportunities

Notifications

### Business Dashboard (Organization Workspace — Subscription)

Only reachable after creating and subscribing an Organization. Do NOT design a bookkeeping dashboard.

Design a Business Operating System dashboard.

Sections:

Business Health Score

Revenue Overview

Business Goals

Growth Progress

Upcoming Plans

Recent Activities

Business Insights

Analytics

Opportunities

Quick Actions

Modern KPI widgets.

Glassmorphism.

Professional charts.

Clean spacing.

---
## 7. Global Layout

Design a reusable application layout.

Top Navigation

Left Sidebar (context-aware: Community items for every user, Workspace items only when an Organization is active)

Community / Workspace Switch (only shown once the user has at least one Organization)

Notification Center

User Profile

Organization Switcher (hidden for users with no Organization)

Theme Switch

Search

Command Palette

Responsive

Desktop

Tablet

Mobile

---
## General Rules

Everything should feel like:

Apple × Stripe × Linear × Notion

Premium.

Enterprise.

Minimal.

Elegant.

No Bootstrap look.

No generic admin template.

No bookkeeping style.

No excessive colors.

No stock photography.

Use abstract business illustrations.

Use floating UI cards.

Use smooth gradients.

Use modern SaaS components.

The final result should immediately communicate:

"This is the future operating system for businesses."
