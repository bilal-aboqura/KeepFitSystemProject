-- ============================================================================
-- KeepFit Supplement — schema (Phase 2)
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

-- =====================================================================

-- Feature 003: Catalog variants, attributes, and R2 media
-- =====================================================================
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

create or replace function public.customer_create_order(p_order jsonb,p_items jsonb,p_grant_hash text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare result public.orders; c public.customers;
begin
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items)=0 then raise exception 'Empty order' using errcode='22023'; end if;
  if p_order->>'customer_id' is not null then
    select * into strict c from public.customers where id=(p_order->>'customer_id')::uuid for share;
    if c.auth_user_id is null or c.auth_user_id is distinct from (p_order->>'user_id')::uuid
      or length(trim(coalesce(c.full_name,'')))<2 or coalesce(c.phone,'') !~ '^01[0125][0-9]{8}$' then raise exception 'Invalid customer association' using errcode='22023'; end if;
    if p_grant_hash is not null then raise exception 'Unexpected guest grant'; end if;
  elsif p_order->>'user_id' is not null or p_grant_hash is null or p_grant_hash !~ '^[a-f0-9]{64}$' then raise exception 'Invalid guest grant' using errcode='22023'; end if;
  if exists(
    select 1 from jsonb_to_recordset(p_items) as i(variant_id uuid,sellable_unit_id uuid,quantity int)
    left join public.product_variants v on v.id=i.variant_id
    left join public.variant_packaging_units u on u.id=i.sellable_unit_id and u.variant_id=v.id
    left join public.products p on p.id=v.product_id
    where i.quantity<=0 or v.id is null or not v.is_active or v.archived_at is not null or not p.is_active or p.archived_at is not null
      or u.id is null or not u.is_active or u.archived_at is not null or not u.is_sellable
  ) then raise exception 'Inactive or invalid catalog Variant/Sellable Unit' using errcode='22023'; end if;
  insert into public.orders(order_number,user_id,customer_id,customer_name,customer_phone,alt_phone,governorate,city,address,notes,items_total,shipping_cost,discount,discount_code,grand_total,payment_method)
  values(p_order->>'order_number',(p_order->>'user_id')::uuid,c.id,p_order->>'customer_name',p_order->>'customer_phone',p_order->>'alt_phone',p_order->>'governorate',p_order->>'city',p_order->>'address',p_order->>'notes',(p_order->>'items_total')::numeric,(p_order->>'shipping_cost')::numeric,(p_order->>'discount')::numeric,p_order->>'discount_code',(p_order->>'grand_total')::numeric,p_order->>'payment_method') returning * into result;
  insert into public.order_items(order_id,product_id,variant_id,sellable_unit_id,sku,sellable_unit_code,name_en,name_ar,product_name_en,product_name_ar,variant_label_en,variant_label_ar,unit_label_en,unit_label_ar,units_per_sold_package_num,units_per_sold_package_den,base_quantity_per_unit_num,base_quantity_per_unit_den,equivalent_base_quantity_num,equivalent_base_quantity_den,price,line_total,quantity,image)
  select result.id,p.id,v.id,u.id,v.sku,u.code,p.name_en,p.name_ar,p.name_en,p.name_ar,v.label_en,v.label_ar,u.label_en,u.label_ar,
    u.quantity_per_parent_num,u.quantity_per_parent_den,u.base_quantity_num,u.base_quantity_den,u.base_quantity_num*i.quantity,u.base_quantity_den,i.price,round(i.price*i.quantity,2),i.quantity,i.image
  from jsonb_to_recordset(p_items) as i(variant_id uuid,sellable_unit_id uuid,price numeric,quantity int,image text)
  join public.product_variants v on v.id=i.variant_id join public.variant_packaging_units u on u.id=i.sellable_unit_id and u.variant_id=v.id join public.products p on p.id=v.product_id;
  if c.id is null then insert into public.order_confirmation_grants(order_id,secret_hash,expires_at) values(result.id,p_grant_hash,now()+interval '30 days');
  else insert into public.customer_audit(customer_id,actor_id,action,details) values(c.id,c.auth_user_id,'order.associated',jsonb_build_object('order_id',result.id)); end if;
  return jsonb_build_object('id',result.id,'order_number',result.order_number,'grand_total',result.grand_total,'payment_method',result.payment_method);
end $$;
revoke all on function public.customer_create_order(jsonb,jsonb,text) from public,anon,authenticated;
grant execute on function public.customer_create_order(jsonb,jsonb,text) to service_role;

create or replace function public.admin_replace_order_items(p_order_id uuid,p_items jsonb,p_items_total numeric,p_shipping_cost numeric,p_discount numeric,p_grand_total numeric)
returns void language plpgsql security definer set search_path = public as $$
begin
  if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 then raise exception 'An order must contain at least one item'; end if;
  delete from public.order_items where order_id=p_order_id;
  insert into public.order_items(id,order_id,product_id,variant_id,sellable_unit_id,sku,sellable_unit_code,name_en,name_ar,product_name_en,product_name_ar,variant_label_en,variant_label_ar,unit_label_en,unit_label_ar,units_per_sold_package_num,units_per_sold_package_den,base_quantity_per_unit_num,base_quantity_per_unit_den,equivalent_base_quantity_num,equivalent_base_quantity_den,price,line_total,quantity,image)
  select coalesce(i.id,gen_random_uuid()),p_order_id,i.product_id,i.variant_id,i.sellable_unit_id,i.sku,i.sellable_unit_code,i.name_en,i.name_ar,coalesce(i.product_name_en,i.name_en),coalesce(i.product_name_ar,i.name_ar),i.variant_label_en,i.variant_label_ar,i.unit_label_en,i.unit_label_ar,i.units_per_sold_package_num,i.units_per_sold_package_den,i.base_quantity_per_unit_num,i.base_quantity_per_unit_den,i.equivalent_base_quantity_num,i.equivalent_base_quantity_den,i.price,round(i.price*i.quantity,2),i.quantity,i.image
  from jsonb_to_recordset(p_items) as i(id uuid,product_id uuid,variant_id uuid,sellable_unit_id uuid,sku text,sellable_unit_code text,name_en text,name_ar text,product_name_en text,product_name_ar text,variant_label_en text,variant_label_ar text,unit_label_en text,unit_label_ar text,units_per_sold_package_num numeric,units_per_sold_package_den numeric,base_quantity_per_unit_num numeric,base_quantity_per_unit_den numeric,equivalent_base_quantity_num numeric,equivalent_base_quantity_den numeric,price numeric,quantity int,image text);
  update public.orders set items_total=p_items_total,shipping_cost=p_shipping_cost,discount=p_discount,grand_total=p_grand_total where id=p_order_id;
  if not found then raise exception 'Order not found'; end if;
end $$;
revoke all on function public.admin_replace_order_items(uuid,jsonb,numeric,numeric,numeric,numeric) from public,anon,authenticated;
grant execute on function public.admin_replace_order_items(uuid,jsonb,numeric,numeric,numeric,numeric) to service_role;

-- Canonical Feature 003b section, ordered after the Feature 003 base schema.
-- Feature 003 follow-up: generic Variant packaging and Sellable Unit identity.
-- Additive and safe to apply after 003_catalog_variants_media.sql.

create or replace function public.catalog_gcd_numeric(a numeric, b numeric)
returns numeric language plpgsql immutable strict set search_path = public as $$
declare left_value numeric := abs(a); right_value numeric := abs(b); remainder numeric;
begin
  while right_value <> 0 loop
    remainder := mod(left_value, right_value);
    left_value := right_value;
    right_value := remainder;
  end loop;
  return greatest(left_value, 1);
end $$;

create table if not exists public.variant_packaging_units (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references public.product_variants(id) on delete restrict,
  parent_unit_id uuid,
  code text check (code is null or length(btrim(code)) between 1 and 80),
  barcode text check (barcode is null or length(btrim(barcode)) between 1 and 120),
  label_en text not null check (length(btrim(label_en)) between 1 and 120),
  label_ar text not null check (length(btrim(label_ar)) between 1 and 120),
  quantity_per_parent_num numeric not null default 1 check (quantity_per_parent_num > 0 and quantity_per_parent_num=trunc(quantity_per_parent_num)),
  quantity_per_parent_den numeric not null default 1 check (quantity_per_parent_den > 0 and quantity_per_parent_den=trunc(quantity_per_parent_den)),
  base_quantity_num numeric not null default 1 check (base_quantity_num > 0 and base_quantity_num=trunc(base_quantity_num)),
  base_quantity_den numeric not null default 1 check (base_quantity_den > 0 and base_quantity_den=trunc(base_quantity_den)),
  is_base_unit boolean not null default false,
  is_sellable boolean not null default false,
  is_default_sale_unit boolean not null default false,
  default_price_mode text not null default 'derived' check (default_price_mode in ('explicit','derived')),
  is_active boolean not null default true,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, variant_id),
  constraint variant_packaging_units_parent_same_variant
    foreign key (parent_unit_id, variant_id)
    references public.variant_packaging_units(id, variant_id)
    on delete restrict deferrable initially deferred,
  check (parent_unit_id is null or parent_unit_id <> id),
  check (not is_default_sale_unit or is_sellable)
);

create unique index if not exists variant_packaging_units_code_permanent_idx
  on public.variant_packaging_units(lower(btrim(code))) where code is not null;
create unique index if not exists variant_packaging_units_active_base_idx
  on public.variant_packaging_units(variant_id) where is_base_unit and is_active and archived_at is null;
create unique index if not exists variant_packaging_units_active_default_idx
  on public.variant_packaging_units(variant_id) where is_default_sale_unit and is_active and archived_at is null;
create index if not exists variant_packaging_units_variant_idx
  on public.variant_packaging_units(variant_id, is_active, is_sellable);
create index if not exists variant_packaging_units_parent_idx
  on public.variant_packaging_units(parent_unit_id) where parent_unit_id is not null;
alter table public.variant_packaging_units enable row level security;

alter table public.order_items add column if not exists sellable_unit_id uuid references public.variant_packaging_units(id) on delete set null;
alter table public.order_items add column if not exists sellable_unit_code text;
alter table public.order_items add column if not exists unit_label_en text;
alter table public.order_items add column if not exists unit_label_ar text;
alter table public.order_items add column if not exists units_per_sold_package_num numeric;
alter table public.order_items add column if not exists units_per_sold_package_den numeric;
alter table public.order_items add column if not exists base_quantity_per_unit_num numeric;
alter table public.order_items add column if not exists base_quantity_per_unit_den numeric;
alter table public.order_items add column if not exists equivalent_base_quantity_num numeric;
alter table public.order_items add column if not exists equivalent_base_quantity_den numeric;
alter table public.order_items add column if not exists line_total numeric(12,2);
create index if not exists order_items_sellable_unit_idx on public.order_items(sellable_unit_id);

create or replace function public.catalog_insert_default_packaging_unit()
returns trigger language plpgsql set search_path = public as $$
begin
  insert into public.variant_packaging_units(
    variant_id,parent_unit_id,label_en,label_ar,quantity_per_parent_num,quantity_per_parent_den,
    base_quantity_num,base_quantity_den,is_base_unit,is_sellable,is_default_sale_unit,
    default_price_mode,is_active,archived_at
  ) values (
    new.id,null,coalesce(nullif(btrim(new.label_en),''),'Unit'),coalesce(nullif(btrim(new.label_ar),''),'وحدة'),
    1,1,1,1,true,true,true,'explicit',new.is_active,
    case when new.is_active then null else now() end
  );
  return new;
end $$;

drop trigger if exists variants_create_default_packaging_unit on public.product_variants;
create trigger variants_create_default_packaging_unit
  after insert on public.product_variants
  for each row execute function public.catalog_insert_default_packaging_unit();

insert into public.variant_packaging_units(
  variant_id,parent_unit_id,label_en,label_ar,quantity_per_parent_num,quantity_per_parent_den,
  base_quantity_num,base_quantity_den,is_base_unit,is_sellable,is_default_sale_unit,
  default_price_mode,is_active,archived_at
)
select v.id,null,coalesce(nullif(btrim(v.label_en),''),'Unit'),coalesce(nullif(btrim(v.label_ar),''),'وحدة'),
  1,1,1,1,true,true,true,'explicit',v.is_active,
  case when v.is_active then null else coalesce(v.archived_at,now()) end
from public.product_variants v
where not exists (select 1 from public.variant_packaging_units u where u.variant_id=v.id);

create or replace function public.catalog_assert_packaging_graph(p_variant_id uuid)
returns void language plpgsql set search_path = public as $$
declare active_variant boolean; active_count integer; reached_count integer;
begin
  select is_active and archived_at is null into active_variant from public.product_variants where id=p_variant_id;
  if not coalesce(active_variant,false) then return; end if;

  select count(*) into active_count from public.variant_packaging_units
    where variant_id=p_variant_id and is_active and archived_at is null;
  if active_count=0 then raise exception 'Active Variant requires packaging units' using errcode='23514'; end if;
  if (select count(*) from public.variant_packaging_units where variant_id=p_variant_id and is_active and archived_at is null and is_base_unit)<>1
    then raise exception 'Packaging hierarchy requires exactly one base unit' using errcode='23514'; end if;
  if (select count(*) from public.variant_packaging_units where variant_id=p_variant_id and is_active and archived_at is null and is_sellable)<1
    then raise exception 'Packaging hierarchy requires a sellable unit' using errcode='23514'; end if;
  if (select count(*) from public.variant_packaging_units where variant_id=p_variant_id and is_active and archived_at is null and is_default_sale_unit and is_sellable)<>1
    then raise exception 'Packaging hierarchy requires exactly one default sellable unit' using errcode='23514'; end if;
  if (select count(*) from public.variant_packaging_units where variant_id=p_variant_id and is_active and archived_at is null and parent_unit_id is null)<>1
    then raise exception 'Packaging hierarchy requires exactly one root' using errcode='23514'; end if;
  if exists (
    select parent_unit_id from public.variant_packaging_units
    where variant_id=p_variant_id and is_active and archived_at is null and parent_unit_id is not null
    group by parent_unit_id having count(*)>1
  ) then raise exception 'Packaging hierarchy has an ambiguous conversion path' using errcode='23514'; end if;
  if exists (
    select 1 from public.variant_packaging_units child
    left join public.variant_packaging_units parent on parent.id=child.parent_unit_id and parent.variant_id=child.variant_id and parent.is_active and parent.archived_at is null
    where child.variant_id=p_variant_id and child.is_active and child.archived_at is null and child.parent_unit_id is not null and parent.id is null
  ) then raise exception 'Packaging hierarchy is disconnected' using errcode='23514'; end if;
  if exists (
    select 1 from public.variant_packaging_units
    where variant_id=p_variant_id and is_active and archived_at is null and parent_unit_id is null
      and (quantity_per_parent_num<>1 or quantity_per_parent_den<>1)
  ) then raise exception 'Root packaging conversion must be one-to-one' using errcode='23514'; end if;

  with recursive path(id,parent_unit_id,base_n,base_d,visited) as (
    select id,parent_unit_id,1::numeric,1::numeric,array[id]
    from public.variant_packaging_units
    where variant_id=p_variant_id and is_active and archived_at is null and is_base_unit
    union all
    select parent.id,parent.parent_unit_id,
      (path.base_n*child.quantity_per_parent_num)/public.catalog_gcd_numeric(path.base_n*child.quantity_per_parent_num,path.base_d*child.quantity_per_parent_den),
      (path.base_d*child.quantity_per_parent_den)/public.catalog_gcd_numeric(path.base_n*child.quantity_per_parent_num,path.base_d*child.quantity_per_parent_den),
      path.visited||parent.id
    from path
    join public.variant_packaging_units child on child.id=path.id
    join public.variant_packaging_units parent on parent.id=child.parent_unit_id and parent.variant_id=p_variant_id and parent.is_active and parent.archived_at is null
    where not parent.id=any(path.visited)
  )
  select count(*) into reached_count from path;
  if reached_count<>active_count then raise exception 'Packaging hierarchy is circular, disconnected, or ambiguous' using errcode='23514'; end if;
  if exists (
    with recursive path(id,parent_unit_id,base_n,base_d,visited) as (
      select id,parent_unit_id,1::numeric,1::numeric,array[id] from public.variant_packaging_units
      where variant_id=p_variant_id and is_active and archived_at is null and is_base_unit
      union all
      select parent.id,parent.parent_unit_id,
        (path.base_n*child.quantity_per_parent_num)/public.catalog_gcd_numeric(path.base_n*child.quantity_per_parent_num,path.base_d*child.quantity_per_parent_den),
        (path.base_d*child.quantity_per_parent_den)/public.catalog_gcd_numeric(path.base_n*child.quantity_per_parent_num,path.base_d*child.quantity_per_parent_den),
        path.visited||parent.id
      from path join public.variant_packaging_units child on child.id=path.id
      join public.variant_packaging_units parent on parent.id=child.parent_unit_id and parent.variant_id=p_variant_id and parent.is_active and parent.archived_at is null
      where not parent.id=any(path.visited)
    )
    select 1 from path join public.variant_packaging_units unit using(id)
    where unit.base_quantity_num<>path.base_n or unit.base_quantity_den<>path.base_d
  ) then raise exception 'Packaging base equivalent is inconsistent' using errcode='23514'; end if;
end $$;

create or replace function public.catalog_assert_packaging_trigger()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_table_name='product_variants' then
    perform public.catalog_assert_packaging_graph(case when tg_op='DELETE' then old.id else new.id end);
    if tg_op='DELETE' then return old; end if;
    return new;
  end if;
  if tg_op='DELETE' then perform public.catalog_assert_packaging_graph(old.variant_id); return old; end if;
  perform public.catalog_assert_packaging_graph(new.variant_id);
  if tg_op='UPDATE' and old.variant_id<>new.variant_id then perform public.catalog_assert_packaging_graph(old.variant_id); end if;
  return new;
end $$;

drop trigger if exists packaging_units_validate_graph on public.variant_packaging_units;
create constraint trigger packaging_units_validate_graph
  after insert or update or delete on public.variant_packaging_units
  deferrable initially deferred for each row execute function public.catalog_assert_packaging_trigger();
drop trigger if exists variants_validate_packaging_graph on public.product_variants;
create constraint trigger variants_validate_packaging_graph
  after update of is_active,archived_at on public.product_variants
  deferrable initially deferred for each row execute function public.catalog_assert_packaging_trigger();

create or replace function public.catalog_replace_packaging_units(p_variant_id uuid,p_units jsonb,p_actor_id uuid default null)
returns jsonb language plpgsql security definer set search_path = public,pg_temp as $$
declare unit jsonb; changed integer;
begin
  if jsonb_typeof(p_units) is distinct from 'array' or jsonb_array_length(p_units)=0 then
    raise exception 'Packaging hierarchy must be a non-empty array' using errcode='22023';
  end if;
  if not exists(select 1 from public.product_variants where id=p_variant_id for update) then raise exception 'Variant not found'; end if;
  drop table if exists pg_temp.catalog_packaging_input;
  create temporary table catalog_packaging_input(
    id uuid primary key,parent_unit_id uuid,code text,barcode text,label_en text not null,label_ar text not null,
    quantity_num numeric not null,quantity_den numeric not null,base_num numeric,base_den numeric,
    is_base boolean not null,is_sellable boolean not null,is_default boolean not null,price_mode text not null
  ) on commit drop;
  for unit in select * from jsonb_array_elements(p_units) loop
    insert into catalog_packaging_input values(
      (unit->>'id')::uuid,nullif(unit->>'parent_unit_id','')::uuid,nullif(upper(btrim(unit->>'code')),''),nullif(btrim(unit->>'barcode'),''),
      btrim(unit->>'label_en'),btrim(unit->>'label_ar'),
      (unit#>>'{quantity_per_parent,numerator}')::numeric,(unit#>>'{quantity_per_parent,denominator}')::numeric,null,null,
      coalesce((unit->>'is_base_unit')::boolean,false),coalesce((unit->>'is_sellable')::boolean,false),
      coalesce((unit->>'is_default_sale_unit')::boolean,false),coalesce(unit->>'default_price_mode','derived')
    );
  end loop;
  if exists(select 1 from catalog_packaging_input where quantity_num<=0 or quantity_den<=0 or quantity_num<>trunc(quantity_num) or quantity_den<>trunc(quantity_den))
    then raise exception 'Packaging conversion must use positive exact integers' using errcode='22023'; end if;
  update catalog_packaging_input set
    quantity_num=quantity_num/public.catalog_gcd_numeric(quantity_num,quantity_den),
    quantity_den=quantity_den/public.catalog_gcd_numeric(quantity_num,quantity_den);
  if exists(select 1 from catalog_packaging_input where length(label_en) not between 1 and 120 or length(label_ar) not between 1 and 120 or price_mode not in ('explicit','derived') or parent_unit_id=id)
    then raise exception 'Invalid packaging unit' using errcode='22023'; end if;
  if (select count(*) from catalog_packaging_input where parent_unit_id is null)<>1
    or (select count(*) from catalog_packaging_input where is_base)<>1
    or (select count(*) from catalog_packaging_input where is_default and is_sellable)<>1
    or exists(select 1 from catalog_packaging_input where is_default and not is_sellable)
    then raise exception 'Packaging requires one root, base, and default sellable unit' using errcode='23514'; end if;
  if exists(select 1 from catalog_packaging_input child left join catalog_packaging_input parent on parent.id=child.parent_unit_id where child.parent_unit_id is not null and parent.id is null)
    or exists(select 1 from catalog_packaging_input group by parent_unit_id having parent_unit_id is not null and count(*)>1)
    then raise exception 'Packaging hierarchy is disconnected or ambiguous' using errcode='23514'; end if;
  if exists(select 1 from catalog_packaging_input where parent_unit_id is null and (quantity_num<>1 or quantity_den<>1))
    then raise exception 'Root packaging conversion must be one-to-one' using errcode='23514'; end if;

  update catalog_packaging_input set base_num=1,base_den=1 where is_base;
  loop
    update catalog_packaging_input parent set
      base_num=(child.base_num*child.quantity_num)/public.catalog_gcd_numeric(child.base_num*child.quantity_num,child.base_den*child.quantity_den),
      base_den=(child.base_den*child.quantity_den)/public.catalog_gcd_numeric(child.base_num*child.quantity_num,child.base_den*child.quantity_den)
    from catalog_packaging_input child
    where child.parent_unit_id=parent.id and child.base_num is not null and parent.base_num is null;
    get diagnostics changed=row_count;
    exit when changed=0;
  end loop;
  if exists(select 1 from catalog_packaging_input where base_num is null) then
    raise exception 'Packaging hierarchy is circular, disconnected, or ambiguous' using errcode='23514';
  end if;

  if exists(
    select 1 from public.variant_packaging_units existing join catalog_packaging_input proposed on proposed.id=existing.id
    where existing.variant_id=p_variant_id and exists(select 1 from public.order_items oi where oi.sellable_unit_id=existing.id)
      and (existing.parent_unit_id is distinct from proposed.parent_unit_id
        or existing.quantity_per_parent_num<>proposed.quantity_num or existing.quantity_per_parent_den<>proposed.quantity_den
        or existing.is_base_unit<>proposed.is_base)
  ) then raise exception 'Referenced packaging identity requires archive and replacement' using errcode='23514'; end if;

  update public.variant_packaging_units set is_active=false,archived_at=coalesce(archived_at,now()),is_base_unit=false,is_default_sale_unit=false,updated_at=now()
    where variant_id=p_variant_id and is_active and archived_at is null;
  insert into public.variant_packaging_units(
    id,variant_id,parent_unit_id,code,barcode,label_en,label_ar,quantity_per_parent_num,quantity_per_parent_den,
    base_quantity_num,base_quantity_den,is_base_unit,is_sellable,is_default_sale_unit,default_price_mode,is_active,archived_at,updated_at
  ) select id,p_variant_id,parent_unit_id,code,barcode,label_en,label_ar,quantity_num,quantity_den,base_num,base_den,
    is_base,is_sellable,is_default,price_mode,true,null,now() from catalog_packaging_input
  on conflict(id) do update set parent_unit_id=excluded.parent_unit_id,code=excluded.code,barcode=excluded.barcode,
    label_en=excluded.label_en,label_ar=excluded.label_ar,quantity_per_parent_num=excluded.quantity_per_parent_num,
    quantity_per_parent_den=excluded.quantity_per_parent_den,base_quantity_num=excluded.base_quantity_num,
    base_quantity_den=excluded.base_quantity_den,is_base_unit=excluded.is_base_unit,is_sellable=excluded.is_sellable,
    is_default_sale_unit=excluded.is_default_sale_unit,default_price_mode=excluded.default_price_mode,is_active=true,archived_at=null,updated_at=now();
  perform public.catalog_assert_packaging_graph(p_variant_id);
  insert into public.catalog_audit_events(actor_id,action,target_type,target_id,new_state)
    values(p_actor_id,'variant.packaging.replaced','variant',p_variant_id,p_units);
  return (select jsonb_agg(to_jsonb(u) order by u.base_quantity_num desc) from public.variant_packaging_units u where u.variant_id=p_variant_id and u.is_active and u.archived_at is null);
end $$;

create or replace function public.catalog_archive_packaging_unit(p_unit_id uuid,p_actor_id uuid default null)
returns void language plpgsql security definer set search_path = public as $$
declare before_state jsonb; owning_variant uuid;
begin
  select to_jsonb(u),u.variant_id into before_state,owning_variant from public.variant_packaging_units u where id=p_unit_id for update;
  if before_state is null then raise exception 'Packaging unit not found'; end if;
  update public.variant_packaging_units set is_active=false,archived_at=coalesce(archived_at,now()),is_base_unit=false,is_default_sale_unit=false,updated_at=now() where id=p_unit_id;
  perform public.catalog_assert_packaging_graph(owning_variant);
  insert into public.catalog_audit_events(actor_id,action,target_type,target_id,previous_state,new_state)
    values(p_actor_id,'packaging_unit.archived','packaging_unit',p_unit_id,before_state,jsonb_build_object('is_active',false));
end $$;

drop policy if exists variant_packaging_units_public_read_active on public.variant_packaging_units;
create policy variant_packaging_units_public_read_active on public.variant_packaging_units for select to anon,authenticated using (
  is_active and archived_at is null and exists(
    select 1 from public.product_variants v join public.products p on p.id=v.product_id
    where v.id=variant_packaging_units.variant_id and v.is_active and v.archived_at is null and p.is_active and p.archived_at is null
  )
);
revoke all on public.variant_packaging_units from anon,authenticated;
grant select on public.variant_packaging_units to anon,authenticated;
grant all on public.variant_packaging_units to service_role;
revoke all on function public.catalog_replace_packaging_units(uuid,jsonb,uuid),public.catalog_archive_packaging_unit(uuid,uuid) from public,anon,authenticated;
grant execute on function public.catalog_replace_packaging_units(uuid,jsonb,uuid),public.catalog_archive_packaging_unit(uuid,uuid) to service_role;

create or replace function public.customer_create_order(p_order jsonb,p_items jsonb,p_grant_hash text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare result public.orders; c public.customers;
begin
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items)=0 then raise exception 'Empty order' using errcode='22023'; end if;
  if p_order->>'customer_id' is not null then
    select * into strict c from public.customers where id=(p_order->>'customer_id')::uuid for share;
    if c.auth_user_id is null or c.auth_user_id is distinct from (p_order->>'user_id')::uuid
      or length(trim(coalesce(c.full_name,'')))<2 or coalesce(c.phone,'') !~ '^01[0125][0-9]{8}$' then raise exception 'Invalid customer association' using errcode='22023'; end if;
    if p_grant_hash is not null then raise exception 'Unexpected guest grant'; end if;
  elsif p_order->>'user_id' is not null or p_grant_hash is null or p_grant_hash !~ '^[a-f0-9]{64}$' then raise exception 'Invalid guest grant' using errcode='22023'; end if;
  if exists(
    select 1 from jsonb_to_recordset(p_items) as i(variant_id uuid,sellable_unit_id uuid,quantity int)
    left join public.product_variants v on v.id=i.variant_id
    left join public.variant_packaging_units u on u.id=i.sellable_unit_id and u.variant_id=v.id
    left join public.products p on p.id=v.product_id
    where i.quantity<=0 or v.id is null or not v.is_active or v.archived_at is not null or not p.is_active or p.archived_at is not null
      or u.id is null or not u.is_active or u.archived_at is not null or not u.is_sellable
  ) then raise exception 'Inactive or invalid catalog Variant/Sellable Unit' using errcode='22023'; end if;

  insert into public.orders(order_number,user_id,customer_id,customer_name,customer_phone,alt_phone,governorate,city,address,notes,items_total,shipping_cost,discount,discount_code,grand_total,payment_method)
  values(p_order->>'order_number',(p_order->>'user_id')::uuid,c.id,p_order->>'customer_name',p_order->>'customer_phone',p_order->>'alt_phone',p_order->>'governorate',p_order->>'city',p_order->>'address',p_order->>'notes',(p_order->>'items_total')::numeric,(p_order->>'shipping_cost')::numeric,(p_order->>'discount')::numeric,p_order->>'discount_code',(p_order->>'grand_total')::numeric,p_order->>'payment_method') returning * into result;

  insert into public.order_items(order_id,product_id,variant_id,sellable_unit_id,sku,sellable_unit_code,name_en,name_ar,product_name_en,product_name_ar,variant_label_en,variant_label_ar,unit_label_en,unit_label_ar,units_per_sold_package_num,units_per_sold_package_den,base_quantity_per_unit_num,base_quantity_per_unit_den,equivalent_base_quantity_num,equivalent_base_quantity_den,price,line_total,quantity,image)
  select result.id,p.id,v.id,u.id,v.sku,u.code,p.name_en,p.name_ar,p.name_en,p.name_ar,v.label_en,v.label_ar,u.label_en,u.label_ar,
    u.quantity_per_parent_num,u.quantity_per_parent_den,u.base_quantity_num,u.base_quantity_den,
    u.base_quantity_num*i.quantity,u.base_quantity_den,i.price,round(i.price*i.quantity,2),i.quantity,i.image
  from jsonb_to_recordset(p_items) as i(variant_id uuid,sellable_unit_id uuid,price numeric,quantity int,image text)
  join public.product_variants v on v.id=i.variant_id join public.variant_packaging_units u on u.id=i.sellable_unit_id and u.variant_id=v.id join public.products p on p.id=v.product_id;
  if c.id is null then insert into public.order_confirmation_grants(order_id,secret_hash,expires_at) values(result.id,p_grant_hash,now()+interval '30 days');
  else insert into public.customer_audit(customer_id,actor_id,action,details) values(c.id,c.auth_user_id,'order.associated',jsonb_build_object('order_id',result.id)); end if;
  return jsonb_build_object('id',result.id,'order_number',result.order_number,'grand_total',result.grand_total,'payment_method',result.payment_method);
end $$;
revoke all on function public.customer_create_order(jsonb,jsonb,text) from public,anon,authenticated;
grant execute on function public.customer_create_order(jsonb,jsonb,text) to service_role;


create or replace function public.admin_replace_order_items(
  p_order_id uuid,p_items jsonb,p_items_total numeric,p_shipping_cost numeric,p_discount numeric,p_grand_total numeric
)
returns void language plpgsql security definer set search_path = public as $$
begin
  if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 then raise exception 'An order must contain at least one item'; end if;
  delete from public.order_items where order_id=p_order_id;
  insert into public.order_items(
    id,order_id,product_id,variant_id,sellable_unit_id,sku,sellable_unit_code,name_en,name_ar,product_name_en,product_name_ar,
    variant_label_en,variant_label_ar,unit_label_en,unit_label_ar,units_per_sold_package_num,units_per_sold_package_den,
    base_quantity_per_unit_num,base_quantity_per_unit_den,equivalent_base_quantity_num,equivalent_base_quantity_den,
    price,line_total,quantity,image
  )
  select coalesce(i.id,gen_random_uuid()),p_order_id,i.product_id,i.variant_id,i.sellable_unit_id,i.sku,i.sellable_unit_code,
    i.name_en,i.name_ar,coalesce(i.product_name_en,i.name_en),coalesce(i.product_name_ar,i.name_ar),i.variant_label_en,i.variant_label_ar,
    i.unit_label_en,i.unit_label_ar,i.units_per_sold_package_num,i.units_per_sold_package_den,i.base_quantity_per_unit_num,
    i.base_quantity_per_unit_den,i.equivalent_base_quantity_num,i.equivalent_base_quantity_den,i.price,round(i.price*i.quantity,2),i.quantity,i.image
  from jsonb_to_recordset(p_items) as i(
    id uuid,product_id uuid,variant_id uuid,sellable_unit_id uuid,sku text,sellable_unit_code text,name_en text,name_ar text,
    product_name_en text,product_name_ar text,variant_label_en text,variant_label_ar text,unit_label_en text,unit_label_ar text,
    units_per_sold_package_num numeric,units_per_sold_package_den numeric,base_quantity_per_unit_num numeric,base_quantity_per_unit_den numeric,
    equivalent_base_quantity_num numeric,equivalent_base_quantity_den numeric,price numeric,quantity int,image text
  );
  update public.orders set items_total=p_items_total,shipping_cost=p_shipping_cost,discount=p_discount,grand_total=p_grand_total where id=p_order_id;
  if not found then raise exception 'Order not found'; end if;
end $$;
revoke all on function public.admin_replace_order_items(uuid,jsonb,numeric,numeric,numeric,numeric) from public,anon,authenticated;
grant execute on function public.admin_replace_order_items(uuid,jsonb,numeric,numeric,numeric,numeric) to service_role;

notify pgrst, 'reload schema';

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

create or replace function public.pricing_resolve_targets(
  p_customer_id uuid,
  p_targets jsonb,
  p_at timestamptz default null
)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  effective_at timestamptz := coalesce(p_at, transaction_timestamp());
  resolved jsonb;
begin
  if jsonb_typeof(p_targets) is distinct from 'array' or jsonb_array_length(p_targets) > 100 then
    raise exception using errcode = '22023', message = 'PRICING_TARGET_INVALID';
  end if;
  if p_customer_id is not null and not exists (select 1 from public.customers where id = p_customer_id) then
    raise exception using errcode = 'P0002', message = 'CUSTOMER_NOT_FOUND';
  end if;

  with recursive raw_requested as (
    select
      (entry.value->>'variantId')::uuid as variant_id,
      (entry.value->>'sellableUnitId')::uuid as sellable_unit_id,
      entry.ordinality::int as ordinality
    from jsonb_array_elements(p_targets) with ordinality as entry(value, ordinality)
  ), requested as (
    select variant_id, sellable_unit_id, min(ordinality) as ordinality
    from raw_requested
    group by variant_id, sellable_unit_id
  ), customer_context as (
    select customer_type_id, direct_price_list_id
    from public.customers
    where id = p_customer_id
  ), catalog as (
    select
      requested.ordinality,
      requested.variant_id,
      requested.sellable_unit_id,
      selected.base_quantity_num as target_base_num,
      selected.base_quantity_den as target_base_den
    from requested
    join public.product_variants variant
      on variant.id = requested.variant_id and variant.is_active and variant.archived_at is null
    join public.products product
      on product.id = variant.product_id and product.is_active and product.archived_at is null
    join public.variant_packaging_units selected
      on selected.id = requested.sellable_unit_id and selected.variant_id = requested.variant_id
      and selected.is_active and selected.archived_at is null and selected.is_sellable
  ), unit_path as (
    select
      catalog.ordinality,
      catalog.variant_id,
      catalog.sellable_unit_id,
      unit.id as candidate_unit_id,
      unit.parent_unit_id,
      0 as depth,
      catalog.target_base_num,
      catalog.target_base_den,
      unit.base_quantity_num as source_base_num,
      unit.base_quantity_den as source_base_den
    from catalog
    join public.variant_packaging_units unit on unit.id = catalog.sellable_unit_id
    union all
    select
      unit_path.ordinality,
      unit_path.variant_id,
      unit_path.sellable_unit_id,
      parent.id,
      parent.parent_unit_id,
      unit_path.depth + 1,
      unit_path.target_base_num,
      unit_path.target_base_den,
      parent.base_quantity_num,
      parent.base_quantity_den
    from unit_path
    join public.variant_packaging_units parent
      on parent.id = unit_path.parent_unit_id and parent.variant_id = unit_path.variant_id
      and parent.is_active and parent.archived_at is null
  ), source_lists as (
    select 'direct_price_list'::text as source, context.direct_price_list_id as price_list_id, 2 as priority
    from customer_context context
    where context.direct_price_list_id is not null
    union all
    select 'customer_type_price_list', mapping.price_list_id, 3
    from customer_context context
    join public.customer_type_price_list_mappings mapping
      on mapping.customer_type_id = context.customer_type_id
      and mapping.is_active and mapping.archived_at is null
    union all
    select 'default_price_list', configuration.default_price_list_id, 4
    from public.pricing_configuration configuration
    where configuration.singleton
  ), override_candidates as (
    select
      path.ordinality,
      path.variant_id,
      path.sellable_unit_id,
      'customer_override'::text as source,
      1 as priority,
      override.id as reference_id,
      null::uuid as price_list_id,
      override.amount_minor,
      override.currency,
      path.candidate_unit_id as source_unit_id,
      path.depth,
      path.target_base_num,
      path.target_base_den,
      path.source_base_num,
      path.source_base_den
    from unit_path path
    join public.customer_unit_price_overrides override
      on override.customer_id = p_customer_id
      and override.variant_id = path.variant_id
      and override.sellable_unit_id = path.candidate_unit_id
      and override.is_active and override.archived_at is null
      and coalesce(override.valid_from, '-infinity'::timestamptz) <= effective_at
      and coalesce(override.valid_until, 'infinity'::timestamptz) > effective_at
  ), list_candidates as (
    select
      path.ordinality,
      path.variant_id,
      path.sellable_unit_id,
      source.source,
      source.priority,
      item.id as reference_id,
      source.price_list_id,
      item.amount_minor,
      item.currency,
      path.candidate_unit_id as source_unit_id,
      path.depth,
      path.target_base_num,
      path.target_base_den,
      path.source_base_num,
      path.source_base_den
    from unit_path path
    join source_lists source on true
    join public.price_lists list
      on list.id = source.price_list_id and list.is_active and list.archived_at is null
    join public.price_list_items item
      on item.price_list_id = source.price_list_id
      and item.variant_id = path.variant_id
      and item.sellable_unit_id = path.candidate_unit_id
      and item.is_active and item.archived_at is null
      and coalesce(item.valid_from, '-infinity'::timestamptz) <= effective_at
      and coalesce(item.valid_until, 'infinity'::timestamptz) > effective_at
  ), candidates as (
    select * from override_candidates
    union all
    select * from list_candidates
  ), ranked as (
    select candidates.*,
      row_number() over (partition by variant_id, sellable_unit_id order by priority, depth, reference_id) as candidate_rank
    from candidates
  ), selected as (
    select
      requested.ordinality,
      requested.variant_id,
      requested.sellable_unit_id,
      catalog.variant_id is not null as target_available,
      ranked.source,
      ranked.reference_id,
      ranked.price_list_id,
      ranked.currency,
      ranked.source_unit_id,
      ranked.depth,
      case when ranked.reference_id is null then null else
        round(
          ranked.amount_minor::numeric * ranked.target_base_num * ranked.source_base_den
          / (ranked.target_base_den * ranked.source_base_num)
        )::bigint
      end as amount_minor
    from requested
    left join catalog using (variant_id, sellable_unit_id, ordinality)
    left join ranked
      on ranked.variant_id = requested.variant_id
      and ranked.sellable_unit_id = requested.sellable_unit_id
      and ranked.candidate_rank = 1
  )
  select coalesce(jsonb_agg(
    case when selected.amount_minor is null then
      jsonb_build_object(
        'variantId', selected.variant_id,
        'sellableUnitId', selected.sellable_unit_id,
        'availability', 'unavailable',
        'reason', case when selected.target_available then 'no_price' else 'target_unavailable' end,
        'effectiveAt', effective_at
      )
    else
      jsonb_build_object(
        'variantId', selected.variant_id,
        'sellableUnitId', selected.sellable_unit_id,
        'availability', 'priced',
        'amountMinor', selected.amount_minor::text,
        'currency', selected.currency,
        'source', selected.source,
        'resolutionKind', case when selected.depth = 0 then 'explicit' else 'derived' end,
        'priceListId', selected.price_list_id,
        'priceListItemId', case when selected.source = 'customer_override' then null else selected.reference_id end,
        'overrideId', case when selected.source = 'customer_override' then selected.reference_id else null end,
        'derivedFromUnitId', case when selected.depth = 0 then null else selected.source_unit_id end,
        'effectiveAt', effective_at
      )
    end
    order by selected.ordinality
  ), '[]'::jsonb) into resolved
  from selected;

  return resolved;
exception
  when invalid_text_representation or numeric_value_out_of_range or division_by_zero then
    raise exception using errcode = '22023', message = 'PRICING_TARGET_INVALID';
end
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
revoke all on function public.pricing_resolve_targets(uuid,jsonb,timestamptz) from public, anon, authenticated;
revoke all on function public.pricing_set_default(uuid,uuid,bigint,text,uuid) from public, anon, authenticated;
revoke all on function public.pricing_set_customer_type_mapping(uuid,uuid,uuid,text,uuid) from public, anon, authenticated;
revoke all on function public.pricing_assign_customer_list(uuid,uuid,uuid,text,uuid) from public, anon, authenticated;
revoke all on function public.pricing_bulk_upsert_items(uuid,uuid,jsonb,uuid) from public, anon, authenticated;
revoke all on function public.pricing_upsert_customer_override(uuid,uuid,jsonb,uuid) from public, anon, authenticated;
revoke all on function public.pricing_create_order(jsonb,jsonb,text) from public, anon, authenticated;
grant execute on function public.pricing_assert_admin(uuid) to service_role;
grant execute on function public.pricing_current_time() to service_role;
grant execute on function public.pricing_resolve_targets(uuid,jsonb,timestamptz) to service_role;
grant execute on function public.pricing_set_default(uuid,uuid,bigint,text,uuid) to service_role;
grant execute on function public.pricing_set_customer_type_mapping(uuid,uuid,uuid,text,uuid) to service_role;
grant execute on function public.pricing_assign_customer_list(uuid,uuid,uuid,text,uuid) to service_role;
grant execute on function public.pricing_bulk_upsert_items(uuid,uuid,jsonb,uuid) to service_role;
grant execute on function public.pricing_upsert_customer_override(uuid,uuid,jsonb,uuid) to service_role;
grant execute on function public.pricing_create_order(jsonb,jsonb,text) to service_role;

notify pgrst, 'reload schema';

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
