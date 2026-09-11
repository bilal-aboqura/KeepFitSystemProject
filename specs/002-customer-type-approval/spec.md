# Feature Specification: Customer Types & Approval

**Feature Branch**: `002-customer-type-approval`  
**Created**: 2026-09-11  
**Status**: Draft  
**Input**: User description: "Add customer types and protected commercial account approval"

## Clarifications

### Session 2026-09-11

- Q: What happens to an active pending commercial request when an administrator directly assigns a customer type? → A: Direct assignment automatically closes the active pending request as superseded.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Request a commercial account (Priority: P1)

An authenticated customer can see Retail as their current type and request Wholesale Trader or Gym Owner from their account by supplying a business or trading name. The request belongs to their persistent identity; the customer continues shopping normally while it is reviewed.

**Why this priority**: It establishes protected commercial classification without blocking ordinary commerce.

**Independent Test**: Sign in as a Retail customer, submit a valid Wholesale Trader request, and verify it is pending while normal shopping remains available.

**Acceptance Scenarios**:

1. **Given** an authenticated customer with no commercial approval, **When** they open their account, **Then** Retail is shown as effective and they can request an eligible active commercial type.
2. **Given** an authenticated Retail customer, **When** they submit a valid Wholesale Trader or Gym Owner request, **Then** it is pending, belongs to that customer, and Retail remains effective.
3. **Given** a customer has a pending request, **When** they browse, manage their account, or place an order, **Then** those functions remain available and no protected privileges are granted.
4. **Given** a guest shopper, **When** they browse or check out, **Then** they can continue normally but cannot request a commercial type until they have an authenticated account.

---

### User Story 2 - Review and decide commercial requests (Priority: P1)

An authorized administrator can find pending requests in a focused queue, inspect relevant customer and business details, and explicitly approve or reject them. Approval changes the effective type; rejection does not.

**Why this priority**: Commercial status must never take effect without an accountable operational decision.

**Independent Test**: Submit a request, find it in the queue, approve it, and verify the type changes and the decision history is retained.

**Acceptance Scenarios**:

1. **Given** a pending request, **When** an authorized administrator approves it, **Then** it becomes Approved, its requested type becomes effective, and the decision actor and time are retained.
2. **Given** a pending request, **When** an authorized administrator rejects it with a customer-facing reason or internal note, **Then** it becomes Rejected, the effective type remains unchanged, and private notes are not automatically shown to the customer.
3. **Given** an administrator has a finalized request open from a stale view, **When** they attempt another decision, **Then** the original decision is preserved and a clear conflict result is shown.
4. **Given** an ordinary customer, **When** they attempt to decide or directly assign a type, **Then** the action is denied.

---

### User Story 3 - Understand status and reapply (Priority: P2)

Customers can understand their effective type, request status, submitted information, and any configured customer-facing rejection reason. A rejected customer can later submit a valid new request without erasing the previous history.

**Why this priority**: Clear feedback supports legitimate reapplication and prevents commercial-status confusion.

**Independent Test**: Reject a request, verify the customer remains usable and can see the outcome, then submit a later request and verify both records remain available.

**Acceptance Scenarios**:

1. **Given** a rejected request, **When** the customer views their account, **Then** the effective type and rejected status are clear and only a configured customer-facing reason is shown.
2. **Given** a rejected request, **When** the customer later submits a valid reapplication, **Then** it is a new request and the prior decision remains preserved.
3. **Given** an approved Wholesale Trader, **When** they request Gym Owner, **Then** Wholesale Trader remains effective until the new request is approved.

---

### User Story 4 - Manage classifications operationally (Priority: P2)

An authorized administrator can directly assign a customer type for an operational exception and filter customer/request views by effective type, requested type, and request status. Direct changes are auditable.

**Why this priority**: Operations need a controlled exception path without requiring a customer request first.

**Independent Test**: Directly assign an active type and verify the prior type, new type, administrator, action, and time are retained.

**Acceptance Scenarios**:

1. **Given** an authorized administrator, **When** they explicitly assign an active type, **Then** the effective type changes and the previous type remains in history.
2. **Given** an inactive type, **When** a customer attempts to request it, **Then** the request is refused while existing assignments and history remain intact.
3. **Given** pending requests exist, **When** an administrator opens the dashboard, **Then** an actionable attention item displays their count and leads to the approval queue.

### Edge Cases

- Repeated submission, retries, and multiple taps cannot create duplicate pending requests.
- A customer with an active pending commercial request cannot create a conflicting second request.
- A stale or concurrent decision cannot overwrite a finalized request.
- Pending or rejected requests never leave a customer without a valid effective type.
- Existing customers receive Retail unless authoritative commercial classification exists; no type is inferred from names, contact data, or orders.
- Deactivation blocks future requests without altering existing assignments or history.
- Errors are understandable and do not expose raw security or data-store details.
- The Arabic RTL and English LTR account experience works at approximately 390 px width with no horizontal overflow.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST maintain an extensible customer-type catalog with a stable business identifier, display name, active state, approval requirement, and display ordering.
- **FR-002**: The initial catalog MUST include Retail, Wholesale Trader, and Gym Owner; Retail MUST remain the usable baseline.
- **FR-003**: Every persistent customer MUST have exactly one authoritative effective customer type at all times.
- **FR-004**: Existing customers MUST transition to Retail unless reliable, authoritative commercial classification already exists.
- **FR-005**: A pending or rejected request MUST NOT change the effective type or grant protected privileges.
- **FR-006**: An authenticated customer MUST be able to request an active protected type from their account by selecting the type and supplying at least a business/trading name.
- **FR-007**: The request flow MAY collect business phone, location, description, and notes; it MUST support gym name/location for Gym Owner and trading/business name/location for Wholesale Trader.
- **FR-008**: Requests MUST be associated with the canonical persistent customer identity, never phone, email, order data, or client-supplied identity.
- **FR-009**: The customer experience and authoritative rules MUST prevent duplicate simultaneous pending requests for the same type.
- **FR-010**: A customer with an active pending commercial request MUST NOT create another conflicting commercial request until it is resolved or withdrawn.
- **FR-011**: Commercial requests MUST have explicit Pending, Approved, or Rejected status; any withdrawal status MUST preserve history.
- **FR-012**: The customer account MUST display the effective type, active request's requested type/status, submitted information, and eligible commercial-request actions.
- **FR-013**: Pending and rejected customers MUST retain normal authentication, browsing, account, and order-placement access.
- **FR-014**: Authorized administrators MUST have a focused approval queue showing customer identity, requested type, business name, contact information, submission time, current effective type, and status.
- **FR-015**: Authorized administrators MUST be able to inspect relevant customer data, supplied business information, current/requested types, submission time, and useful request history before deciding.
- **FR-016**: Only authorized administrators MUST be able to approve, reject, or directly assign types, enforced by authoritative server-side rules.
- **FR-017**: Approval MUST finalize the request and change the effective type to the requested type as one indivisible business outcome.
- **FR-018**: Rejection MUST finalize the request without changing the effective type. Administrators MUST be able to separately record customer-facing reason and internal note.
- **FR-019**: Decision processing MUST refuse stale, repeated, or concurrent attempts to overwrite a finalized request.
- **FR-020**: An authorized administrator MUST be able to directly assign an active customer type without a preceding customer request. A direct assignment MUST automatically close any active pending commercial request as superseded while preserving its history.
- **FR-021**: Requests, decisions, and direct assignments MUST preserve the customer, prior effective type, requested/new type, action/status, acting administrator where applicable, and timestamp.
- **FR-022**: Rejected customers MUST be able to submit a later legitimate request, subject only to reasonable anti-duplication/resubmission controls, without erasing previous history.
- **FR-023**: Customers MUST access and manage only their own requests; cross-customer read, submission, and alteration attempts MUST be refused.
- **FR-024**: Inactive types MUST be unavailable for new requests while preserving current assignments and history.
- **FR-025**: The admin dashboard MUST surface pending commercial-request count as an actionable item linked to the approval queue.
- **FR-026**: Admin views MUST support filters for effective type, requested type, and request status.
- **FR-027**: Customer-type names and state copy MUST support Arabic RTL and English LTR; translated labels MUST NOT determine business behavior.
- **FR-028**: Customer-facing flows MUST be mobile-first, usable at approximately 390 px width, show useful loading/error feedback, and avoid horizontal overflow.
- **FR-029**: The effective type MUST be the only authoritative classification for future rules; pending data, past orders, contacts, and frontend state MUST NOT infer it.
- **FR-030**: This feature MUST NOT change product, cart, checkout, or order prices because of commercial approval.
- **FR-031**: Google authentication, account/profile/address access, authenticated order ownership/history, guest checkout, admin authentication/customer visibility, payments, delivery integrations, notifications, analytics, and order snapshots MUST continue working.
- **FR-032**: Request state MUST support future reaction to submission, approval, and rejection without implementing a communications automation engine in this feature.

### Key Entities *(include if feature involves data)*

- **Customer Type**: Business classification with stable identifier, localized name, availability, approval requirement, and ordering. Retail is baseline.
- **Customer Effective Type**: The single approved classification currently governing future eligibility; always present.
- **Commercial Type Request**: A customer-owned request for a protected type, with business details, lifecycle status, submission details, and decision data.
- **Customer Type History**: Preserved record of requests, decisions, and direct assignments.
- **Decision Note**: Separate customer-facing and internal decision information.

### Operational Controls *(include when applicable)*

- **Authorization**: Only authorized operational/admin users can decide or directly assign types. Customers only create and view their own requests.
- **Auditability**: Sensitive actions retain customer, type transition, action/status, actor where applicable, and time; records are not silently overwritten.
- **Commercial authority**: Future rules use only the effective customer type. No prices or benefits change in this feature.
- **Transaction integrity**: Approval and effective-type change are indivisible; current state is checked before decision.
- **Events & integrations**: Lifecycle state supports later notification/automation reaction; no communication engine is added.
- **Existing functionality impact**: Existing Feature 001 identity and commerce flows, guest checkout, integrations, and admin capabilities remain available.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of persistent customers have one valid effective type after transition, with previously unclassified customers assigned Retail.
- **SC-002**: In acceptance testing, 100% of approved requests change the effective type once and 100% of rejected requests leave it unchanged.
- **SC-003**: In acceptance testing, 100% of duplicate, cross-customer, unauthorized, and stale decision attempts are refused without changing classification or history.
- **SC-004**: A customer can submit a valid commercial request and see its pending status in no more than 3 minutes on a 390 px-wide mobile viewport.
- **SC-005**: An authorized administrator can identify, review, and decide a pending request in no more than 2 minutes in usability testing.
- **SC-006**: All existing Feature 001 regression journeys named in FR-031 complete successfully during release verification.
- **SC-007**: Product, cart, checkout, and order prices remain identical for otherwise equivalent Retail and approved commercial customers in this feature's acceptance tests.

## Assumptions

- Existing persistent customer identity, customer account, Google authentication, and authorized admin boundaries are extended rather than duplicated.
- Retail stays active and remains the baseline unless a future explicit migration changes that rule.
- A customer may reapply after rejection when no pending request exists; any cooldown is a reasonable safeguard and never permanently removes eligibility.
- Business/trading name is universally required; other business information is optional unless a later policy states otherwise.
- Customer-facing rejection reasons are optional, and internal notes are private by default.
- Simple in-account status feedback is in scope; email/messaging, pricing, credit, inventory, full CRM, and automation-engine work are out of scope.
