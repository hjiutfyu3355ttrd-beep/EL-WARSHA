-- المساعد الذكي: عدّاد استخدام يومي لكل ورشة + ملخص أرقام (بدون أسماء عملاء/تليفونات)
create table if not exists public.ai_usage (
  shop_id uuid not null,
  day date not null default current_date,
  count int not null default 0,
  primary key (shop_id, day)
);
alter table public.ai_usage enable row level security;  -- مفيش policies: الوصول من الدالة بس

create or replace function public.ai_bump_usage(p_limit int default 30)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_shop uuid := public.current_shop_id(); v_n int;
begin
  if v_shop is null then return false; end if;
  insert into public.ai_usage(shop_id, day, count) values (v_shop, current_date, 1)
  on conflict (shop_id, day) do update set count = public.ai_usage.count + 1
  returning count into v_n;
  return v_n <= p_limit;
end $$;
revoke all on function public.ai_bump_usage(int) from public, anon;
grant execute on function public.ai_bump_usage(int) to authenticated;

create or replace function public.ai_shop_summary(p_from date, p_to date)
returns jsonb language sql stable security invoker set search_path = public as $$
  with
  pay as (select coalesce(sum(amount),0) v from payments where created_at::date between p_from and p_to),
  inc as (select coalesce((select sum(amount) from incomes where income_date between p_from and p_to),0)
               + coalesce((select sum(amount) from income where created_at::date between p_from and p_to),0) v),
  exp as (select coalesce(sum(amount),0) v from expenses where expense_date between p_from and p_to),
  sal as (select coalesce(sum(amount),0) v from salary_payments where paid_at between p_from and p_to),
  pur as (select coalesce(sum(paid),0) v from purchases where purchased_at::date between p_from and p_to),
  rec as (select coalesce(sum(total - paid_amount),0) v, count(*) n from invoices where status in ('issued','partially_paid')),
  wo as (select status, count(*) n from work_orders where status not in ('delivered','cancelled') group by status),
  low as (select name, qty, min_qty from parts where qty <= min_qty order by qty limit 20),
  cat as (select coalesce(nullif(category,''),'بدون تصنيف') c, sum(amount) v from expenses
          where expense_date between p_from and p_to group by 1 order by 2 desc limit 5)
  select jsonb_build_object(
    'from', p_from, 'to', p_to,
    'currency', (select coalesce(nullif(currency_symbol,''), nullif(currency,'')) from shop_profile limit 1),
    'payments_received', (select v from pay),
    'other_income', (select v from inc),
    'expenses', (select v from exp),
    'salaries_paid', (select v from sal),
    'purchases_paid', (select v from pur),
    'net_cash_estimate', (select v from pay) + (select v from inc) - (select v from exp) - (select v from sal) - (select v from pur),
    'unpaid_invoices_total', (select v from rec), 'unpaid_invoices_count', (select n from rec),
    'open_work_orders', coalesce((select jsonb_object_agg(status, n) from wo), '{}'::jsonb),
    'low_stock_parts', coalesce((select jsonb_agg(to_jsonb(low)) from low), '[]'::jsonb),
    'top_expense_categories', coalesce((select jsonb_agg(jsonb_build_object('category', c, 'amount', v)) from cat), '[]'::jsonb)
  )
$$;
grant execute on function public.ai_shop_summary(date, date) to authenticated;
