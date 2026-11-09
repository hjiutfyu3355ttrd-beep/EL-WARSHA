-- v0.18.0: عملة الورشة (قابلة للتغيير من الإعدادات).
-- currency        = كود العملة (EGP / TRY / SAR ...) أو OTHER لعملة مخصصة
-- currency_symbol = رمز العرض الاختياري (مثل TL أو ₺)؛ فاضي = الرمز الافتراضي للعملة واللغة
-- NULL = EGP. التغيير إضافي بالكامل ومفيش أي سجل قديم بيتأثر.
alter table public.shop_profile
  add column if not exists currency text,
  add column if not exists currency_symbol text;

alter table public.shop_profile
  drop constraint if exists shop_profile_currency_len,
  add constraint shop_profile_currency_len check (
    (currency is null or char_length(currency) between 2 and 10)
    and (currency_symbol is null or char_length(currency_symbol) <= 12)
  );
