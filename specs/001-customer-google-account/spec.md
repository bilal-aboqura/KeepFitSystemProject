# Feature Specification: Customer Identity, Google Authentication & Account

**Feature Branch**: `001-customer-google-account`  
**Created**: 2026-09-10  
**Status**: Draft  
**Input**: Customer identity, Google authentication, account, addresses, and secure order access.

## Clarifications

### Session 2026-09-10

- Q: Should one Egyptian mobile number be allowed on more than one customer account? → A: Allow duplicates; phone is contact data, not an identity key.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Sign in and establish an account (Priority: P1)

As a storefront visitor, I can continue with Google and establish or return to my customer
account without losing the ability to shop as a guest.

**Why this priority**: Persistent customer identity is the foundation for all account,
address, order-history, and later B2B capabilities.

**Independent Test**: A new visitor signs in with Google, completes missing commerce
details, returns to the storefront as signed in, signs out, and can no longer open account
pages.

**Acceptance Scenarios**:

1. **Given** a guest is browsing the storefront, **When** they choose Continue with Google
   and authentication succeeds, **Then** a persistent customer identity is created or
   resolved and the storefront shows the signed-in state.
2. **Given** a returning person signs in with the same Google identity, **When**
   authentication succeeds, **Then** the existing customer identity is resolved without a
   duplicate customer record.
3. **Given** a signed-in customer lacks a full name or valid Egyptian mobile number,
   **When** they first continue shopping or attempt authenticated checkout, **Then** they
   are asked to complete the missing information before that checkout can finish.
4. **Given** Google authentication is cancelled or fails, **When** the visitor returns to
   the storefront, **Then** they receive a clear non-technical message and may continue as
   a guest.

---

### User Story 2 - Maintain account and delivery details (Priority: P1)

As an authenticated customer, I can view and update my permitted profile information and
saved delivery addresses from a mobile-first account area.

**Why this priority**: Accurate customer and delivery information reduces checkout effort
while preserving the business's canonical customer identity.

**Independent Test**: A signed-in customer views their profile, changes their name and
phone, adds, edits, selects, and deletes addresses, then confirms no other customer's
information is visible or editable.

**Acceptance Scenarios**:

1. **Given** an authenticated customer, **When** they open their account, **Then** they
   can navigate to Overview, My Orders, Addresses, and Profile in an RTL-first responsive
   experience.
2. **Given** an authenticated customer, **When** they update their full name or valid
   Egyptian mobile phone number, **Then** the permitted profile information is saved and
   privileged or operational fields remain unchanged.
3. **Given** an authenticated customer, **When** they add, edit, delete, or set a saved
   delivery address as default, **Then** only their addresses are affected and default
   address state remains logically valid.
4. **Given** Customer A, **When** Customer A attempts to access Customer B's profile or
   address through any customer-facing action, **Then** access is denied without exposing
   Customer B's information.

---

### User Story 3 - Place and view securely associated orders (Priority: P1)

As an authenticated customer, I can place an order that is associated with my customer
identity and view only my own order history and details.

**Why this priority**: Orders must become safely useful to customers without changing
historical checkout snapshots or weakening guest checkout.

**Independent Test**: An authenticated customer completes an order, sees it in My Orders,
opens its detail, and a different customer is denied access. A guest also completes an
order without signing in.

**Acceptance Scenarios**:

1. **Given** a signed-in customer with a complete profile, **When** they complete the
   existing checkout, **Then** the new order is associated with their persistent customer
   identity and retains its own immutable name, phone, and delivery snapshots.
2. **Given** a customer later changes their profile or address, **When** they view a prior
   order, **Then** its checkout-time customer and delivery details remain unchanged.
3. **Given** an authenticated customer, **When** they open My Orders or an order detail,
   **Then** they see only orders associated with their own identity, including order number,
   date, total, payment status, fulfillment status, items, and delivery information.
4. **Given** a guest customer, **When** they complete checkout without authentication,
   **Then** the order, payment, shipping, and notification behavior remains available and
   the guest cannot retrieve another customer's private order information.

---

### User Story 4 - Identify real customers in administration (Priority: P2)

As an administrator, I can distinguish persistent customer records from guest/order-derived
information while existing admin access and order operations continue to work.

**Why this priority**: Operations need a minimal reliable view of the new business identity
without prematurely building advanced customer administration.

**Independent Test**: An authorized administrator can identify an account-linked customer
and basic order relationship; a normal signed-in customer cannot access the same capability.

**Acceptance Scenarios**:

1. **Given** an authorized administrator, **When** they open the customer area, **Then**
   they can identify customer ID, name, available email, phone, account-link state, basic
   order relationship, and creation date.
2. **Given** a normal authenticated customer, **When** they attempt to access admin pages
   or admin actions, **Then** they are denied.

### Edge Cases

- A Google identity may not provide a name or email; the customer must still be able to
  provide required commerce profile information where available identity data is absent.
- Repeated authentication with the same Google identity must not create duplicate customers.
- A validated phone number is required for authenticated checkout but is not a login method
  or sole identity key.
- A customer with no addresses must see a clear empty state and can add the first address.
- If the default address is changed or deleted, the remaining default state must be valid.
- Historical guest orders must remain unlinked unless a future approved, safe linking method
  exists; name or phone similarity alone is insufficient.
- Guest confirmation must remain usable while preventing disclosure of another order's
  name, phone, address, products, or totals.
- Customer-facing errors for failed authentication, expired sessions, invalid phone data,
  duplicate/conflicting information, address failures, and unauthorized order access must
  be understandable and avoid exposing internal details.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST establish a durable Customer business identity that is
  independent of an order, a phone-number grouping, an authentication profile, and an
  authentication account, and that has a stable identifier for future relationships.
- **FR-002**: A Customer MAY exist without an authentication account; an authentication
  account MAY be associated with at most its authorized Customer identity.
- **FR-003**: The system MUST offer Google as the only required customer authentication
  method for this feature and MUST NOT introduce customer password, password-reset, email
  password registration, or SMS-OTP flows.
- **FR-004**: The storefront MUST show a clear account/sign-in action while unauthenticated
  and an account state with sign-out capability while authenticated.
- **FR-005**: Successful Google authentication MUST deterministically create or resolve the
  appropriate customer identity without using phone number as the sole authoritative key.
- **FR-006**: The system MUST initialize available trusted identity information without
  overwriting customer-entered permitted profile information on subsequent sign-ins.
- **FR-007**: Authenticated customers MUST provide a full name and valid Egyptian mobile
  phone number before completing an authenticated commerce order; they MAY browse before
  completion. A mobile phone number is contact data and MAY be shared by multiple Customer
  identities; it MUST NOT be used as an identity-uniqueness constraint.
- **FR-008**: Authenticated customers MUST have a mobile-first account area with Overview,
  My Orders, Addresses, and Profile navigation, with Arabic RTL as the primary direction
  and compatible bilingual presentation.
- **FR-009**: Customers MUST be able to view their account identity, full name, available
  email, and mobile phone number.
- **FR-010**: Customers MUST be able to change only explicitly permitted customer-facing
  profile fields, including at minimum full name and mobile phone number.
- **FR-011**: Customers MUST NOT directly create, change, or control administrative status,
  customer type, approval, price lists, special pricing, internal notes, balances, debt,
  permissions, or other privileged operational fields.
- **FR-012**: Authenticated customers MUST be able to add, view, edit, delete, and select a
  default saved delivery address containing compatible recipient, phone, governorate, city,
  and detailed street-address information.
- **FR-013**: Address operations MUST enforce ownership at an authoritative server or data
  access boundary; a customer MUST NOT read, update, or delete another customer's address.
- **FR-014**: The system MUST maintain valid default-address behavior, including replacing a
  prior default when a new default is selected and leaving valid state after deletion.
- **FR-015**: Guest checkout MUST remain available without account creation or
  authentication.
- **FR-016**: When a profile-complete authenticated customer places a new order, the order
  MUST be safely associated with that customer's persistent identity while retaining any
  compatible authentication association.
- **FR-017**: Orders MUST retain immutable checkout-time customer, phone, delivery, item,
  and total snapshots; later profile or address changes MUST NOT alter historical orders.
- **FR-018**: Authenticated customers MUST be able to list and open only their own orders,
  with useful existing order, payment, fulfillment, item, total, and delivery information.
- **FR-019**: Customer order ownership MUST be verified before any private order information
  is returned or rendered.
- **FR-020**: Guest order confirmation MUST remain usable and MUST NOT disclose private
  order information based only on an arbitrary, predictable, or guessable order reference.
- **FR-021**: The system MUST NOT automatically link historical guest orders to a newly
  authenticated customer solely on matching name or phone number.
- **FR-022**: Administrators MUST be able to distinguish persistent customer entities from
  guest/order-derived customer information and view customer ID, name, available email,
  phone, authentication-link state, basic order relationship, and creation date.
- **FR-023**: Normal authenticated customers MUST NOT gain administrator access or
  privileges; existing server-side administrator authorization MUST continue to apply.
- **FR-024**: Authentication-aware access policies MUST limit ordinary customers to their
  explicitly authorized customer data and public data.
- **FR-025**: Ordinary authenticated customers MUST NOT gain the ability to upload, modify,
  or delete administrative product media; required public product-media reading MUST remain
  available.
- **FR-026**: The feature MUST preserve guest checkout validation, COD, card payment,
  shipping, Bosta, Mylerz, Kashier, notifications, WhatsApp/order links, Meta tracking,
  analytics, product management, admin order screens, and order snapshots.
- **FR-027**: Authentication, profile, address, and order actions MUST provide clear
  loading, success, failure, and unauthorized states and prevent accidental duplicate
  submissions where applicable.
- **FR-028**: The feature MUST provide targeted automated coverage for first and returning
  customer resolution, profile authorization and safe updates, address ownership/defaults,
  authenticated and guest order handling, order ownership, guest confirmation privacy,
  admin authorization, and product-media authorization.
- **FR-029**: The feature MUST NOT implement customer types, approval, B2B pricing,
  variants, quantity rules, deposits, payment proof/review, advanced order lifecycle,
  inventory, finance, automation, AI, advanced reports, or executive dashboard features.

### Key Entities *(include if feature involves data)*

- **Customer**: The canonical persistent business identity, independent of individual
  orders and optionally associated with an authentication account.
- **Customer Account**: The authenticated relationship that permits a person to access a
  Customer's self-service account and data.
- **Customer Profile**: Customer-facing identity and contact information, including full
  name, available email, and mobile phone, with privileged business fields excluded from
  customer control.
- **Saved Address**: A customer-owned reusable delivery destination with recipient/contact,
  location, detailed address, and default-selection state.
- **Order Customer Association**: The relationship connecting a new authenticated order to
  its Customer while preserving immutable checkout-time order snapshots.

### Operational Controls *(include when applicable)*

- **Authorization**: Customer data and order access require verified ownership; existing
  administrator authorization remains separate and server-enforced.
- **Auditability**: Customer identity association, privileged customer-field changes, and
  any exceptional identity-management action must be traceable where applicable.
- **Commercial authority**: This feature does not add customer-type or price benefits;
  existing server-side checkout validation and commercial behavior remain in force.
- **Transaction integrity**: Customer/account resolution and association of a newly
  authenticated order must not leave duplicate or partially linked identity state.
- **Events & integrations**: Existing payment, shipping, notification, tracking, and
  analytics consumers continue to use order snapshots and remain compatible.
- **Existing functionality impact**: Guest checkout and the existing administrator flow are
  preserved; historical guest orders remain unlinked unless a later approved safe process
  establishes a relationship.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A new customer can authenticate, supply any missing required profile data, and
  reach a signed-in storefront state in no more than 2 minutes under normal conditions.
- **SC-002**: In acceptance testing, 100% of repeat authentications using the same identity
  resolve one existing customer record rather than creating a duplicate.
- **SC-003**: In authorization testing, 100% of attempts by one customer to access another
  customer's profile, addresses, or private orders are denied.
- **SC-004**: In the critical acceptance journey, an authenticated customer can add a
  default address, place an order, and find that order in My Orders without support
  intervention.
- **SC-005**: In guest-regression testing, a visitor can complete checkout without signing
  in and retains a usable, privacy-protected confirmation experience.
- **SC-006**: In regression testing, administrator login and protected operations, COD,
  card payment, shipping fulfillment handoff, notifications, and order administration
  remain operational.
- **SC-007**: At approximately 390px viewport width, all primary authentication, profile,
  address, account-navigation, and order-history actions are usable without horizontal
  scrolling.

## Assumptions

- Google identity data is treated as trusted only to initialize available profile values;
  customers can correct permitted fields.
- Existing Egyptian phone normalization and validation rules remain the baseline for a
  valid customer mobile number.
- Historical guest orders remain unassociated by default because the existing data cannot
  establish identity safely enough for automatic linking.
- Existing order customer, phone, delivery, item, and financial data remain snapshots for
  integrations and operations, even when a Customer relationship is added.
- Customer account functionality is part of the existing storefront experience and must
  retain its Arabic RTL and English LTR compatibility.
- Feature 002 owns customer type, approval, and advanced customer administration decisions;
  Feature 001 introduces no commercial entitlement based on authentication.
