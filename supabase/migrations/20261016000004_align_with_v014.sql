-- مطابقة قاعدة البيانات الحقيقية مع كود v0.14
-- الكود هو المرجع: أي جدول/عمود بيستخدمه الكود لازم يكون موجود بنفس الاسم.
-- التعديلات إضافية أو إعادة تسمية على جداول فاضية (vehicles فيه سطر واحد بيتنقل بياناته بالـ rename).

-- ============ 1) vehicles: أسماء الحقول اللي بتستخدمها صفحة السيارات ============
alter table public.vehicles rename column fuel_type to fuel;
alter table public.vehicles rename column engine_number to engine_no;
alter table public.vehicles rename column gearbox_number to gearbox_no;
alter table public.vehicles rename column vin to chassis_no;
alter table public.vehicles
  add column if not exists description text not null default '',
  add column if not exists images jsonb not null default '[]'::jsonb,
  add column if not exists image text;

-- ============ 2) invoices.vehicle_id (تبويب فواتير السيارة) ============
alter table public.invoices
  add column if not exists vehicle_id uuid references public.vehicles (id) on delete set null;
create index if not exists invoices_vehicle_id_idx on public.invoices (vehicle_id);
update public.invoices i set vehicle_id = w.vehicle_id
  from public.work_orders w where w.id = i.work_order_id and i.vehicle_id is null;

create or replace function public.set_invoice_vehicle()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.vehicle_id is null and new.work_order_id is not null then
    select vehicle_id into new.vehicle_id from public.work_orders where id = new.work_order_id;
  end if;
  return new;
end
$$;
drop trigger if exists invoices_set_vehicle on public.invoices;
create trigger invoices_set_vehicle before insert on public.invoices
  for each row execute function public.set_invoice_vehicle();

-- ============ 3) عروض الأسعار ============
alter table public.quotations add column if not exists total numeric(12, 2) not null default 0;
do $$
declare c record;
begin
  for c in select conname from pg_constraint
           where conrelid = 'public.quotations'::regclass and contype = 'c'
             and pg_get_constraintdef(oid) like '%status%' loop
    execute format('alter table public.quotations drop constraint %I', c.conname);
  end loop;
end $$;
alter table public.quotations add constraint quotations_status_check
  check (status in ('draft', 'sent', 'accepted', 'approved', 'rejected', 'converted'));

alter table public.quotation_lines
  add column if not exists part_id uuid references public.parts (id) on delete set null;
create index if not exists quotation_lines_part_id_idx on public.quotation_lines (part_id);

-- ============ 4) الموردين / المصروفات / المشتريات ============
alter table public.suppliers add column if not exists company text not null default '';

alter table public.expenses add column if not exists label text not null default '';
alter table public.expenses alter column description set default '';

alter table public.purchases add column if not exists status text not null default 'received';

-- ============ 5) تصاريح الخروج: kind -> direction ============
alter table public.gate_passes rename column kind to direction;

-- ============ 6) الضرائب وقوالب الإيميل ============
alter table public.tax_rates rename column rate_pct to rate;
alter table public.tax_rates add column if not exists is_default boolean not null default false;

alter table public.email_templates rename column title to name;
-- ملاحظة: الجدول فيه unique (shop_id, key) أصلاً، فمفيش فهرس إضافي مطلوب.

-- ============ 7) الحقول المخصصة: module بدل entity ============
alter table public.custom_fields add column if not exists module text not null default 'customer';
alter table public.custom_fields alter column entity drop not null;
alter table public.custom_fields alter column entity set default '';
do $$
declare c record;
begin
  for c in select conname from pg_constraint
           where conrelid = 'public.custom_fields'::regclass and contype = 'c'
             and pg_get_constraintdef(oid) like '%entity%' loop
    execute format('alter table public.custom_fields drop constraint %I', c.conname);
  end loop;
end $$;
alter table public.custom_fields add constraint custom_fields_module_check
  check (module in ('customer', 'vehicle', 'employee'));

-- ============ 8) جداول جديدة ============
create table public.observation_points (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null default public.current_shop_id() references public.shops (id) on delete cascade,
  category text not null default 'أخرى',
  name text not null,
  default_charge numeric(12, 2) not null default 0 check (default_charge >= 0),
  created_at timestamptz not null default now()
);

create table public.part_sales (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null default public.current_shop_id() references public.shops (id) on delete cascade,
  number integer not null default 0,
  customer_id uuid not null references public.customers (id) on delete restrict,
  total numeric(12, 2) not null default 0,
  status text not null default 'paid',
  notes text not null default '',
  created_at timestamptz not null default now()
);

create table public.part_sale_lines (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null default public.current_shop_id() references public.shops (id) on delete cascade,
  part_sale_id uuid not null references public.part_sales (id) on delete cascade,
  part_id uuid references public.parts (id) on delete set null,
  description text not null,
  qty numeric(10, 2) not null default 1 check (qty > 0),
  unit_price numeric(12, 2) not null default 0 check (unit_price >= 0),
  created_at timestamptz not null default now()
);

create table public.income (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null default public.current_shop_id() references public.shops (id) on delete cascade,
  label text not null,
  amount numeric(12, 2) not null default 0 check (amount >= 0),
  notes text not null default '',
  source text not null default 'manual',
  ref_id uuid,
  created_at timestamptz not null default now()
);

create table public.work_order_inspections (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null default public.current_shop_id() references public.shops (id) on delete cascade,
  work_order_id uuid not null references public.work_orders (id) on delete cascade,
  observation_point_id uuid not null references public.observation_points (id) on delete restrict,
  status text not null default 'pass' check (status in ('pass', 'fail', 'na')),
  notes text not null default '',
  charge numeric(12, 2) not null default 0 check (charge >= 0),
  created_at timestamptz not null default now()
);

create table public.vehicle_taxes (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null default public.current_shop_id() references public.shops (id) on delete cascade,
  vehicle_id uuid not null references public.vehicles (id) on delete cascade,
  tax_type text not null,
  amount numeric(12, 2) not null default 0 check (amount >= 0),
  due_date timestamptz,
  paid boolean not null default false,
  notes text not null default '',
  created_at timestamptz not null default now()
);

create table public.shop_profile (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null unique default public.current_shop_id() references public.shops (id) on delete cascade,
  name text not null default '',
  phone text not null default '',
  address text not null default '',
  logo_text text not null default '',
  business_hours text not null default '',
  created_at timestamptz not null default now()
);

-- فهارس المفاتيح الأجنبية
create index part_sales_shop_idx on public.part_sales (shop_id);
create index part_sales_customer_idx on public.part_sales (customer_id);
create index part_sale_lines_sale_idx on public.part_sale_lines (part_sale_id);
create index part_sale_lines_part_idx on public.part_sale_lines (part_id);
create index part_sale_lines_shop_idx on public.part_sale_lines (shop_id);
create index income_shop_idx on public.income (shop_id);
create index observation_points_shop_idx on public.observation_points (shop_id);
create index work_order_inspections_order_idx on public.work_order_inspections (work_order_id);
create index work_order_inspections_point_idx on public.work_order_inspections (observation_point_id);
create index work_order_inspections_shop_idx on public.work_order_inspections (shop_id);
create index vehicle_taxes_vehicle_idx on public.vehicle_taxes (vehicle_id);
create index vehicle_taxes_shop_idx on public.vehicle_taxes (shop_id);

-- ترقيم تلقائي لمبيعات القطع (يبدأ من 1001 لكل ورشة)
create trigger part_sales_set_number before insert on public.part_sales
  for each row execute function public.set_next_number();

-- ============ 9) RLS لكل الجداول الجديدة (نفس نمط باقي الجداول) ============
do $$
declare t text;
begin
  foreach t in array array['observation_points', 'part_sales', 'part_sale_lines', 'income',
                           'work_order_inspections', 'vehicle_taxes', 'shop_profile'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for select using (shop_id = (select public.current_shop_id()))',
                   t || '_select', t);
    execute format('create policy %I on public.%I for insert with check (shop_id = (select public.current_shop_id()) and public.shop_writable(shop_id))',
                   t || '_insert', t);
    execute format('create policy %I on public.%I for update using (shop_id = (select public.current_shop_id()) and public.shop_writable(shop_id)) with check (shop_id = (select public.current_shop_id()))',
                   t || '_update', t);
    execute format('create policy %I on public.%I for delete using (shop_id = (select public.current_shop_id()) and public.shop_writable(shop_id))',
                   t || '_delete', t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;

-- ============ 10) قوالب الإيميل الافتراضية لكل ورشة (مفيش شاشة إضافة، فلازم تتزرع) ============
create or replace function public.seed_shop_defaults()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.email_templates (shop_id, key, name, subject, body) values
    (new.id, 'quotation_sent', 'إرسال عرض سعر', 'عرض سعر من {{shop_name}}',
     E'عزيزي {{customer_name}}،\nمرفق عرض السعر رقم {{number}}.\nشكراً لتعاملك معنا.'),
    (new.id, 'job_ready', 'السيارة جاهزة', 'سيارتك جاهزة للاستلام',
     E'عزيزي {{customer_name}}،\nسيارتك {{plate}} جاهزة للاستلام.\nمع تحيات {{shop_name}}'),
    (new.id, 'invoice', 'فاتورة', 'فاتورة رقم {{number}}',
     E'عزيزي {{customer_name}}،\nفاتورتك بمبلغ {{total}} ج.م.\nشكراً.')
  on conflict (shop_id, key) do nothing;
  return new;
end
$$;
revoke execute on function public.seed_shop_defaults() from public, anon, authenticated;
drop trigger if exists shops_seed_defaults on public.shops;
create trigger shops_seed_defaults after insert on public.shops
  for each row execute function public.seed_shop_defaults();

-- تعبئة الورش الموجودة فعلاً
insert into public.email_templates (shop_id, key, name, subject, body)
select s.id, t.key, t.name, t.subject, t.body
from public.shops s
cross join (values
  ('quotation_sent', 'إرسال عرض سعر', 'عرض سعر من {{shop_name}}',
   E'عزيزي {{customer_name}}،\nمرفق عرض السعر رقم {{number}}.\nشكراً لتعاملك معنا.'),
  ('job_ready', 'السيارة جاهزة', 'سيارتك جاهزة للاستلام',
   E'عزيزي {{customer_name}}،\nسيارتك {{plate}} جاهزة للاستلام.\nمع تحيات {{shop_name}}'),
  ('invoice', 'فاتورة', 'فاتورة رقم {{number}}',
   E'عزيزي {{customer_name}}،\nفاتورتك بمبلغ {{total}} ج.م.\nشكراً.')
) as t(key, name, subject, body)
on conflict (shop_id, key) do nothing;
