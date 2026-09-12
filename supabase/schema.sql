-- ============================================================================
-- Xeemo Ecommerce — schema (Phase 2)
-- Run via scripts/migrate.mjs against DIRECT_URL (session pooler, port 5432).
-- Idempotent: safe to re-run.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- storage bucket
-- Create a public storage bucket for product/bundle images if it doesn't exist.
insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

-- Allow public read access to product-images bucket
drop policy if exists "product_images_public_read" on storage.objects;
create policy "product_images_public_read" on storage.objects
  for select using (bucket_id = 'product-images');

-- Allow authenticated users to upload to product-images
drop policy if exists "product_images_auth_upload" on storage.objects;
create policy "product_images_auth_upload" on storage.objects
  for insert to authenticated with check (bucket_id = 'product-images');

drop policy if exists "product_images_auth_update" on storage.objects;
create policy "product_images_auth_update" on storage.objects
  for update to authenticated using (bucket_id = 'product-images');

drop policy if exists "product_images_auth_delete" on storage.objects;
create policy "product_images_auth_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'product-images');

-- Feature 001 replaces broad authenticated storage mutation with server/admin-only access.
drop policy if exists "product_images_auth_upload" on storage.objects;
drop policy if exists "product_images_auth_update" on storage.objects;
drop policy if exists "product_images_auth_delete" on storage.objects;

-- ---------------------------------------------------------------- categories
create table if not exists public.categories (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  name_en     text not null,
  name_ar     text not null,
  image       text,
  sort_order  int  not null default 0,
  created_at  timestamptz not null default now()
);

-- ------------------------------------------------------------------ products
create table if not exists public.products (
  id                uuid primary key default gen_random_uuid(),
  legacy_id         text unique,                       -- e.g. mg_1 (from JSON)
  slug              text unique not null,
  sku               text,
  category_id       uuid references public.categories(id) on delete set null,
  name_en           text not null,
  name_ar           text not null,
  short_desc_en     text not null default '',
  short_desc_ar     text not null default '',
  long_desc_en      text not null default '',
  long_desc_ar      text not null default '',
  price             numeric(10,2) not null,
  compare_at_price  numeric(10,2),
  stock             int  not null default 0,
  is_active         boolean not null default true,
  is_featured       boolean not null default false,
  images            text[] not null default '{}',
  weight            text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists products_category_idx        on public.products(category_id);
create index if not exists products_active_featured_idx on public.products(is_active, is_featured);

-- ------------------------------------------------------- locations (EG gov/city)
create table if not exists public.locations (
  id             uuid primary key default gen_random_uuid(),
  governorate_en text not null,
  governorate_ar text not null,
  city           text not null,        -- Arabic city name (matches source data)
  sort_order     int  not null default 0
);
create index if not exists locations_gov_ar_idx on public.locations(governorate_ar);

-- ------------------------------------------------------------- shipping_rates
-- Lookup precedence at checkout: exact (gov,city) → (gov,'*') → ('*','*')
create table if not exists public.shipping_rates (
  id          uuid primary key default gen_random_uuid(),
  governorate text not null default '*',   -- '*' = wildcard
  city        text not null default '*',   -- '*' = wildcard
  cost        numeric(10,2) not null,
  unique (governorate, city)
);

-- ------------------------------------------------------------------ profiles
-- 1:1 with auth.users. is_admin is ONLY set by the service role (server).
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text,
  full_name  text,
  phone      text,
  is_admin   boolean not null default false,
  created_at timestamptz not null default now()
);

-- Customers must exist before addresses and orders add their ownership FKs.
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  full_name text,
  email text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop policy if exists "product_images_admin_write" on storage.objects;
create policy "product_images_admin_write" on storage.objects for all to authenticated
  using (bucket_id = 'product-images' and exists (select 1 from public.profiles where id = auth.uid() and is_admin))
  with check (bucket_id = 'product-images' and exists (select 1 from public.profiles where id = auth.uid() and is_admin));

-- ----------------------------------------------------------------- addresses
create table if not exists public.addresses (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade,
  full_name   text not null,
  phone       text not null,
  governorate text not null,
  city        text not null,
  address     text not null,
  is_default  boolean not null default false,
  created_at  timestamptz not null default now()
);
alter table public.addresses add column if not exists customer_id uuid references public.customers(id) on delete cascade;

-- -------------------------------------------------------------------- orders
create table if not exists public.orders (
  id                uuid primary key default gen_random_uuid(),
  order_number      text unique not null,
  user_id           uuid references auth.users(id) on delete set null,
  customer_name     text not null,
  customer_phone    text not null,
  alt_phone         text not null,
  governorate       text not null,
  city              text not null,
  address           text not null,
  notes             text,
  items_total       numeric(10,2) not null default 0,
  shipping_cost     numeric(10,2) not null default 0,
  discount          numeric(10,2) not null default 0,
  grand_total       numeric(10,2) not null default 0,
  payment_method    text not null check (payment_method in ('card','cod')),
  payment_status    text not null default 'pending'
                    check (payment_status in ('pending','paid','failed','refunded')),
  fulfillment_status text not null default 'pending'
                    check (fulfillment_status in ('pending','processing','shipped','delivered','cancelled','returned')),
  kashier_payment_id text,
  discount_code     text,
  bosta              jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
alter table public.orders add column if not exists customer_id uuid references public.customers(id) on delete set null;
create index if not exists orders_created_idx on public.orders(created_at desc);
create index if not exists orders_user_idx     on public.orders(user_id);
alter table public.orders add column if not exists bosta jsonb;
alter table public.orders drop constraint if exists orders_fulfillment_status_check;
alter table public.orders add constraint orders_fulfillment_status_check
  check (fulfillment_status in ('pending','processing','shipped','delivered','cancelled','returned'));
update public.orders set alt_phone = customer_phone where alt_phone is null;
alter table public.orders alter column alt_phone set not null;
create unique index if not exists orders_bosta_tracking_idx
  on public.orders ((bosta ->> 'trackingNumber'))
  where bosta ->> 'trackingNumber' is not null;

-- --------------------------------------------------------------- order_items
create table if not exists public.order_items (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  name_en    text not null,
  name_ar    text,
  price      numeric(10,2) not null,
  quantity   int  not null,
  image      text
);
create index if not exists order_items_order_idx on public.order_items(order_id);

-- ----------------------------------------------------------- store analytics
-- Anonymous, first-party storefront events. No names, email addresses, IPs,
-- or detailed device data are stored here.
create table if not exists public.store_events (
  id          uuid primary key default gen_random_uuid(),
  visitor_id  uuid not null,
  event_type  text not null check (event_type in ('page_view', 'add_to_cart', 'initiate_checkout')),
  path        text not null,
  created_at  timestamptz not null default now()
);
create index if not exists store_events_created_idx on public.store_events(created_at desc);
create index if not exists store_events_visitor_created_idx on public.store_events(visitor_id, created_at desc);
create index if not exists store_events_type_created_idx on public.store_events(event_type, created_at desc);

-- --------------------------------------------------------------- reviews
create table if not exists public.product_reviews (
  id             uuid primary key default gen_random_uuid(),
  product_id     uuid not null references public.products(id) on delete cascade,
  reviewer_name  text not null,
  rating         int not null check (rating between 1 and 5),
  title          text,
  body           text not null,
  status         text not null default 'pending'
                 check (status in ('pending','approved','rejected')),
  moderated_at   timestamptz,
  created_at     timestamptz not null default now()
);
create index if not exists product_reviews_product_status_idx
  on public.product_reviews(product_id, status, created_at desc);

-- --------------------------------------------------------------- Bosta pickups
create table if not exists public.bosta_pickups (
  automation_key       text primary key,
  bosta_pickup_id      text unique,
  puid                 text,
  scheduled_date       date,
  scheduled_time_slot  text,
  state                text,
  business_location_id text,
  order_ids            jsonb not null default '[]'::jsonb,
  tracking_numbers     jsonb not null default '[]'::jsonb,
  parcel_count         int not null default 0,
  telegram_sent        boolean not null default false,
  status               text not null check (status in ('running','completed','skipped','failed')),
  error                text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index if not exists bosta_pickups_scheduled_idx
  on public.bosta_pickups(scheduled_date desc);
alter table public.bosta_pickups add column if not exists telegram_sent boolean not null default false;

-- ----------------------------------------------------------------- discounts
create table if not exists public.discounts (
  id           uuid primary key default gen_random_uuid(),
  code         text unique not null,
  type         text not null check (type in ('percent','fixed')),
  value        numeric(10,2) not null,
  min_subtotal numeric(10,2) not null default 0,
  expires_at   timestamptz,
  usage_limit  int,
  used_count   int  not null default 0,
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);

-- ------------------------------------------------------------------- settings
create table if not exists public.settings (
  key      text primary key,
  value_en text not null default '',
  value_ar text not null default ''
);

create table if not exists public.newsletter_subscribers (
  id         uuid primary key default gen_random_uuid(),
  email      text not null,
  created_at timestamptz not null default now()
);
create unique index if not exists newsletter_subscribers_email_lower_idx
  on public.newsletter_subscribers (lower(email));

-- =====================================================================
-- Triggers: updated_at, and auto-create profile on signup
-- =====================================================================

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create or replace function public.admin_replace_order_items(
  p_order_id uuid,
  p_items jsonb,
  p_items_total numeric,
  p_shipping_cost numeric,
  p_discount numeric,
  p_grand_total numeric
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'An order must contain at least one item';
  end if;

  delete from public.order_items where order_id = p_order_id;

  insert into public.order_items
    (id, order_id, product_id, name_en, name_ar, price, quantity, image)
  select
    coalesce(item.id, gen_random_uuid()),
    p_order_id,
    item.product_id,
    item.name_en,
    item.name_ar,
    item.price,
    item.quantity,
    item.image
  from jsonb_to_recordset(p_items) as item(
    id uuid,
    product_id uuid,
    name_en text,
    name_ar text,
    price numeric,
    quantity int,
    image text
  );

  update public.orders
  set items_total = p_items_total,
      shipping_cost = p_shipping_cost,
      discount = p_discount,
      grand_total = p_grand_total
  where id = p_order_id;

  if not found then
    raise exception 'Order not found';
  end if;
end;
$$;

revoke all on function public.admin_replace_order_items(uuid, jsonb, numeric, numeric, numeric, numeric) from public, anon, authenticated;
grant execute on function public.admin_replace_order_items(uuid, jsonb, numeric, numeric, numeric, numeric) to service_role;

drop trigger if exists products_touch on public.products;
create trigger products_touch before update on public.products
  for each row execute function public.touch_updated_at();

drop trigger if exists orders_touch on public.orders;
create trigger orders_touch before update on public.orders
  for each row execute function public.touch_updated_at();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', ''));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- =====================================================================
-- Row Level Security
-- Public reads for catalog/settings; customer self-service for own data.
-- All admin/mutation work happens server-side via the service role (bypasses RLS).
-- =====================================================================

alter table public.categories     enable row level security;
alter table public.products       enable row level security;
alter table public.locations      enable row level security;
alter table public.shipping_rates enable row level security;
alter table public.discounts      enable row level security;
alter table public.settings       enable row level security;
alter table public.profiles       enable row level security;
alter table public.addresses      enable row level security;
alter table public.orders         enable row level security;
alter table public.order_items    enable row level security;
alter table public.store_events   enable row level security;
alter table public.newsletter_subscribers enable row level security;
alter table public.product_reviews enable row level security;
alter table public.bosta_pickups enable row level security;

-- public reads
drop policy if exists "categories_public_read" on public.categories;
create policy "categories_public_read" on public.categories
  for select using (true);

drop policy if exists "products_public_read_active" on public.products;
create policy "products_public_read_active" on public.products
  for select using (is_active = true);

drop policy if exists "product_reviews_public_read_approved" on public.product_reviews;
create policy "product_reviews_public_read_approved" on public.product_reviews
  for select using (status = 'approved');

drop policy if exists "locations_public_read" on public.locations;
create policy "locations_public_read" on public.locations
  for select using (true);

drop policy if exists "shipping_public_read" on public.shipping_rates;
create policy "shipping_public_read" on public.shipping_rates
  for select using (true);

drop policy if exists "discounts_public_read_active" on public.discounts;
create policy "discounts_public_read_active" on public.discounts
  for select using (active = true);

drop policy if exists "settings_public_read" on public.settings;
create policy "settings_public_read" on public.settings
  for select using (true);

-- profiles: read own only (is_admin is set solely by the service role)
drop policy if exists "profiles_self_read" on public.profiles;
create policy "profiles_self_read" on public.profiles
  for select using (auth.uid() = id);

-- addresses: owner full access
drop policy if exists "addresses_owner_all" on public.addresses;
create policy "addresses_owner_all" on public.addresses
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "addresses_owner_all" on public.addresses;

-- orders: owner read (guest/server writes via service role)
drop policy if exists "orders_owner_read" on public.orders;
create policy "orders_owner_read" on public.orders
  for select using (auth.uid() = user_id);

-- order_items: read if parent order is yours
drop policy if exists "order_items_owner_read" on public.order_items;
create policy "order_items_owner_read" on public.order_items
  for select using (
    exists (
      select 1 from public.orders o
      where o.id = order_id and o.user_id = auth.uid()
    )
  );

revoke all on public.bosta_pickups from anon, authenticated;
grant all on public.bosta_pickups to service_role;

notify pgrst, 'reload schema';

alter table public.orders add column if not exists mylerz jsonb;
create unique index if not exists orders_mylerz_tracking_idx
  on public.orders ((mylerz ->> 'trackingNumber'))
  where mylerz ->> 'trackingNumber' is not null;
alter table public.orders add column if not exists shipment_creation text;

-- Feature 001 canonical schema (kept identical to its additive migration).
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(), auth_user_id uuid unique references auth.users(id) on delete set null,
  full_name text, email text, phone text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.addresses add column if not exists customer_id uuid references public.customers(id) on delete cascade;
alter table public.addresses add column if not exists is_default boolean not null default false;
alter table public.orders add column if not exists customer_id uuid references public.customers(id) on delete set null;
create table if not exists public.order_confirmation_grants (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  secret_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists customers_phone_idx on public.customers(phone);
create index if not exists orders_customer_idx on public.orders(customer_id);
create index if not exists order_confirmation_grants_order_idx on public.order_confirmation_grants(order_id);
create unique index if not exists addresses_one_default_per_customer on public.addresses(customer_id) where is_default;
alter table public.customers enable row level security;
drop policy if exists "customers_self_read" on public.customers;
create policy "customers_self_read" on public.customers for select using (auth_user_id = auth.uid());
drop policy if exists "addresses_customer_read" on public.addresses;
create policy "addresses_customer_read" on public.addresses for select using (customer_id in (select id from public.customers where auth_user_id = auth.uid()));
drop policy if exists "addresses_owner_all" on public.addresses;
drop policy if exists "orders_customer_read" on public.orders;
create policy "orders_customer_read" on public.orders for select using (customer_id in (select id from public.customers where auth_user_id = auth.uid()));
drop policy if exists "product_images_auth_upload" on storage.objects;
drop policy if exists "product_images_auth_update" on storage.objects;
drop policy if exists "product_images_auth_delete" on storage.objects;
drop policy if exists "product_images_admin_write" on storage.objects;
create policy "product_images_admin_write" on storage.objects for all to authenticated
  using (bucket_id = 'product-images' and exists (select 1 from public.profiles where id = auth.uid() and is_admin))
  with check (bucket_id = 'product-images' and exists (select 1 from public.profiles where id = auth.uid() and is_admin));
alter table public.order_confirmation_grants enable row level security;
revoke all on public.order_confirmation_grants from anon, authenticated;
grant all on public.order_confirmation_grants to service_role;
create unique index if not exists order_confirmation_one_active on public.order_confirmation_grants(order_id) where revoked_at is null;

create table if not exists public.customer_audit (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id) on delete set null,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);
alter table public.customer_audit enable row level security;
revoke all on public.customer_audit from anon, authenticated;
grant all on public.customer_audit to service_role;
revoke insert, update, delete on public.customers, public.profiles, public.addresses from anon, authenticated;
grant select on public.customers, public.profiles, public.addresses, public.orders, public.order_items to authenticated;
grant all on public.customers, public.addresses to service_role;
drop policy if exists orders_owner_read on public.orders;
drop policy if exists order_items_owner_read on public.order_items;
create policy order_items_owner_read on public.order_items for select to authenticated using (
  exists (select 1 from public.orders o join public.customers c on c.id = o.customer_id
    where o.id = order_id and c.auth_user_id = auth.uid())
);
drop trigger if exists customers_touch on public.customers;
create trigger customers_touch before update on public.customers for each row execute function public.touch_updated_at();

create or replace function public.customer_resolve(p_user_id uuid)
returns public.customers language plpgsql security definer set search_path = public as $$
declare result public.customers; u auth.users;
begin
  select * into strict u from auth.users where id = p_user_id;
  insert into public.customers(auth_user_id, full_name, email)
  values (u.id, left(coalesce(u.raw_user_meta_data->>'full_name',u.raw_user_meta_data->>'name'),120),u.email)
  on conflict (auth_user_id) do nothing;
  select * into strict result from public.customers where auth_user_id = u.id;
  insert into public.customer_audit(customer_id,actor_id,action) values(result.id,u.id,'identity.resolved');
  return result;
end;
$$;

create or replace function public.customer_profile_update(p_customer_id uuid, p_name text, p_phone text)
returns public.customers language plpgsql security definer set search_path = public as $$
declare result public.customers; previous public.customers;
begin
  if length(trim(p_name)) not between 2 and 120 or p_phone !~ '^01[0125][0-9]{8}$' then
    raise exception 'Invalid profile' using errcode = '22023';
  end if;
  select * into strict previous from public.customers where id = p_customer_id for update;
  update public.customers set full_name=trim(p_name),phone=p_phone where id=p_customer_id returning * into result;
  update public.profiles set full_name=result.full_name,phone=result.phone where id=result.auth_user_id;
  insert into public.customer_audit(customer_id,actor_id,action,details)
  values(result.id,result.auth_user_id,'profile.updated',jsonb_build_object('fields',jsonb_build_array('full_name','phone')));
  return result;
end;
$$;

create or replace function public.customer_address_command(p_customer_id uuid, p_action text, p_id uuid default null, p_data jsonb default '{}')
returns jsonb language plpgsql security definer set search_path = public as $$
declare result public.addresses; c public.customers; next_id uuid; make_default boolean;
begin
  select * into strict c from public.customers where id=p_customer_id for update;
  if p_action <> 'create' then
    select * into result from public.addresses where id=p_id and customer_id=c.id for update;
    if not found then return null; end if;
  end if;
  if p_action = 'delete' then
    delete from public.addresses where id=result.id;
  elsif p_action in ('create','update','default') then
    make_default := p_action='default' or coalesce((p_data->>'is_default')::boolean,false);
    if make_default then update public.addresses set is_default=false where customer_id=c.id and is_default; end if;
    if p_action='create' then
      insert into public.addresses(customer_id,user_id,full_name,phone,governorate,city,address,is_default)
      values(c.id,c.auth_user_id,p_data->>'full_name',p_data->>'phone',p_data->>'governorate',p_data->>'city',p_data->>'address',make_default)
      returning * into result;
    elsif p_action='update' then
      update public.addresses set full_name=coalesce(p_data->>'full_name',full_name), phone=coalesce(p_data->>'phone',phone),
        governorate=coalesce(p_data->>'governorate',governorate),city=coalesce(p_data->>'city',city),
        address=coalesce(p_data->>'address',address),is_default=coalesce((p_data->>'is_default')::boolean,is_default)
      where id=result.id returning * into result;
    else
      update public.addresses set is_default=true where id=result.id returning * into result;
    end if;
    if length(trim(result.full_name)) not between 2 and 120 or result.phone !~ '^01[0125][0-9]{8}$'
       or length(trim(result.address)) not between 3 and 500 or length(trim(result.city))=0 or length(trim(result.governorate))=0 then
      raise exception 'Invalid address' using errcode='22023';
    end if;
  else raise exception 'Invalid address action' using errcode='22023';
  end if;
  if not exists(select 1 from public.addresses where customer_id=c.id and is_default) then
    select id into next_id from public.addresses where customer_id=c.id order by created_at,id limit 1;
    update public.addresses set is_default=true where id=next_id;
  end if;
  if p_action='delete' then return jsonb_build_object('deleted',true); end if;
  select * into result from public.addresses where id=result.id;
  return to_jsonb(result);
end;
$$;

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
  insert into public.orders(order_number,user_id,customer_id,customer_name,customer_phone,alt_phone,
    governorate,city,address,notes,items_total,shipping_cost,discount,discount_code,grand_total,payment_method)
  values(p_order->>'order_number',(p_order->>'user_id')::uuid,c.id,p_order->>'customer_name',p_order->>'customer_phone',
    p_order->>'alt_phone',p_order->>'governorate',p_order->>'city',p_order->>'address',p_order->>'notes',
    (p_order->>'items_total')::numeric,(p_order->>'shipping_cost')::numeric,(p_order->>'discount')::numeric,
    p_order->>'discount_code',(p_order->>'grand_total')::numeric,p_order->>'payment_method') returning * into result;
  if exists(select 1 from jsonb_to_recordset(p_items) as i(price numeric,quantity int) where price<0 or quantity<=0) then
    raise exception 'Invalid item' using errcode='22023';
  end if;
  insert into public.order_items(order_id,product_id,name_en,name_ar,price,quantity,image)
  select result.id,i.product_id,i.name_en,i.name_ar,i.price,i.quantity,i.image
  from jsonb_to_recordset(p_items) as i(product_id uuid,name_en text,name_ar text,price numeric,quantity int,image text);
  if c.id is null then
    insert into public.order_confirmation_grants(order_id,secret_hash,expires_at) values(result.id,p_grant_hash,now()+interval '30 days');
  else
    insert into public.customer_audit(customer_id,actor_id,action,details)
    values(c.id,c.auth_user_id,'order.associated',jsonb_build_object('order_id',result.id));
  end if;
  return jsonb_build_object('id',result.id,'order_number',result.order_number,'grand_total',result.grand_total,'payment_method',result.payment_method);
end;
$$;

revoke all on function public.customer_resolve(uuid), public.customer_profile_update(uuid,text,text),
  public.customer_address_command(uuid,text,uuid,jsonb), public.customer_create_order(jsonb,jsonb,text) from public,anon,authenticated;
grant execute on function public.customer_resolve(uuid), public.customer_profile_update(uuid,text,text),
  public.customer_address_command(uuid,text,uuid,jsonb), public.customer_create_order(jsonb,jsonb,text) to service_role;
-- Only legacy addresses with a verified Auth foreign key are eligible for association.
insert into public.customers(auth_user_id,full_name,email)
select distinct u.id, left(coalesce(u.raw_user_meta_data->>'full_name',u.raw_user_meta_data->>'name'),120),u.email
from public.addresses a join auth.users u on u.id=a.user_id
where a.customer_id is null
on conflict(auth_user_id) do nothing;
update public.addresses set is_default=false where customer_id is null and user_id is not null;
update public.addresses a set customer_id=c.id from public.customers c
where a.customer_id is null and a.user_id=c.auth_user_id;
with chosen as (
  select distinct on(customer_id) id from public.addresses a where customer_id is not null
  and not exists(select 1 from public.addresses d where d.customer_id=a.customer_id and d.is_default)
  order by customer_id,created_at,id
) update public.addresses set is_default=true where id in(select id from chosen);
do $$ begin
  if not exists(select 1 from pg_constraint where conrelid='public.addresses'::regclass and conname='addresses_customer_required') then
    alter table public.addresses add constraint addresses_customer_required check(customer_id is not null) not valid;
  end if;
end $$;
notify pgrst, 'reload schema';

-- =====================================================================
-- Feature 002: Customer Types and commercial approval
-- =====================================================================

create table if not exists public.customer_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z][a-z0-9_]*$'),
  name_ar text not null,
  name_en text not null,
  requires_approval boolean not null default true,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.customer_types (code, name_ar, name_en, requires_approval, is_active, sort_order)
values
  ('retail', 'تجزئة', 'Retail', false, true, 10),
  ('wholesale', 'تاجر جملة', 'Wholesale Trader', true, true, 20),
  ('gym_owner', 'مالك جيم', 'Gym Owner', true, true, 30)
on conflict (code) do update
set name_ar = excluded.name_ar,
    name_en = excluded.name_en,
    requires_approval = excluded.requires_approval,
    sort_order = excluded.sort_order;

create or replace function public.default_customer_type_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.customer_types where code = 'retail' limit 1
$$;

alter table public.customers add column if not exists customer_type_id uuid references public.customer_types(id) on delete restrict;
update public.customers set customer_type_id = public.default_customer_type_id() where customer_type_id is null;
alter table public.customers alter column customer_type_id set default public.default_customer_type_id();
alter table public.customers alter column customer_type_id set not null;

create table if not exists public.customer_type_requests (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete restrict,
  requested_type_id uuid not null references public.customer_types(id) on delete restrict,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'superseded')),
  business_name text not null check (char_length(btrim(business_name)) between 2 and 160),
  business_phone text check (business_phone is null or business_phone ~ '^01[0125][0-9]{8}$'),
  governorate text check (governorate is null or char_length(governorate) <= 100),
  city text check (city is null or char_length(city) <= 100),
  business_description text check (business_description is null or char_length(business_description) <= 1000),
  customer_note text check (customer_note is null or char_length(customer_note) <= 1000),
  rejection_reason_public text check (rejection_reason_public is null or char_length(rejection_reason_public) <= 1000),
  internal_admin_note text check (internal_admin_note is null or char_length(internal_admin_note) <= 2000),
  submitted_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references auth.users(id) on delete set null,
  superseded_at timestamptz,
  superseded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.customer_type_audit_events (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete restrict,
  request_id uuid references public.customer_type_requests(id) on delete restrict,
  action text not null check (action in ('requested', 'approved', 'rejected', 'superseded', 'assigned')),
  previous_type_id uuid references public.customer_types(id) on delete restrict,
  new_type_id uuid references public.customer_types(id) on delete restrict,
  actor_user_id uuid references auth.users(id) on delete set null,
  reason_public text,
  internal_note text,
  occurred_at timestamptz not null default now()
);

create index if not exists customer_types_active_sort_idx on public.customer_types(is_active, sort_order, code);
create index if not exists customers_customer_type_idx on public.customers(customer_type_id);
create index if not exists customer_type_requests_customer_history_idx on public.customer_type_requests(customer_id, submitted_at desc);
create index if not exists customer_type_requests_queue_idx on public.customer_type_requests(status, submitted_at asc);
create index if not exists customer_type_requests_requested_type_idx on public.customer_type_requests(requested_type_id, status);
create unique index if not exists customer_type_requests_one_pending_per_customer_idx
  on public.customer_type_requests(customer_id) where status = 'pending';
create index if not exists customer_type_audit_customer_idx on public.customer_type_audit_events(customer_id, occurred_at desc);
create index if not exists customer_type_audit_request_idx on public.customer_type_audit_events(request_id, occurred_at desc);

create or replace function public.customer_type_touch_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end;
$$;
drop trigger if exists customer_types_touch on public.customer_types;
create trigger customer_types_touch before update on public.customer_types
  for each row execute function public.customer_type_touch_updated_at();
drop trigger if exists customer_type_requests_touch on public.customer_type_requests;
create trigger customer_type_requests_touch before update on public.customer_type_requests
  for each row execute function public.customer_type_touch_updated_at();

create or replace function public.create_customer_type_request(
  p_customer_id uuid, p_requested_type_code text, p_business_name text,
  p_business_phone text, p_governorate text, p_city text,
  p_business_description text, p_customer_note text
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_customer public.customers%rowtype;
  v_type public.customer_types%rowtype;
  v_request public.customer_type_requests%rowtype;
begin
  select * into v_customer from public.customers where id = p_customer_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'CUSTOMER_NOT_FOUND'; end if;
  select * into v_type from public.customer_types where code = p_requested_type_code;
  if not found then raise exception using errcode = '22023', message = 'TYPE_NOT_FOUND'; end if;
  if not v_type.is_active then raise exception using errcode = '22023', message = 'TYPE_INACTIVE'; end if;
  if not v_type.requires_approval then raise exception using errcode = '22023', message = 'TYPE_NOT_PROTECTED'; end if;
  if v_customer.customer_type_id = v_type.id then raise exception using errcode = '23505', message = 'TYPE_ALREADY_EFFECTIVE'; end if;
  if char_length(btrim(coalesce(p_business_name, ''))) not between 2 and 160 then
    raise exception using errcode = '22023', message = 'INVALID_BUSINESS_NAME';
  end if;
  if exists (select 1 from public.customer_type_requests where customer_id = p_customer_id and status = 'pending') then
    raise exception using errcode = '23505', message = 'PENDING_REQUEST_EXISTS';
  end if;
  insert into public.customer_type_requests (
    customer_id, requested_type_id, business_name, business_phone, governorate, city,
    business_description, customer_note
  ) values (
    p_customer_id, v_type.id, btrim(p_business_name), nullif(btrim(p_business_phone), ''),
    nullif(btrim(p_governorate), ''), nullif(btrim(p_city), ''),
    nullif(btrim(p_business_description), ''), nullif(btrim(p_customer_note), '')
  ) returning * into v_request;
  insert into public.customer_type_audit_events (
    customer_id, request_id, action, previous_type_id, new_type_id, actor_user_id
  ) values (
    v_customer.id, v_request.id, 'requested', v_customer.customer_type_id,
    v_customer.customer_type_id, v_customer.auth_user_id
  );
  return jsonb_build_object(
    'request_id', v_request.id, 'customer_id', v_customer.id, 'status', v_request.status,
    'effective_type_id', v_customer.customer_type_id, 'requested_type_id', v_type.id
  );
exception when unique_violation then
  raise exception using errcode = '23505', message = 'PENDING_REQUEST_EXISTS';
end;
$$;

create or replace function public.approve_customer_type_request(p_request_id uuid, p_admin_user_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_request public.customer_type_requests%rowtype;
  v_customer public.customers%rowtype;
  v_type public.customer_types%rowtype;
begin
  if not exists (select 1 from public.profiles where id = p_admin_user_id and is_admin) then
    raise exception using errcode = '42501', message = 'ADMIN_UNAUTHORIZED';
  end if;
  select * into v_request from public.customer_type_requests where id = p_request_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'REQUEST_NOT_FOUND'; end if;
  if v_request.status <> 'pending' then raise exception using errcode = '40001', message = 'REQUEST_NOT_PENDING'; end if;
  select * into v_type from public.customer_types where id = v_request.requested_type_id;
  if not found or not v_type.is_active or not v_type.requires_approval then
    raise exception using errcode = '22023', message = 'TYPE_INACTIVE';
  end if;
  select * into v_customer from public.customers where id = v_request.customer_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'CUSTOMER_NOT_FOUND'; end if;
  update public.customer_type_requests
  set status = 'approved', decided_at = now(), decided_by = p_admin_user_id,
      rejection_reason_public = null, internal_admin_note = null
  where id = v_request.id and status = 'pending';
  if not found then raise exception using errcode = '40001', message = 'REQUEST_NOT_PENDING'; end if;
  update public.customers set customer_type_id = v_type.id, updated_at = now() where id = v_customer.id;
  insert into public.customer_type_audit_events (
    customer_id, request_id, action, previous_type_id, new_type_id, actor_user_id
  ) values (v_customer.id, v_request.id, 'approved', v_customer.customer_type_id, v_type.id, p_admin_user_id);
  return jsonb_build_object(
    'request_id', v_request.id, 'customer_id', v_customer.id, 'status', 'approved',
    'effective_type_id', v_type.id, 'previous_type_id', v_customer.customer_type_id
  );
end;
$$;

create or replace function public.reject_customer_type_request(
  p_request_id uuid, p_admin_user_id uuid, p_public_reason text, p_internal_note text
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_request public.customer_type_requests%rowtype;
  v_customer public.customers%rowtype;
begin
  if not exists (select 1 from public.profiles where id = p_admin_user_id and is_admin) then
    raise exception using errcode = '42501', message = 'ADMIN_UNAUTHORIZED';
  end if;
  select * into v_request from public.customer_type_requests where id = p_request_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'REQUEST_NOT_FOUND'; end if;
  if v_request.status <> 'pending' then raise exception using errcode = '40001', message = 'REQUEST_NOT_PENDING'; end if;
  select * into v_customer from public.customers where id = v_request.customer_id for update;
  update public.customer_type_requests
  set status = 'rejected', decided_at = now(), decided_by = p_admin_user_id,
      rejection_reason_public = nullif(btrim(p_public_reason), ''),
      internal_admin_note = nullif(btrim(p_internal_note), '')
  where id = v_request.id and status = 'pending';
  if not found then raise exception using errcode = '40001', message = 'REQUEST_NOT_PENDING'; end if;
  insert into public.customer_type_audit_events (
    customer_id, request_id, action, previous_type_id, new_type_id, actor_user_id,
    reason_public, internal_note
  ) values (
    v_customer.id, v_request.id, 'rejected', v_customer.customer_type_id,
    v_customer.customer_type_id, p_admin_user_id, nullif(btrim(p_public_reason), ''),
    nullif(btrim(p_internal_note), '')
  );
  return jsonb_build_object(
    'request_id', v_request.id, 'customer_id', v_customer.id, 'status', 'rejected',
    'effective_type_id', v_customer.customer_type_id
  );
end;
$$;

create or replace function public.assign_customer_type(
  p_customer_id uuid, p_target_type_code text, p_admin_user_id uuid, p_reason text
)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_customer public.customers%rowtype;
  v_type public.customer_types%rowtype;
  v_pending public.customer_type_requests%rowtype;
begin
  if not exists (select 1 from public.profiles where id = p_admin_user_id and is_admin) then
    raise exception using errcode = '42501', message = 'ADMIN_UNAUTHORIZED';
  end if;
  select * into v_customer from public.customers where id = p_customer_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'CUSTOMER_NOT_FOUND'; end if;
  select * into v_type from public.customer_types where code = p_target_type_code;
  if not found then raise exception using errcode = '22023', message = 'TYPE_NOT_FOUND'; end if;
  if not v_type.is_active then raise exception using errcode = '22023', message = 'TYPE_INACTIVE'; end if;
  if v_type.id = v_customer.customer_type_id then raise exception using errcode = '23505', message = 'TYPE_ALREADY_EFFECTIVE'; end if;
  select * into v_pending from public.customer_type_requests
    where customer_id = v_customer.id and status = 'pending' for update;
  if found then
    update public.customer_type_requests
    set status = 'superseded', superseded_at = now(), superseded_by = p_admin_user_id,
        internal_admin_note = nullif(btrim(p_reason), '')
    where id = v_pending.id and status = 'pending';
    if not found then raise exception using errcode = '40001', message = 'REQUEST_NOT_PENDING'; end if;
    insert into public.customer_type_audit_events (
      customer_id, request_id, action, previous_type_id, new_type_id, actor_user_id, internal_note
    ) values (
      v_customer.id, v_pending.id, 'superseded', v_customer.customer_type_id,
      v_type.id, p_admin_user_id, nullif(btrim(p_reason), '')
    );
  end if;
  update public.customers set customer_type_id = v_type.id, updated_at = now() where id = v_customer.id;
  insert into public.customer_type_audit_events (
    customer_id, request_id, action, previous_type_id, new_type_id, actor_user_id, internal_note
  ) values (
    v_customer.id, case when v_pending.id is null then null else v_pending.id end, 'assigned',
    v_customer.customer_type_id, v_type.id, p_admin_user_id, nullif(btrim(p_reason), '')
  );
  return jsonb_build_object(
    'customer_id', v_customer.id, 'status', 'assigned', 'effective_type_id', v_type.id,
    'previous_type_id', v_customer.customer_type_id, 'superseded_request_id', v_pending.id
  );
end;
$$;

alter table public.customers enable row level security;
alter table public.customer_types enable row level security;
alter table public.customer_type_requests enable row level security;
alter table public.customer_type_audit_events enable row level security;
drop policy if exists "customers_self_read" on public.customers;
create policy "customers_self_read" on public.customers for select using (auth_user_id = auth.uid());
drop policy if exists "customer_types_active_read" on public.customer_types;
create policy "customer_types_active_read" on public.customer_types for select using (is_active = true);
drop policy if exists "customer_type_requests_self_read" on public.customer_type_requests;
create policy "customer_type_requests_self_read" on public.customer_type_requests
  for select to authenticated using (
    customer_id in (select id from public.customers where auth_user_id = auth.uid())
  );

revoke all on public.customer_types from anon, authenticated;
grant select on public.customer_types to anon, authenticated;
revoke all on public.customer_type_requests from anon, authenticated;
grant select (
  id, customer_id, requested_type_id, status, business_name, business_phone,
  governorate, city, business_description, customer_note,
  rejection_reason_public, submitted_at, decided_at, superseded_at,
  created_at, updated_at
) on public.customer_type_requests to authenticated;
revoke all on public.customer_type_audit_events from anon, authenticated;
revoke insert, update, delete on public.customers from anon, authenticated;
grant select on public.customers to authenticated;
revoke all on function public.default_customer_type_id() from public, anon, authenticated;
grant execute on function public.default_customer_type_id() to service_role;
revoke all on function public.create_customer_type_request(uuid, text, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.create_customer_type_request(uuid, text, text, text, text, text, text, text) to service_role;
revoke all on function public.approve_customer_type_request(uuid, uuid) from public, anon, authenticated;
grant execute on function public.approve_customer_type_request(uuid, uuid) to service_role;
revoke all on function public.reject_customer_type_request(uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.reject_customer_type_request(uuid, uuid, text, text) to service_role;
revoke all on function public.assign_customer_type(uuid, text, uuid, text) from public, anon, authenticated;
grant execute on function public.assign_customer_type(uuid, text, uuid, text) to service_role;

notify pgrst, 'reload schema';
