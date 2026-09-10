# Customer Account Interface Contracts

Private handlers authenticate with the server session and verify ownership before returning
data. Handler names are Feature 001 targets, not public commitments.

## Authentication

- `POST /api/customer/auth/google`: starts Google sign-in with an optional validated local
  return path; no password endpoints exist.
- `GET /auth/callback?code=…&next=…`: exchanges code, resolves Customer, and redirects only
  to a validated local account/profile/storefront destination.

## Current Customer

- `GET /api/customer/me`: returns permitted current Customer fields and completeness state;
  `401` without a session.
- `PATCH /api/customer/me`: accepts only `full_name` and `phone`; server validates and
  normalizes; privileged input is rejected/ignored; `422` for invalid fields.

## Addresses

- `GET|POST /api/customer/addresses`: lists only owned rows or creates one from recipient,
  phone, governorate, city, detailed address, and optional default selection.
- `PATCH|DELETE /api/customer/addresses/{id}`: changes/deletes only owned address rows.
- `POST /api/customer/addresses/{id}/default`: atomically selects an owned default.

Unowned records return generic forbidden/not-found behavior without revealing ownership.

## Orders and confirmation

- `GET /api/customer/orders`: paginated summaries filtered by canonical `customer_id`.
- `GET /api/customer/orders/{orderNumber}`: private detail only when current Customer owns it.
- Existing `POST /api/orders`: with a customer session, resolves profile-complete Customer and
  creates an atomic linked order; without session, preserves guest creation and issues a
  confirmation cookie.
- `GET /checkout/success?order={orderNumber}`: order reference routes display only; private
  data requires owned session or valid matching guest confirmation cookie.

No contract exposes database/Auth internals or private order-existence information.
