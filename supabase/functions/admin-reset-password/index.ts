// دالة Edge: الأدمن بس يقدر يعيّن كلمة سر مؤقتة لورشة (المستخدم بيغيّرها أول دخول).
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

function tempPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const a = crypto.getRandomValues(new Uint32Array(10));
  return Array.from(a, (n) => chars[n % chars.length]).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    // 1) نتأكد إن المنادي أدمن (بصلاحيته هو مش بالـ service_role)
    const asUser = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const adm = await asUser.rpc("is_platform_admin");
    if (adm.error || adm.data !== true) return json({ error: "forbidden" }, 403);

    const { email } = await req.json();
    if (!email || typeof email !== "string") return json({ error: "email required" }, 400);

    // 2) service_role جوه السيرفر بس
    const svc = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const found = await svc.rpc("admin_find_user", { p_email: email });
    if (found.error || !found.data) return json({ error: "user not found" }, 404);

    const pwd = tempPassword();
    const upd = await svc.auth.admin.updateUserById(found.data, {
      password: pwd,
      user_metadata: { must_change_password: true },
    });
    if (upd.error) return json({ error: upd.error.message }, 500);
    return json({ password: pwd });
  } catch (e) {
    return json({ error: String((e as Error).message || e) }, 500);
  }
});
