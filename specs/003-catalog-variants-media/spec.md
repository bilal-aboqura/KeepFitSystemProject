# Feature Specification: Catalog, Variants, Attributes & Product Media

**Feature Branch**: `003-catalog-variants-media`  
**Created**: 2026-09-12  
**Status**: Draft  
**Input**: User description: "Build catalog variants attributes and product media"

## Clarifications

### Session 2026-09-12

- Q: May a SKU be reused after its Variant is archived? → A: A SKU is globally unique forever; archived Variant SKUs cannot be reused.
- Q: What happens when an administrator removes catalog media? → A: Archive the media record first; delete the R2 object only when it is unreferenced.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Create a sellable variant catalog (Priority: P1)

An authorized administrator can create a reusable Category and Brand, then create a Product with at least one sellable Variant. The Product is the catalog concept; every Variant is the stable purchasable unit with its own SKU, optional barcode, active state, and current base-price compatibility.

**Why this priority**: A canonical sellable unit is the foundation required by current commerce and later pricing, inventory, purchasing, and reporting.

**Independent Test**: Create a Protein Powder Product under a Category and Brand with four Weight/Flavor Variants, verify unique stable identities and SKUs, and publish only when an active sellable Variant exists.

**Acceptance Scenarios**:

1. **Given** an authorized administrator, **When** they create an active sellable Product, **Then** it has at least one active Variant and each Variant has a stable identity and SKU.
2. **Given** a Product with Weight and Flavor as variant-defining attributes, **When** the administrator creates 2 LB/Chocolate and 2 LB/Vanilla Variants, **Then** each combination is distinct and a duplicate active combination is refused.
3. **Given** a Variant SKU already used by any current or archived Variant, **When** an administrator attempts to use it again, **Then** the duplicate SKU is refused without changing existing catalog records.
4. **Given** a Creatine Product with only one default Variant, **When** it is published, **Then** it is still a valid sellable Product without requiring customer-selectable options.

---

### User Story 2 - Browse and select the correct Variant (Priority: P1)

A customer can browse active Products, open a Product detail page, understand its gallery, specifications, and available human-readable options, then select an active Variant and add that Variant to the cart. Single-Variant Products avoid unnecessary selection controls.

**Why this priority**: The catalog becomes commercially useful only when customers can select the actual purchasable Variant safely.

**Independent Test**: Open a published Protein Powder Product, select 5 LB and Vanilla, confirm the matching Variant is selected and added to the cart, and verify inactive/invalid combinations cannot be added.

**Acceptance Scenarios**:

1. **Given** an active Product with active Weight and Flavor Variants, **When** a customer selects valid values, **Then** exactly the matching Variant becomes selected using its stable identity.
2. **Given** a single-Variant Product, **When** a customer opens its detail page, **Then** the default Variant is selected without meaningless option controls.
3. **Given** an inactive Product or Variant, **When** a customer browses or manipulates the cart request, **Then** it is not newly purchasable.
4. **Given** an active selected Variant, **When** the customer adds it to the cart, **Then** the new cart item identifies that Variant rather than only its parent Product.

---

### User Story 3 - Manage flexible attributes and catalog media (Priority: P2)

An authorized administrator can maintain reusable attribute definitions and suitable values, use some attributes as variant options while keeping other attributes informational, and manage ordered Product/Variant media stored in Cloudflare R2.

**Why this priority**: Flexible attributes avoid schema changes for each supplement/product shape, while controlled media makes the catalog understandable and maintainable.

**Independent Test**: Configure Weight, Flavor, and Form; use Weight/Flavor to define Variants and Form as a Product specification; upload/reorder Product images, set one primary image, and associate a Vanilla image with the Vanilla Variant.

**Acceptance Scenarios**:

1. **Given** reusable attributes, **When** an administrator uses Weight and Flavor as variant-defining values and Form as informational data, **Then** only the first two influence purchasable Variant combinations.
2. **Given** an authorized administrator, **When** they upload supported Product media, **Then** it is stored in the configured R2 environment and the catalog stores a stable object reference plus media metadata rather than image bytes.
3. **Given** Product media has an ordered gallery, **When** an administrator reorders images and selects a primary image, **Then** the storefront displays the configured order and exactly one effective primary image.
4. **Given** selected Variant-specific media, **When** the customer changes Variant, **Then** its media is available; when none exists, Product gallery media remains the fallback.

---

### User Story 4 - Operate and retire catalog records safely (Priority: P2)

An authorized administrator can search/filter Products and Variants by useful catalog identifiers, edit Product-level information without changing Variant identities, and archive inactive records safely while historical order information remains usable.

**Why this priority**: Operational teams must be able to manage a changing catalog without corrupting history or making products untraceable.

**Independent Test**: Find a Product by Arabic name, SKU, barcode, Brand, and Category; archive a purchased Variant; verify it cannot be newly purchased but historical order display remains meaningful.

**Acceptance Scenarios**:

1. **Given** active and inactive catalog records, **When** an administrator searches or filters by Product name, SKU, barcode, Brand, Category, or active state, **Then** matching records are practical to identify and distinguish.
2. **Given** a Variant referenced by historical operations, **When** an administrator archives it, **Then** it is unavailable for new purchase and historical references remain intact.
3. **Given** a Product-level name, description, Category, Brand, or image change, **When** the administrator saves it, **Then** existing Variant identities remain unchanged.
4. **Given** an operationally referenced Variant whose defining attributes need a material change, **When** the administrator attempts the change, **Then** the workflow avoids silently reinterpreting historical identity and supports safe archival/replacement instead.

### Edge Cases

- An active sellable Product cannot be published with no active Variant; a single default Variant is valid.
- Duplicate SKUs and duplicate active Variant-defining combinations under one Product are rejected by authoritative rules, including concurrent saves.
- An inactive Product/Variant cannot be newly browsed as purchasable or added by altered client state, but history remains readable.
- Attribute display labels, translations, media ordering, and Product name changes never alter Variant identity.
- Informational specifications do not create Variant combinations.
- Legacy Product-only cart entries map only to one unambiguous default Variant; otherwise they fail safely and do not choose arbitrarily.
- Image upload rejects unsupported/unsafe content and reports R2 or association failures without falsely reporting success.
- Removing media archives its catalog record first and cannot leave a primary-image conflict, delete a still-referenced object, or expose broken Product/Variant gallery references; R2 deletion occurs only after no catalog reference remains.
- A customer cannot create, alter, archive, or upload catalog/media records; R2 administrative credentials never reach the browser.
- Arabic RTL and English LTR browsing, filtering, gallery, and option selection work at approximately 390 px with no horizontal overflow.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST distinguish Product as the catalog concept from Variant as the stable sellable unit used by new cart items and future commercial/operational references.
- **FR-002**: Every active sellable Product MUST have at least one active Variant; Products with no customer-selectable options MUST use one default Variant.
- **FR-003**: Every Variant MUST have a stable internal identity unaffected by names, translations, media, or attribute display order.
- **FR-004**: Every sellable Variant MUST support a SKU; the authoritative layer MUST enforce global permanent SKU uniqueness, including archived Variants, while preserving historical references.
- **FR-005**: Variants MUST support an optional barcode or external code without requiring a barcode-scanning experience in this feature.
- **FR-006**: Products MUST support bilingual names/descriptions, Category, optional Brand, active/featured state, searchable metadata, media, and compatible SEO information.
- **FR-007**: Categories MUST be persistent entities with stable identity, bilingual names, slug, active state, display order, and optional media; the design MUST remain extendable to future hierarchy.
- **FR-008**: Brands MUST be reusable persistent entities with stable identity, name, optional description/logo/media, and active state; Product/Variant records MUST NOT independently duplicate Brand identity.
- **FR-009**: The catalog MUST support reusable attribute definitions with stable code, bilingual labels, value semantics, optional unit, variant-defining/filterable/display behavior, display order, and active state.
- **FR-010**: The catalog MUST support reusable controlled attribute values where appropriate and text/numeric values where an open fixed-option list is unsuitable.
- **FR-011**: The system MUST distinguish Variant-defining attributes from informational Product specifications; informational attributes MUST NOT generate Variant combinations.
- **FR-012**: The authoritative layer MUST reject duplicate active Variants that represent the same defining-attribute combination within one Product.
- **FR-013**: The system MUST present a human-readable Variant label without requiring administrators to duplicate the parent Product name on every Variant.
- **FR-014**: Products and Variants MUST support active/inactive archival behavior. Inactive records MUST not be newly purchasable; historical operational/order references MUST remain meaningful.
- **FR-015**: Catalog removal workflows MUST preserve records referenced by historical orders or operations and MUST avoid destructive deletion that breaks those references.
- **FR-016**: The catalog MUST retain the current basic/base price compatibility required by existing storefront behavior, but MUST NOT implement customer-type, Wholesale, Gym, customer-specific, price-list, quantity, or B2B pricing.
- **FR-017**: The catalog MUST retain only the current minimum availability/stock compatibility needed by existing storefront behavior and MUST NOT implement an inventory ledger, reservation, warehouse balance, or stock movement system.
- **FR-018**: New Product and Variant media MUST use Cloudflare R2. Catalog records MUST store stable media references/metadata rather than image binary data or a fixed public hostname.
- **FR-019**: Media references MUST remain usable when the configured public serving domain changes, without requiring updates to every catalog record.
- **FR-020**: Only authorized admin/operational users MUST create, change, reorder, designate primary, archive/remove, or upload Product/Variant media. Customers MUST never receive R2 administrative credentials or catalog-media mutation authority.
- **FR-021**: Product galleries MUST support multiple media items, configured ordering, and at most one effective primary image. Variant-specific media MUST be optional with Product-gallery fallback.
- **FR-022**: Media uploads MUST validate content type and reasonable file size/dimension limits without relying solely on filename extensions, and MUST provide understandable failure feedback.
- **FR-023**: Media removal MUST archive the catalog media record first and coordinate R2 cleanup only after no catalog reference remains, avoiding broken associations, accidental deletion of shared references, and unnecessary orphan accumulation.
- **FR-024**: Authorized administrators MUST be able to create/edit Products with Category, Brand, media, attributes, at least one Variant, activation state, and current basic-price compatibility.
- **FR-025**: Authorized administrators MUST be able to create/edit Variants with SKU, optional barcode, applicable attribute combination, basic-price compatibility, activation state, and optional Variant media.
- **FR-026**: Variant generation assistance MAY create reviewed combinations from selected option values, but MUST let administrators deactivate/remove unwanted combinations before publication and MUST avoid uncontrolled combinatorial expansion.
- **FR-027**: Editing Product-level content MUST NOT unnecessarily create or change Variant identities. Material changes to a historically referenced Variant's defining attributes MUST use a safe archive/replacement workflow rather than silently reinterpreting it.
- **FR-028**: Admin catalog views MUST show Product name, Category, Brand, active state, Variant count, current basic price information, and primary image; they MUST support practical search/filtering by Product names, SKU, barcode, Brand, Category, and status.
- **FR-029**: Storefront catalog pages MUST browse active Products, show Product detail/media/specifications, allow human-readable active Variant selection, and refuse invalid/inactive combinations.
- **FR-030**: When a selected Variant changes, storefront state MUST use the selected Variant identity and MAY update Variant-specific media, SKU/details, and current basic price where applicable.
- **FR-031**: New cart items MUST identify the selected Variant. Legacy Product-only cart entries MAY map only to an unambiguous default Variant and otherwise MUST fail safely.
- **FR-032**: Newly created order items MUST identify the purchased Variant while preserving historical order items and their existing readable snapshots.
- **FR-033**: Storefront search MUST find active Products by useful Product data, including Arabic/English name, Brand, and SKU where appropriate, without external search infrastructure.
- **FR-034**: Current storefront filters MUST use stable Category, Brand, and Attribute identities and prepare the catalog for future attribute-based filtering without requiring a full faceted-search engine.
- **FR-035**: Catalog customer-facing fields, option selectors, and state copy MUST support Arabic RTL and English LTR without duplicating Product identity per language or using translated labels for rules.
- **FR-036**: Product URLs MUST remain stable and compatible with existing SEO metadata, structured data, OpenGraph, and sitemap behavior; Variant architecture MUST NOT create duplicate Product pages by default.
- **FR-037**: Development/staging MUST have reproducible, clearly marked, safely resettable demo catalog data representing multi-option, single-Variant, capsule, strip/tablet, and liquid shapes. Production MUST NOT automatically receive fake data.
- **FR-038**: Product-media workflows MUST separate development/staging and production R2 configuration, keep credentials out of source control, and prevent non-production work from altering production media.
- **FR-039**: Sensitive catalog changes, including activation/deactivation, Variant creation/archive, SKU changes, and media deletion, MUST be compatible with the existing audit principles.
- **FR-040**: Google authentication, Customer identity/account/approval workflow, addresses, guest and authenticated checkout, order history, admin authorization, payments, shipping, notifications, analytics, and existing order data MUST remain functional.
- **FR-041**: Customer Type MUST NOT influence catalog or current base price behavior in this feature; Feature 004 must be able to consume Variant identity without redesigning the catalog.

### Key Entities *(include if feature involves data)*

- **Product**: The bilingual catalog concept with Category, optional Brand, product-level specifications, visibility, SEO-compatible identity, and media gallery.
- **Variant**: The stable purchasable unit belonging to one Product, with SKU, optional barcode, active state, current base-price/availability compatibility, defining attribute values, and optional media.
- **Category**: Reusable Product classification with bilingual display data, URL-friendly identity, visibility, ordering, and optional media.
- **Brand**: Reusable manufacturer/brand entity assigned to Products.
- **Attribute Definition**: Reusable typed/specification definition identified by stable code and configured for variant definition, filtering, and display when applicable.
- **Attribute Value**: A controlled reusable option or validated free-form/numeric value linked to an Attribute Definition and Product/Variant context.
- **Product Media**: Ordered Product/Variant gallery record with stable object key, type, bilingual alt text, primary status, file metadata, and lifecycle state.
- **Cart Item / Order Item Variant Reference**: New commerce reference to the chosen stable Variant while retaining readable historical snapshots.

### Operational Controls *(include when applicable)*

- **Authorization**: Existing authorized admin boundaries protect all catalog, attribute, and media mutations. Customers have read-only storefront access and cannot obtain R2 management authority.
- **Auditability**: Important catalog activation, SKU, Variant lifecycle, and media-removal actions retain actor, target, action, prior/new state where available, and time through existing audit-compatible mechanisms.
- **Commercial authority**: Variant is the sellable authority. Current base price remains type-neutral; no Customer Type pricing, quantity pricing, or pricing engine is added.
- **Transaction integrity**: Authoritative catalog actions protect publishability, active SKU uniqueness, Variant-combination uniqueness, primary-media integrity, and archive safety against concurrent/admin-client conflicts.
- **Events & integrations**: Media records and catalog lifecycle changes are structured for future operational/audit integration. R2 failures never mark catalog media successful before an object/reference is safely established.
- **Existing functionality impact**: Feature 001/002 identity, approval, checkout, integrations, and historical order data are retained; new catalog carts/orders use Variant identity without altering Customer-Type pricing.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of active sellable Products in acceptance data have at least one active Variant, and every active Variant has one stable identity and globally non-duplicated SKU.
- **SC-002**: In acceptance testing, 100% of duplicate SKU and duplicate active defining-attribute-combination attempts are refused without changing existing catalog records.
- **SC-003**: A customer can select a valid Variant and add it to the cart in under 2 minutes at a 390 px mobile viewport; 100% of newly added catalog items identify the selected Variant.
- **SC-004**: A single-Variant Product can be added to cart without presenting unnecessary option selection, while all inactive Products/Variants are unavailable for new purchase in acceptance tests.
- **SC-005**: An authorized administrator can create a Product with Category, Brand, one Variant, and ordered primary Product media in under 5 minutes in usability testing.
- **SC-006**: 100% of tested unauthorized catalog/media mutation and upload attempts are refused, and no R2 administrative credential appears in browser-delivered code or customer responses.
- **SC-007**: Tested Product galleries show configured ordering and exactly one effective primary image; Variant-specific media falls back to Product media when absent.
- **SC-008**: All named Feature 001/002 and current commerce regression journeys complete successfully, and equivalent Retail, Wholesale, and Gym customers continue to see the same base price in Feature 003 acceptance tests.

## Assumptions

- The existing Product, Category, cart, order-item, storefront, admin authorization, and SEO foundations are evolved rather than duplicated.
- A Product can be saved as an inactive draft while it has no active Variant; publication/active sellability requires an active Variant.
- SKU uniqueness applies permanently across all current and archived Variants. Archived records retain their SKU and it cannot be reused.
- Business-configured reasonable media MIME, file-size, and dimension limits are sufficient for this feature; image optimization implementation is a planning decision.
- R2 uses separate non-production and production configuration with a configurable serving base domain. Secrets remain server-side and outside source control.
- Current base catalog price and minimal stock fields are transitional compatibility state only; Feature 004 owns future pricing and later features own inventory.
- No barcode scanning, external search service, full faceted search engine, inventory ledger, purchasing, or automation engine is introduced.
