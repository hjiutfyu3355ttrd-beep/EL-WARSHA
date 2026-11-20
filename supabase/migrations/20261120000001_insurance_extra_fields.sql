-- حقول إضافية لأوامر التأمين: صاحب السيارة، السائق، الخبير، رقم الخبير
alter table public.work_orders
  add column if not exists insurance_owner_name text not null default '',
  add column if not exists insurance_driver_name text not null default '',
  add column if not exists insurance_expert_name text not null default '',
  add column if not exists insurance_expert_no text not null default '';
