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
