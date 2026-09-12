create extension if not exists "pgcrypto";

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
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.customer_types where code = 'retail' limit 1
$$;

alter table public.customers
  add column if not exists customer_type_id uuid references public.customer_types(id) on delete restrict;

update public.customers
set customer_type_id = public.default_customer_type_id()
where customer_type_id is null;

alter table public.customers
  alter column customer_type_id set default public.default_customer_type_id();
alter table public.customers
  alter column customer_type_id set not null;

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

create index if not exists customer_types_active_sort_idx
  on public.customer_types(is_active, sort_order, code);
create index if not exists customers_customer_type_idx
  on public.customers(customer_type_id);
create index if not exists customer_type_requests_customer_history_idx
  on public.customer_type_requests(customer_id, submitted_at desc);
create index if not exists customer_type_requests_queue_idx
  on public.customer_type_requests(status, submitted_at asc);
create index if not exists customer_type_requests_requested_type_idx
  on public.customer_type_requests(requested_type_id, status);
create unique index if not exists customer_type_requests_one_pending_per_customer_idx
  on public.customer_type_requests(customer_id)
  where status = 'pending';
create index if not exists customer_type_audit_customer_idx
  on public.customer_type_audit_events(customer_id, occurred_at desc);
create index if not exists customer_type_audit_request_idx
  on public.customer_type_audit_events(request_id, occurred_at desc);

create or replace function public.customer_type_touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists customer_types_touch on public.customer_types;
create trigger customer_types_touch
before update on public.customer_types
for each row execute function public.customer_type_touch_updated_at();

drop trigger if exists customer_type_requests_touch on public.customer_type_requests;
create trigger customer_type_requests_touch
before update on public.customer_type_requests
for each row execute function public.customer_type_touch_updated_at();

create or replace function public.create_customer_type_request(
  p_customer_id uuid,
  p_requested_type_code text,
  p_business_name text,
  p_business_phone text,
  p_governorate text,
  p_city text,
  p_business_description text,
  p_customer_note text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer public.customers%rowtype;
  v_type public.customer_types%rowtype;
  v_request public.customer_type_requests%rowtype;
begin
  select * into v_customer
  from public.customers
  where id = p_customer_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'CUSTOMER_NOT_FOUND';
  end if;

  select * into v_type
  from public.customer_types
  where code = p_requested_type_code;
  if not found then
    raise exception using errcode = '22023', message = 'TYPE_NOT_FOUND';
  end if;
  if not v_type.is_active then
    raise exception using errcode = '22023', message = 'TYPE_INACTIVE';
  end if;
  if not v_type.requires_approval then
    raise exception using errcode = '22023', message = 'TYPE_NOT_PROTECTED';
  end if;
  if v_customer.customer_type_id = v_type.id then
    raise exception using errcode = '23505', message = 'TYPE_ALREADY_EFFECTIVE';
  end if;
  if char_length(btrim(coalesce(p_business_name, ''))) not between 2 and 160 then
    raise exception using errcode = '22023', message = 'INVALID_BUSINESS_NAME';
  end if;
  if exists (
    select 1 from public.customer_type_requests
    where customer_id = p_customer_id and status = 'pending'
  ) then
    raise exception using errcode = '23505', message = 'PENDING_REQUEST_EXISTS';
  end if;

  insert into public.customer_type_requests (
    customer_id,
    requested_type_id,
    business_name,
    business_phone,
    governorate,
    city,
    business_description,
    customer_note
  ) values (
    p_customer_id,
    v_type.id,
    btrim(p_business_name),
    nullif(btrim(p_business_phone), ''),
    nullif(btrim(p_governorate), ''),
    nullif(btrim(p_city), ''),
    nullif(btrim(p_business_description), ''),
    nullif(btrim(p_customer_note), '')
  )
  returning * into v_request;

  insert into public.customer_type_audit_events (
    customer_id,
    request_id,
    action,
    previous_type_id,
    new_type_id,
    actor_user_id
  ) values (
    v_customer.id,
    v_request.id,
    'requested',
    v_customer.customer_type_id,
    v_customer.customer_type_id,
    v_customer.auth_user_id
  );

  return jsonb_build_object(
    'request_id', v_request.id,
    'customer_id', v_customer.id,
    'status', v_request.status,
    'effective_type_id', v_customer.customer_type_id,
    'requested_type_id', v_type.id
  );
exception
  when unique_violation then
    raise exception using errcode = '23505', message = 'PENDING_REQUEST_EXISTS';
end;
$$;

create or replace function public.approve_customer_type_request(
  p_request_id uuid,
  p_admin_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.customer_type_requests%rowtype;
  v_customer public.customers%rowtype;
  v_type public.customer_types%rowtype;
begin
  if not exists (
    select 1 from public.profiles where id = p_admin_user_id and is_admin
  ) then
    raise exception using errcode = '42501', message = 'ADMIN_UNAUTHORIZED';
  end if;

  select * into v_request
  from public.customer_type_requests
  where id = p_request_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'REQUEST_NOT_FOUND';
  end if;
  if v_request.status <> 'pending' then
    raise exception using errcode = '40001', message = 'REQUEST_NOT_PENDING';
  end if;

  select * into v_type
  from public.customer_types
  where id = v_request.requested_type_id;
  if not found or not v_type.is_active or not v_type.requires_approval then
    raise exception using errcode = '22023', message = 'TYPE_INACTIVE';
  end if;

  select * into v_customer
  from public.customers
  where id = v_request.customer_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'CUSTOMER_NOT_FOUND';
  end if;

  update public.customer_type_requests
  set status = 'approved',
      decided_at = now(),
      decided_by = p_admin_user_id,
      rejection_reason_public = null,
      internal_admin_note = null
  where id = v_request.id and status = 'pending';
  if not found then
    raise exception using errcode = '40001', message = 'REQUEST_NOT_PENDING';
  end if;

  update public.customers
  set customer_type_id = v_type.id,
      updated_at = now()
  where id = v_customer.id;

  insert into public.customer_type_audit_events (
    customer_id, request_id, action, previous_type_id, new_type_id, actor_user_id
  ) values (
    v_customer.id, v_request.id, 'approved', v_customer.customer_type_id, v_type.id, p_admin_user_id
  );

  return jsonb_build_object(
    'request_id', v_request.id,
    'customer_id', v_customer.id,
    'status', 'approved',
    'effective_type_id', v_type.id,
    'previous_type_id', v_customer.customer_type_id
  );
end;
$$;

create or replace function public.reject_customer_type_request(
  p_request_id uuid,
  p_admin_user_id uuid,
  p_public_reason text,
  p_internal_note text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request public.customer_type_requests%rowtype;
  v_customer public.customers%rowtype;
begin
  if not exists (
    select 1 from public.profiles where id = p_admin_user_id and is_admin
  ) then
    raise exception using errcode = '42501', message = 'ADMIN_UNAUTHORIZED';
  end if;

  select * into v_request
  from public.customer_type_requests
  where id = p_request_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'REQUEST_NOT_FOUND';
  end if;
  if v_request.status <> 'pending' then
    raise exception using errcode = '40001', message = 'REQUEST_NOT_PENDING';
  end if;

  select * into v_customer
  from public.customers
  where id = v_request.customer_id
  for update;

  update public.customer_type_requests
  set status = 'rejected',
      decided_at = now(),
      decided_by = p_admin_user_id,
      rejection_reason_public = nullif(btrim(p_public_reason), ''),
      internal_admin_note = nullif(btrim(p_internal_note), '')
  where id = v_request.id and status = 'pending';
  if not found then
    raise exception using errcode = '40001', message = 'REQUEST_NOT_PENDING';
  end if;

  insert into public.customer_type_audit_events (
    customer_id,
    request_id,
    action,
    previous_type_id,
    new_type_id,
    actor_user_id,
    reason_public,
    internal_note
  ) values (
    v_customer.id,
    v_request.id,
    'rejected',
    v_customer.customer_type_id,
    v_customer.customer_type_id,
    p_admin_user_id,
    nullif(btrim(p_public_reason), ''),
    nullif(btrim(p_internal_note), '')
  );

  return jsonb_build_object(
    'request_id', v_request.id,
    'customer_id', v_customer.id,
    'status', 'rejected',
    'effective_type_id', v_customer.customer_type_id
  );
end;
$$;

create or replace function public.assign_customer_type(
  p_customer_id uuid,
  p_target_type_code text,
  p_admin_user_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer public.customers%rowtype;
  v_type public.customer_types%rowtype;
  v_pending public.customer_type_requests%rowtype;
begin
  if not exists (
    select 1 from public.profiles where id = p_admin_user_id and is_admin
  ) then
    raise exception using errcode = '42501', message = 'ADMIN_UNAUTHORIZED';
  end if;

  select * into v_customer
  from public.customers
  where id = p_customer_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'CUSTOMER_NOT_FOUND';
  end if;

  select * into v_type
  from public.customer_types
  where code = p_target_type_code;
  if not found then
    raise exception using errcode = '22023', message = 'TYPE_NOT_FOUND';
  end if;
  if not v_type.is_active then
    raise exception using errcode = '22023', message = 'TYPE_INACTIVE';
  end if;
  if v_type.id = v_customer.customer_type_id then
    raise exception using errcode = '23505', message = 'TYPE_ALREADY_EFFECTIVE';
  end if;

  select * into v_pending
  from public.customer_type_requests
  where customer_id = v_customer.id and status = 'pending'
  for update;

  if found then
    update public.customer_type_requests
    set status = 'superseded',
        superseded_at = now(),
        superseded_by = p_admin_user_id,
        internal_admin_note = nullif(btrim(p_reason), '')
    where id = v_pending.id and status = 'pending';
    if not found then
      raise exception using errcode = '40001', message = 'REQUEST_NOT_PENDING';
    end if;

    insert into public.customer_type_audit_events (
      customer_id, request_id, action, previous_type_id, new_type_id, actor_user_id, internal_note
    ) values (
      v_customer.id,
      v_pending.id,
      'superseded',
      v_customer.customer_type_id,
      v_type.id,
      p_admin_user_id,
      nullif(btrim(p_reason), '')
    );
  end if;

  update public.customers
  set customer_type_id = v_type.id,
      updated_at = now()
  where id = v_customer.id;

  insert into public.customer_type_audit_events (
    customer_id, request_id, action, previous_type_id, new_type_id, actor_user_id, internal_note
  ) values (
    v_customer.id,
    case when v_pending.id is null then null else v_pending.id end,
    'assigned',
    v_customer.customer_type_id,
    v_type.id,
    p_admin_user_id,
    nullif(btrim(p_reason), '')
  );

  return jsonb_build_object(
    'customer_id', v_customer.id,
    'status', 'assigned',
    'effective_type_id', v_type.id,
    'previous_type_id', v_customer.customer_type_id,
    'superseded_request_id', v_pending.id
  );
end;
$$;

alter table public.customer_types enable row level security;
alter table public.customer_type_requests enable row level security;
alter table public.customer_type_audit_events enable row level security;

drop policy if exists "customer_types_active_read" on public.customer_types;
create policy "customer_types_active_read" on public.customer_types
for select using (is_active = true);

drop policy if exists "customer_type_requests_self_read" on public.customer_type_requests;
create policy "customer_type_requests_self_read" on public.customer_type_requests
for select to authenticated using (
  customer_id in (
    select id from public.customers where auth_user_id = auth.uid()
  )
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
