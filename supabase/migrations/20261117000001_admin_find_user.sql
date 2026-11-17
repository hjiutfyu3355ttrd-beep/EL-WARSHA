-- بيجيب id المستخدم من الإيميل الداخلي — للـ service_role بس (بتستخدمه دالة admin-reset-password)
create or replace function public.admin_find_user(p_email text)
returns uuid language sql security definer set search_path = auth, public as
$$ select id from auth.users where lower(email) = lower(p_email) limit 1 $$;
revoke all on function public.admin_find_user(text) from public, anon, authenticated;
grant execute on function public.admin_find_user(text) to service_role;
