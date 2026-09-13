-- Feature 005: authoritative B2B Commerce foundation.

create extension if not exists "pgcrypto";

create table if not exists public.commerce_quantity_rules (
  id uuid primary key default gen_random_uuid(),
  context_kind text not null check (context_kind in ('public','customer_type')),
  customer_type_id uuid references public.customer_types(id) on delete restrict,
  variant_id uuid not null references public.product_variants(id) on delete restrict,
  sellable_unit_id uuid not null,
  minimum_quantity integer not null check (minimum_quantity > 0),
  quantity_increment integer not null check (quantity_increment > 0),
  is_active boolean not null default true,
  archived_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default transaction_timestamp(),
  updated_at timestamptz not null default transaction_timestamp(),
  constraint commerce_quantity_rules_unit_variant_fk
    foreign key (sellable_unit_id, variant_id)
    references public.variant_packaging_units(id, variant_id) on delete restrict,
  constraint commerce_quantity_rules_context_check check (
    (context_kind = 'public' and customer_type_id is null)
    or (context_kind = 'customer_type' and customer_type_id is not null)
  ),
  constraint commerce_quantity_rules_lifecycle_check check (not is_active or archived_at is null)
);

create unique index if not exists commerce_quantity_rules_public_active_idx
  on public.commerce_quantity_rules(variant_id, sellable_unit_id)
  where context_kind = 'public' and is_active and archived_at is null;
create unique index if not exists commerce_quantity_rules_customer_type_active_idx
  on public.commerce_quantity_rules(customer_type_id, variant_id, sellable_unit_id)
  where context_kind = 'customer_type' and is_active and archived_at is null;
create index if not exists commerce_quantity_rules_target_idx
  on public.commerce_quantity_rules(variant_id, sellable_unit_id, context_kind, customer_type_id)
  where is_active and archived_at is null;

create table if not exists public.quantity_rule_audit_events (
  id uuid primary key default gen_random_uuid(),
  rule_id uuid not null references public.commerce_quantity_rules(id) on delete restrict,
  action text not null check (action in ('created','updated','activated','deactivated','archived')),
  actor_user_id uuid references auth.users(id) on delete set null,
  context_kind text not null check (context_kind in ('public','customer_type')),
  customer_type_id uuid references public.customer_types(id) on delete set null,
  variant_id uuid not null references public.product_variants(id) on delete restrict,
  sellable_unit_id uuid not null references public.variant_packaging_units(id) on delete restrict,
  previous_state jsonb,
  new_state jsonb,
  reason text check (reason is null or length(btrim(reason)) between 1 and 1000),
  correlation_id uuid not null default gen_random_uuid(),
  occurred_at timestamptz not null default transaction_timestamp()
);
create index if not exists quantity_rule_audit_target_idx
  on public.quantity_rule_audit_events(variant_id, sellable_unit_id, occurred_at desc);
create index if not exists quantity_rule_audit_correlation_idx
  on public.quantity_rule_audit_events(correlation_id);

create table if not exists public.checkout_quotes (
  id uuid primary key default gen_random_uuid(),
  scope_kind text not null check (scope_kind in ('customer','guest')),
  customer_id uuid references public.customers(id) on delete restrict,
  guest_context_hash text,
  revision integer not null default 1 check (revision > 0),
  state text not null default 'draft' check (state in ('draft','confirmed','consumed','expired')),
  commercial_document jsonb not null,
  safe_projection jsonb not null,
  commercial_fingerprint text not null check (commercial_fingerprint ~ '^[a-f0-9]{64}$'),
  confirmed_revision integer,
  confirmed_fingerprint text check (confirmed_fingerprint is null or confirmed_fingerprint ~ '^[a-f0-9]{64}$'),
  confirmed_at timestamptz,
  expires_at timestamptz not null,
  consumed_order_id uuid references public.orders(id) on delete restrict,
  consumed_at timestamptz,
  created_at timestamptz not null default transaction_timestamp(),
  updated_at timestamptz not null default transaction_timestamp(),
  constraint checkout_quotes_scope_check check (
    (scope_kind = 'customer' and customer_id is not null and guest_context_hash is null)
    or (scope_kind = 'guest' and customer_id is null and guest_context_hash ~ '^[a-f0-9]{64}$')
  ),
  constraint checkout_quotes_confirmation_check check (
    (confirmed_revision is null and confirmed_fingerprint is null and confirmed_at is null)
    or (confirmed_revision = revision and confirmed_fingerprint is not null and confirmed_at is not null)
  ),
  constraint checkout_quotes_consumption_check check (
    (consumed_order_id is null and consumed_at is null)
    or (consumed_order_id is not null and consumed_at is not null and state = 'consumed')
  ),
  constraint checkout_quotes_expiry_check check (expires_at > created_at)
);
create index if not exists checkout_quotes_customer_scope_idx
  on public.checkout_quotes(customer_id, state, expires_at desc) where scope_kind = 'customer';
create index if not exists checkout_quotes_guest_scope_idx
  on public.checkout_quotes(guest_context_hash, state, expires_at desc) where scope_kind = 'guest';
create index if not exists checkout_quotes_expiry_idx on public.checkout_quotes(state, expires_at);
create unique index if not exists checkout_quotes_consumed_order_idx
  on public.checkout_quotes(consumed_order_id) where consumed_order_id is not null;

create table if not exists public.checkout_submissions (
  id uuid primary key default gen_random_uuid(),
  scope_kind text not null check (scope_kind in ('customer','guest')),
  scope_hash text not null check (scope_hash ~ '^[a-f0-9]{64}$'),
  submission_key uuid not null,
  quote_id uuid not null references public.checkout_quotes(id) on delete restrict,
  quote_revision integer not null check (quote_revision > 0),
  payload_hash text not null check (payload_hash ~ '^[a-f0-9]{64}$'),
  state text not null check (state in ('accepted','completed','failed_retryable')),
  first_accepted_at timestamptz not null,
  expires_at timestamptz not null,
  order_id uuid references public.orders(id) on delete restrict,
  last_error_code text check (last_error_code is null or last_error_code ~ '^[A-Z][A-Z0-9_]{1,79}$'),
  created_at timestamptz not null default transaction_timestamp(),
  updated_at timestamptz not null default transaction_timestamp(),
  constraint checkout_submissions_expiry_check check (expires_at = first_accepted_at + interval '24 hours'),
  constraint checkout_submissions_completion_check check (
    (state = 'completed' and order_id is not null) or (state <> 'completed' and order_id is null)
  )
);
create unique index if not exists checkout_submissions_scope_key_idx
  on public.checkout_submissions(scope_hash, submission_key);
create unique index if not exists checkout_submissions_order_idx
  on public.checkout_submissions(order_id) where order_id is not null;
create index if not exists checkout_submissions_expiry_idx
  on public.checkout_submissions(expires_at, state);

create table if not exists public.order_domain_events (
  id uuid primary key default gen_random_uuid(),
  correlation_id uuid not null,
  order_id uuid not null references public.orders(id) on delete restrict,
  event_type text not null check (event_type = 'order.created'),
  event_version integer not null default 1 check (event_version = 1),
  payload jsonb not null,
  occurred_at timestamptz not null default transaction_timestamp()
);
create unique index if not exists order_domain_events_created_idx
  on public.order_domain_events(order_id, event_type, event_version);
create index if not exists order_domain_events_pending_idx
  on public.order_domain_events(occurred_at, id);

alter table public.orders add column if not exists commerce_snapshot_version smallint;
alter table public.orders add column if not exists checkout_quote_id uuid references public.checkout_quotes(id) on delete restrict;
alter table public.orders add column if not exists checkout_submission_id uuid references public.checkout_submissions(id) on delete restrict;
alter table public.orders add column if not exists commercial_fingerprint text;
alter table public.orders add column if not exists commerce_context_kind text;
alter table public.orders add column if not exists customer_type_id_snapshot uuid references public.customer_types(id) on delete set null;
alter table public.orders add column if not exists customer_type_code_snapshot text;
alter table public.orders add column if not exists customer_type_name_en_snapshot text;
alter table public.orders add column if not exists customer_type_name_ar_snapshot text;
alter table public.orders add column if not exists currency text;
alter table public.orders add column if not exists discount_snapshot jsonb;
alter table public.orders add column if not exists shipping_snapshot jsonb;

do $$ begin
  if not exists (select 1 from pg_constraint where conrelid='public.orders'::regclass and conname='orders_commerce_snapshot_integrity') then
    alter table public.orders add constraint orders_commerce_snapshot_integrity check (
      commerce_snapshot_version is null or (
        commerce_snapshot_version = 1
        and checkout_quote_id is not null and checkout_submission_id is not null
        and commercial_fingerprint ~ '^[a-f0-9]{64}$'
        and commerce_context_kind in ('public','customer_type')
        and customer_type_code_snapshot is not null
        and customer_type_name_en_snapshot is not null
        and customer_type_name_ar_snapshot is not null
        and currency = 'EGP'
        and items_total_minor >= 0 and discount_minor >= 0 and shipping_cost_minor >= 0 and grand_total_minor >= 0
        and discount_snapshot is not null and shipping_snapshot is not null
      )
    ) not valid;
  end if;
end $$;

create unique index if not exists orders_checkout_quote_idx
  on public.orders(checkout_quote_id) where checkout_quote_id is not null;
create unique index if not exists orders_checkout_submission_idx
  on public.orders(checkout_submission_id) where checkout_submission_id is not null;
create index if not exists orders_fulfillment_created_idx
  on public.orders(fulfillment_status, created_at desc);
create index if not exists orders_payment_method_created_idx
  on public.orders(payment_method, created_at desc);
create index if not exists orders_customer_type_created_idx
  on public.orders(customer_type_code_snapshot, created_at desc);

alter table public.order_items add column if not exists quantity_rule_context_kind text;
alter table public.order_items add column if not exists quantity_rule_customer_type_id uuid references public.customer_types(id) on delete set null;
alter table public.order_items add column if not exists minimum_quantity_snapshot integer;
alter table public.order_items add column if not exists quantity_increment_snapshot integer;

do $$ begin
  if not exists (select 1 from pg_constraint where conrelid='public.order_items'::regclass and conname='order_items_quantity_snapshot_integrity') then
    alter table public.order_items add constraint order_items_quantity_snapshot_integrity check (
      (quantity_rule_context_kind is null and quantity_rule_customer_type_id is null
        and minimum_quantity_snapshot is null and quantity_increment_snapshot is null)
      or (
        quantity_rule_context_kind in ('public','customer_type')
        and minimum_quantity_snapshot > 0 and quantity_increment_snapshot > 0
        and ((quantity_rule_context_kind = 'public' and quantity_rule_customer_type_id is null)
          or (quantity_rule_context_kind = 'customer_type' and quantity_rule_customer_type_id is not null))
      )
    ) not valid;
  end if;
end $$;

create index if not exists order_items_sku_order_idx on public.order_items(lower(sku), order_id) where sku is not null;

create or replace function public.commerce_touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = transaction_timestamp();
  return new;
end
$$;

create or replace function public.commerce_confirm_quote(
  p_scope_kind text,
  p_customer_id uuid,
  p_guest_context_hash text,
  p_quote_id uuid,
  p_revision integer
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  quote public.checkout_quotes%rowtype;
begin
  select * into quote
  from public.checkout_quotes
  where id = p_quote_id
    and scope_kind = p_scope_kind
    and customer_id is not distinct from p_customer_id
    and guest_context_hash is not distinct from p_guest_context_hash
  for update;
  if not found then raise exception using errcode='P0002', message='QUOTE_NOT_FOUND'; end if;
  if quote.expires_at <= transaction_timestamp() or quote.state = 'expired' then
    raise exception using errcode='22023', message='QUOTE_EXPIRED';
  end if;
  if quote.state = 'consumed' then raise exception using errcode='22023', message='QUOTE_NOT_FOUND'; end if;
  if quote.revision <> p_revision then raise exception using errcode='40001', message='QUOTE_REVISION_CONFLICT'; end if;
  if quote.safe_projection->>'validationState' <> 'valid' then
    raise exception using errcode='22023', message='QUOTE_INVALID';
  end if;
  update public.checkout_quotes set
    state='confirmed', confirmed_revision=revision,
    confirmed_fingerprint=commercial_fingerprint,
    confirmed_at=transaction_timestamp(), updated_at=transaction_timestamp()
  where id=quote.id
  returning * into quote;
  return jsonb_build_object(
    'quoteId',quote.id,'revision',quote.revision,'state',quote.state,
    'confirmedAt',quote.confirmed_at,'expiresAt',quote.expires_at
  );
end
$$;

create or replace function public.commerce_assert_admin(p_actor_id uuid)
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if p_actor_id is null or not exists(select 1 from public.profiles where id=p_actor_id and is_admin) then
    raise exception using errcode='42501',message='ADMIN_UNAUTHORIZED';
  end if;
end
$$;

create or replace function public.commerce_set_quantity_rule(
  p_actor_id uuid,
  p_context_kind text,
  p_customer_type_id uuid,
  p_variant_id uuid,
  p_sellable_unit_id uuid,
  p_minimum_quantity integer,
  p_quantity_increment integer,
  p_reason text,
  p_correlation_id uuid default gen_random_uuid()
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare previous public.commerce_quantity_rules%rowtype; created public.commerce_quantity_rules%rowtype;
begin
  perform public.commerce_assert_admin(p_actor_id);
  if p_context_kind not in ('public','customer_type') or p_minimum_quantity<=0 or p_quantity_increment<=0
    or length(btrim(coalesce(p_reason,''))) not between 1 and 1000
    or (p_context_kind='public' and p_customer_type_id is not null)
    or (p_context_kind='customer_type' and not exists(select 1 from public.customer_types where id=p_customer_type_id and is_active))
    or not exists(select 1 from public.variant_packaging_units where id=p_sellable_unit_id and variant_id=p_variant_id and is_active and archived_at is null and is_sellable)
  then raise exception using errcode='22023',message='QUANTITY_RULE_INVALID'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_context_kind||':'||coalesce(p_customer_type_id::text,'public')||':'||p_variant_id||':'||p_sellable_unit_id,0));
  select * into previous from public.commerce_quantity_rules where context_kind=p_context_kind
    and customer_type_id is not distinct from p_customer_type_id and variant_id=p_variant_id and sellable_unit_id=p_sellable_unit_id
    and is_active and archived_at is null for update;
  if found then
    update public.commerce_quantity_rules set is_active=false,archived_at=transaction_timestamp(),updated_by=p_actor_id where id=previous.id;
    insert into public.quantity_rule_audit_events(rule_id,action,actor_user_id,context_kind,customer_type_id,variant_id,sellable_unit_id,previous_state,new_state,reason,correlation_id)
    values(previous.id,'deactivated',p_actor_id,previous.context_kind,previous.customer_type_id,previous.variant_id,previous.sellable_unit_id,
      jsonb_build_object('minimumQuantity',previous.minimum_quantity,'quantityIncrement',previous.quantity_increment,'active',true),jsonb_build_object('active',false),p_reason,p_correlation_id);
  end if;
  insert into public.commerce_quantity_rules(context_kind,customer_type_id,variant_id,sellable_unit_id,minimum_quantity,quantity_increment,created_by,updated_by)
  values(p_context_kind,p_customer_type_id,p_variant_id,p_sellable_unit_id,p_minimum_quantity,p_quantity_increment,p_actor_id,p_actor_id) returning * into created;
  insert into public.quantity_rule_audit_events(rule_id,action,actor_user_id,context_kind,customer_type_id,variant_id,sellable_unit_id,previous_state,new_state,reason,correlation_id)
  values(created.id,'created',p_actor_id,created.context_kind,created.customer_type_id,created.variant_id,created.sellable_unit_id,null,
    jsonb_build_object('minimumQuantity',created.minimum_quantity,'quantityIncrement',created.quantity_increment,'active',true),p_reason,p_correlation_id);
  return jsonb_build_object('id',created.id,'replacedRuleId',previous.id,'correlationId',p_correlation_id);
end
$$;

create or replace function public.commerce_archive_quantity_rule(
  p_actor_id uuid,p_rule_id uuid,p_reason text,p_correlation_id uuid default gen_random_uuid()
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare previous public.commerce_quantity_rules%rowtype;
begin
  perform public.commerce_assert_admin(p_actor_id);
  if length(btrim(coalesce(p_reason,''))) not between 1 and 1000 then raise exception using errcode='22023',message='QUANTITY_RULE_INVALID'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_rule_id::text,0));
  select * into previous from public.commerce_quantity_rules where id=p_rule_id and is_active and archived_at is null for update;
  if not found then raise exception using errcode='P0002',message='QUANTITY_RULE_NOT_FOUND'; end if;
  update public.commerce_quantity_rules set is_active=false,archived_at=transaction_timestamp(),updated_by=p_actor_id where id=p_rule_id;
  insert into public.quantity_rule_audit_events(rule_id,action,actor_user_id,context_kind,customer_type_id,variant_id,sellable_unit_id,previous_state,new_state,reason,correlation_id)
  values(previous.id,'archived',p_actor_id,previous.context_kind,previous.customer_type_id,previous.variant_id,previous.sellable_unit_id,
    jsonb_build_object('minimumQuantity',previous.minimum_quantity,'quantityIncrement',previous.quantity_increment,'active',true),jsonb_build_object('active',false),p_reason,p_correlation_id);
  return jsonb_build_object('id',p_rule_id,'correlationId',p_correlation_id);
end
$$;

create or replace function public.commerce_finalize_order(
  p_scope_kind text,
  p_customer_id uuid,
  p_guest_context_hash text,
  p_quote_id uuid,
  p_quote_revision integer,
  p_submission_key uuid,
  p_payload_hash text,
  p_correlation_id uuid,
  p_confirmation_grant_hash text default null
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  quote public.checkout_quotes%rowtype;
  submission public.checkout_submissions%rowtype;
  created_order public.orders%rowtype;
  document jsonb;
  now_at timestamptz := transaction_timestamp();
  generated_number text;
  customer_user_id uuid;
  current_prices jsonb;
begin
  if p_scope_kind not in ('customer','guest') or p_payload_hash !~ '^[a-f0-9]{64}$' then
    raise exception using errcode='22023',message='CHECKOUT_UNAVAILABLE';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_scope_kind||':'||coalesce(p_customer_id::text,p_guest_context_hash)||':'||p_submission_key::text,0));

  select * into submission from public.checkout_submissions
  where scope_hash = encode(extensions.digest(p_scope_kind||':'||coalesce(p_customer_id::text,p_guest_context_hash),'sha256'),'hex')
    and submission_key=p_submission_key;
  if found and submission.expires_at>now_at then
    if submission.payload_hash<>p_payload_hash then raise exception using errcode='22023',message='IDEMPOTENCY_CONFLICT'; end if;
    if submission.state='completed' and submission.order_id is not null then
      select * into created_order from public.orders where id=submission.order_id;
      return jsonb_build_object('kind','replayed','orderId',created_order.id,'orderNumber',created_order.order_number,
        'grandTotalMinor',created_order.grand_total_minor::text,'paymentMethod',created_order.payment_method,'customerName',created_order.customer_name);
    end if;
  elsif found then
    delete from public.checkout_submissions where id=submission.id and order_id is null;
  end if;

  select * into quote from public.checkout_quotes
  where id=p_quote_id and scope_kind=p_scope_kind
    and customer_id is not distinct from p_customer_id
    and guest_context_hash is not distinct from p_guest_context_hash
  for update;
  if not found then raise exception using errcode='P0002',message='QUOTE_NOT_FOUND'; end if;
  if quote.expires_at<=now_at then raise exception using errcode='22023',message='QUOTE_EXPIRED'; end if;
  if quote.state<>'confirmed' or quote.confirmed_revision<>p_quote_revision or quote.revision<>p_quote_revision
    or quote.confirmed_fingerprint is distinct from quote.commercial_fingerprint then
    raise exception using errcode='40001',message='QUOTE_REVISION_CONFLICT';
  end if;
  document := quote.commercial_document;
  if jsonb_array_length(document->'lines')=0 then raise exception using errcode='22023',message='QUOTE_INVALID'; end if;

  select public.pricing_resolve_targets(
    p_customer_id,
    jsonb_agg(jsonb_build_object('variantId',line->>'variantId','sellableUnitId',line->>'sellableUnitId') order by ordinality),
    now_at
  ) into current_prices
  from jsonb_array_elements(document->'lines') with ordinality as source(line,ordinality);
  if exists (
    select 1
    from jsonb_array_elements(document->'lines') line
    left join lateral (
      select price from jsonb_array_elements(current_prices) price
      where price->>'variantId'=line->>'variantId' and price->>'sellableUnitId'=line->>'sellableUnitId' limit 1
    ) resolved on true
    left join public.product_variants variant on variant.id=(line->>'variantId')::uuid
    left join public.products product on product.id=variant.product_id
    left join public.variant_packaging_units unit on unit.id=(line->>'sellableUnitId')::uuid and unit.variant_id=variant.id
    left join lateral (
      select rule.minimum_quantity,rule.quantity_increment from public.commerce_quantity_rules rule
      where rule.context_kind=document#>>'{context,contextKind}'
        and rule.customer_type_id is not distinct from nullif(document#>>'{context,customerTypeId}','')::uuid
        and rule.variant_id=variant.id and rule.sellable_unit_id=unit.id and rule.is_active and rule.archived_at is null limit 1
    ) active_rule on true
    where resolved.price->>'availability' is distinct from 'priced'
      or resolved.price->>'amountMinor' is distinct from line->>'unitAmountMinor'
      or variant.id is null or not variant.is_active or variant.archived_at is not null
      or product.id is null or not product.is_active or product.archived_at is not null
      or unit.id is null or not unit.is_active or unit.archived_at is not null or not unit.is_sellable
      or coalesce(active_rule.minimum_quantity,1) is distinct from (line#>>'{quantityRule,minimum}')::integer
      or coalesce(active_rule.quantity_increment,1) is distinct from (line#>>'{quantityRule,increment}')::integer
      or (line->>'quantity')::integer < coalesce(active_rule.minimum_quantity,1)
      or ((line->>'quantity')::integer-coalesce(active_rule.minimum_quantity,1)) % coalesce(active_rule.quantity_increment,1) <> 0
  ) or (
    p_customer_id is not null and not exists (
      select 1 from public.customers customer where customer.id=p_customer_id
        and customer.customer_type_id is not distinct from nullif(document#>>'{context,customerTypeId}','')::uuid
        and customer.direct_price_list_id is not distinct from nullif(document#>>'{context,directPriceListId}','')::uuid
    )
  ) then
    raise exception using errcode='40001',message='RECONFIRMATION_REQUIRED';
  end if;

  insert into public.checkout_submissions(
    scope_kind,scope_hash,submission_key,quote_id,quote_revision,payload_hash,state,first_accepted_at,expires_at
  ) values (
    p_scope_kind,encode(extensions.digest(p_scope_kind||':'||coalesce(p_customer_id::text,p_guest_context_hash),'sha256'),'hex'),
    p_submission_key,p_quote_id,p_quote_revision,p_payload_hash,'accepted',now_at,now_at+interval '24 hours'
  ) returning * into submission;

  if p_customer_id is not null then
    select auth_user_id into customer_user_id from public.customers where id=p_customer_id for share;
    if not found then raise exception using errcode='P0002',message='QUOTE_NOT_FOUND'; end if;
    if p_confirmation_grant_hash is not null then raise exception using errcode='22023',message='CHECKOUT_UNAVAILABLE'; end if;
  elsif p_confirmation_grant_hash is null or p_confirmation_grant_hash !~ '^[a-f0-9]{64}$' then
    raise exception using errcode='22023',message='CHECKOUT_UNAVAILABLE';
  end if;

  generated_number := 'KF-'||upper(substr(encode(extensions.gen_random_bytes(6),'hex'),1,6))||'-'||to_char(now_at,'YYMMDD');
  insert into public.orders(
    order_number,user_id,customer_id,customer_name,customer_phone,alt_phone,governorate,city,address,notes,
    items_total,shipping_cost,discount,discount_code,grand_total,payment_method,
    items_total_minor,shipping_cost_minor,discount_minor,grand_total_minor,price_currency,
    commerce_snapshot_version,checkout_quote_id,checkout_submission_id,commercial_fingerprint,
    commerce_context_kind,customer_type_id_snapshot,customer_type_code_snapshot,customer_type_name_en_snapshot,
    customer_type_name_ar_snapshot,currency,discount_snapshot,shipping_snapshot
  ) values (
    generated_number,customer_user_id,p_customer_id,document#>>'{delivery,fullName}',document#>>'{delivery,phone}',
    coalesce(document#>>'{delivery,altPhone}',''),document#>>'{delivery,governorate}',document#>>'{delivery,city}',
    document#>>'{delivery,address}',document->>'notes',
    (document->>'subtotalMinor')::bigint/100.0,(document->>'shippingMinor')::bigint/100.0,
    (document->>'discountMinor')::bigint/100.0,document->>'discountCode',(document->>'totalMinor')::bigint/100.0,
    document->>'paymentMethod',(document->>'subtotalMinor')::bigint,(document->>'shippingMinor')::bigint,
    (document->>'discountMinor')::bigint,(document->>'totalMinor')::bigint,'EGP',
    1,quote.id,submission.id,quote.commercial_fingerprint,document#>>'{context,contextKind}',
    nullif(document#>>'{context,customerTypeId}','')::uuid,document#>>'{context,customerTypeCode}',
    document#>>'{context,customerTypeNameEn}',document#>>'{context,customerTypeNameAr}','EGP',
    coalesce(document->'adjustments','[]'::jsonb),coalesce(document->'shipping','{}'::jsonb)
  ) returning * into created_order;

  insert into public.order_items(
    order_id,product_id,variant_id,sellable_unit_id,sku,sellable_unit_code,name_en,name_ar,
    product_name_en,product_name_ar,variant_label_en,variant_label_ar,unit_label_en,unit_label_ar,
    base_quantity_per_unit_num,base_quantity_per_unit_den,equivalent_base_quantity_num,equivalent_base_quantity_den,
    price,line_total,quantity,image,unit_price_minor,line_total_minor,price_currency,pricing_source,
    pricing_reference_id,price_is_derived,derived_from_sellable_unit_id,quantity_rule_context_kind,
    quantity_rule_customer_type_id,minimum_quantity_snapshot,quantity_increment_snapshot
  )
  select created_order.id,(line->>'productId')::uuid,(line->>'variantId')::uuid,(line->>'sellableUnitId')::uuid,
    line->>'sku',line->>'unitCode',line->>'productNameEn',line->>'productNameAr',line->>'productNameEn',line->>'productNameAr',
    line->>'variantLabelEn',line->>'variantLabelAr',line->>'unitLabelEn',line->>'unitLabelAr',
    (line->>'baseQuantityNumerator')::numeric,(line->>'baseQuantityDenominator')::numeric,
    (line->>'baseQuantityNumerator')::numeric*(line->>'quantity')::integer,(line->>'baseQuantityDenominator')::numeric,
    (line->>'unitAmountMinor')::bigint/100.0,(line->>'lineAmountMinor')::bigint/100.0,(line->>'quantity')::integer,null,
    (line->>'unitAmountMinor')::bigint,(line->>'lineAmountMinor')::bigint,'EGP',line#>>'{price,source}',
    (line#>>'{price,referenceId}')::uuid,(line#>>'{price,resolutionKind}')='derived',
    nullif(line#>>'{price,derivedFromUnitId}','')::uuid,line#>>'{quantityRule,contextKind}',
    nullif(line#>>'{quantityRule,customerTypeId}','')::uuid,(line#>>'{quantityRule,minimum}')::integer,
    (line#>>'{quantityRule,increment}')::integer
  from jsonb_array_elements(document->'lines') line;

  if p_customer_id is null then
    insert into public.order_confirmation_grants(order_id,secret_hash,expires_at)
    values(created_order.id,p_confirmation_grant_hash,now_at+interval '30 days');
  else
    insert into public.customer_audit(customer_id,actor_id,action,details)
    values(p_customer_id,customer_user_id,'order.associated',jsonb_build_object('order_id',created_order.id));
  end if;
  insert into public.order_domain_events(id,correlation_id,order_id,event_type,event_version,payload,occurred_at)
  values(gen_random_uuid(),p_correlation_id,created_order.id,'order.created',1,
    jsonb_build_object('orderId',created_order.id,'orderNumber',created_order.order_number,'commerceSnapshotVersion',1),now_at);
  update public.checkout_quotes set state='consumed',consumed_order_id=created_order.id,consumed_at=now_at,updated_at=now_at where id=quote.id;
  update public.checkout_submissions set state='completed',order_id=created_order.id,updated_at=now_at where id=submission.id;
  return jsonb_build_object('kind','created','orderId',created_order.id,'orderNumber',created_order.order_number,
    'grandTotalMinor',created_order.grand_total_minor::text,'paymentMethod',created_order.payment_method,'customerName',created_order.customer_name);
end
$$;

drop trigger if exists commerce_quantity_rules_touch on public.commerce_quantity_rules;
create trigger commerce_quantity_rules_touch before update on public.commerce_quantity_rules
  for each row execute function public.commerce_touch_updated_at();
drop trigger if exists checkout_quotes_touch on public.checkout_quotes;
create trigger checkout_quotes_touch before update on public.checkout_quotes
  for each row execute function public.commerce_touch_updated_at();
drop trigger if exists checkout_submissions_touch on public.checkout_submissions;
create trigger checkout_submissions_touch before update on public.checkout_submissions
  for each row execute function public.commerce_touch_updated_at();

alter table public.commerce_quantity_rules enable row level security;
alter table public.quantity_rule_audit_events enable row level security;
alter table public.checkout_quotes enable row level security;
alter table public.checkout_submissions enable row level security;
alter table public.order_domain_events enable row level security;

revoke all on public.commerce_quantity_rules, public.quantity_rule_audit_events,
  public.checkout_quotes, public.checkout_submissions, public.order_domain_events
  from public, anon, authenticated;
grant select, insert, update on public.commerce_quantity_rules to service_role;
grant select, insert on public.quantity_rule_audit_events to service_role;
grant select, insert, update on public.checkout_quotes to service_role;
grant select, insert, update, delete on public.checkout_submissions to service_role;
grant select, insert on public.order_domain_events to service_role;

revoke all on function public.commerce_touch_updated_at() from public, anon, authenticated;
revoke all on function public.commerce_assert_admin(uuid) from public, anon, authenticated;
revoke all on function public.commerce_set_quantity_rule(uuid,text,uuid,uuid,uuid,integer,integer,text,uuid) from public, anon, authenticated;
revoke all on function public.commerce_archive_quantity_rule(uuid,uuid,text,uuid) from public, anon, authenticated;
revoke all on function public.commerce_confirm_quote(text,uuid,text,uuid,integer) from public, anon, authenticated;
revoke all on function public.commerce_finalize_order(text,uuid,text,uuid,integer,uuid,text,uuid,text) from public, anon, authenticated;
grant execute on function public.commerce_touch_updated_at() to service_role;
grant execute on function public.commerce_assert_admin(uuid) to service_role;
grant execute on function public.commerce_set_quantity_rule(uuid,text,uuid,uuid,uuid,integer,integer,text,uuid) to service_role;
grant execute on function public.commerce_archive_quantity_rule(uuid,uuid,text,uuid) to service_role;
grant execute on function public.commerce_confirm_quote(text,uuid,text,uuid,integer) to service_role;
grant execute on function public.commerce_finalize_order(text,uuid,text,uuid,integer,uuid,text,uuid,text) to service_role;

notify pgrst, 'reload schema';
