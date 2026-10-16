-- المرحلة 1: مطابقة هيكل البيانات لبرنامج الورشة (WPF).
-- إضافات فقط (مفيش حذف بيانات). كل جدول جديد فيه shop_id + RLS زي الجداول الأساسية.

-- ============ 1) الموردين (لازم قبل parts.supplier_id) ============
create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null default public.current_shop_id() references public.shops (id) on delete cascade,
  name text not null,
  phone text not null default '',
  email text not null default '',
  address text not null default '',
  notes text not null default '',
  balance numeric(12, 2) not null default 0,
  created_at timestamptz not null default now()
);

-- ============ 2) حقول ناقصة في الجداول الحالية ============
alter table public.work_orders
  add column delivered_at timestamptz,
  add column expected_delivery_at timestamptz,
  add column mileage_in integer,
  add column mileage_out integer,
  add column fuel_level integer check (fuel_level between 0 and 100),
  add column condition_notes text not null default '',
  add column belongings text not null default '',
  add column delivery_notes text not null default '',
  add column diagnosis text not null default '',
  add column customer_notes text not null default '',
  add column notes text not null default '',
  add column job_type text not null default 'repair',
  add column discount numeric(12, 2) not null default 0 check (discount >= 0),
  add column tax numeric(12, 2) not null default 0 check (tax >= 0);

-- حالات أكتر زي البرنامج: معتمد، بانتظار قطعة، اختبار
alter table public.work_orders drop constraint work_orders_status_check;
alter table public.work_orders add constraint work_orders_status_check check (status in (
  'received', 'inspecting', 'awaiting_approval', 'approved', 'in_progress',
  'waiting_parts', 'testing', 'ready', 'delivered', 'cancelled'));

alter table public.vehicles
  add column vin text not null default '',
  add column color text not null default '',
  add column fuel_type text not null default '',
  add column transmission text not null default '',
  add column engine_number text not null default '',
  add column gearbox_number text not null default '',
  add column notes text not null default '';

alter table public.parts
  add column category text not null default '',
  add column brand text not null default '',
  add column unit text not null default '',
  add column notes text not null default '',
  add column supplier_id uuid references public.suppliers (id) on delete set null;

-- ============ 3) المشتريات ============
create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null default public.current_shop_id() references public.shops (id) on delete cascade,
  number integer not null default 0,
  supplier_id uuid not null references public.suppliers (id) on delete restrict,
  purchased_at timestamptz not null default now(),
  total numeric(12, 2) not null default 0,
  paid numeric(12, 2) not null default 0,
  invoice_ref text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now()
);

create table public.purchase_lines (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null default public.current_shop_id() references public.shops (id) on delete cascade,
  purchase_id uuid not null references public.purchases (id) on delete cascade,
  part_id uuid references public.parts (id) on delete set null,
  description text not null,
  qty numeric(12, 2) not null check (qty > 0),
  unit_cost numeric(12, 2) not null check (unit_cost >= 0),
  created_at timestamptz not null default now()
);

-- ============ 4) المصروفات ============
create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null default public.current_shop_id() references public.shops (id) on delete cascade,
  expense_date date not null default current_date,
  category text not null default '',
  description text not null,
  amount numeric(12, 2) not null check (amount > 0),
  paid_by text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now()
);

-- ============ 5) الفواتير ============
create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null default public.current_shop_id() references public.shops (id) on delete cascade,
  number integer not null default 0,
  customer_id uuid not null references public.customers (id) on delete restrict,
  work_order_id uuid references public.work_orders (id) on delete set null,
  status text not null default 'draft' check (status in ('draft', 'issued', 'partially_paid', 'paid', 'cancelled')),
  issued_at timestamptz not null default now(),
  due_date date,
  subtotal numeric(12, 2) not null default 0,
  discount numeric(12, 2) not null default 0 check (discount >= 0),
  tax numeric(12, 2) not null default 0 check (tax >= 0),
  total numeric(12, 2) not null default 0,
  paid_amount numeric(12, 2) not null default 0,
  notes text not null default '',
  created_at timestamptz not null default now()
);

create table public.invoice_lines (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null default public.current_shop_id() references public.shops (id) on delete cascade,
  invoice_id uuid not null references public.invoices (id) on delete cascade,
  kind text not null default 'part' check (kind in ('part', 'labor')),
  description text not null,
  qty numeric(12, 2) not null check (qty > 0),
  unit_price numeric(12, 2) not null check (unit_price >= 0),
  category text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- المدفوعات تقدر تتربط بفاتورة (زي البرنامج) أو بأمر شغل
alter table public.payments add column invoice_id uuid references public.invoices (id) on delete cascade;
alter table public.payments alter column work_order_id drop not null;
alter table public.payments add constraint payments_target_check check (work_order_id is not null or invoice_id is not null);

-- ============ 6) حركة المخزون ============
create table public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null default public.current_shop_id() references public.shops (id) on delete cascade,
  part_id uuid not null references public.parts (id) on delete cascade,
  kind text not null check (kind in ('purchase', 'sale', 'adjustment', 'return')),
  qty numeric(12, 2) not null,           -- موجب = دخول، سالب = خروج
  ref_type text not null default '',
  ref_id uuid,
  note text not null default '',
  created_at timestamptz not null default now()
);

-- ============ 7) ترقيم المشتريات والفواتير لكل ورشة (من 1001) ============
create or replace function public.set_next_number()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(tg_table_name || new.shop_id::text, 0));
  execute format('select coalesce(max(number), 1000) + 1 from public.%I where shop_id = $1', tg_table_name)
    into new.number using new.shop_id;
  return new;
end
$$;
revoke execute on function public.set_next_number() from public, anon, authenticated;

create trigger purchases_set_number before insert on public.purchases
  for each row execute function public.set_next_number();
create trigger invoices_set_number before insert on public.invoices
  for each row execute function public.set_next_number();

-- ============ 8) فهارس (لكل shop_id وكل مفتاح أجنبي) ============
create index suppliers_shop_idx on public.suppliers (shop_id);
create index parts_supplier_idx on public.parts (supplier_id);
create index purchases_shop_idx on public.purchases (shop_id);
create index purchases_supplier_idx on public.purchases (supplier_id);
create index purchase_lines_shop_idx on public.purchase_lines (shop_id);
create index purchase_lines_purchase_idx on public.purchase_lines (purchase_id);
create index purchase_lines_part_idx on public.purchase_lines (part_id);
create index expenses_shop_idx on public.expenses (shop_id, expense_date);
create index invoices_shop_idx on public.invoices (shop_id);
create index invoices_customer_idx on public.invoices (customer_id);
create index invoices_work_order_idx on public.invoices (work_order_id);
create index invoice_lines_shop_idx on public.invoice_lines (shop_id);
create index invoice_lines_invoice_idx on public.invoice_lines (invoice_id);
create index payments_invoice_idx on public.payments (invoice_id);
create index stock_movements_shop_idx on public.stock_movements (shop_id);
create index stock_movements_part_idx on public.stock_movements (part_id);

-- ============ 9) RLS ============
do $$
declare
  t text;
begin
  foreach t in array array['suppliers', 'purchases', 'purchase_lines', 'expenses', 'invoices', 'invoice_lines', 'stock_movements']
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

revoke all on all tables in schema public from anon;
