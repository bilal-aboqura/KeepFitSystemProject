# Feature Specification: B2B Cart, Checkout & Operational Admin Foundation

**Feature Branch**: `005-b2b-checkout-admin`  
**Created**: 2026-09-13  
**Status**: Draft  
**Input**: User description: "Complete Milestone 1 with B2B-aware quantity rules, authoritative cart and checkout totals, safe order creation, guest and authenticated commerce, and an operational Admin foundation built on Features 001–004."

## Clarifications

### Session 2026-09-13

- Q: How should guest/public quantity rules be determined? → A: Admin-configurable public rule per Variant and Sellable Unit, falling back to minimum 1/increment 1.
- Q: Which quote changes require the Customer to explicitly review and reconfirm checkout? → A: Any change to line price, discount, shipping, final total, selected commercial identity, or purchase eligibility.
- Q: How should multiple quantity rules for the same public/Customer-Type, Variant, and Sellable Unit context be handled? → A: Permit no more than one active rule per configured context.
- Q: What should the Milestone 1 dashboard count as an order requiring attention? → A: Every order still in the existing initial order status.
- Q: How long must the same checkout submission remain protected from creating another order? → A: 24 hours from the first accepted submission.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Complete an authoritative guest or customer order (Priority: P1)

A guest or authenticated Customer browses to a Product, selects a Variant and independently sellable Sellable Unit, chooses a valid whole-number quantity, reviews an authoritative cart, supplies valid delivery and payment information, and creates one order using current commercial terms. Authenticated Customers may use their own saved addresses, while guest checkout remains available under public/default rules.

**Why this priority**: A secure end-to-end order is the core Milestone 1 outcome and the foundation for all later order operations.

**Independent Test**: Purchase one active Variant/Sellable Unit as a guest and again as an authenticated Retail Customer using COD and, where enabled, card payment; verify current prices, shipping, discounts, Customer/address association, order history, and secure confirmation without trusting submitted monetary values.

**Acceptance Scenarios**:

1. **Given** an active Variant with an active independently sellable unit, valid public price, and default quantity rules, **When** a guest completes valid delivery and payment details, **Then** exactly one order is created using the current authoritative line, discount, shipping, and final totals.
2. **Given** an authenticated Customer with a complete commerce profile and saved addresses, **When** they select their default address or another address they own, **Then** checkout uses the selected address and links the order to that persistent Customer.
3. **Given** an authenticated Customer with missing required contact information, **When** they attempt checkout, **Then** order creation is blocked and they are directed to complete the required profile fields without losing their cart.
4. **Given** manipulated client values for price, totals, shipping, Customer identity/type, packaging conversion, or minimum quantity, **When** checkout is submitted, **Then** the manipulated values do not control the order and invalid commercial intent is rejected.

---

### User Story 2 - Buy under approved B2B pricing and quantity rules (Priority: P1)

An approved Wholesale or Gym Customer sees and uses the pricing and quantity rules for their authoritative effective Customer Type. The same Product, cart, and checkout journey serves guest, Retail, Wholesale, and Gym contexts without separate type-specific checkout experiences.

**Why this priority**: Approved B2B commerce is the defining business capability of Feature 005.

**Independent Test**: Configure different minimums and increments for Retail, Wholesale, and Gym on one Variant/Sellable Unit, then verify that each effective type receives its own rule and Feature 004 price while a pending request and a guest retain their current public/default behavior.

**Acceptance Scenarios**:

1. **Given** a Wholesale Customer and a rule with minimum 6 and increment 2, **When** they select quantities 6, 8, or 10, **Then** each is accepted; quantities 5, 7, and 9 are rejected with corrective guidance.
2. **Given** a Retail Customer whose Wholesale request is pending, **When** they shop, **Then** Retail pricing and quantity rules remain effective until approval.
3. **Given** no specific quantity rule for an active independently sellable unit, **When** a guest or Customer selects it, **Then** the default minimum 1 and increment 1 apply.
4. **Given** one Variant sold independently as both Box and Ampoule, **When** a Customer adds each unit, **Then** they remain distinct cart lines and neither is silently converted or merged into the other.

---

### User Story 3 - Review changed terms before placing an order (Priority: P1)

A Customer whose cart has become stale receives a refreshed authoritative quote and clear, actionable explanations. Material changes are shown before the Customer can confirm the new terms, while invalid or unavailable lines remain visible enough to correct or remove.

**Why this priority**: Revalidation prevents unexpected charges, invalid B2B orders, and stale catalog terms.

**Independent Test**: After a Customer sees a cart, independently change a price, quantity rule, coupon, shipping fee, Customer Type, Variant state, and unit state; verify that the next validation uses current terms, identifies each affected line or total, and never silently completes a materially changed order.

**Acceptance Scenarios**:

1. **Given** any line price, discount, shipping, final total, selected commercial identity, or purchase-eligibility term differs from the Customer-confirmed quote, **When** they submit checkout, **Then** the prior confirmation is invalidated and the order is not finalized until all correctable updated terms are presented for explicit review and reconfirmation.
2. **Given** a quantity-rule minimum changes from 5 to 10 while quantity 5 remains in a cart, **When** the cart is next validated, **Then** the line becomes invalid and the Customer is told the new minimum.
3. **Given** a Variant or selected Sellable Unit becomes inactive or non-sellable, **When** the cart is validated, **Then** the line cannot be purchased, is not silently substituted, and has an actionable availability message.
4. **Given** a Retail Customer is approved as Wholesale while their cart persists, **When** they return to the cart, **Then** current Wholesale pricing and quantity rules replace stale Retail terms.

---

### User Story 4 - Create one durable and explainable order (Priority: P1)

A Customer can safely retry a slow submission without creating duplicate orders. A successful order preserves immutable Customer, delivery, Product, Variant, Sellable Unit, quantity, pricing, discount, shipping, and payment snapshots so the purchase remains understandable after later configuration changes.

**Why this priority**: Duplicate prevention, atomicity, and historical meaning are essential financial and operational safeguards.

**Independent Test**: Submit the same checkout intent concurrently and by retry, inject a failure during order creation, then change the Customer type, catalog labels, packaging, prices, and quantity rules; verify one complete order, no partial order, and unchanged historical details.

**Acceptance Scenarios**:

1. **Given** repeated requests represent the same checkout submission, **When** they arrive within 24 hours of the first accepted submission because of double-click, browser retry, network retry, or payment redirect, **Then** they produce one order and return only that order to the same checkout context.
2. **Given** an order cannot persist all required order and line information, **When** creation fails, **Then** no partially valid order remains and the Customer can safely retry with their intent preserved.
3. **Given** a completed order, **When** live Customer, catalog, packaging, pricing, or quantity-rule data later changes, **Then** the historical order continues to show the original commercial and delivery snapshots.
4. **Given** card payment is enabled, **When** payment is prepared, **Then** its amount equals the authoritative final order total and protected return/confirmation behavior remains intact.

---

### User Story 5 - Configure quantity rules and resolve commerce blockers (Priority: P2)

An authorized Admin configures minimum and increment rules by Customer Type, Variant, and Sellable Unit, reviews the resulting rule in an understandable commerce context, and sees detectable blockers such as active offerings without a sellable unit, valid price, or valid quantity rule.

**Why this priority**: B2B behavior must be operationally configurable for current and future Customer Types without code changes or direct data intervention.

**Independent Test**: Create, update, and deactivate rules for multiple Customer Types and units; verify deterministic resolution, defaults, validation of invalid configurations, audit-compatible history, and links from detected blockers to the relevant management view.

**Acceptance Scenarios**:

1. **Given** an authorized Admin, **When** they configure a public or Customer-Type rule for a Variant, Sellable Unit, minimum, and increment, **Then** future authoritative quotes use that rule for the matching guest or effective Customer-Type context.
2. **Given** an invalid rule with a non-positive minimum or increment, **When** an Admin attempts to save it, **Then** the rule is rejected with a clear correction message.
3. **Given** an active Variant has no independently sellable unit or an active sellable unit has no valid price, **When** the condition is reliably detectable, **Then** Admin receives an actionable configuration warning.
4. **Given** a future Customer Type is added, **When** an Admin configures a rule for it, **Then** the rule can participate in the same resolution flow without a Customer-Type-specific commerce path.
5. **Given** one active quantity rule already exists for a commerce context, Variant, and Sellable Unit, **When** an Admin activates its replacement, **Then** the change completes with exactly one active rule for that context.

---

### User Story 6 - Operate Milestone 1 from Admin (Priority: P2)

An authorized Admin opens one coherent operational area to see what needs attention, review a concise live summary, find orders using business-facing information, inspect exact order snapshots, and navigate among Customers, type requests, Catalog, Pricing, and Orders.

**Why this priority**: Milestone 1 is not operationally complete if staff need direct data access to approve Customers or understand orders.

**Independent Test**: Populate pending approvals, orders inside and outside the existing initial status, and detectable catalog/pricing issues; verify dashboard counts and links, then search/filter orders and inspect a guest order and authenticated B2B order without using internal identifiers.

**Acceptance Scenarios**:

1. **Given** pending Customer-Type requests, orders in the existing initial order status, and detectable commerce blockers, **When** Admin opens the dashboard, **Then** current attention counts are backed by real data and each item opens the relevant operational view.
2. **Given** existing orders, **When** Admin searches by order number, Customer name, phone, or supported SKU and filters by supported date, status, payment method, or Customer Type, **Then** matching orders can be found without knowing internal identifiers.
3. **Given** an authenticated order, **When** Admin opens it, **Then** they can inspect Customer/address snapshots, Product/Variant/unit identity, quantities, unit and line prices, discounts, shipping, final total, payment method, existing status, and limited stored price-source context where available.
4. **Given** a guest order and an authenticated order, **When** Admin views each, **Then** guest status is explicit and only the authenticated order links to its persistent Customer; ownership is not inferred from phone number.

### Edge Cases

- Fractional, zero, negative, non-numeric, and excessively large quantities are rejected for the discrete Sellable Units in scope.
- Quantity validity uses `quantity >= minimum` and increments measured from the configured minimum; the default is minimum 1 and increment 1.
- Rules apply only to the authoritative effective Customer Type; pending, rejected, stale, or client-claimed types grant no B2B terms.
- A line with the same Variant but a different Sellable Unit never merges; matching identities merge only when their commerce context is compatible.
- Packaging equivalence is captured from authoritative Catalog data for the order snapshot but never changes the Customer-selected Sellable Unit.
- Missing or invalid price, inactive Variant/unit, non-sellable unit, invalid quantity, invalid coupon, invalid address ownership, and changed shipping each block order creation with a safe actionable message.
- If a current basic availability check reports unavailable stock, checkout blocks the obvious unavailable purchase; no reservation or inventory concurrency guarantee is implied.
- A lost response after successful creation can be retried within the same bounded submission context without creating another order or exposing another Customer’s order.
- Cart intent is retained after validation, payment-preparation, or order-creation failure and is cleared or transitioned only after the existing payment flow confirms successful authoritative creation.
- Arabic RTL and English LTR cart, checkout, quantity guidance, errors, and Admin views remain usable at approximately 390 px with no horizontal overflow.
- Real payments, shipment creation, and Customer notifications are replaced by safe controlled equivalents in automated acceptance tests.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: A new cart line MUST identify exactly one canonical Variant, one Sellable Unit belonging to that Variant, and a positive whole-number quantity.
- **FR-002**: Cart lines MUST merge only when Variant, Sellable Unit, and relevant commerce context match; different Sellable Units MUST remain distinct.
- **FR-003**: The system MUST preserve the Customer-selected Sellable Unit and MUST NOT silently convert it to another packaging unit.
- **FR-004**: Client-stored cart details MAY preserve shopping intent and display context, but MUST NOT be authoritative for identity, Customer Type, packaging, quantity eligibility, price, discounts, shipping, or totals.
- **FR-005**: The system MUST resolve one quantity rule using authoritative effective Customer Type, Variant, and Sellable Unit, with no separate hardcoded Retail, Wholesale, or Gym checkout behavior.
- **FR-006**: A quantity rule MUST define a positive whole-number minimum and increment for one public or Customer-Type commerce context, one Variant, and one Sellable Unit; no more than one rule MAY be active for that complete context.
- **FR-007**: If no applicable specific rule exists for an active independently sellable unit, the system MUST apply minimum 1 and increment 1.
- **FR-008**: Guests MUST use an active Admin-configured public rule for the selected Variant/Sellable Unit when one exists, otherwise minimum 1 and increment 1; they MUST NOT select or claim protected Customer-Type rules.
- **FR-009**: Pending or rejected Customer-Type requests MUST NOT affect quantity rules; only the effective Customer Type from Feature 002 applies.
- **FR-010**: A quantity MUST be valid only when it is at least the applicable minimum and falls on an allowed increment from that minimum.
- **FR-011**: Relevant quantity minimums and increments MUST be shown before checkout near the selected commerce unit, with immediate client guidance allowed but never authoritative.
- **FR-012**: Authorized Admin users MUST be able to create, update, activate/deactivate, and review public rules and Customer-Type rules by commerce context, Variant, and Sellable Unit.
- **FR-013**: Quantity-rule configuration MUST remain extensible to future Customer Types, MUST reject invalid, contradictory, or non-positive rule values, and MUST activate replacements without leaving zero or multiple active rules unintentionally.
- **FR-014**: Quantity-rule changes MUST affect subsequent authoritative validation of existing carts without rewriting completed orders.
- **FR-015**: The storefront MUST allow Customers to reach a purchasable Variant/Sellable Unit through existing browsing or search without knowledge of internal identifiers.
- **FR-016**: Product detail MUST combine Variant, active independently sellable unit, authoritative price, applicable quantity guidance, and selected quantity before add-to-cart is offered.
- **FR-017**: One authoritative cart validation MUST verify each requested line’s Variant existence/active state, unit membership/active/sellable state, quantity, Customer context, quantity rule, current Feature 004 price, and currently supported availability constraint.
- **FR-018**: Cart validation MUST return a normalized current quote containing line identity, quantity, unit price, line total, applicable quantity rule, subtotal, existing valid discount adjustment, and validation state.
- **FR-019**: Cart and checkout validation MUST process the cart as one commercial request and MUST NOT require a separate validation request for every line.
- **FR-020**: Validation failures MUST identify the affected line or checkout field and provide a safe actionable explanation without exposing internal data errors.
- **FR-021**: Every authoritative validation MUST use current Feature 004 pricing and MUST ignore client-stored or client-submitted prices and monetary totals.
- **FR-022**: Before order creation, the system MUST calculate a final authoritative quote containing current line totals, subtotal, valid existing discount/coupon adjustment, authoritative shipping, and final total.
- **FR-023**: Existing Egyptian governorate/city shipping, configured fees, free-shipping rules, and supported special rules MUST remain authoritative and compatible.
- **FR-024**: Existing supported coupons and discounts MUST remain server-authoritative and apply after authoritative line pricing and before shipping/final total according to current business behavior.
- **FR-025**: Any change to line price, discount, shipping, final total, selected Product/Variant/Sellable Unit identity, or purchase eligibility after Customer confirmation MUST invalidate that confirmation; order creation MUST pause until all correctable updated terms are displayed and explicitly reconfirmed, even when offsetting monetary changes leave the final total unchanged.
- **FR-026**: Checkout MUST derive authenticated Customer identity, effective Customer Type, pricing context, and quantity rules from the active session and canonical Customer record.
- **FR-027**: Guest checkout MUST remain available with public/default pricing, quantity, delivery, and existing payment behavior.
- **FR-028**: Authenticated checkout MUST support the Customer’s default saved address, another saved address they own, or another valid delivery address according to existing behavior.
- **FR-029**: A saved address selected by identity MUST belong to the authenticated Customer; another Customer’s address MUST be rejected without disclosure.
- **FR-030**: Authenticated Customers MUST satisfy Feature 001 commerce profile requirements before order creation and MUST receive a recoverable completion path when information is missing.
- **FR-031**: Checkout MUST preserve COD and enabled Kashier/card flows; any payment amount MUST derive only from the authoritative final order total.
- **FR-032**: Order creation MUST use only the validated final Customer/guest context, cart, pricing, quantity rules, shipping, discount, and payment method.
- **FR-033**: New order lines MUST snapshot Product name, Variant identity/label, SKU, Sellable Unit identity/label, quantity, equivalent base quantity, authoritative unit price, line total, currency, and useful price-source context where available.
- **FR-034**: New orders MUST preserve immutable Customer/guest name, phone, delivery address, governorate, city, discount, shipping, final total, payment method, and existing status information needed to explain the purchase.
- **FR-035**: Later Customer, Customer-Type, Catalog, packaging, pricing, quantity-rule, or address changes MUST NOT alter completed order snapshots.
- **FR-036**: Order creation MUST be atomic across the order, its lines, and required commerce snapshots; failure MUST leave no partially valid order.
- **FR-037**: Repeated submission of the same checkout intent due to double-click, browser retry, or network retry MUST create no more than one order.
- **FR-038**: Duplicate protection MUST be bound to the relevant guest/authenticated checkout context for 24 hours from the first accepted submission, MUST reject reuse with changed commercial terms, and MUST not reveal another Customer’s order.
- **FR-039**: Cart intent MUST remain recoverable after checkout failure and MUST clear or transition only after successful authoritative order creation according to the existing payment flow.
- **FR-040**: Current basic stock/availability validation MAY continue to block obvious unavailable purchases, but this feature MUST NOT claim stock reservation or inventory concurrency guarantees.
- **FR-041**: Admin MUST provide one coherent operational navigation path for Dashboard, Customers, Customer Type Requests, Catalog/Products/Variants, Pricing, and Orders.
- **FR-042**: The Admin dashboard MUST prioritize actionable current conditions, including pending Customer-Type approvals, every order still in the existing initial order status, and reliably detectable Catalog, pricing, or quantity-rule blockers; order age and whether an Admin viewed it MUST NOT remove it from attention.
- **FR-043**: Each dashboard attention item MUST be based on current data and MUST navigate to the relevant operational view.
- **FR-044**: The Admin dashboard MUST provide a concise Milestone 1 summary of available order, Customer, pending approval, active Product, active Variant, and safely supported order-value measures without becoming an advanced reporting system.
- **FR-045**: The Admin Orders list MUST show order number, date, Customer or guest identity, Customer Type where available, total, payment method, current existing status, and currently available fulfillment/shipping information.
- **FR-046**: Admin MUST be able to find orders using supported business-facing values including order number, Customer name, phone, and SKU where feasible, and narrow results using available date, current status, payment method, and Customer Type filters.
- **FR-047**: Admin order detail MUST show immutable Customer/address and Product/Variant/Sellable Unit snapshots, quantities, unit/line prices, discounts, shipping, final total, payment method, existing status, and limited stored pricing-source context where available.
- **FR-048**: Authenticated orders MUST link to their persistent Customer; guest orders MUST be explicitly distinguished, and Customer ownership MUST NOT be inferred from phone number.
- **FR-049**: Feature 005 MUST NOT introduce broad arbitrary order mutation or the future controlled order lifecycle and post-order editing workflows.
- **FR-050**: Quantity-rule changes and operationally useful exceptional checkout/order failures MUST remain compatible with existing audit principles, including actor, target, change/error context, and time where applicable.
- **FR-051**: New customer-facing and Admin experiences MUST preserve the current brand identity, components, navigation patterns, responsive behavior, and bilingual Arabic RTL/English LTR experience without obsolete Xeemo identity.
- **FR-052**: Existing Google authentication, Customer profiles/addresses, Customer-Type request/approval, Variant/Sellable Unit Catalog and media, Feature 004 pricing, order history/confirmation, COD, Kashier, Bosta, Mylerz, notifications, Meta, and analytics behavior MUST remain compatible.
- **FR-053**: Automated tests MUST NOT charge real payments, create real shipments, or send real Customer notifications.
- **FR-054**: Development/staging fixtures SHOULD demonstrate distinct Retail, Wholesale, and Gym rules for representative package and sub-package units and MUST NOT introduce fake operational rules into production by default.
- **FR-055**: Feature closure MUST reconcile each agreed Milestone 1 requirement as implemented, existing and verified, or explicitly assigned to a later milestone.
- **FR-056**: Advanced order lifecycle, deposits, payment proof, post-order editing/recalculation, stock reservations, inventory/warehouses, preparation/packing, shipment redesign, suppliers/purchasing, finance, advanced reporting, AI, automation, and full audit/security administration are outside Feature 005.

### Key Entities *(include if feature involves data)*

- **Cart Intent**: A Customer’s requested Variant, Sellable Unit, and positive whole-number quantity, plus non-authoritative display context retained for shopping convenience.
- **Quantity Rule**: A commercial constraint for either the public guest context or one Customer Type, plus one Variant and Sellable Unit, defining minimum quantity and allowed increment; at most one rule is active for the complete context.
- **Authoritative Cart Quote**: A current validation result containing normalized lines, applicable rules, current prices, calculations, adjustments, and actionable validation state for one guest or Customer context.
- **Checkout Submission**: An attempt to confirm one authoritative quote with delivery and payment intent; its guest or authenticated duplicate-protection context remains authoritative for 24 hours from the first accepted submission.
- **Order**: The atomically created commercial record for a guest or persistent Customer with immutable totals, delivery, payment, and existing status snapshots.
- **Order Line Snapshot**: The immutable Product, Variant, SKU, Sellable Unit, packaging equivalence, quantity, price, currency, and pricing-source meaning captured at purchase.
- **Operational Attention Item**: A current count or exception backed by business data and linked to the Admin view where action can be taken; order attention includes every order in the existing initial order status.

### Operational Controls *(include when applicable)*

- **Authorization**: Session-derived Customer context controls protected pricing, quantity rules, saved addresses, idempotent order retrieval, and order ownership. Existing Admin authority protects quantity configuration and operational Customer/order access.
- **Auditability**: Quantity-rule mutations and useful exceptional commerce failures preserve sufficient actor, target, context, and time information under existing audit principles; full audit administration remains deferred.
- **Commercial authority**: The browser expresses Variant, Sellable Unit, quantity, delivery, coupon, and payment intent. Current Customer identity/type, packaging, pricing, eligibility, discounts, shipping, and totals are independently resolved before order creation.
- **Transaction integrity**: Quantity-rule replacement preserves at most one active rule per complete commerce context. Final terms are revalidated; order, lines, and snapshots succeed or fail together; repeat submissions in one bounded context resolve to no more than one order.
- **Events & integrations**: Existing payment, shipping, notification, Meta, and analytics integrations consume authoritative order snapshots and are isolated from real side effects in automated tests.
- **Existing functionality impact**: Features 001–004 and current guest commerce remain foundational. Feature 005 completes Milestone 1 without preempting the controlled lifecycle, inventory, finance, and advanced operations milestones.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In the acceptance matrix, 100% of guest, Retail, approved Wholesale, and approved Gym carts receive the correct current Feature 004 price and applicable minimum/increment for every tested Variant/Sellable Unit.
- **SC-002**: In security acceptance tests, 100% of manipulated price, total, shipping, Customer identity/type, packaging, and quantity-rule inputs fail to change authoritative order terms or access another Customer’s data.
- **SC-003**: In 100% of tested price, quantity-rule, availability, coupon, and shipping changes made after quote display, checkout either presents the updated terms for review or blocks with an actionable correction; no materially changed order is silently finalized.
- **SC-004**: In duplicate and concurrent retry tests, each logical checkout submission produces exactly one order; in injected failure tests, zero partial orders remain.
- **SC-005**: In historical-order tests, 100% of completed Customer, address, Variant, Sellable Unit, quantity, packaging, price, discount, shipping, total, and payment snapshots remain unchanged after related live records change.
- **SC-006**: At least 90% of representative users can complete a valid guest, Retail, or approved B2B checkout on their first attempt in under 3 minutes after reaching Product detail.
- **SC-007**: At a viewport of approximately 390 px, 100% of acceptance screens for Arabic RTL and English LTR complete without horizontal overflow and keep identity, quantity guidance, price, errors, totals, and the primary action readable and operable.
- **SC-008**: In operational usability testing, an authorized Admin can identify the top current attention item, open its relevant view, find a specified order, and explain its purchased unit and totals in under 2 minutes without direct data access or internal identifiers.
- **SC-009**: Dashboard attention counts and order summaries match their underlying acceptance fixtures in 100% of tested pending-approval, recent-order, and detectable commerce-blocker cases.
- **SC-010**: The complete Wholesale Milestone 1 journey—from approved type through personalized Product selection, valid cart, checkout, order history, and Admin order detail—and the independent guest journey both pass end to end.
- **SC-011**: All agreed Feature 001–004 regression journeys and currently enabled payment, shipping, notification, and analytics compatibility checks pass without real external side effects in automated tests.
- **SC-012**: Milestone 1 reconciliation classifies 100% of agreed requirements as implemented, existing and verified, or explicitly scheduled to a named later milestone; none remain unaccounted for.

## Assumptions

- Features 001–004 provide the canonical Customer/session, effective Customer Type, saved address, Product/Variant/Sellable Unit/packaging, media, and authoritative pricing capabilities described in their specifications.
- Retail is the effective type until an approved change takes effect; guests use an active configured public quantity rule when present and otherwise use minimum 1/increment 1.
- All Sellable Units currently in commerce are discrete, so quantities are positive whole numbers. Divisible measurement-based selling requires a future Catalog specification.
- Quantity increments are measured from the configured minimum (for example, minimum 6 and increment 2 permits 6, 8, 10). This definition is used consistently across configuration, display, and validation.
- Existing shipping, coupon/discount, payment, confirmation, order-status, availability, and integration behavior is preserved unless an authoritative-calculation or security requirement in this specification explicitly tightens it.
- A reconfirmation-triggering change is any change to line price, discount, shipping, final total, selected Product/Variant/Sellable Unit identity, or purchase eligibility; no monetary tolerance applies, and offsetting changes do not bypass reconfirmation.
- Existing Admin authorization and audit foundations remain the source of operational access control; this feature extends their coverage rather than defining a new role model.
- Basic availability checks reduce obvious invalid orders but cannot guarantee stock under concurrency until Feature 013 introduces reservation integrity.
- Admin pricing-source visibility is limited to information snapshotted at order time and does not recalculate historical orders from current rules.
