<!--
Sync Impact Report
- Version change: template/unversioned -> 1.0.0
- Modified principles: placeholder principles -> five product-governance principles
- Added sections: Architecture & Commercial Constraints; Delivery & Quality Workflow;
  Milestone 1 Objective; Governance
- Removed sections: none
- Templates requiring updates:
  - ✅ .specify/templates/plan-template.md
  - ✅ .specify/templates/spec-template.md
  - ✅ .specify/templates/tasks-template.md
  - ✅ .specify/templates/commands/ (directory not present; no command templates to update)
- Follow-up TODOs: TODO(RATIFICATION_DATE): original adoption date was not supplied.
-->
# KeepFit Constitution

## Core Principles

### I. Evolve One Modular-Monolith Business System

KeepFit MUST evolve the existing production-capable Next.js 16, React 19, and Supabase
application; it MUST NOT rebuild the ecommerce platform unless an existing implementation
is proven incompatible with an approved architecture. Working features outside an approved
specification MUST be preserved. The system MUST remain a modular monolith: capabilities
may be isolated behind intentional service interfaces, but they share one application
ecosystem and primary database rather than becoming microservices.

All storefront, customer-account, administrative, and warehouse/preparation interfaces
MUST operate on one source of truth for customers, product variants, prices, orders,
payments, inventory, shipments, and financial transactions. Core records MUST NOT be
copied or synchronized between independent systems. This keeps the high-volume business
operationally coherent and reduces manual reconciliation.

### II. Model Commercial Truth Explicitly

The Product Variant is the stockable and orderable commercial unit. Every inventory,
availability, pricing, and order-quantity rule MUST use the variant identifier as its
canonical reference where applicable. Variants MAY differ by attributes such as size,
flavor, weight, or pack size, and each MAY have its own SKU, availability, price, and
inventory.

Customers MUST exist independently of orders and support an authentication account,
profile, configurable customer type, approval and account status, assigned price list,
saved addresses, internal notes, history, future balance/debt information, and optional
customer-specific pricing. Customer types are data, not hard-coded roles; Retail,
Wholesale, and Gym Owner are initial types. Privileged-type requests MUST use an
auditable approval lifecycle and grant no protected benefits until approved unless an
explicit configuration says otherwise.

### III. Enforce Commercial Rules on the Server and in Transactions

The browser is NEVER authoritative for price or other commercial values. Server-side
domain/application services MUST calculate or validate prices, cart contents, quantity
rules, approvals, order transitions, inventory reservations, shipment eligibility,
payment balances, and financial calculations. UI components may collect input and render
state, but MUST NOT be the primary home of business decisions.

Pricing MUST support configurable default and customer-type price lists, variant prices,
customer overrides, minimum quantities, and applicable promotions. Precedence is:
customer-specific override, then assigned customer price list, then configured
default/base price. Changing the default price list MUST NOT require deployment.

Orders MUST have an explicit validated state machine; administrators MUST NOT freely edit
status text. Inventory MUST use traceable operations, not direct stock mutations, and
distinguish physical, reserved, and available quantity (available = physical minus
reserved where applicable). Critical multi-entity actions MUST have transactional
boundaries so partial success cannot leave commercial state inconsistent.

### IV. Automate Through Events, Adapters, and Authorized Tools

The operating model is automation-first and human-by-exception. Meaningful domain events
(for example customer approval, order creation, payment review, preparation, and shipment
delivery) MUST be emitted so notifications, analytics, audit activity, automation jobs,
AI workflows, and shipping actions can subscribe. External side effects MUST have
appropriate failure handling and retry behavior, and MUST NOT be tightly embedded in core
order logic.

External providers such as Bosta, Mylerz, Kashier, Telegram, messaging, and AI services
MUST be isolated behind adapters where practical. Provider failures MUST NOT silently
corrupt core state. The AI agent is not a source of business truth and MUST NOT mutate
database records directly; it may retrieve information and request authorized actions only
through the same validated services and permissions as all other interfaces.

### V. Secure, Auditable, Operationally Useful Delivery

Authentication alone is insufficient: every protected action MUST receive server-side
authorization. Roles such as Owner, Manager, Accountant, Warehouse Manager, Preparation
Employee, Customer Support, and customer roles MUST restrict access to sensitive data and
actions; hiding UI is not authorization. Sensitive operations MUST be auditable with
actor, action, entity, prior and new state where applicable, timestamp, and reason/context.

The admin experience MUST foreground actionable exceptions, pending approvals, payment
reviews, operational failures, stock problems, shipment failures, and other attention
requirements over decorative metrics. The storefront MUST be mobile-first, optimized for
Arabic RTL while retaining existing English LTR support, with fast discovery,
personalized pricing, variant selection, quantity changes, cart, and checkout.

## Architecture & Commercial Constraints

Expected logical modules include Authentication, Customers, Customer Types, Catalog,
Product Variants, Pricing, Cart, Checkout, Orders, Payments, Inventory, Warehouses,
Preparation, Purchasing, Suppliers, Shipping, Finance, Automation, Communications, AI
Agent, Reporting, RBAC, and Audit. Modules MUST expose intentional interfaces instead of
arbitrarily accessing each other's internals.

Existing integrations and capabilities—including Kashier, Mylerz, Bosta, Meta tracking,
reviews, newsletter, analytics, product management, shipping rules, carts, checkout, and
admin operations—MUST remain intact unless an approved feature explicitly replaces or
changes them. Scope is disciplined: introduce only foundations required for a feature and
defer complete future capabilities to their assigned milestone unless approved.

## Delivery & Quality Workflow

Every feature specification MUST state its responsibility, affected business modules,
shared entities, authorization rules, audit events, server-authoritative calculations,
transaction boundaries, integrations, and out-of-scope work as relevant. Plans MUST verify
modular-monolith fit, single-source-of-truth ownership, variant use, pricing authority,
lifecycle controls, event/adaptor design, and preservation of existing capabilities before
implementation.

Critical business logic requires targeted automated tests, especially authentication,
authorization, approval, price precedence, quantity restrictions, server-side cart
validation, order transitions, payment calculations, inventory reservations and
consistency, and financial calculations. Implementations MUST run relevant tests;
milestone and final-project closure MUST run full regression. A feature closes only when
requirements and acceptance scenarios pass, authorization and affected existing behavior
are checked, critical defects are resolved, and Spec Kit convergence finds no unresolved
required work.

## Milestone 1 Objective

Milestone 1 comprises 001 Customer Auth & Profile, 002 Customer Types & Approval, 003
Catalog & Variants, 004 Pricing Engine, and 005 B2B Cart, Checkout & Operational Admin
Foundation. It MUST demonstrate this end-to-end outcome: a customer registers and selects
a customer type; protected accounts wait for approval; an administrator approves the
customer; the customer receives correct pricing, selects products and variants, satisfies
applicable quantity rules, and adds items to cart; the server revalidates commercial
pricing; the customer selects or saves an address and completes checkout; and the order
appears in operational administration. The result MUST visibly become an operational tool,
not merely a redesigned storefront.

## Governance

This constitution supersedes conflicting project conventions. Amendments MUST be
documented in this file with a Sync Impact Report and propagated to dependent templates
and guidance. Use semantic versioning: MAJOR for incompatible principle removals or
redefinitions, MINOR for new or materially expanded governance, and PATCH for
clarification-only changes. Each plan, implementation review, milestone close, and final
project close MUST assess compliance.

When trade-offs are necessary, decide in this order: data correctness; business-rule
correctness; security and authorization; operational reliability; maintainability; user
experience; visual polish. Visual polish MUST NOT conceal broken business logic.

**Version**: 1.0.0 | **Ratified**: TODO(RATIFICATION_DATE): original adoption date unknown | **Last Amended**: 2026-09-10
