-- ✅ اتطبّق على مشروع الورشة (blspjpghimjpyczxkvvs) بتاريخ 2026-10-16 باسم revoke_trigger_function_execute.
-- دوال الـ triggers مش المفروض حد ينفّذها عن طريق الـ API (/rest/v1/rpc/...).
-- الـ trigger نفسه بيشتغل عادي لأن صلاحية التنفيذ بتتفحص وقت إنشاء الـ trigger مش وقت تشغيله.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.set_work_order_number() from public, anon, authenticated;
