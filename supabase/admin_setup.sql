-- تعيين حساب الأدمن (إنت). مش migration: بيتشغّل مرة واحدة بعد التسجيل.
-- 1) سجّل حساب عادي من signup.html برقم تليفونك.
-- 2) بدّل الرقم تحت (بصيغة 01XXXXXXXXX) وشغّل الأمر من SQL Editor في Supabase
--    (أو اطلب من المساعد ينفّذه).

insert into public.platform_admins (user_id)
select id from auth.users where email = 'PUT-YOUR-PHONE-HERE@phone.workshop-system.app'
on conflict do nothing;
