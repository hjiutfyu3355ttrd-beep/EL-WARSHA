-- نظام الورشة: المخطط الأساسي + عزل كل ورشة (RLS) + صلاحيات الأدمن.
-- ✅ اتطبّق على مشروع الورشة (blspjpghimjpyczxkvvs) بتاريخ 2026-10-16 باسم init_workshop_schema.
-- ما تطبّقوش تاني على نفس المشروع. أي تعديل جديد = ملف migration جديد.

-- ============ الجداول الأساسية ============

create table public.shops (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid references auth.users (id) on delete set null,
  status text not null default 'trial' check (status in ('trial', 'active', 'suspended')),
  trial_ends_at timestamptz default (now() + interval '7 days'),
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  created_at timestamptz not null default now()
);

create table public.shop_members (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'staff' check (role in ('owner', 'staff', 'technician')),
  created_at timestamptz not null default now(),
  unique (shop_id, user_id)
);

create table public.platform_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- ============ دوال مساعدة (SECURITY DEFINER) ============

-- ورشة المستخدم الحالي (ورشة واحدة لكل مستخدم حالياً)
create or replace function public.current_shop_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select shop_id from public.shop_members where user_id = (select auth.uid()) limit 1
$$;

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.platform_admins where user_id = (select auth.uid()))
$$;

-- الورش الموقوفة تقرأ فقط ولا تكتب
create or replace function public.shop_writable(sid uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.shops where id = sid and status <> 'suspended')
$$;

-- ============ جداول الورشة (كلها فيها shop_id بقيمة افتراضية من current_shop_id) ============

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null default public.current_shop_id() references public.shops (id) on delete cascade,
  name text not null,
  phone text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now()
);

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null default public.current_shop_id() references public.shops (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  plate text not null,
  make text not null default '',
  model text not null default '',
  year integer,
  odometer integer,
  created_at timestamptz not null default now()
);

create table public.technicians (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null default public.current_shop_id() references public.shops (id) on delete cascade,
  name text not null,
  commission_pct numeric(5, 2) not null default 0,
  created_at timestamptz not null default now()
);

create table public.parts (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null default public.current_shop_id() references public.shops (id) on delete cascade,
  name text not null,
  sku text not null default '',
  qty numeric(12, 2) not null default 0,
  min_qty numeric(12, 2) not null default 0,
  cost numeric(12, 2) not null default 0,
  price numeric(12, 2) not null default 0,
  created_at timestamptz not null default now()
);

create table public.work_orders (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null default public.current_shop_id() references public.shops (id) on delete cascade,
  number integer not null default 0,
  customer_id uuid not null references public.customers (id) on delete restrict,
  vehicle_id uuid not null references public.vehicles (id) on delete restrict,
  technician_id uuid references public.technicians (id) on delete set null,
  status text not null default 'received'
    check (status in ('received', 'inspecting', 'awaiting_approval', 'in_progress', 'ready', 'delivered', 'cancelled')),
  complaint text not null default '',
  created_at timestamptz not null default now(),
  unique (shop_id, number)
);

create table public.work_order_lines (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null default public.current_shop_id() references public.shops (id) on delete cascade,
  work_order_id uuid not null references public.work_orders (id) on delete cascade,
  kind text not null check (kind in ('part', 'labor')),
  description text not null,
  qty numeric(12, 2) not null check (qty > 0),
  unit_price numeric(12, 2) not null check (unit_price >= 0),
  part_id uuid references public.parts (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null default public.current_shop_id() references public.shops (id) on delete cascade,
  work_order_id uuid not null references public.work_orders (id) on delete cascade,
  amount numeric(12, 2) not null check (amount > 0),
  method text not null default 'cash' check (method in ('cash', 'card', 'instapay', 'wallet', 'transfer')),
  created_at timestamptz not null default now()
);

-- ترقيم أوامر الشغل لكل ورشة (بيبدأ من 1001) مع قفل لمنع التكرار
create or replace function public.set_work_order_number()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.shop_id::text, 0));
  select coalesce(max(number), 1000) + 1 into new.number
  from public.work_orders where shop_id = new.shop_id;
  return new;
end
$$;

create trigger work_orders_set_number
  before insert on public.work_orders
  for each row execute function public.set_work_order_number();

-- ============ فهارس ============

create index customers_shop_idx on public.customers (shop_id);
create index vehicles_shop_idx on public.vehicles (shop_id);
create index vehicles_customer_idx on public.vehicles (customer_id);
create index technicians_shop_idx on public.technicians (shop_id);
create index parts_shop_idx on public.parts (shop_id);
create index work_orders_shop_idx on public.work_orders (shop_id);
create index work_orders_customer_idx on public.work_orders (customer_id);
create index work_orders_vehicle_idx on public.work_orders (vehicle_id);
create index work_orders_technician_idx on public.work_orders (technician_id);
create index work_order_lines_shop_idx on public.work_order_lines (shop_id);
create index work_order_lines_order_idx on public.work_order_lines (work_order_id);
create index work_order_lines_part_idx on public.work_order_lines (part_id);
create index payments_shop_idx on public.payments (shop_id);
create index payments_order_idx on public.payments (work_order_id);
create index shop_members_user_idx on public.shop_members (user_id);
create index shops_owner_idx on public.shops (owner_id);

-- ============ تسجيل مستخدم جديد: بروفايل + ورشة + عضوية مالك ============
-- ملاحظة: لما نضيف دعوة موظفين لاحقاً لازم نفرّق بين "مالك جديد" و"موظف مدعو" هنا.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_shop uuid;
begin
  insert into public.profiles (id, email) values (new.id, new.email);

  insert into public.shops (name, owner_id)
  values (coalesce(nullif(trim(new.raw_user_meta_data ->> 'shop_name'), ''), 'ورشتي'), new.id)
  returning id into v_shop;

  insert into public.shop_members (shop_id, user_id, role) values (v_shop, new.id, 'owner');
  return new;
end
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============ دوال الأدمن (بتتأكد من الصلاحية جوه الداتابيز) ============

create or replace function public.admin_list_shops()
returns table (
  id uuid,
  name text,
  owner_email text,
  status text,
  trial_ends_at timestamptz,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  return query
    select s.id, s.name, p.email, s.status, s.trial_ends_at, s.created_at
    from public.shops s
    left join public.profiles p on p.id = s.owner_id
    order by s.created_at desc;
end
$$;

create or replace function public.admin_update_shop(
  p_id uuid,
  p_status text,
  p_trial_ends_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if p_status not in ('trial', 'active', 'suspended') then
    raise exception 'invalid status' using errcode = '22023';
  end if;
  update public.shops set status = p_status, trial_ends_at = p_trial_ends_at where id = p_id;
end
$$;

-- ============ RLS ============

alter table public.shops enable row level security;
alter table public.profiles enable row level security;
alter table public.shop_members enable row level security;
alter table public.platform_admins enable row level security; -- من غير policies = مفيش وصول مباشر من العميل

create policy shops_select on public.shops
  for select to authenticated using (id = (select public.current_shop_id()));

create policy profiles_select on public.profiles
  for select to authenticated using (id = (select auth.uid()));

create policy shop_members_select on public.shop_members
  for select to authenticated using (shop_id = (select public.current_shop_id()));

do $$
declare
  t text;
begin
  foreach t in array array['customers', 'vehicles', 'technicians', 'parts', 'work_orders', 'work_order_lines', 'payments']
  loop
    execute format('alter table public.%I enable row level security', t);

    execute format(
      'create policy %I on public.%I for select to authenticated using (shop_id = (select public.current_shop_id()))',
      t || '_select', t);

    execute format(
      'create policy %I on public.%I for insert to authenticated with check (shop_id = (select public.current_shop_id()) and public.shop_writable(shop_id))',
      t || '_insert', t);

    execute format(
      'create policy %I on public.%I for update to authenticated using (shop_id = (select public.current_shop_id()) and public.shop_writable(shop_id)) with check (shop_id = (select public.current_shop_id()))',
      t || '_update', t);

    execute format(
      'create policy %I on public.%I for delete to authenticated using (shop_id = (select public.current_shop_id()) and public.shop_writable(shop_id))',
      t || '_delete', t);
  end loop;
end
$$;

-- ============ الصلاحيات ============

revoke all on all tables in schema public from anon;

revoke execute on function
  public.current_shop_id(),
  public.is_platform_admin(),
  public.shop_writable(uuid),
  public.admin_list_shops(),
  public.admin_update_shop(uuid, text, timestamptz)
from public, anon;

grant execute on function
  public.current_shop_id(),
  public.is_platform_admin(),
  public.shop_writable(uuid),
  public.admin_list_shops(),
  public.admin_update_shop(uuid, text, timestamptz)
to authenticated;
