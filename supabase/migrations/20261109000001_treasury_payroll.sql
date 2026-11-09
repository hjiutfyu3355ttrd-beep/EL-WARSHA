-- v0.19.0: الخزنة + المرتبات.
-- الخزنة مفيهاش رصيد مخزّن: بتتحسب دايماً من الجداول الموجودة (مفيش إدخال مزدوج):
--   داخل  = payments + income + treasury_entries(deposit)
--   خارج  = expenses (والمشتريات بتتسجّل فيها) + salary_payments + treasury_entries(withdraw)

-- حركات يدوية على الخزنة (رصيد افتتاحي / إيداع / سحب)
create table if not exists public.treasury_entries (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null default public.current_shop_id() references public.shops(id) on delete cascade,
  kind text not null check (kind in ('deposit','withdraw')),
  amount numeric(14,2) not null check (amount > 0),
  note text not null default '',
  entry_date date not null default current_date,
  created_at timestamptz not null default now()
);

-- العمال والمرتب الثابت (أسبوعي/شهري)
create table if not exists public.employees (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null default public.current_shop_id() references public.shops(id) on delete cascade,
  name text not null check (char_length(btrim(name)) > 0),
  role text not null default '',
  phone text not null default '',
  salary_amount numeric(14,2) not null check (salary_amount >= 0),
  salary_period text not null default 'week' check (salary_period in ('week','month')),
  start_date date not null default current_date,
  end_date date,
  notes text not null default '',
  created_at timestamptz not null default now()
);

-- المستحق عن كل فترة (أسبوع/شهر) — بيتولّد تلقائي من sync_salary_accruals
create table if not exists public.salary_accruals (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null default public.current_shop_id() references public.shops(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete cascade,
  period_start date not null,
  amount numeric(14,2) not null check (amount >= 0),
  created_at timestamptz not null default now(),
  unique (employee_id, period_start)
);

-- المبالغ اللي اتصرفت فعلاً (دي اللي بتتخصم من الخزنة). RESTRICT: مينفعش نحذف عامل ليه صرف (كان هيرجّع فلوس للخزنة بالغلط)
create table if not exists public.salary_payments (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null default public.current_shop_id() references public.shops(id) on delete cascade,
  employee_id uuid not null references public.employees(id) on delete restrict,
  amount numeric(14,2) not null check (amount > 0),
  paid_at date not null default current_date,
  note text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists treasury_entries_shop_idx on public.treasury_entries (shop_id, entry_date);
create index if not exists employees_shop_idx on public.employees (shop_id);
create index if not exists salary_accruals_shop_idx on public.salary_accruals (shop_id);
create index if not exists salary_accruals_employee_idx on public.salary_accruals (employee_id);
create index if not exists salary_payments_shop_idx on public.salary_payments (shop_id, paid_at);
create index if not exists salary_payments_employee_idx on public.salary_payments (employee_id);

do $$
declare t text;
begin
  foreach t in array array['treasury_entries','employees','salary_accruals','salary_payments'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('drop policy if exists %I on public.%I', t||'_select', t);
    execute format('drop policy if exists %I on public.%I', t||'_insert', t);
    execute format('drop policy if exists %I on public.%I', t||'_update', t);
    execute format('drop policy if exists %I on public.%I', t||'_delete', t);
    execute format('create policy %I on public.%I for select to authenticated using (shop_id = (select public.current_shop_id()))', t||'_select', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (shop_id = (select public.current_shop_id()) and public.shop_writable(shop_id))', t||'_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (shop_id = (select public.current_shop_id()) and public.shop_writable(shop_id)) with check (shop_id = (select public.current_shop_id()))', t||'_update', t);
    execute format('create policy %I on public.%I for delete to authenticated using (shop_id = (select public.current_shop_id()) and public.shop_writable(shop_id))', t||'_delete', t);
  end loop;
end $$;

-- بيولّد مستحقات الفترات الناقصة لكل العمال (idempotent). p_today بييجي من جهاز العميل (توقيت مصر/تركيا) بدل UTC.
create or replace function public.sync_salary_accruals(p_today date default current_date)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare v_count integer;
begin
  if p_today > current_date + 2 then p_today := current_date + 2; end if;
  insert into public.salary_accruals (shop_id, employee_id, period_start, amount)
  select e.shop_id, e.id,
         case e.salary_period
           when 'week' then e.start_date + (n.n * 7)
           else (e.start_date + (n.n * interval '1 month'))::date
         end,
         e.salary_amount
  from public.employees e
  cross join lateral generate_series(
    0,
    least(1300, ((least(p_today, coalesce(e.end_date, p_today)) - e.start_date) / (case e.salary_period when 'week' then 7 else 28 end)) + 1)
  ) as n(n)
  where least(p_today, coalesce(e.end_date, p_today)) >= e.start_date
    and (case e.salary_period
           when 'week' then e.start_date + (n.n * 7)
           else (e.start_date + (n.n * interval '1 month'))::date
         end) <= least(p_today, coalesce(e.end_date, p_today))
  on conflict (employee_id, period_start) do nothing;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- إجماليات الخزنة (بتتحسب في الداتابيز: سريعة ومش بتتأثر بحد الـ 1000 صف)
-- salary_owed = مجموع المتبقي لكل عامل (المقدّم/السلفة بالسالب مش بيخصم من مستحقات غيره)
create or replace function public.treasury_totals()
returns table (total_in numeric, total_out numeric, balance numeric, salary_owed numeric)
language sql
stable
security invoker
set search_path = public
as $$
  with t as (
    select
      coalesce((select sum(amount) from public.payments), 0)
        + coalesce((select sum(amount) from public.income), 0)
        + coalesce((select sum(amount) from public.treasury_entries where kind = 'deposit'), 0) as tin,
      coalesce((select sum(amount) from public.expenses), 0)
        + coalesce((select sum(amount) from public.salary_payments), 0)
        + coalesce((select sum(amount) from public.treasury_entries where kind = 'withdraw'), 0) as tout,
      coalesce((
        select sum(greatest(a.acc - coalesce(p.paid, 0), 0))
        from (select employee_id, sum(amount) as acc from public.salary_accruals group by employee_id) a
        left join (select employee_id, sum(amount) as paid from public.salary_payments group by employee_id) p using (employee_id)
      ), 0) as owed
  )
  select tin, tout, tin - tout, owed from t;
$$;

revoke all on function public.sync_salary_accruals(date) from public, anon;
revoke all on function public.treasury_totals() from public, anon;
grant execute on function public.sync_salary_accruals(date) to authenticated;
grant execute on function public.treasury_totals() to authenticated;
