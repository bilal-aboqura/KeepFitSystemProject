alter table public.orders add column if not exists mylerz jsonb;
alter table public.orders add column if not exists shipment_creation text;
create unique index if not exists orders_mylerz_tracking_idx
  on public.orders ((mylerz ->> 'trackingNumber'))
  where mylerz ->> 'trackingNumber' is not null;
