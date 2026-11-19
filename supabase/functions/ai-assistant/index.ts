// دالة Edge: مساعد ذكي بـ Gemini. المفتاح secret على Supabase (GEMINI_API_KEY) ومش في الكود.
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const DAILY_LIMIT = Number(Deno.env.get("AI_DAILY_LIMIT") ?? "40"); // طلبات/يوم لكل ورشة
const MODEL = Deno.env.get("GEMINI_MODEL") ?? "gemini-flash-latest";
const BASE = "اتكلم بالعامية المصرية بأسلوب مهذب ومختصر. استخدم الأرقام المعطاة فقط ولا تخترع أرقام. ";

type Turn = { role: "user" | "model"; parts: { text: string }[] };
const one = (text: string): Turn[] => [{ role: "user", parts: [{ text }] }];

async function gemini(system: string, contents: Turn[]): Promise<string> {
  const key = Deno.env.get("GEMINI_API_KEY");
  if (!key) throw { code: "not_configured" };
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents,
      generationConfig: { temperature: 0.4, maxOutputTokens: 900 },
    }),
  });
  if (r.status === 429) throw { code: "quota" };
  if (!r.ok) throw { code: "provider", status: r.status };
  const d = await r.json();
  const t = d?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";
  if (!t) throw { code: "empty" };
  return t.trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const b = await req.json();
    const mode = String(b.mode || "");
    const clip = (s: unknown, n: number) => String(s ?? "").slice(0, n);

    // 1) الحد اليومي (بصلاحية المستخدم — بيحدد الورشة تلقائياً)
    const ok = await sb.rpc("ai_bump_usage", { p_limit: DAILY_LIMIT });
    if (ok.error) return json({ error: "auth" }, 401);
    if (ok.data !== true) return json({ error: "limit" }, 429);

    let text = "";
    if (mode === "ask") {
      const q = clip(b.question, 500);
      if (!q) return json({ error: "bad_request" }, 400);
      const from = /^\d{4}-\d{2}-\d{2}$/.test(b.from) ? b.from : new Date().toISOString().slice(0, 8) + "01";
      const to = /^\d{4}-\d{2}-\d{2}$/.test(b.to) ? b.to : new Date().toISOString().slice(0, 10);
      const s = await sb.rpc("ai_shop_summary", { p_from: from, p_to: to });
      if (s.error) return json({ error: "summary" }, 500);
      text = await gemini(
        BASE + "إنت مساعد لصاحب ورشة سيارات. هتاخد ملخص أرقام الورشة (JSON) وسؤاله. جاوب من الملخص بس. " +
          "net_cash_estimate تقدير نقدي (مش ربح محاسبي). لو السؤال مش مغطّى بالأرقام قول كده بصراحة واقترح يشوف الصفحة المناسبة.",
        one(`ملخص الورشة:\n${JSON.stringify(s.data)}\n\nالسؤال: ${q}`),
      );
    } else if (mode === "diagnose") {
      const p = clip(b.problem, 800);
      if (!p) return json({ error: "bad_request" }, 400);
      text = await gemini(
        BASE + "إنت فني سيارات خبير. من وصف المشكلة اقترح: أسباب محتملة مرتبة من الأكثر احتمالاً، وخطوات الفحص، وقطع الغيار المحتمل تغييرها. " +
          "وضّح إن ده اقتراح مبدئي لازم الفني يتأكد منه بالفحص.",
        one(`السيارة: ${clip(b.vehicle, 120)}\nوصف المشكلة: ${p}`),
      );
    } else if (mode === "whatsapp") {
      const kinds: Record<string, string> = {
        ready: "العربية جاهزة للاستلام",
        quote: "عرض سعر جاهز للموافقة",
        reminder: "تذكير بمبلغ متبقي",
        thanks: "شكر بعد التسليم",
      };
      const kind = kinds[String(b.kind)] || kinds.ready;
      text = await gemini(
        BASE + "اكتب رسالة واتساب قصيرة (3 لـ 5 سطور) من الورشة للعميل، ودودة ومحترمة، من غير مبالغة. اكتب نص الرسالة بس.",
        one(`نوع الرسالة: ${kind}\nاسم الورشة: ${clip(b.shop, 80)}\nاسم العميل: ${clip(b.customer, 60)}\nالسيارة: ${clip(b.vehicle, 80)}\nتفاصيل إضافية: ${clip(b.details, 300)}`),
      );
    } else if (mode === "chat") {
      const msg = clip(b.message, 600);
      if (!msg) return json({ error: "bad_request" }, 400);
      const today = /^\d{4}-\d{2}-\d{2}$/.test(b.today) ? b.today : new Date().toISOString().slice(0, 10);
      const d = new Date(today + "T00:00:00Z");
      const Y = d.getUTCFullYear(), M = d.getUTCMonth();
      const iso = (x: Date) => x.toISOString().slice(0, 10);
      const rng = (a: Date, e: Date) => sb.rpc("ai_shop_summary", { p_from: iso(a), p_to: iso(e) });
      const [cur, prev, yr] = await Promise.all([
        rng(new Date(Date.UTC(Y, M, 1)), d),
        rng(new Date(Date.UTC(Y, M - 1, 1)), new Date(Date.UTC(Y, M, 0))),
        rng(new Date(Date.UTC(Y, 0, 1)), d),
      ]);
      if (cur.error) return json({ error: "summary" }, 500);
      const money = (x: Record<string, unknown> | null) => x && ({
        from: x.from, to: x.to, payments_received: x.payments_received, other_income: x.other_income,
        expenses: x.expenses, salaries_paid: x.salaries_paid, purchases_paid: x.purchases_paid,
        net_cash_estimate: x.net_cash_estimate, top_expense_categories: x.top_expense_categories,
      });
      const ctx = { today, this_month: cur.data, last_month: money(prev.data), this_year: money(yr.data) };
      const hist: Turn[] = (Array.isArray(b.history) ? b.history : []).slice(-8)
        .filter((h: { role?: string; text?: string }) => (h?.role === "user" || h?.role === "model") && h?.text)
        .map((h: { role: "user" | "model"; text: string }) => ({ role: h.role, parts: [{ text: clip(h.text, 800) }] }));
      while (hist.length && hist[0].role !== "user") hist.shift();
      text = await gemini(
        BASE + "إنت 'مساعد الورشة' جوه برنامج إدارة ورش السيارات. بتجاوب على: أرقام الورشة من الملخص، واقتراحات تشخيص الأعطال (مبدئية ولازم الفني يتأكد بالفحص)، وكتابة رسائل واتساب للعملاء، ونصايح شغل. " +
          "net_cash_estimate تقدير نقدي مش ربح محاسبي. إنت مش بتشوف أسماء العملاء ولا تليفوناتهم ولا أي بيانات مش في الملخص — لو اتسألت عنها قول كده. " +
          "خلّي الرد قصير (غالباً مش أكتر من 8 سطور) وممكن تستخدم **غامق** وقوائم بنقط.\nملخص الورشة:\n" + JSON.stringify(ctx),
        [...hist, { role: "user", parts: [{ text: msg }] }],
      );
    } else return json({ error: "bad_request" }, 400);

    return json({ text });
  } catch (e) {
    const c = (e as { code?: string })?.code;
    if (c === "quota") return json({ error: "quota" }, 429);
    if (c === "not_configured") return json({ error: "not_configured" }, 503);
    return json({ error: "provider" }, 502);
  }
});
