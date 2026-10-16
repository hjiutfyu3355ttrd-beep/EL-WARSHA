-- وحدات إضافية مستوحاة من Garage Master (عروض أسعار، موردين، فحص، مصروفات)
-- غير مطبّق على Postgres إلا بعد موافقة المستخدم.

create table if not exists public.quotations (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null default public.current_shop_id() references public.shops (id) on delete cascade,
  number integer not null,
  customer_id uuid not null references public.customers (id) on delete restrict,
  vehicle_id uuid references public.vehicles (id) on delete set null,
  status text not null default 'draft' check (status in ('draft', 'sent', 'accepted', 'rejected', 'converted')),
  notes text not null default '',
  total numeric(12, 2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.quotation_lines (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null default public.current_shop_id() references public.shops (id) on delete cascade,
  quotation_id uuid not null references public.quotations (id) on delete cascade,
  kind text not null default 'labor' check (kind in ('part', 'labor')),
  description text not null,
  qty numeric(10, 2) not null default 1,
  unit_price numeric(12, 2) not null default 0,
  part_id uuid references public.parts (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null default public.current_shop_id() references public.shops (id) on delete cascade,
  name text not null,
  company text not null default '',
  phone text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.observation_points (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null default public.current_shop_id() references public.shops (id) on delete cascade,
  category text not null default 'أخرى',
  name text not null,
  default_charge numeric(12, 2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null default public.current_shop_id() references public.shops (id) on delete cascade,
  label text not null,
  amount numeric(12, 2) not null default 0,
  notes text not null default '',
  created_at timestamptz not null default now()
);

-- RLS (نفس نمط باقي الجداول)
alter table public.quotations enable row level security;
alter table public.quotation_lines enable row level security;
alter table public.suppliers enable row level security;
alter table public.observation_points enable row level security;
alter table public.expenses enable row level security;

create policy quotations_shop on public.quotations
  for all using (shop_id = public.current_shop_id())
  with check (shop_id = public.current_shop_id() and public.shop_writable(shop_id));

create policy quotation_lines_shop on public.quotation_lines
  for all using (shop_id = public.current_shop_id())
  with check (shop_id = public.current_shop_id() and public.shop_writable(shop_id));

create policy suppliers_shop on public.suppliers
  for all using (shop_id = public.current_shop_id())
  with check (shop_id = public.current_shop_id() and public.shop_writable(shop_id));

create policy observation_points_shop on public.observation_points
  for all using (shop_id = public.current_shop_id())
  with check (shop_id = public.current_shop_id() and public.shop_writable(shop_id));

create policy expenses_shop on public.expenses
  for all using (shop_id = public.current_shop_id())
  with check (shop_id = public.current_shop_id() and public.shop_writable(shop_id));


create table if not exists public.gate_passes (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null default public.current_shop_id() references public.shops (id) on delete cascade,
  number integer not null,
  work_order_id uuid references public.work_orders (id) on delete set null,
  vehicle_id uuid references public.vehicles (id) on delete set null,
  direction text not null check (direction in ('in', 'out')),
  notes text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.part_sales (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null default public.current_shop_id() references public.shops (id) on delete cascade,
  number integer not null,
  customer_id uuid not null references public.customers (id) on delete restrict,
  total numeric(12, 2) not null default 0,
  status text not null default 'paid',
  notes text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.part_sale_lines (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null default public.current_shop_id() references public.shops (id) on delete cascade,
  part_sale_id uuid not null references public.part_sales (id) on delete cascade,
  part_id uuid references public.parts (id) on delete set null,
  description text not null,
  qty numeric(10, 2) not null default 1,
  unit_price numeric(12, 2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.income (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null default public.current_shop_id() references public.shops (id) on delete cascade,
  label text not null,
  amount numeric(12, 2) not null default 0,
  notes text not null default '',
  source text not null default 'manual',
  ref_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.work_order_inspections (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null default public.current_shop_id() references public.shops (id) on delete cascade,
  work_order_id uuid not null references public.work_orders (id) on delete cascade,
  observation_point_id uuid not null references public.observation_points (id) on delete restrict,
  status text not null default 'pass' check (status in ('pass', 'fail', 'na')),
  notes text not null default '',
  charge numeric(12, 2) not null default 0,
  created_at timestamptz not null default now()
);

alter table public.gate_passes enable row level security;
alter table public.part_sales enable row level security;
alter table public.part_sale_lines enable row level security;
alter table public.income enable row level security;
alter table public.work_order_inspections enable row level security;

create policy gate_passes_shop on public.gate_passes for all using (shop_id = public.current_shop_id()) with check (shop_id = public.current_shop_id() and public.shop_writable(shop_id));
create policy part_sales_shop on public.part_sales for all using (shop_id = public.current_shop_id()) with check (shop_id = public.current_shop_id() and public.shop_writable(shop_id));
create policy part_sale_lines_shop on public.part_sale_lines for all using (shop_id = public.current_shop_id()) with check (shop_id = public.current_shop_id() and public.shop_writable(shop_id));
create policy income_shop on public.income for all using (shop_id = public.current_shop_id()) with check (shop_id = public.current_shop_id() and public.shop_writable(shop_id));
create policy work_order_inspections_shop on public.work_order_inspections for all using (shop_id = public.current_shop_id()) with check (shop_id = public.current_shop_id() and public.shop_writable(shop_id));

create table if not exists public.vehicle_taxes (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null default public.current_shop_id() references public.shops (id) on delete cascade,
  vehicle_id uuid not null references public.vehicles (id) on delete cascade,
  tax_type text not null,
  amount numeric(12, 2) not null default 0,
  due_date timestamptz,
  paid boolean not null default false,
  notes text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.custom_fields (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null default public.current_shop_id() references public.shops (id) on delete cascade,
  module text not null,
  label text not null,
  field_type text not null default 'text',
  options text not null default '',
  required boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.shop_profile (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null default public.current_shop_id() references public.shops (id) on delete cascade,
  name text not null default '',
  phone text not null default '',
  address text not null default '',
  logo_text text not null default '',
  business_hours text not null default '',
  created_at timestamptz not null default now()
);

alter table public.vehicle_taxes enable row level security;
alter table public.custom_fields enable row level security;
alter table public.shop_profile enable row level security;

create policy vehicle_taxes_shop on public.vehicle_taxes for all using (shop_id = public.current_shop_id()) with check (shop_id = public.current_shop_id() and public.shop_writable(shop_id));
create policy custom_fields_shop on public.custom_fields for all using (shop_id = public.current_shop_id()) with check (shop_id = public.current_shop_id() and public.shop_writable(shop_id));
create policy shop_profile_shop on public.shop_profile for all using (shop_id = public.current_shop_id()) with check (shop_id = public.current_shop_id() and public.shop_writable(shop_id));

create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null default public.current_shop_id() references public.shops (id) on delete cascade,
  number integer not null,
  supplier_id uuid references public.suppliers (id) on delete set null,
  total numeric(12, 2) not null default 0,
  status text not null default 'received',
  notes text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.purchase_lines (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null default public.current_shop_id() references public.shops (id) on delete cascade,
  purchase_id uuid not null references public.purchases (id) on delete cascade,
  part_id uuid references public.parts (id) on delete set null,
  description text not null,
  qty numeric(10, 2) not null default 1,
  unit_cost numeric(12, 2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.tax_rates (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null default public.current_shop_id() references public.shops (id) on delete cascade,
  name text not null,
  rate numeric(6, 2) not null default 0,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.email_templates (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null default public.current_shop_id() references public.shops (id) on delete cascade,
  key text not null,
  name text not null,
  subject text not null default '',
  body text not null default '',
  created_at timestamptz not null default now()
);

alter table public.purchases enable row level security;
alter table public.purchase_lines enable row level security;
alter table public.tax_rates enable row level security;
alter table public.email_templates enable row level security;

create policy purchases_shop on public.purchases for all using (shop_id = public.current_shop_id()) with check (shop_id = public.current_shop_id() and public.shop_writable(shop_id));
create policy purchase_lines_shop on public.purchase_lines for all using (shop_id = public.current_shop_id()) with check (shop_id = public.current_shop_id() and public.shop_writable(shop_id));
create policy tax_rates_shop on public.tax_rates for all using (shop_id = public.current_shop_id()) with check (shop_id = public.current_shop_id() and public.shop_writable(shop_id));
create policy email_templates_shop on public.email_templates for all using (shop_id = public.current_shop_id()) with check (shop_id = public.current_shop_id() and public.shop_writable(shop_id));
