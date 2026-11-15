-- v0.20.0: أوامر التأمين. جهة الدفع لأمر الشغل: العميل (الافتراضي) أو شركة تأمين.
-- المطالبة بتفضل معلّقة لحد ما insurance_settled_at يتسجّل — حتى لو السيارة اتسلّمت (مفيش أي شرط دفع عند التسليم).
-- دفعة شركة التأمين بتتسجّل كدفعة عادية في payments فبتدخل الخزنة وبتحدّث المتبقي لوحدها.
-- (اتطبّقت على Supabase بتاريخ 2026-11-10 وكل الأوامر القديمة فضلت payer_type = 'customer'.)
alter table public.work_orders
  add column if not exists payer_type text not null default 'customer',
  add column if not exists insurance_company text not null default '',
  add column if not exists insurance_claim_no text not null default '',
  add column if not exists insurance_settled_at timestamptz;

alter table public.work_orders
  drop constraint if exists work_orders_payer_type_check,
  drop constraint if exists work_orders_insurance_company_check,
  drop constraint if exists work_orders_insurance_settled_check,
  drop constraint if exists work_orders_insurance_len_check;

alter table public.work_orders
  add constraint work_orders_payer_type_check check (payer_type in ('customer', 'insurance')),
  add constraint work_orders_insurance_company_check check (payer_type <> 'insurance' or btrim(insurance_company) <> ''),
  add constraint work_orders_insurance_settled_check check (insurance_settled_at is null or payer_type = 'insurance'),
  add constraint work_orders_insurance_len_check check (char_length(insurance_company) <= 120 and char_length(insurance_claim_no) <= 60);

create index if not exists work_orders_insurance_pending_idx
  on public.work_orders (shop_id, created_at desc)
  where payer_type = 'insurance' and insurance_settled_at is null;
