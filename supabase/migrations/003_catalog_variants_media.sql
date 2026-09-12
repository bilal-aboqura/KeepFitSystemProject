-- Feature 003: canonical catalog variants, flexible attributes, and R2 media.
create extension if not exists "pgcrypto";

alter table public.categories add column if not exists parent_id uuid references public.categories(id) on delete set null;
alter table public.categories add column if not exists is_active boolean not null default true;
alter table public.categories add column if not exists updated_at timestamptz not null default now();

create table if not exists public.brands (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name_en text not null,
  name_ar text not null,
  description_en text not null default '',
  description_ar text not null default '',
  logo_media_id uuid,
  is_active boolean not null default true,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.products add column if not exists brand_id uuid references public.brands(id) on delete set null;
alter table public.products add column if not exists seo_title_en text;
alter table public.products add column if not exists seo_title_ar text;
alter table public.products add column if not exists seo_description_en text;
alter table public.products add column if not exists seo_description_ar text;
alter table public.products add column if not exists archived_at timestamptz;

create table if not exists public.attribute_definitions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z][a-z0-9_]*$'),
  label_en text not null,
  label_ar text not null,
  value_type text not null check (value_type in ('option','text','number','boolean')),
  unit text,
  is_variant_defining boolean not null default false,
  is_filterable boolean not null default false,
  is_visible boolean not null default true,
  sort_order integer not null default 0 check (sort_order >= 0),
  is_active boolean not null default true,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.attribute_values (
  id uuid primary key default gen_random_uuid(),
  attribute_definition_id uuid not null references public.attribute_definitions(id) on delete restrict,
  code text not null check (code ~ '^[a-z0-9][a-z0-9_-]*$'),
  label_en text not null,
  label_ar text not null,
  sort_order integer not null default 0 check (sort_order >= 0),
  is_active boolean not null default true,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  unique (attribute_definition_id, code),
  unique (id, attribute_definition_id)
);

create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete restrict,
  sku text not null check (length(btrim(sku)) between 1 and 80),
  barcode text,
  label_en text not null default '',
  label_ar text not null default '',
  base_price numeric(10,2) not null check (base_price >= 0),
  compare_at_price numeric(10,2) check (compare_at_price is null or compare_at_price >= 0),
  stock integer not null default 0 check (stock >= 0),
  is_default boolean not null default false,
  is_active boolean not null default true,
  combination_fingerprint text not null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists product_variants_sku_permanent_idx on public.product_variants (lower(btrim(sku)));
create unique index if not exists product_variants_active_combination_idx
  on public.product_variants(product_id, combination_fingerprint)
  where is_active and archived_at is null;
create unique index if not exists product_variants_active_default_idx
  on public.product_variants(product_id)
  where is_default and is_active and archived_at is null;
create index if not exists product_variants_product_idx on public.product_variants(product_id, is_active);
create index if not exists product_variants_barcode_idx on public.product_variants(barcode) where barcode is not null;

create table if not exists public.product_specifications (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  attribute_definition_id uuid not null references public.attribute_definitions(id) on delete restrict,
  attribute_value_id uuid,
  text_value text,
  number_value numeric,
  boolean_value boolean,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, attribute_definition_id),
  foreign key (attribute_value_id, attribute_definition_id)
    references public.attribute_values(id, attribute_definition_id) on delete restrict,
  check (num_nonnulls(attribute_value_id, nullif(btrim(text_value), ''), number_value, boolean_value) = 1)
);

create table if not exists public.variant_attribute_values (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references public.product_variants(id) on delete cascade,
  attribute_definition_id uuid not null references public.attribute_definitions(id) on delete restrict,
  attribute_value_id uuid,
  text_value text,
  number_value numeric,
  boolean_value boolean,
  created_at timestamptz not null default now(),
  unique (variant_id, attribute_definition_id),
  foreign key (attribute_value_id, attribute_definition_id)
    references public.attribute_values(id, attribute_definition_id) on delete restrict,
  check (num_nonnulls(attribute_value_id, nullif(btrim(text_value), ''), number_value, boolean_value) = 1)
);

create table if not exists public.catalog_media (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('r2','legacy')),
  object_key text not null,
  mime_type text not null check (mime_type in ('image/jpeg','image/png','image/webp','image/avif')),
  byte_size bigint not null check (byte_size > 0 and byte_size <= 10485760),
  width integer not null check (width between 1 and 8000),
  height integer not null check (height between 1 and 8000),
  alt_en text not null default '',
  alt_ar text not null default '',
  archived_at timestamptz,
  cleanup_after timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider, object_key)
);

create table if not exists public.product_media (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  media_id uuid not null references public.catalog_media(id) on delete restrict,
  sort_order integer not null default 0 check (sort_order >= 0),
  is_primary boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  unique (product_id, media_id)
);
create unique index if not exists product_media_one_active_primary_idx
  on public.product_media(product_id) where is_primary and archived_at is null;

create table if not exists public.variant_media (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references public.product_variants(id) on delete cascade,
  media_id uuid not null references public.catalog_media(id) on delete restrict,
  sort_order integer not null default 0 check (sort_order >= 0),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  unique (variant_id, media_id)
);

alter table public.brands drop constraint if exists brands_logo_media_id_fkey;
alter table public.brands add constraint brands_logo_media_id_fkey foreign key (logo_media_id) references public.catalog_media(id) on delete set null;

alter table public.order_items add column if not exists variant_id uuid references public.product_variants(id) on delete set null;
alter table public.order_items add column if not exists sku text;
alter table public.order_items add column if not exists product_name_en text;
alter table public.order_items add column if not exists product_name_ar text;
alter table public.order_items add column if not exists variant_label_en text;
alter table public.order_items add column if not exists variant_label_ar text;
create index if not exists order_items_variant_idx on public.order_items(variant_id);

create table if not exists public.catalog_audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_type text not null,
  target_id uuid not null,
  previous_state jsonb,
  new_state jsonb,
  occurred_at timestamptz not null default now()
);
create index if not exists catalog_audit_target_idx on public.catalog_audit_events(target_type, target_id, occurred_at desc);

do $$
begin
  if exists (
    select 1 from public.products
    where nullif(btrim(sku), '') is not null
    group by lower(btrim(sku)) having count(*) > 1
  ) then
    raise exception 'Feature 003 migration stopped: duplicate legacy product SKUs must be resolved explicitly';
  end if;
end $$;

insert into public.product_variants (
  product_id, sku, barcode, label_en, label_ar, base_price, compare_at_price,
  stock, is_default, is_active, combination_fingerprint, archived_at
)
select p.id,
  coalesce(nullif(upper(btrim(p.sku)), ''), 'LEGACY-' || upper(substr(p.id::text, 1, 12))),
  null, '', '', p.price, p.compare_at_price, p.stock, true, p.is_active,
  '__default__', case when p.is_active then null else now() end
from public.products p
where not exists (select 1 from public.product_variants v where v.product_id = p.id);

create or replace function public.catalog_validate_assignment() returns trigger
language plpgsql set search_path = public as $$
declare
  definition public.attribute_definitions%rowtype;
  variant_product uuid;
begin
  select * into definition from public.attribute_definitions where id = new.attribute_definition_id;
  if definition.id is null or not definition.is_active then raise exception 'Inactive or unknown attribute definition'; end if;
  if tg_table_name = 'variant_attribute_values' then
    if not definition.is_variant_defining then raise exception 'Variant assignments require defining attributes'; end if;
    select product_id into variant_product from public.product_variants where id = new.variant_id;
    if variant_product is null then raise exception 'Unknown variant'; end if;
  elsif definition.is_variant_defining then
    raise exception 'Product specifications cannot use variant-defining attributes';
  end if;
  if definition.value_type = 'option' and new.attribute_value_id is null then raise exception 'Controlled option required'; end if;
  if definition.value_type = 'text' and new.text_value is null then raise exception 'Text value required'; end if;
  if definition.value_type = 'number' and new.number_value is null then raise exception 'Numeric value required'; end if;
  if definition.value_type = 'boolean' and new.boolean_value is null then raise exception 'Boolean value required'; end if;
  return new;
end $$;
drop trigger if exists product_specifications_validate on public.product_specifications;
create trigger product_specifications_validate before insert or update on public.product_specifications
  for each row execute function public.catalog_validate_assignment();
drop trigger if exists variant_attribute_values_validate on public.variant_attribute_values;
create trigger variant_attribute_values_validate before insert or update on public.variant_attribute_values
  for each row execute function public.catalog_validate_assignment();

create or replace function public.catalog_assert_product_sellable() returns trigger
language plpgsql set search_path = public as $$
declare product_uuid uuid;
begin
  if tg_table_name = 'products' then
    product_uuid := new.id;
  elsif tg_op = 'DELETE' then
    product_uuid := old.product_id;
  else
    product_uuid := new.product_id;
  end if;
  if exists (select 1 from public.products where id = product_uuid and is_active and archived_at is null)
     and not exists (select 1 from public.product_variants where product_id = product_uuid and is_active and archived_at is null) then
    raise exception 'An active product requires at least one active variant' using errcode = '23514';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
drop trigger if exists products_require_variant on public.products;
create constraint trigger products_require_variant after insert or update of is_active, archived_at on public.products
  deferrable initially deferred for each row execute function public.catalog_assert_product_sellable();
drop trigger if exists variants_keep_product_sellable on public.product_variants;
create constraint trigger variants_keep_product_sellable after insert or update or delete on public.product_variants
  deferrable initially deferred for each row execute function public.catalog_assert_product_sellable();

create or replace function public.catalog_sync_product_compatibility() returns trigger
language plpgsql set search_path = public as $$
declare product_uuid uuid; selected_variant public.product_variants%rowtype;
begin
  product_uuid := case when tg_op='DELETE' then old.product_id else new.product_id end;
  select * into selected_variant from public.product_variants
    where product_id=product_uuid and is_active and archived_at is null
    order by is_default desc,created_at,id limit 1;
  if selected_variant.id is not null then
    update public.products set sku=selected_variant.sku,price=selected_variant.base_price,
      compare_at_price=selected_variant.compare_at_price,stock=selected_variant.stock,updated_at=now()
      where id=product_uuid;
  end if;
  if tg_op='DELETE' then return old; end if;
  return new;
end $$;
drop trigger if exists variants_sync_product_compatibility on public.product_variants;
create trigger variants_sync_product_compatibility after insert or update of sku,base_price,compare_at_price,stock,is_default,is_active,archived_at or delete on public.product_variants
  for each row execute function public.catalog_sync_product_compatibility();

create or replace function public.catalog_create_variant(p_product_id uuid, p_variant jsonb, p_actor_id uuid default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare variant_uuid uuid; assignment jsonb; fingerprint text;
begin
  if not exists (select 1 from public.products where id = p_product_id) then raise exception 'Product not found'; end if;
  select coalesce(string_agg(
    (item->>'attribute_definition_id') || ':' || coalesce(
      'o:' || nullif(item->>'attribute_value_id',''),
      'n:' || nullif(item->>'number_value',''),
      'b:' || nullif(item->>'boolean_value',''),
      't:' || lower(btrim(coalesce(item->>'text_value','')))
    ), '|' order by item->>'attribute_definition_id'
  ), '__default__') into fingerprint
  from jsonb_array_elements(coalesce(p_variant->'attributes', '[]'::jsonb)) item;

  insert into public.product_variants(product_id, sku, barcode, label_en, label_ar, base_price, compare_at_price, stock, is_default, is_active, combination_fingerprint)
  values (p_product_id, upper(btrim(p_variant->>'sku')), nullif(btrim(p_variant->>'barcode'),''), coalesce(p_variant->>'label_en',''), coalesce(p_variant->>'label_ar',''),
    (p_variant->>'base_price')::numeric, nullif(p_variant->>'compare_at_price','')::numeric, coalesce((p_variant->>'stock')::integer,0),
    coalesce((p_variant->>'is_default')::boolean,false), coalesce((p_variant->>'is_active')::boolean,true), fingerprint)
  returning id into variant_uuid;

  for assignment in select * from jsonb_array_elements(coalesce(p_variant->'attributes','[]'::jsonb)) loop
    insert into public.variant_attribute_values(variant_id, attribute_definition_id, attribute_value_id, text_value, number_value, boolean_value)
    values (variant_uuid, (assignment->>'attribute_definition_id')::uuid, nullif(assignment->>'attribute_value_id','')::uuid,
      nullif(assignment->>'text_value',''), nullif(assignment->>'number_value','')::numeric, nullif(assignment->>'boolean_value','')::boolean);
  end loop;
  insert into public.catalog_audit_events(actor_id, action, target_type, target_id, new_state)
  values (p_actor_id, 'variant.created', 'variant', variant_uuid, jsonb_build_object('sku', upper(btrim(p_variant->>'sku')), 'product_id', p_product_id));
  return variant_uuid;
end $$;

create or replace function public.catalog_create_product(p_product jsonb, p_actor_id uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare product_uuid uuid; variant jsonb; specification jsonb; variant_ids uuid[] := '{}'; first_variant jsonb;
begin
  first_variant := (p_product->'variants')->0;
  if first_variant is null then raise exception 'At least one variant is required' using errcode = '23514'; end if;
  insert into public.products(slug, sku, category_id, brand_id, name_en, name_ar, short_desc_en, short_desc_ar, long_desc_en, long_desc_ar,
    price, compare_at_price, stock, is_active, is_featured, images, weight, seo_title_en, seo_title_ar, seo_description_en, seo_description_ar)
  values (p_product->>'slug', first_variant->>'sku', nullif(p_product->>'category_id','')::uuid, nullif(p_product->>'brand_id','')::uuid,
    p_product->>'name_en', p_product->>'name_ar', coalesce(p_product->>'short_desc_en',''), coalesce(p_product->>'short_desc_ar',''),
    coalesce(p_product->>'long_desc_en',''), coalesce(p_product->>'long_desc_ar',''), (first_variant->>'base_price')::numeric,
    nullif(first_variant->>'compare_at_price','')::numeric, coalesce((first_variant->>'stock')::integer,0),
    coalesce((p_product->>'is_active')::boolean,true), coalesce((p_product->>'is_featured')::boolean,false), '{}', null,
    nullif(p_product->>'seo_title_en',''), nullif(p_product->>'seo_title_ar',''), nullif(p_product->>'seo_description_en',''), nullif(p_product->>'seo_description_ar',''))
  returning id into product_uuid;
  for variant in select * from jsonb_array_elements(p_product->'variants') loop
    variant_ids := array_append(variant_ids, public.catalog_create_variant(product_uuid, variant, p_actor_id));
  end loop;
  for specification in select * from jsonb_array_elements(coalesce(p_product->'specifications','[]'::jsonb)) loop
    insert into public.product_specifications(product_id,attribute_definition_id,attribute_value_id,text_value,number_value,boolean_value,sort_order)
    values(product_uuid,(specification->>'attribute_definition_id')::uuid,nullif(specification->>'attribute_value_id','')::uuid,
      nullif(specification->>'text_value',''),nullif(specification->>'number_value','')::numeric,nullif(specification->>'boolean_value','')::boolean,
      coalesce((specification->>'sort_order')::integer,0));
  end loop;
  insert into public.catalog_audit_events(actor_id, action, target_type, target_id, new_state)
  values (p_actor_id, 'product.created', 'product', product_uuid, jsonb_build_object('slug', p_product->>'slug'));
  return jsonb_build_object('product_id', product_uuid, 'variant_ids', to_jsonb(variant_ids));
end $$;

create or replace function public.catalog_replace_product_specifications(p_product_id uuid, p_specifications jsonb, p_actor_id uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare specification jsonb;
begin
  if jsonb_typeof(p_specifications) is distinct from 'array' then raise exception 'Specifications must be an array' using errcode='22023'; end if;
  delete from public.product_specifications where product_id=p_product_id;
  for specification in select * from jsonb_array_elements(p_specifications) loop
    insert into public.product_specifications(product_id,attribute_definition_id,attribute_value_id,text_value,number_value,boolean_value,sort_order)
    values(p_product_id,(specification->>'attribute_definition_id')::uuid,nullif(specification->>'attribute_value_id','')::uuid,
      nullif(specification->>'text_value',''),nullif(specification->>'number_value','')::numeric,nullif(specification->>'boolean_value','')::boolean,
      coalesce((specification->>'sort_order')::integer,0));
  end loop;
  insert into public.catalog_audit_events(actor_id,action,target_type,target_id,new_state)
  values(p_actor_id,'product.specifications.updated','product',p_product_id,p_specifications);
end $$;

create or replace function public.catalog_archive_variant(p_variant_id uuid, p_actor_id uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare before_state jsonb;
begin
  select to_jsonb(v) into before_state from public.product_variants v where id = p_variant_id for update;
  if before_state is null then raise exception 'Variant not found'; end if;
  update public.product_variants set is_active = false, archived_at = coalesce(archived_at, now()), updated_at = now() where id = p_variant_id;
  insert into public.catalog_audit_events(actor_id, action, target_type, target_id, previous_state, new_state)
  values (p_actor_id, 'variant.archived', 'variant', p_variant_id, before_state, jsonb_build_object('is_active', false));
end $$;

alter table public.brands enable row level security;
alter table public.attribute_definitions enable row level security;
alter table public.attribute_values enable row level security;
alter table public.product_variants enable row level security;
alter table public.product_specifications enable row level security;
alter table public.variant_attribute_values enable row level security;
alter table public.catalog_media enable row level security;
alter table public.product_media enable row level security;
alter table public.variant_media enable row level security;
alter table public.catalog_audit_events enable row level security;

drop policy if exists "categories_public_read" on public.categories;
create policy "categories_public_read" on public.categories for select to anon, authenticated using (is_active);
drop policy if exists "products_public_read_active" on public.products;
create policy "products_public_read_active" on public.products for select to anon, authenticated using (is_active and archived_at is null);

drop policy if exists brands_public_read_active on public.brands;
create policy brands_public_read_active on public.brands for select to anon, authenticated using (is_active and archived_at is null);
drop policy if exists attribute_definitions_public_read_active on public.attribute_definitions;
create policy attribute_definitions_public_read_active on public.attribute_definitions for select to anon, authenticated using (is_active and archived_at is null and is_visible);
drop policy if exists attribute_values_public_read_active on public.attribute_values;
create policy attribute_values_public_read_active on public.attribute_values for select to anon, authenticated using (is_active and archived_at is null);
drop policy if exists product_variants_public_read_active on public.product_variants;
create policy product_variants_public_read_active on public.product_variants for select to anon, authenticated using (
  is_active and archived_at is null and exists (select 1 from public.products p where p.id = product_id and p.is_active and p.archived_at is null)
);
drop policy if exists product_specifications_public_read on public.product_specifications;
create policy product_specifications_public_read on public.product_specifications for select to anon, authenticated using (
  exists (select 1 from public.products p where p.id = product_id and p.is_active and p.archived_at is null)
);
drop policy if exists variant_attribute_values_public_read on public.variant_attribute_values;
create policy variant_attribute_values_public_read on public.variant_attribute_values for select to anon, authenticated using (
  exists (select 1 from public.product_variants v join public.products p on p.id = v.product_id where v.id = variant_id and v.is_active and v.archived_at is null and p.is_active and p.archived_at is null)
);
drop policy if exists catalog_media_public_read_active on public.catalog_media;
create policy catalog_media_public_read_active on public.catalog_media for select to anon, authenticated using (
  archived_at is null and (
    exists(select 1 from public.product_media pm join public.products p on p.id=pm.product_id where pm.media_id=catalog_media.id and pm.archived_at is null and p.is_active and p.archived_at is null)
    or exists(select 1 from public.variant_media vm join public.product_variants v on v.id=vm.variant_id join public.products p on p.id=v.product_id where vm.media_id=catalog_media.id and vm.archived_at is null and v.is_active and v.archived_at is null and p.is_active and p.archived_at is null)
  )
);
drop policy if exists product_media_public_read_active on public.product_media;
create policy product_media_public_read_active on public.product_media for select to anon, authenticated using (archived_at is null and exists(select 1 from public.products p where p.id=product_media.product_id and p.is_active and p.archived_at is null));
drop policy if exists variant_media_public_read_active on public.variant_media;
create policy variant_media_public_read_active on public.variant_media for select to anon, authenticated using (archived_at is null and exists(select 1 from public.product_variants v join public.products p on p.id=v.product_id where v.id=variant_media.variant_id and v.is_active and v.archived_at is null and p.is_active and p.archived_at is null));

revoke all on public.brands, public.attribute_definitions, public.attribute_values, public.product_variants,
  public.product_specifications, public.variant_attribute_values, public.catalog_media, public.product_media,
  public.variant_media, public.catalog_audit_events from anon, authenticated;
grant select on public.brands, public.attribute_definitions, public.attribute_values, public.product_variants,
  public.product_specifications, public.variant_attribute_values, public.catalog_media, public.product_media, public.variant_media to anon, authenticated;
grant all on public.brands, public.attribute_definitions, public.attribute_values, public.product_variants,
  public.product_specifications, public.variant_attribute_values, public.catalog_media, public.product_media,
  public.variant_media, public.catalog_audit_events to service_role;
revoke all on function public.catalog_create_product(jsonb, uuid), public.catalog_create_variant(uuid, jsonb, uuid), public.catalog_archive_variant(uuid, uuid), public.catalog_replace_product_specifications(uuid,jsonb,uuid) from public, anon, authenticated;
grant execute on function public.catalog_create_product(jsonb, uuid), public.catalog_create_variant(uuid, jsonb, uuid), public.catalog_archive_variant(uuid, uuid), public.catalog_replace_product_specifications(uuid,jsonb,uuid) to service_role;

create or replace function public.customer_create_order(p_order jsonb, p_items jsonb, p_grant_hash text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare result public.orders; c public.customers;
begin
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items)=0 then
    raise exception 'Empty order' using errcode='22023';
  end if;
  if p_order->>'customer_id' is not null then
    select * into strict c from public.customers where id=(p_order->>'customer_id')::uuid for share;
    if c.auth_user_id is null or c.auth_user_id is distinct from (p_order->>'user_id')::uuid
       or length(trim(coalesce(c.full_name,'')))<2 or coalesce(c.phone,'') !~ '^01[0125][0-9]{8}$' then
      raise exception 'Invalid customer association' using errcode='22023';
    end if;
    if p_grant_hash is not null then raise exception 'Unexpected guest grant'; end if;
  elsif p_order->>'user_id' is not null or p_grant_hash is null or p_grant_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'Invalid guest grant' using errcode='22023';
  end if;
  if exists (
    select 1 from jsonb_to_recordset(p_items) as i(variant_id uuid, quantity int)
    left join public.product_variants v on v.id=i.variant_id
    left join public.products p on p.id=v.product_id
    where i.quantity<=0 or v.id is null or not v.is_active or v.archived_at is not null or not p.is_active or p.archived_at is not null
  ) then raise exception 'Inactive or invalid catalog variant' using errcode='22023'; end if;

  insert into public.orders(order_number,user_id,customer_id,customer_name,customer_phone,alt_phone,
    governorate,city,address,notes,items_total,shipping_cost,discount,discount_code,grand_total,payment_method)
  values(p_order->>'order_number',(p_order->>'user_id')::uuid,c.id,p_order->>'customer_name',p_order->>'customer_phone',
    p_order->>'alt_phone',p_order->>'governorate',p_order->>'city',p_order->>'address',p_order->>'notes',
    (p_order->>'items_total')::numeric,(p_order->>'shipping_cost')::numeric,(p_order->>'discount')::numeric,
    p_order->>'discount_code',(p_order->>'grand_total')::numeric,p_order->>'payment_method') returning * into result;

  insert into public.order_items(order_id,product_id,variant_id,sku,name_en,name_ar,product_name_en,product_name_ar,
    variant_label_en,variant_label_ar,price,quantity,image)
  select result.id,p.id,v.id,v.sku,p.name_en,p.name_ar,p.name_en,p.name_ar,v.label_en,v.label_ar,
    i.price,i.quantity,i.image
  from jsonb_to_recordset(p_items) as i(variant_id uuid,price numeric,quantity int,image text)
  join public.product_variants v on v.id=i.variant_id
  join public.products p on p.id=v.product_id;
  if c.id is null then
    insert into public.order_confirmation_grants(order_id,secret_hash,expires_at) values(result.id,p_grant_hash,now()+interval '30 days');
  else
    insert into public.customer_audit(customer_id,actor_id,action,details)
    values(c.id,c.auth_user_id,'order.associated',jsonb_build_object('order_id',result.id));
  end if;
  return jsonb_build_object('id',result.id,'order_number',result.order_number,'grand_total',result.grand_total,'payment_method',result.payment_method);
end $$;
revoke all on function public.customer_create_order(jsonb,jsonb,text) from public,anon,authenticated;
grant execute on function public.customer_create_order(jsonb,jsonb,text) to service_role;

create or replace function public.catalog_confirm_media(p_media jsonb, p_actor_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare relation_id uuid; target_variant uuid; media_uuid uuid := (p_media->>'media_id')::uuid; make_primary boolean;
begin
  if not exists (select 1 from public.products where id=(p_media->>'product_id')::uuid) then raise exception 'Product not found'; end if;
  target_variant := nullif(p_media->>'variant_id','')::uuid;
  if target_variant is not null and not exists (
    select 1 from public.product_variants where id=target_variant and product_id=(p_media->>'product_id')::uuid
  ) then raise exception 'Variant association is invalid' using errcode='22023'; end if;
  insert into public.catalog_media(id,provider,object_key,mime_type,byte_size,width,height,alt_en,alt_ar,created_by)
  values(media_uuid,'r2',p_media->>'object_key',p_media->>'mime_type',(p_media->>'byte_size')::bigint,
    (p_media->>'width')::integer,(p_media->>'height')::integer,coalesce(p_media->>'alt_en',''),coalesce(p_media->>'alt_ar',''),p_actor_id);
  if target_variant is null then
    make_primary := coalesce((p_media->>'is_primary')::boolean,false) or not exists (
      select 1 from public.product_media where product_id=(p_media->>'product_id')::uuid and archived_at is null
    );
    if make_primary then
      update public.product_media set is_primary=false where product_id=(p_media->>'product_id')::uuid and archived_at is null;
    end if;
    insert into public.product_media(product_id,media_id,sort_order,is_primary)
    values((p_media->>'product_id')::uuid,media_uuid,coalesce((p_media->>'sort_order')::integer,0),make_primary)
    returning id into relation_id;
  else
    insert into public.variant_media(variant_id,media_id,sort_order)
    values(target_variant,media_uuid,coalesce((p_media->>'sort_order')::integer,0)) returning id into relation_id;
  end if;
  insert into public.catalog_audit_events(actor_id,action,target_type,target_id,new_state)
  values(p_actor_id,'media.confirmed','media',media_uuid,p_media);
  return jsonb_build_object('media_id',media_uuid,'association_id',relation_id);
end $$;

create or replace function public.catalog_update_media(p_media_id uuid, p_sort_order integer default null, p_is_primary boolean default null, p_actor_id uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare target_product uuid;
begin
  select product_id into target_product from public.product_media where media_id=p_media_id and archived_at is null for update;
  if target_product is null then
    if p_is_primary is not null then raise exception 'Variant media cannot be primary' using errcode='22023'; end if;
    update public.variant_media set sort_order=coalesce(p_sort_order,sort_order) where media_id=p_media_id and archived_at is null;
  else
    if p_is_primary then update public.product_media set is_primary=false where product_id=target_product and archived_at is null; end if;
    update public.product_media set sort_order=coalesce(p_sort_order,sort_order), is_primary=coalesce(p_is_primary,is_primary)
      where media_id=p_media_id and archived_at is null;
  end if;
  insert into public.catalog_audit_events(actor_id,action,target_type,target_id,new_state)
  values(p_actor_id,'media.updated','media',p_media_id,jsonb_build_object('sort_order',p_sort_order,'is_primary',p_is_primary));
end $$;

create or replace function public.catalog_archive_media(p_media_id uuid, p_actor_id uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare archived_time timestamptz := now(); target_product uuid;
begin
  if not exists (select 1 from public.catalog_media where id=p_media_id) then raise exception 'Media not found'; end if;
  select product_id into target_product from public.product_media where media_id=p_media_id and archived_at is null;
  update public.product_media set archived_at=archived_time,is_primary=false where media_id=p_media_id and archived_at is null;
  update public.variant_media set archived_at=archived_time where media_id=p_media_id and archived_at is null;
  update public.catalog_media set archived_at=coalesce(archived_at,archived_time),cleanup_after=archived_time+interval '1 day',updated_at=archived_time where id=p_media_id;
  if target_product is not null and not exists(select 1 from public.product_media where product_id=target_product and archived_at is null and is_primary) then
    update public.product_media set is_primary=true where id=(select id from public.product_media where product_id=target_product and archived_at is null order by sort_order,id limit 1);
  end if;
  insert into public.catalog_audit_events(actor_id,action,target_type,target_id,new_state)
  values(p_actor_id,'media.archived','media',p_media_id,jsonb_build_object('archived_at',archived_time));
end $$;

revoke all on function public.catalog_confirm_media(jsonb,uuid), public.catalog_update_media(uuid,integer,boolean,uuid), public.catalog_archive_media(uuid,uuid) from public,anon,authenticated;
grant execute on function public.catalog_confirm_media(jsonb,uuid), public.catalog_update_media(uuid,integer,boolean,uuid), public.catalog_archive_media(uuid,uuid) to service_role;

notify pgrst, 'reload schema';
