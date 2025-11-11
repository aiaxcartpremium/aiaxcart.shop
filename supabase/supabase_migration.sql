
-- =============================================================
-- Aiaxcart Premium Shop — Full Supabase Schema & Policies
-- Safe to run on a fresh project. Re-run friendly (uses IF NOT EXISTS).
-- =============================================================

-- 1) ENUMS
create type if not exists order_status as enum ('pending','awaiting_payment','paid','processing','delivered','cancelled','refunded');
create type if not exists payment_status as enum ('unpaid','paid','failed');
create type if not exists report_type as enum ('bug','payment-proof','concern','other');

-- 2) CORE TABLES
create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,
  label text not null
);

create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,               -- e.g. 'netflix'
  name text not null,                     -- e.g. 'Netflix Premium'
  category_key text not null references categories(key) on delete cascade,
  icon text default '📦',
  active boolean default true,
  created_at timestamptz default now()
);

create table if not exists account_types (
  id uuid primary key default gen_random_uuid(),
  product_key text not null references products(key) on delete cascade,
  label text not null,                    -- e.g. 'solo account','shared profile'
  sort_order int default 0,
  unique(product_key, label)
);

create table if not exists durations (
  id uuid primary key default gen_random_uuid(),
  product_key text not null references products(key) on delete cascade,
  code text not null,                     -- e.g. '7d','1m','3m','12m'
  days int not null,                      -- normalized days for expiry calc
  sort_order int default 0,
  unique(product_key, code)
);

create table if not exists pricing (
  id uuid primary key default gen_random_uuid(),
  product_key text not null references products(key) on delete cascade,
  account_type text not null,             -- must match account_types.label
  duration_code text not null,            -- must match durations.code
  price numeric(12,2) not null check(price >= 0),
  unique(product_key, account_type, duration_code)
);

-- Owner-managed onhand stock that will be auto-dropped on delivery
create table if not exists onhand_accounts (
  id uuid primary key default gen_random_uuid(),
  product_key text not null references products(key) on delete cascade,
  account_type text not null,
  duration_code text not null,
  creds jsonb not null,                   -- {email, password, profile?, pin?}
  notes text,
  is_assigned boolean default false,
  assigned_order_id uuid,
  created_at timestamptz default now()
);

-- Rules shown on product detail + in auto-drop receipt
create table if not exists product_rules (
  id uuid primary key default gen_random_uuid(),
  product_key text not null references products(key) on delete cascade,
  rules_md text not null,                 -- markdown/text rules
  updated_at timestamptz default now()
);

-- Buyers (mirrors auth.users but safe to expose)
create table if not exists buyers (
  id uuid primary key default gen_random_uuid(),
  auth_uid uuid unique,                   -- optional, for Supabase Auth
  email text,
  display_name text,
  created_at timestamptz default now()
);

-- Orders
create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid references buyers(id) on delete set null,
  product_key text not null references products(key) on delete cascade,
  account_type text not null,
  duration_code text not null,
  price numeric(12,2) not null,
  status order_status default 'pending',
  payment_status payment_status default 'unpaid',
  payment_confirmed_at timestamptz,
  paid_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz default now()
);

-- Delivery details (what was dropped to buyer)
create table if not exists deliveries (
  id uuid primary key default gen_random_uuid(),
  order_id uuid unique references orders(id) on delete cascade,
  product_key text not null,
  creds jsonb not null,                   -- delivered credentials
  expires_at timestamptz not null,
  created_at timestamptz default now()
);

-- Feedback (store date & time)
create table if not exists feedback (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id) on delete set null,
  buyer_id uuid references buyers(id) on delete set null,
  message text not null,
  rating int check(rating between 1 and 5),
  created_at timestamptz default now()
);

-- Reports (with image uploads)
create table if not exists reports (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid references buyers(id) on delete set null,
  type report_type default 'other',
  title text,
  message text,
  image_path text,                        -- storage path in bucket
  created_at timestamptz default now()
);

-- Admin allow-list
create table if not exists admin_uids (
  uid uuid primary key,                   -- auth.user id
  email text unique
);

-- Telegram Config (server-side only)
create table if not exists tg_config (
  id int primary key default 1,
  bot_token text,
  chat_id text,
  enabled boolean default false,
  updated_at timestamptz default now()
);

-- 3) VIEWS (derived counts)
create or replace view v_product_stock as
select
  p.key as product_key,
  coalesce(sum(case when not o.is_assigned then 1 else 0 end), 0) as stock_available,
  coalesce(sum(case when o.is_assigned then 1 else 0 end), 0) as stock_assigned
from products p
left join onhand_accounts o on o.product_key = p.key
group by 1;

create or replace view v_product_sold as
select product_key, count(*)::int as sold_count
from orders
where status in ('delivered','refunded') -- delivered are counted sold
group by 1;

-- 4) TRIGGERS

-- Keep product_rules.updated_at fresh
create or replace function trg_touch_product_rules() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end; $$;
drop trigger if exists t_touch_rules on product_rules;
create trigger t_touch_rules before update on product_rules
for each row execute procedure trg_touch_product_rules();

-- When order is marked 'paid', assign one onhand account automatically and deliver.
create or replace function fulfill_paid_order() returns trigger language plpgsql as $$
declare
  picked onhand_accounts%rowtype;
  dur_days int;
begin
  if new.payment_status = 'paid' and new.status in ('pending','awaiting_payment') then
    -- pick an available onhand account matching product/type/duration
    select * into picked from onhand_accounts
     where product_key = new.product_key
       and account_type = new.account_type
       and duration_code = new.duration_code
       and is_assigned = false
     order by created_at asc
     limit 1;

    if not found then
      -- mark as processing and bail out (owner must add stock)
      new.status := 'processing';
      return new;
    end if;

    -- mark the stock as assigned
    update onhand_accounts
      set is_assigned = true, assigned_order_id = new.id
      where id = picked.id;

    -- compute expiry
    select d.days into dur_days
    from durations d
    where d.product_key = new.product_key and d.code = new.duration_code;

    if dur_days is null then
      dur_days := 30;
    end if;

    insert into deliveries(order_id, product_key, creds, expires_at)
    values (new.id, new.product_key, picked.creds, now() + make_interval(days => dur_days));

    new.status := 'delivered';
    new.delivered_at := now();
  end if;

  return new;
end;
$$;

drop trigger if exists t_fulfill_paid on orders;
create trigger t_fulfill_paid
after update on orders
for each row
when (old.payment_status is distinct from new.payment_status)
execute procedure fulfill_paid_order();

-- 5) STORAGE
-- Create storage bucket for reports (if not present, run via dashboard once):
--   Name: reports  Public: false
-- Then add policies via dashboard to allow authenticated users to upload/read their own files.

-- 6) RLS (Enable & Policies)
alter table categories enable row level security;
alter table products enable row level security;
alter table account_types enable row level security;
alter table durations enable row level security;
alter table pricing enable row level security;
alter table onhand_accounts enable row level security;
alter table product_rules enable row level security;
alter table buyers enable row level security;
alter table orders enable row level security;
alter table deliveries enable row level security;
alter table feedback enable row level security;
alter table reports enable row level security;
alter table admin_uids enable row level security;
alter table tg_config enable row level security;

-- Public readable catalog
create policy if not exists "catalog read"
on categories for select
to anon, authenticated
using (true);

create policy if not exists "products read"
on products for select
to anon, authenticated
using (active is true);

create policy if not exists "account_types read"
on account_types for select
to anon, authenticated
using (true);

create policy if not exists "durations read"
on durations for select
to anon, authenticated
using (true);

create policy if not exists "pricing read"
on pricing for select
to anon, authenticated
using (true);

create policy if not exists "product_rules read"
on product_rules for select
to anon, authenticated
using (true);

-- Buyers can read their own record. Create via RPC or signup flow.
create policy if not exists "buyers self read"
on buyers for select
to authenticated
using (auth.uid() = auth_uid);

create policy if not exists "buyers self insert"
on buyers for insert
to authenticated
with check (auth.uid() = auth_uid);

-- Orders CRUD: buyer can see/create their own
create policy if not exists "orders self select"
on orders for select
to authenticated
using (exists(select 1 from buyers b where b.id = orders.buyer_id and b.auth_uid = auth.uid()));

create policy if not exists "orders self insert"
on orders for insert
to authenticated
with check (exists(select 1 from buyers b where b.id = orders.buyer_id and b.auth_uid = auth.uid()));

-- Allow admins full access (based on admin_uids)
create policy if not exists "admin all products"
on products for all
to authenticated
using (exists(select 1 from admin_uids a where a.uid = auth.uid()))
with check (exists(select 1 from admin_uids a where a.uid = auth.uid()));

create policy if not exists "admin all generic"
on account_types for all
to authenticated
using (exists(select 1 from admin_uids a where a.uid = auth.uid()))
with check (exists(select 1 from admin_uids a where a.uid = auth.uid()));

create policy if not exists "admin all durations"
on durations for all
to authenticated
using (exists(select 1 from admin_uids a where a.uid = auth.uid()))
with check (exists(select 1 from admin_uids a where a.uid = auth.uid()));

create policy if not exists "admin all pricing"
on pricing for all
to authenticated
using (exists(select 1 from admin_uids a where a.uid = auth.uid()))
with check (exists(select 1 from admin_uids a where a.uid = auth.uid()));

create policy if not exists "admin onhand manage"
on onhand_accounts for all
to authenticated
using (exists(select 1 from admin_uids a where a.uid = auth.uid()))
with check (exists(select 1 from admin_uids a where a.uid = auth.uid()));

create policy if not exists "admin orders manage"
on orders for all
to authenticated
using (exists(select 1 from admin_uids a where a.uid = auth.uid()))
with check (exists(select 1 from admin_uids a where a.uid = auth.uid()));

create policy if not exists "admin deliveries read"
on deliveries for select
to authenticated
using (exists(select 1 from admin_uids a where a.uid = auth.uid()));

create policy if not exists "admin rules manage"
on product_rules for all
to authenticated
using (exists(select 1 from admin_uids a where a.uid = auth.uid()))
with check (exists(select 1 from admin_uids a where a.uid = auth.uid()));

create policy if not exists "admin tg config"
on tg_config for select, update
to authenticated
using (exists(select 1 from admin_uids a where a.uid = auth.uid()))
with check (exists(select 1 from admin_uids a where a.uid = auth.uid()));

-- Feedback and Reports: user can create, admins can read all
create policy if not exists "feedback insert self"
on feedback for insert
to authenticated
with check (coalesce(buyer_id in (select id from buyers where auth_uid = auth.uid()), true));

create policy if not exists "feedback read own or admin"
on feedback for select
to authenticated
using (
  coalesce(buyer_id in (select id from buyers where auth_uid = auth.uid()), false)
  or exists(select 1 from admin_uids a where a.uid = auth.uid())
);

create policy if not exists "reports insert self"
on reports for insert
to authenticated
with check (coalesce(buyer_id in (select id from buyers where auth_uid = auth.uid()), true));

create policy if not exists "reports read own or admin"
on reports for select
to authenticated
using (
  coalesce(buyer_id in (select id from buyers where auth_uid = auth.uid()), false)
  or exists(select 1 from admin_uids a where a.uid = auth.uid())
);

-- 7) RPCs

-- Confirm payment (sets paid and triggers auto-fulfillment)
create or replace function rpc_confirm_payment(p_order_id uuid) returns void
language plpgsql security definer as $$
begin
  update orders
    set payment_status = 'paid',
        paid_at = now(),
        status = 'paid'
  where id = p_order_id;
end;
$$;

-- Insert or upsert buyer by auth.uid()
create or replace function rpc_upsert_buyer() returns buyers
language plpgsql security definer as $$
declare
  v buyers;
begin
  insert into buyers (auth_uid, created_at)
  values (auth.uid(), now())
  on conflict (auth_uid) do update set created_at = buyers.created_at
  returning * into v;
  return v;
end; $$;
