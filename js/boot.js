// ============================================================
// تشغيل مبكر (بيتحمّل في <head> قبل أي رسم) — ملف خارجي لأن CSP بتحجب السكربتات المضمّنة.
// 1) يضبط اللغة والاتجاه ومنع ترجمة المتصفح قبل ما الصفحة تترسم (من غير وميض RTL→LTR).
// 2) لو Supabase متضبط: يفتح الاتصال بالسيرفر مسبقًا ويحمّل المكتبة بالتوازي مع باقي الملفات.
// ============================================================
(function () {
  var lang = "ar";
  try {
    var s = localStorage.getItem("workshop_lang");
    if (s === "tr" || s === "ar") lang = s;
  } catch (e) {}
  var h = document.documentElement;
  h.lang = lang;
  h.dir = lang === "tr" ? "ltr" : "rtl";
  h.setAttribute("translate", "no");
  if ((" " + h.className + " ").indexOf(" notranslate ") < 0) h.className = (h.className + " notranslate").trim();

  var cfg = window.APP_CONFIG || {};
  if (cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY) {
    var pc = document.createElement("link");
    pc.rel = "preconnect";
    pc.href = cfg.SUPABASE_URL;
    pc.crossOrigin = "";
    document.head.appendChild(pc);

    var sc = document.createElement("script");
    sc.src = "vendor/supabase-2.118.0.js";
    sc.async = true;
    // db.js بيستنى الوعد ده قبل أول استعلام
    window.__sbReady = new Promise(function (resolve, reject) {
      sc.onload = resolve;
      sc.onerror = function () { reject(new Error("supabase lib load failed")); };
    });
    window.__sbReady.catch(function () {});
    document.head.appendChild(sc);
  }
})();
