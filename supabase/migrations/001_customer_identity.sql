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
create policy "product_images_admin_write" on storage.objects for all to authenticated
  using (bucket_id = 'product-images' and exists (select 1 from public.profiles where id = auth.uid() and is_admin))
  with check (bucket_id = 'product-images' and exists (select 1 from public.profiles where id = auth.uid() and is_admin));
