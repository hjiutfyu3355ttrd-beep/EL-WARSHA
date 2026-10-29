-- تعيين حساب الأدمن (إنت). مش migration: بيتشغّل مرة واحدة بإيدك بعد التسجيل.
-- 1) سجّل حساب عادي من صفحة /signup بالإيميل بتاعك.
-- 2) بدّل الإيميل تحت وشغّل الأمر من SQL Editor في Supabase (أو اطلب من المساعد ينفّذه بعد موافقتك).

insert into public.platform_admins (user_id)
select id from auth.users where email = 'PUT-YOUR-ADMIN-EMAIL-HERE'
on conflict do nothing;
