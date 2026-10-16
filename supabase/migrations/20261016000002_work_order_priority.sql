-- أولوية أمر الشغل (منخفضة/عادية/عالية/حرجة) — لتبويب "أولوية عالية" في شاشة أوامر الشغل
alter table public.work_orders
  add column priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'critical'));
create index work_orders_shop_status_idx on public.work_orders (shop_id, status);
