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
