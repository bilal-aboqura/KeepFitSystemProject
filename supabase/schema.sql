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
