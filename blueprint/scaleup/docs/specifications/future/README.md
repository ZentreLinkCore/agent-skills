# Future Specifications

This directory holds proposed and exploratory modules that are not yet part of the committed product — incubation space for ideas being evaluated against ScaleUP's vision before they are promoted into a committed domain.

---

## Specifications

| Document | Purpose |
| :--- | :--- |
| [FUTURE_ECOSYSTEM.md](./FUTURE_ECOSYSTEM.md) | The long-term vision these proposals are evaluated against |
| [AI_BUSINESS_ASSISTANT.md](./AI_BUSINESS_ASSISTANT.md) | Decision support built on an organization's own business data |
| [BUSINESS_MARKETPLACE.md](./BUSINESS_MARKETPLACE.md) | Connecting organizations with providers, products, and resources |
| [INVESTMENT_PLATFORM.md](./INVESTMENT_PLATFORM.md) | Connecting businesses seeking capital with potential investors |
| [MENTORSHIP.md](./MENTORSHIP.md) | Structured relationships between mentees and experienced mentors |

---

## Purpose

- Capture business module ideas surfaced by user research, market opportunity, or strategic direction.
- Evaluate new modules against the platform's design principles before committing engineering or design effort.
- Keep exploratory thinking visible and versioned, rather than scattered across ad hoc documents.

---

## Promotion Criteria

A specification is ready to move out of `future/` and into a committed domain when it:

1. Has a clear place within the existing [Platform Architecture](../../PLATFORM_ARCHITECTURE.md) (or a documented reason to extend it).
2. Has been evaluated against the [Design Principles](../../DESIGN_PRINCIPLES.md).
3. Has an owner and a rationale that ties it back to the [Product Vision](../../PRODUCT_VISION.md) or [Roadmap](../../PRODUCT_ROADMAP.md).

---

## Adding a Proposal

Add one Markdown file per proposed module, named in `UPPER_SNAKE_CASE.md` to match the rest of `specifications/`, and follow the same section structure as a committed specification (`Purpose` → `Overview` → `Actors` → … → `Success Criteria`). Proposals here are expected to be less complete than committed specifications; use `Potential Capabilities` and `Potential Flow` where the design is still open.
