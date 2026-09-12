-- Feature 004: server-authoritative Variant and Sellable Unit pricing.

create extension if not exists "pgcrypto";
create extension if not exists "btree_gist";

create table if not exists public.price_lists (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z][a-z0-9-]*$'),
  name_en text not null check (length(btrim(name_en)) between 1 and 160),
  name_ar text not null check (length(btrim(name_ar)) between 1 and 160),
  currency text not null default 'EGP' check (currency = 'EGP'),
  is_active boolean not null default true,
  archived_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (not is_active or archived_at is null)
);

create table if not exists public.pricing_configuration (
  singleton boolean primary key default true check (singleton),
  default_price_list_id uuid not null references public.price_lists(id) on delete restrict,
  version bigint not null default 1 check (version > 0),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.price_list_items (
  id uuid primary key default gen_random_uuid(),
  price_list_id uuid not null references public.price_lists(id) on delete restrict,
  variant_id uuid not null references public.product_variants(id) on delete restrict,
  sellable_unit_id uuid not null,
  amount_minor bigint not null check (amount_minor > 0 and amount_minor <= 999999999999),
  currency text not null default 'EGP' check (currency = 'EGP'),
  valid_from timestamptz,
  valid_until timestamptz,
  is_active boolean not null default true,
  archived_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (sellable_unit_id, variant_id)
    references public.variant_packaging_units(id, variant_id) on delete restrict,
  check (valid_until is null or valid_from is null or valid_until > valid_from),
  check (not is_active or archived_at is null),
  constraint price_list_items_no_effective_overlap exclude using gist (
    price_list_id with =,
    variant_id with =,
    sellable_unit_id with =,
    tstzrange(coalesce(valid_from, '-infinity'::timestamptz), coalesce(valid_until, 'infinity'::timestamptz), '[)') with &&
  ) where (is_active and archived_at is null)
);

create table if not exists public.customer_type_price_list_mappings (
  id uuid primary key default gen_random_uuid(),
  customer_type_id uuid not null references public.customer_types(id) on delete restrict,
  price_list_id uuid not null references public.price_lists(id) on delete restrict,
  is_active boolean not null default true,
  archived_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (not is_active or archived_at is null)
);
create unique index if not exists customer_type_price_list_one_active_idx
  on public.customer_type_price_list_mappings(customer_type_id)
  where is_active and archived_at is null;

alter table public.customers add column if not exists direct_price_list_id uuid references public.price_lists(id) on delete restrict;

create table if not exists public.customer_price_list_assignment_audit (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete restrict,
  previous_price_list_id uuid references public.price_lists(id) on delete restrict,
  new_price_list_id uuid references public.price_lists(id) on delete restrict,
  actor_id uuid references auth.users(id) on delete set null,
  reason text,
  correlation_id uuid not null default gen_random_uuid(),
  occurred_at timestamptz not null default now()
);

create table if not exists public.customer_unit_price_overrides (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete restrict,
  variant_id uuid not null references public.product_variants(id) on delete restrict,
  sellable_unit_id uuid not null,
  amount_minor bigint not null check (amount_minor > 0 and amount_minor <= 999999999999),
  currency text not null default 'EGP' check (currency = 'EGP'),
  valid_from timestamptz,
  valid_until timestamptz,
  is_active boolean not null default true,
  archived_at timestamptz,
  reason text not null check (length(btrim(reason)) between 1 and 1000),
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (sellable_unit_id, variant_id)
    references public.variant_packaging_units(id, variant_id) on delete restrict,
  check (valid_until is null or valid_from is null or valid_until > valid_from),
  check (not is_active or archived_at is null),
  constraint customer_unit_overrides_no_effective_overlap exclude using gist (
    customer_id with =,
    variant_id with =,
    sellable_unit_id with =,
    tstzrange(coalesce(valid_from, '-infinity'::timestamptz), coalesce(valid_until, 'infinity'::timestamptz), '[)') with &&
  ) where (is_active and archived_at is null)
);

create table if not exists public.pricing_audit_events (
  id uuid primary key default gen_random_uuid(),
  action text not null,
  actor_id uuid references auth.users(id) on delete set null,
  entity_type text not null,
  entity_id uuid,
  customer_id uuid references public.customers(id) on delete set null,
  variant_id uuid references public.product_variants(id) on delete set null,
  sellable_unit_id uuid references public.variant_packaging_units(id) on delete set null,
  correlation_id uuid not null default gen_random_uuid(),
  previous_state jsonb,
  new_state jsonb,
  reason text,
  context jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

alter table public.orders add column if not exists items_total_minor bigint;
alter table public.orders add column if not exists shipping_cost_minor bigint;
alter table public.orders add column if not exists discount_minor bigint;
alter table public.orders add column if not exists grand_total_minor bigint;
alter table public.orders add column if not exists price_currency text;
alter table public.order_items add column if not exists unit_price_minor bigint;
alter table public.order_items add column if not exists line_total_minor bigint;
alter table public.order_items add column if not exists price_currency text;
alter table public.order_items add column if not exists pricing_source text;
alter table public.order_items add column if not exists pricing_reference_id uuid;
alter table public.order_items add column if not exists price_is_derived boolean;
alter table public.order_items add column if not exists derived_from_sellable_unit_id uuid references public.variant_packaging_units(id) on delete set null;
do $$ begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.order_items'::regclass and conname = 'order_items_pricing_snapshot_integrity') then
    alter table public.order_items add constraint order_items_pricing_snapshot_integrity check (
      (unit_price_minor is null and line_total_minor is null and price_currency is null and pricing_source is null and price_is_derived is null)
      or
      (unit_price_minor >= 0 and line_total_minor = unit_price_minor * quantity and price_currency = 'EGP'
        and pricing_source in ('customer_override','direct_price_list','customer_type_price_list','default_price_list')
        and pricing_reference_id is not null and price_is_derived is not null)
    ) not valid;
  end if;
end $$;

create index if not exists price_list_items_resolution_idx
  on public.price_list_items(price_list_id, variant_id, sellable_unit_id, valid_from, valid_until)
  where is_active and archived_at is null;
create index if not exists customer_unit_overrides_resolution_idx
  on public.customer_unit_price_overrides(customer_id, variant_id, sellable_unit_id, valid_from, valid_until)
  where is_active and archived_at is null;
create index if not exists customer_type_price_list_mapping_lookup_idx
  on public.customer_type_price_list_mappings(customer_type_id, price_list_id)
  where is_active and archived_at is null;
create index if not exists pricing_audit_events_history_idx
  on public.pricing_audit_events(occurred_at desc, action);
create index if not exists pricing_audit_events_customer_idx
  on public.pricing_audit_events(customer_id, occurred_at desc) where customer_id is not null;

create or replace function public.pricing_touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end
$$;

drop trigger if exists price_lists_touch on public.price_lists;
create trigger price_lists_touch before update on public.price_lists
  for each row execute function public.pricing_touch_updated_at();
drop trigger if exists price_list_items_touch on public.price_list_items;
create trigger price_list_items_touch before update on public.price_list_items
  for each row execute function public.pricing_touch_updated_at();
drop trigger if exists customer_type_price_list_mappings_touch on public.customer_type_price_list_mappings;
create trigger customer_type_price_list_mappings_touch before update on public.customer_type_price_list_mappings
  for each row execute function public.pricing_touch_updated_at();
drop trigger if exists customer_unit_price_overrides_touch on public.customer_unit_price_overrides;
create trigger customer_unit_price_overrides_touch before update on public.customer_unit_price_overrides
  for each row execute function public.pricing_touch_updated_at();

create or replace function public.pricing_protect_default_list()
returns trigger language plpgsql set search_path = '' as $$
begin
  if (not new.is_active or new.archived_at is not null)
    and exists (select 1 from public.pricing_configuration where default_price_list_id = old.id)
  then
    raise exception using errcode = '23514', message = 'DEFAULT_PRICE_LIST_INVALID';
  end if;
  return new;
end
$$;
drop trigger if exists price_lists_protect_default on public.price_lists;
create trigger price_lists_protect_default before update on public.price_lists
  for each row execute function public.pricing_protect_default_list();

insert into public.price_lists(code, name_en, name_ar, currency, is_active)
values ('public-default', 'Public default', 'السعر الافتراضي', 'EGP', true)
on conflict (code) do nothing;

insert into public.pricing_configuration(singleton, default_price_list_id)
select true, id from public.price_lists where code = 'public-default' and is_active and archived_at is null
on conflict (singleton) do nothing;

insert into public.price_list_items(price_list_id, variant_id, sellable_unit_id, amount_minor)
select configuration.default_price_list_id, variant.id, unit.id, round(variant.base_price * 100)::bigint
from public.product_variants variant
join public.variant_packaging_units unit
  on unit.variant_id = variant.id
 and unit.is_active and unit.archived_at is null
 and unit.is_sellable and unit.is_default_sale_unit
cross join public.pricing_configuration configuration
where variant.is_active and variant.archived_at is null and variant.base_price > 0
  and not exists (
    select 1 from public.price_list_items item
    where item.price_list_id = configuration.default_price_list_id
      and item.variant_id = variant.id and item.sellable_unit_id = unit.id
      and item.is_active and item.archived_at is null
  );

create or replace function public.pricing_assert_admin(p_actor_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_actor_id is null or not exists (
    select 1 from public.profiles where id = p_actor_id and is_admin
  ) then
    raise exception using errcode = '42501', message = 'ADMIN_UNAUTHORIZED';
  end if;
end
$$;

create or replace function public.pricing_current_time()
returns timestamptz language sql stable security definer set search_path = '' as $$
  select now()
$$;

create or replace function public.pricing_set_default(
  p_actor_id uuid,
  p_price_list_id uuid,
  p_expected_version bigint default null,
  p_reason text default null,
  p_correlation_id uuid default gen_random_uuid()
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  current_configuration public.pricing_configuration%rowtype;
  target_list public.price_lists%rowtype;
begin
  perform public.pricing_assert_admin(p_actor_id);
  select * into current_configuration from public.pricing_configuration where singleton for update;
  if p_expected_version is not null and current_configuration.version <> p_expected_version then
    raise exception using errcode = '40001', message = 'PRICING_VERSION_CONFLICT';
  end if;
  select * into target_list from public.price_lists where id = p_price_list_id and is_active and archived_at is null;
  if not found then raise exception using errcode = '22023', message = 'DEFAULT_PRICE_LIST_INVALID'; end if;
  update public.pricing_configuration
  set default_price_list_id = p_price_list_id, version = version + 1, updated_by = p_actor_id, updated_at = now()
  where singleton;
  insert into public.pricing_audit_events(action, actor_id, entity_type, entity_id, correlation_id, previous_state, new_state, reason)
  values ('DEFAULT_PRICE_LIST_CHANGED', p_actor_id, 'pricing_configuration', p_price_list_id, p_correlation_id,
    jsonb_build_object('default_price_list_id', current_configuration.default_price_list_id, 'version', current_configuration.version),
    jsonb_build_object('default_price_list_id', p_price_list_id, 'version', current_configuration.version + 1), p_reason);
  return jsonb_build_object('default_price_list_id', p_price_list_id, 'version', current_configuration.version + 1, 'correlation_id', p_correlation_id);
end
$$;

create or replace function public.pricing_set_customer_type_mapping(
  p_actor_id uuid,
  p_customer_type_id uuid,
  p_price_list_id uuid,
  p_reason text default null,
  p_correlation_id uuid default gen_random_uuid()
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare previous_mapping jsonb;
begin
  perform public.pricing_assert_admin(p_actor_id);
  if not exists (select 1 from public.customer_types where id = p_customer_type_id and is_active) then
    raise exception using errcode = '22023', message = 'PRICING_TARGET_INVALID';
  end if;
  if p_price_list_id is not null and not exists (select 1 from public.price_lists where id = p_price_list_id and is_active and archived_at is null) then
    raise exception using errcode = '22023', message = 'DEFAULT_PRICE_LIST_INVALID';
  end if;
  select to_jsonb(mapping) into previous_mapping from public.customer_type_price_list_mappings mapping
  where customer_type_id = p_customer_type_id and is_active and archived_at is null for update;
  update public.customer_type_price_list_mappings
    set is_active = false, archived_at = now(), updated_by = p_actor_id
    where customer_type_id = p_customer_type_id and is_active and archived_at is null;
  if p_price_list_id is not null then
    insert into public.customer_type_price_list_mappings(customer_type_id, price_list_id, created_by, updated_by)
    values (p_customer_type_id, p_price_list_id, p_actor_id, p_actor_id);
  end if;
  insert into public.pricing_audit_events(action, actor_id, entity_type, entity_id, correlation_id, previous_state, new_state, reason)
  values ('CUSTOMER_TYPE_PRICE_LIST_MAPPED', p_actor_id, 'customer_type_mapping', p_customer_type_id, p_correlation_id,
    previous_mapping, jsonb_build_object('customer_type_id', p_customer_type_id, 'price_list_id', p_price_list_id), p_reason);
  return jsonb_build_object('customer_type_id', p_customer_type_id, 'price_list_id', p_price_list_id, 'correlation_id', p_correlation_id);
end
$$;

create or replace function public.pricing_assign_customer_list(
  p_actor_id uuid,
  p_customer_id uuid,
  p_price_list_id uuid,
  p_reason text default null,
  p_correlation_id uuid default gen_random_uuid()
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare previous_list_id uuid;
begin
  perform public.pricing_assert_admin(p_actor_id);
  if p_price_list_id is not null and not exists (select 1 from public.price_lists where id = p_price_list_id and is_active and archived_at is null) then
    raise exception using errcode = '22023', message = 'DEFAULT_PRICE_LIST_INVALID';
  end if;
  select direct_price_list_id into previous_list_id from public.customers where id = p_customer_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'CUSTOMER_NOT_FOUND'; end if;
  update public.customers set direct_price_list_id = p_price_list_id, updated_at = now() where id = p_customer_id;
  insert into public.customer_price_list_assignment_audit(customer_id, previous_price_list_id, new_price_list_id, actor_id, reason, correlation_id)
  values (p_customer_id, previous_list_id, p_price_list_id, p_actor_id, p_reason, p_correlation_id);
  insert into public.pricing_audit_events(action, actor_id, entity_type, entity_id, customer_id, correlation_id, previous_state, new_state, reason)
  values ('CUSTOMER_PRICE_LIST_ASSIGNED', p_actor_id, 'customer_price_list_assignment', p_customer_id, p_customer_id, p_correlation_id,
    jsonb_build_object('price_list_id', previous_list_id), jsonb_build_object('price_list_id', p_price_list_id), p_reason);
  return jsonb_build_object('customer_id', p_customer_id, 'price_list_id', p_price_list_id, 'correlation_id', p_correlation_id);
end
$$;

create or replace function public.pricing_bulk_upsert_items(
  p_actor_id uuid,
  p_price_list_id uuid,
  p_items jsonb,
  p_correlation_id uuid default gen_random_uuid()
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare item jsonb; inserted_count int := 0;
begin
  perform public.pricing_assert_admin(p_actor_id);
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then raise exception using errcode='22023',message='PRICING_TARGET_INVALID'; end if;
  if not exists(select 1 from public.price_lists where id=p_price_list_id and is_active and archived_at is null) then raise exception using errcode='22023',message='DEFAULT_PRICE_LIST_INVALID'; end if;
  for item in select value from jsonb_array_elements(p_items) loop
    if coalesce((item->>'close_prior_at_start')::boolean,false) and item->>'valid_from' is not null then
      update public.price_list_items set valid_until=(item->>'valid_from')::timestamptz,updated_by=p_actor_id
      where price_list_id=p_price_list_id and variant_id=(item->>'variant_id')::uuid and sellable_unit_id=(item->>'sellable_unit_id')::uuid
        and is_active and archived_at is null and valid_until is null and coalesce(valid_from,'-infinity'::timestamptz)<(item->>'valid_from')::timestamptz;
    end if;
    insert into public.price_list_items(price_list_id,variant_id,sellable_unit_id,amount_minor,valid_from,valid_until,created_by,updated_by)
    values(p_price_list_id,(item->>'variant_id')::uuid,(item->>'sellable_unit_id')::uuid,(item->>'amount_minor')::bigint,(item->>'valid_from')::timestamptz,(item->>'valid_until')::timestamptz,p_actor_id,p_actor_id);
    inserted_count := inserted_count + 1;
  end loop;
  insert into public.pricing_audit_events(action,actor_id,entity_type,entity_id,correlation_id,new_state)
  values('PRICE_ENTRY_SCHEDULED',p_actor_id,'price_list',p_price_list_id,p_correlation_id,jsonb_build_object('item_count',inserted_count));
  return jsonb_build_object('price_list_id',p_price_list_id,'saved',inserted_count,'correlation_id',p_correlation_id);
end
$$;

create or replace function public.pricing_upsert_customer_override(
  p_actor_id uuid,
  p_customer_id uuid,
  p_override jsonb,
  p_correlation_id uuid default gen_random_uuid()
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare result public.customer_unit_price_overrides;
begin
  perform public.pricing_assert_admin(p_actor_id);
  if not exists(select 1 from public.customers where id=p_customer_id) then raise exception using errcode='P0002',message='CUSTOMER_NOT_FOUND'; end if;
  if coalesce((p_override->>'close_prior_at_start')::boolean,false) and p_override->>'valid_from' is not null then
    update public.customer_unit_price_overrides set valid_until=(p_override->>'valid_from')::timestamptz,updated_by=p_actor_id
    where customer_id=p_customer_id and variant_id=(p_override->>'variant_id')::uuid and sellable_unit_id=(p_override->>'sellable_unit_id')::uuid
      and is_active and archived_at is null and valid_until is null and coalesce(valid_from,'-infinity'::timestamptz)<(p_override->>'valid_from')::timestamptz;
  end if;
  insert into public.customer_unit_price_overrides(customer_id,variant_id,sellable_unit_id,amount_minor,currency,valid_from,valid_until,reason,created_by,updated_by)
  values(p_customer_id,(p_override->>'variant_id')::uuid,(p_override->>'sellable_unit_id')::uuid,(p_override->>'amount_minor')::bigint,'EGP',(p_override->>'valid_from')::timestamptz,(p_override->>'valid_until')::timestamptz,p_override->>'reason',p_actor_id,p_actor_id)
  returning * into result;
  insert into public.pricing_audit_events(action,actor_id,entity_type,entity_id,customer_id,variant_id,sellable_unit_id,correlation_id,new_state,reason)
  values('CUSTOMER_PRICE_OVERRIDE_CHANGED',p_actor_id,'customer_unit_price_override',result.id,p_customer_id,result.variant_id,result.sellable_unit_id,p_correlation_id,jsonb_build_object('valid_from',result.valid_from,'valid_until',result.valid_until,'active',true),result.reason);
  return jsonb_build_object('id',result.id,'customer_id',p_customer_id,'correlation_id',p_correlation_id);
end
$$;

create or replace function public.pricing_create_order(p_order jsonb, p_items jsonb, p_grant_hash text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  result public.orders;
  customer public.customers;
  calculated_items_total bigint;
  requested_items_total bigint := (p_order->>'items_total_minor')::bigint;
  requested_shipping bigint := (p_order->>'shipping_cost_minor')::bigint;
  requested_discount bigint := (p_order->>'discount_minor')::bigint;
  requested_grand_total bigint := (p_order->>'grand_total_minor')::bigint;
begin
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then
    raise exception using errcode = '22023', message = 'PRICE_UNAVAILABLE';
  end if;
  select sum(item.line_total_minor) into calculated_items_total
  from jsonb_to_recordset(p_items) as item(unit_amount_minor bigint, line_total_minor bigint, quantity int);
  if calculated_items_total is distinct from requested_items_total
    or requested_grand_total <> greatest(0, requested_items_total + requested_shipping - requested_discount)
    or requested_items_total < 0 or requested_shipping < 0 or requested_discount < 0
    or exists (
      select 1 from jsonb_to_recordset(p_items) as item(
        variant_id uuid, sellable_unit_id uuid, quantity int, unit_amount_minor bigint, line_total_minor bigint,
        currency text, pricing_source text, pricing_reference_id uuid, price_is_derived boolean
      )
      left join public.product_variants variant on variant.id = item.variant_id
      left join public.variant_packaging_units unit on unit.id = item.sellable_unit_id and unit.variant_id = variant.id
      left join public.products product on product.id = variant.product_id
      where item.quantity <= 0 or item.unit_amount_minor <= 0 or item.line_total_minor <> item.unit_amount_minor * item.quantity
        or item.currency <> 'EGP' or item.pricing_reference_id is null or item.price_is_derived is null
        or item.pricing_source not in ('customer_override','direct_price_list','customer_type_price_list','default_price_list')
        or variant.id is null or not variant.is_active or variant.archived_at is not null
        or product.id is null or not product.is_active or product.archived_at is not null
        or unit.id is null or not unit.is_active or unit.archived_at is not null or not unit.is_sellable
    )
  then
    raise exception using errcode = '22023', message = 'PRICING_TARGET_INVALID';
  end if;

  if p_order->>'customer_id' is not null then
    select * into strict customer from public.customers where id = (p_order->>'customer_id')::uuid for share;
    if customer.auth_user_id is null or customer.auth_user_id is distinct from (p_order->>'user_id')::uuid
      or length(trim(coalesce(customer.full_name, ''))) < 2 or coalesce(customer.phone, '') !~ '^01[0125][0-9]{8}$'
    then raise exception using errcode = '22023', message = 'Invalid customer association'; end if;
    if p_grant_hash is not null then raise exception using errcode = '22023', message = 'Unexpected guest grant'; end if;
  elsif p_order->>'user_id' is not null or p_grant_hash is null or p_grant_hash !~ '^[a-f0-9]{64}$' then
    raise exception using errcode = '22023', message = 'Invalid guest grant';
  end if;

  insert into public.orders(
    order_number,user_id,customer_id,customer_name,customer_phone,alt_phone,governorate,city,address,notes,
    items_total,shipping_cost,discount,discount_code,grand_total,payment_method,
    items_total_minor,shipping_cost_minor,discount_minor,grand_total_minor,price_currency
  ) values (
    p_order->>'order_number',(p_order->>'user_id')::uuid,customer.id,p_order->>'customer_name',p_order->>'customer_phone',p_order->>'alt_phone',
    p_order->>'governorate',p_order->>'city',p_order->>'address',p_order->>'notes',
    requested_items_total / 100.0,requested_shipping / 100.0,requested_discount / 100.0,p_order->>'discount_code',requested_grand_total / 100.0,p_order->>'payment_method',
    requested_items_total,requested_shipping,requested_discount,requested_grand_total,'EGP'
  ) returning * into result;

  insert into public.order_items(
    order_id,product_id,variant_id,sellable_unit_id,sku,sellable_unit_code,name_en,name_ar,product_name_en,product_name_ar,
    variant_label_en,variant_label_ar,unit_label_en,unit_label_ar,units_per_sold_package_num,units_per_sold_package_den,
    base_quantity_per_unit_num,base_quantity_per_unit_den,equivalent_base_quantity_num,equivalent_base_quantity_den,
    price,line_total,quantity,image,unit_price_minor,line_total_minor,price_currency,pricing_source,pricing_reference_id,
    price_is_derived,derived_from_sellable_unit_id
  )
  select result.id,product.id,variant.id,unit.id,variant.sku,unit.code,product.name_en,product.name_ar,product.name_en,product.name_ar,
    variant.label_en,variant.label_ar,unit.label_en,unit.label_ar,unit.quantity_per_parent_num,unit.quantity_per_parent_den,
    unit.base_quantity_num,unit.base_quantity_den,unit.base_quantity_num * item.quantity,unit.base_quantity_den,
    item.unit_amount_minor / 100.0,item.line_total_minor / 100.0,item.quantity,(product.images)[1],
    item.unit_amount_minor,item.line_total_minor,item.currency,item.pricing_source,item.pricing_reference_id,
    item.price_is_derived,item.derived_from_sellable_unit_id
  from jsonb_to_recordset(p_items) as item(
    variant_id uuid,sellable_unit_id uuid,quantity int,unit_amount_minor bigint,line_total_minor bigint,currency text,
    pricing_source text,pricing_reference_id uuid,price_is_derived boolean,derived_from_sellable_unit_id uuid
  )
  join public.product_variants variant on variant.id = item.variant_id
  join public.variant_packaging_units unit on unit.id = item.sellable_unit_id and unit.variant_id = variant.id
  join public.products product on product.id = variant.product_id;

  if customer.id is null then
    insert into public.order_confirmation_grants(order_id,secret_hash,expires_at) values(result.id,p_grant_hash,now()+interval '30 days');
  else
    insert into public.customer_audit(customer_id,actor_id,action,details)
    values(customer.id,customer.auth_user_id,'order.associated',jsonb_build_object('order_id',result.id));
  end if;
  return jsonb_build_object('id',result.id,'order_number',result.order_number,'grand_total',result.grand_total,'payment_method',result.payment_method);
end
$$;

alter table public.price_lists enable row level security;
alter table public.pricing_configuration enable row level security;
alter table public.price_list_items enable row level security;
alter table public.customer_type_price_list_mappings enable row level security;
alter table public.customer_price_list_assignment_audit enable row level security;
alter table public.customer_unit_price_overrides enable row level security;
alter table public.pricing_audit_events enable row level security;

revoke all on public.price_lists, public.pricing_configuration, public.price_list_items,
  public.customer_type_price_list_mappings, public.customer_price_list_assignment_audit,
  public.customer_unit_price_overrides, public.pricing_audit_events from public, anon, authenticated;
grant select, insert, update on public.price_lists, public.pricing_configuration, public.price_list_items,
  public.customer_type_price_list_mappings, public.customer_price_list_assignment_audit,
  public.customer_unit_price_overrides, public.pricing_audit_events to service_role;

revoke all on function public.pricing_assert_admin(uuid) from public, anon, authenticated;
revoke all on function public.pricing_current_time() from public, anon, authenticated;
revoke all on function public.pricing_set_default(uuid,uuid,bigint,text,uuid) from public, anon, authenticated;
revoke all on function public.pricing_set_customer_type_mapping(uuid,uuid,uuid,text,uuid) from public, anon, authenticated;
revoke all on function public.pricing_assign_customer_list(uuid,uuid,uuid,text,uuid) from public, anon, authenticated;
revoke all on function public.pricing_bulk_upsert_items(uuid,uuid,jsonb,uuid) from public, anon, authenticated;
revoke all on function public.pricing_upsert_customer_override(uuid,uuid,jsonb,uuid) from public, anon, authenticated;
revoke all on function public.pricing_create_order(jsonb,jsonb,text) from public, anon, authenticated;
grant execute on function public.pricing_assert_admin(uuid) to service_role;
grant execute on function public.pricing_current_time() to service_role;
grant execute on function public.pricing_set_default(uuid,uuid,bigint,text,uuid) to service_role;
grant execute on function public.pricing_set_customer_type_mapping(uuid,uuid,uuid,text,uuid) to service_role;
grant execute on function public.pricing_assign_customer_list(uuid,uuid,uuid,text,uuid) to service_role;
grant execute on function public.pricing_bulk_upsert_items(uuid,uuid,jsonb,uuid) to service_role;
grant execute on function public.pricing_upsert_customer_override(uuid,uuid,jsonb,uuid) to service_role;
grant execute on function public.pricing_create_order(jsonb,jsonb,text) to service_role;

notify pgrst, 'reload schema';
