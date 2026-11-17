// ============================================================
// أدوات الواجهة المشتركة: القوالب الآمنة، التنسيق، الشريط الجانبي.
// ============================================================
(function () {
  "use strict";

  // ---------- قوالب HTML آمنة ----------
  // html`...` بتعمل escape تلقائي لأي قيمة بتدخل في القالب (حماية من XSS):
  // لو عميل اسمه <script> هيظهر كنص عادي مش هيتنفّذ.
  // ولو عايز تدمج قالب جوه قالب (زي map) استخدم html`` تاني — بيتعرف إنه آمن.
  function Raw(s) {
    this.s = s;
  }
  Raw.prototype.toString = function () {
    return this.s;
  };

  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function part(v) {
    if (v === false || v == null) return "";
    if (v instanceof Raw) return v.s;
    if (Array.isArray(v)) return v.map(part).join("");
    return esc(v);
  }

  function html(strings) {
    var out = strings[0];
    for (var i = 1; i < arguments.length; i++) out += part(arguments[i]) + strings[i];
    return new Raw(out);
  }

  // ---------- تنسيق ----------
  function locale() {
    return window.I18N ? I18N.locale() : "ar-EG";
  }
  // ---------- العملة (إعداد على مستوى الورشة، بيتخزّن في shop_profile) ----------
  // sym = الرمز الافتراضي بالعربي/التركي. الرمز المخصص (currency_symbol) بيغلب الافتراضي.
  var CURRENCIES = [
    { code: "EGP", ar: "ج.م", tr: "EGP" },
    { code: "TRY", ar: "TL", tr: "TL" },
    { code: "SAR", ar: "ر.س", tr: "SAR" },
    { code: "AED", ar: "د.إ", tr: "AED" },
    { code: "KWD", ar: "د.ك", tr: "KWD" },
    { code: "QAR", ar: "ر.ق", tr: "QAR" },
    { code: "BHD", ar: "د.ب", tr: "BHD" },
    { code: "OMR", ar: "ر.ع", tr: "OMR" },
    { code: "JOD", ar: "د.أ", tr: "JOD" },
    { code: "IQD", ar: "د.ع", tr: "IQD" },
    { code: "LYD", ar: "د.ل", tr: "LYD" },
    { code: "MAD", ar: "د.م", tr: "MAD" },
    { code: "DZD", ar: "د.ج", tr: "DZD" },
    { code: "TND", ar: "د.ت", tr: "TND" },
    { code: "USD", ar: "$", tr: "$" },
    { code: "EUR", ar: "€", tr: "€" },
    { code: "GBP", ar: "£", tr: "£" },
  ];
  var curState = { code: "EGP", symbol: "", name: "" };
  var curUid = "demo";
  function currencyDefaultSymbol(code) {
    var lang = I18N.getLang();
    for (var i = 0; i < CURRENCIES.length; i++) {
      if (CURRENCIES[i].code === code) return CURRENCIES[i][lang] || CURRENCIES[i].ar;
    }
    return code;
  }
  function currencyLabel() {
    return (curState.symbol && curState.symbol.trim()) || currencyDefaultSymbol(curState.code);
  }
  function applyCurrency(c) {
    curState = { code: (c && c.code) || "EGP", symbol: (c && c.symbol) || "", name: (c && c.name) || curState.name || "" };
    I18N.setCurrencyLabel(currencyLabel());
    if (window.Shell && Shell.setShop) Shell.setShop(curState.name);
  }
  function readCurrencyRow(rows) {
    var r = rows && rows[0];
    return { code: (r && r.currency) || "EGP", symbol: (r && r.currency_symbol) || "", name: (r && r.name) || "" };
  }
  // أول مرة على الجهاز بنستنى القراءة مرة واحدة؛ بعد كده بنقرأ من الكاش فورًا ونحدّثه في الخلفية
  async function loadCurrency(uid) {
    curUid = uid || "demo";
    var key = "ws_cur_" + curUid, cached = null;
    try { cached = JSON.parse(localStorage.getItem(key)); } catch (e) {}
    function store(c) { try { localStorage.setItem(key, JSON.stringify(c)); } catch (e) {} }
    if (cached && cached.code) {
      applyCurrency(cached);
      var last = 0;
      try { last = Number(sessionStorage.getItem("ws_cur_t") || 0); } catch (e) {}
      if (cached.name === undefined || Date.now() - last > 600000) {  // تحديث خلفي كل 10 دقايق (لو اتغيّرت من جهاز تاني بتظهر في الصفحة اللي بعدها)
        try { sessionStorage.setItem("ws_cur_t", String(Date.now())); } catch (e) {}
        DB.list("shop_profile").then(function (rows) {
          var fresh = readCurrencyRow(rows);
          store(fresh);
          if (window.Shell && Shell.setShop) Shell.setShop(fresh.name);
        }, function () {});
      }
      return;
    }
    try {
      var c = readCurrencyRow(await DB.list("shop_profile"));
      store(c);
      applyCurrency(c);
      try { sessionStorage.setItem("ws_cur_t", String(Date.now())); } catch (e) {}  // لسه مقروءة طازة: مفيش تحديث خلفي دلوقتي
    } catch (e) {
      applyCurrency({ code: "EGP", symbol: "" });
    }
  }
  // بيتنادى من الإعدادات بعد الحفظ
  function setCurrency(code, symbol) {
    var c = { code: code || "EGP", symbol: symbol || "", name: curState.name };
    try { localStorage.setItem("ws_cur_" + curUid, JSON.stringify(c)); } catch (e) {}
    applyCurrency(c);
  }
  // بيتنادى من الإعدادات بعد حفظ اسم الورشة عشان يظهر فورًا في القائمة الجانبية
  function setShopName(name) {
    curState.name = name || "";
    try { localStorage.setItem("ws_cur_" + curUid, JSON.stringify({ code: curState.code, symbol: curState.symbol, name: curState.name })); } catch (e) {}
    if (window.Shell && Shell.setShop) Shell.setShop(curState.name);
  }
  function money(n) {
    return new Intl.NumberFormat(locale(), { maximumFractionDigits: 2 }).format(n || 0) + " " + currencyLabel();
  }

  // ---------- ترقيم الصفحات (client-side: بيقلّل رسم الـ DOM في القوائم الطويلة) ----------
  // الاستخدام في أي صفحة:
  //   var pg = UI.makePager();  UI.bindPager($("list"), pg, renderList);
  //   في renderList:  var rows = UI.pageSlice(pg, shown, filterSignature);  ...  + UI.pagerBar(pg, shown.length)
  var PAGE_SIZES = [25, 50, 100];
  function makePager(size) { return { page: 1, size: size || 25, sig: "" }; }
  function pageSlice(p, arr, sig) {
    sig = String(sig == null ? "" : sig);
    if (p.sig !== sig) { p.sig = sig; p.page = 1; }  // فلتر/بحث اتغيّر → نرجع لأول صفحة
    var pages = Math.max(1, Math.ceil(arr.length / p.size));
    if (p.page > pages) p.page = pages;
    if (p.page < 1) p.page = 1;
    return arr.slice((p.page - 1) * p.size, p.page * p.size);
  }
  function pagerBar(p, total) {
    if (total <= PAGE_SIZES[0]) return "";  // أقل من صفحة واحدة: مفيش داعي للشريط
    var pages = Math.max(1, Math.ceil(total / p.size));
    var from = (p.page - 1) * p.size + 1, to = Math.min(total, p.page * p.size);
    return html`<div class="pager no-print">
      <span class="pager-info">${I18N.t("pg_range", { from: from, to: to, total: total })}</span>
      <div class="pager-ctl">
        <label class="pager-size">${I18N.t("pg_size")}
          <select data-pg-size>${PAGE_SIZES.map(function (n) { return option(n, n, n === p.size); })}</select>
        </label>
        <button type="button" class="small secondary" data-pg="prev" ${p.page <= 1 ? "disabled" : ""}>${I18N.t("pg_prev")}</button>
        <span class="pager-page">${I18N.t("pg_page", { p: p.page, n: pages })}</span>
        <button type="button" class="small secondary" data-pg="next" ${p.page >= pages ? "disabled" : ""}>${I18N.t("pg_next")}</button>
      </div>
    </div>`;
  }
  function bindPager(container, p, rerender) {
    container.addEventListener("click", function (e) {
      var b = e.target.closest("button[data-pg]");
      if (!b || b.disabled) return;
      p.page += b.getAttribute("data-pg") === "next" ? 1 : -1;
      rerender();
      var r = container.getBoundingClientRect();
      if (r.top < 0) container.scrollIntoView({ block: "start" });
    });
    container.addEventListener("change", function (e) {
      var sel = e.target.closest("select[data-pg-size]");
      if (!sel) return;
      p.size = Number(sel.value) || 25;
      p.page = 1;
      rerender();
    });
  }
  function dateAr(s) {
    return new Date(s).toLocaleDateString(locale());
  }
  function isToday(iso) {
    return new Date(iso).toDateString() === new Date().toDateString();
  }

  // كل عنصر فيه label كـ getter: بيرجّع النص بلغة الواجهة الحالية (عربي/تركي)
  // فأي صفحة بتعمل list.map(x => x.label) بتتترجم لوحدها من غير ما نعدّل فيها.
  function mk(keys, prefix) {
    return keys.map(function (k) {
      return { key: k, get label() { return I18N.t(prefix + k); } };
    });
  }
  var STATUSES = mk(["received", "inspecting", "awaiting_approval", "approved", "in_progress", "waiting_parts", "testing", "ready", "delivered", "cancelled"], "status_");
  var PRIORITIES = mk(["low", "normal", "high", "critical"], "prio_");
  var INV_STATUSES = mk(["draft", "issued", "partially_paid", "paid", "cancelled"], "inv_st_");
  var PAY_METHODS = mk(["cash", "card", "instapay", "wallet", "transfer"], "pay_");

  function labelOf(list, key) {
    var f = list.filter(function (x) { return x.key === key; })[0];
    return f ? f.label : key;
  }
  var STATUS_I18N = {
    received: "status_received", inspecting: "status_inspecting", awaiting_approval: "status_awaiting_approval",
    approved: "status_approved", in_progress: "status_in_progress", waiting_parts: "status_waiting_parts",
    testing: "status_testing", ready: "status_ready", delivered: "status_delivered", cancelled: "status_cancelled"
  };
  function statusLabel(k) {
    if (window.I18N && STATUS_I18N[k]) return I18N.t(STATUS_I18N[k]);
    return labelOf(STATUSES, k);
  }
  var PRIORITY_I18N = { low: "prio_low", normal: "prio_normal", high: "prio_high", critical: "prio_critical" };
  function priorityLabel(k) {
    k = k || "normal";
    if (window.I18N && PRIORITY_I18N[k]) return I18N.t(PRIORITY_I18N[k]);
    return labelOf(PRIORITIES, k);
  }
  // متأخر = ليه موعد تسليم متوقع عدّى والأمر لسه مفتوح
  function isOverdue(o) {
    return !!o.expected_delivery_at && UI_isOpen(o.status) && new Date(o.expected_delivery_at).getTime() < Date.now();
  }
  function UI_isOpen(s) { return s !== "delivered" && s !== "cancelled"; }
  function invStatusLabel(k) { return labelOf(INV_STATUSES, k); }  // label getter بيترجم لوحده
  var PAY_I18N = { cash: "pay_cash", card: "pay_card", instapay: "pay_instapay", wallet: "pay_wallet", transfer: "pay_transfer" };
  function methodLabel(k) {
    if (window.I18N && PAY_I18N[k]) return I18N.t(PAY_I18N[k]);
    return labelOf(PAY_METHODS, k);
  }
  function isOpen(status) { return status !== "delivered" && status !== "cancelled"; }

  // فهرس سريع: byId(customers)["c1"]
  function byId(arr) {
    var m = {};
    arr.forEach(function (x) { m[x.id] = x; });
    return m;
  }

  function option(value, label, selected) {
    return html`<option value="${value}" ${selected ? "selected" : ""}>${label}</option>`;
  }

  // قائمة <option> لقيم محايدة اللغة (fuel / trans / obs_cat / tax_type):
  // value = الرمز الثابت، والقيم القديمة المحفوظة بالعربي أو التركي بتتعرّف وتتحدد صح.
  function enumOptions(group, stored, withEmpty) {
    var code = I18N.enumCode(group, stored);
    var opts = withEmpty ? [{ value: "", label: "—" }] : [];
    opts = opts.concat(I18N.enumList(group));
    if (stored && !code) opts.push({ value: stored, label: stored });  // نص حر قديم: منضيّعوش
    return opts.map(function (o) { return option(o.value, o.label, o.value === (code || stored || "")); });
  }

  // ---------- رسائل ----------
  // الرسائل بتتكدّس في حاوية واحدة (مش فوق بعض)، وبتفضل ظاهرة حتى لو المستخدم انتقل لصفحة تانية.
  function flash(msg, type) {
    var host = document.getElementById("toasts");
    if (!host) {
      host = document.createElement("div");
      host.id = "toasts";
      host.className = "toasts no-print";
      host.setAttribute("aria-live", "polite");
      document.body.appendChild(host);
    }
    var kind = type || "error";
    var d = document.createElement("div");
    d.className = "toast " + kind;
    d.setAttribute("role", kind === "error" ? "alert" : "status");
    var ic = document.createElement("span");
    ic.className = "toast-ic";
    ic.innerHTML = ICON_TOAST[kind === "success" ? "check" : "alert"];  // SVG ثابت من عندنا
    var tx = document.createElement("span");
    tx.className = "toast-tx";
    tx.textContent = msg;
    d.appendChild(ic);
    d.appendChild(tx);
    host.appendChild(d);
    while (host.children.length > 4) host.removeChild(host.firstChild);
    setTimeout(function () {
      d.classList.add("out");
      setTimeout(function () { d.remove(); }, 220);
    }, kind === "error" ? 5200 : 3200);
  }
  var ICON_TOAST = {
    check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>',
    alert: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.5h.01"/></svg>'
  };

  // اسم بديل لـ flash بيستخدمه vehicles.js: toast(رسالة) = نجاح، toast(رسالة, true) = خطأ
  function toast(msg, isError) {
    flash(msg, isError ? "error" : "success");
  }

  // بينفّذ دالة وأي خطأ بيطلع كرسالة بدل ما الصفحة تقف
  async function guard(fn) {
    try {
      await fn();
    } catch (e) {
      flash((e && e.message) || String(e));
    }
  }

  // ---------- القائمة الجانبية: البيانات (الرسم نفسه في js/shell.js) ----------
  // أيقونات SVG (stroke) — بتتلوّن بلون الحالة من CSS. كل صفحة ليها أيقونة مميّزة.
  var ICONS = {
    dashboard: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
    workorders: '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="m9 14 2 2 4-4"/>',
    receive: '<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>',
    quotations: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>',
    insurance: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
    observation: '<path d="m3 17 2 2 4-4M3 7l2 2 4-4M13 6h8M13 12h8M13 18h8"/>',
    gatepass: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
    customers: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.4 3.2-5.5 6.5-5.5s5.9 2.1 6.5 5.5"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.8c1.8.7 3 2.4 3.5 5.2"/>',
    vehicles: '<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/>',
    compliance: '<path d="M12 3v18M7 21h10M5 6h14"/><path d="m5 6-3 7a3.5 3.5 0 0 0 6 0z"/><path d="m19 6-3 7a3.5 3.5 0 0 0 6 0z"/>',
    parts: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94z"/>',
    suppliers: '<path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.62l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/>',
    purchases: '<circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>',
    partsales: '<path d="M12.6 2.6A2 2 0 0 0 11.2 2H4a2 2 0 0 0-2 2v7.2a2 2 0 0 0 .6 1.4l8.7 8.7a2.4 2.4 0 0 0 3.4 0l6.6-6.6a2.4 2.4 0 0 0 0-3.4z"/><circle cx="7.5" cy="7.5" r=".6"/>',
    invoices: '<path d="M6 2h9l4 4v16l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6M9 16h3"/>',
    treasury: '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
    payments: '<rect x="2" y="5" width="20" height="14" rx="2.5"/><path d="M2 10h20M6 15h4"/>',
    income: '<path d="M22 7 13.5 15.5l-5-5L2 17"/><path d="M16 7h6v6"/>',
    expenses: '<path d="M22 17 13.5 8.5l-5 5L2 7"/><path d="M16 17h6v-6"/>',
    payroll: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.2"/><path d="M6 12h.01M18 12h.01"/>',
    reports: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    taxrates: '<path d="M19 5 5 19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>',
    mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/>',
    fields: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
    setup: '<path d="M4 22V4M4 4h13l-2 4 2 4H4"/>',
    admin: '<path d="M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6z"/><path d="M12 8v4M12 15.5h.01"/>',
    // أيقونات الواجهة
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    chev: '<path d="m6 9 6 6 6-6"/>',
    panel: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="M9 4v16"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h10"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    more: '<rect x="4" y="4" width="6" height="6" rx="1.6"/><rect x="14" y="4" width="6" height="6" rx="1.6"/><rect x="4" y="14" width="6" height="6" rx="1.6"/><rect x="14" y="14" width="6" height="6" rx="1.6"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    enter: '<path d="M9 10 4 15l5 5"/><path d="M20 4v7a4 4 0 0 1-4 4H4"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 2.7 4 5.7 4 9s-1.4 6.3-4 9c-2.6-2.7-4-5.7-4-9s1.4-6.3 4-9z"/>',
  };
  function icon(name) {
    return '<svg viewBox="0 0 24 24" aria-hidden="true">' + (ICONS[name] || "") + "</svg>";
  }

  // مجموعات القائمة. الـ key = اسم الصفحة (نفس القيمة اللي بتتبعت لـ UI.init)
  var NAV = [
    { group: "الرئيسية", gk: "g_home", items: [{ key: "dashboard", href: "index.html", label: "لوحة التحكم", icon: "dashboard" }] },
    {
      group: "العمليات", gk: "g_ops",
      items: [
        { key: "work-orders", href: "work-orders.html", label: "أوامر الشغل", icon: "workorders" },
        { key: "work-order-new", href: "work-order-new.html", label: "استقبال سيارة", icon: "receive" },
        { key: "quotations", href: "quotations.html", label: "عروض الأسعار", icon: "quotations" },
        { key: "insurance", href: "insurance.html", label: "التأمين", icon: "insurance" },
        { key: "observation", href: "observation.html", label: "مكتبة الفحص", icon: "observation" },
        { key: "gate-pass", href: "gate-pass.html", label: "تصاريح الخروج", icon: "gatepass" },
      ],
    },
    { group: "العملاء والسيارات", gk: "g_customers", items: [
      { key: "customers", href: "customers.html", label: "العملاء", icon: "customers" },
      { key: "vehicles", href: "vehicles.html", label: "السيارات", icon: "vehicles" },
      { key: "compliance", href: "compliance.html", label: "الضرائب والامتثال", icon: "compliance" },
    ] },
    {
      group: "المخزون", gk: "g_stock",
      items: [
        { key: "inventory", href: "inventory.html", label: "قطع الغيار", icon: "parts" },
        { key: "suppliers", href: "suppliers.html", label: "الموردين", icon: "suppliers" },
        { key: "purchases", href: "purchases.html", label: "المشتريات", icon: "purchases" },
        { key: "part-sales", href: "part-sales.html", label: "بيع قطع غيار", icon: "partsales" },
      ],
    },
    {
      group: "المالية", gk: "g_finance",
      items: [
        { key: "invoices", href: "invoices.html", label: "الفواتير", icon: "invoices" },
        { key: "treasury", href: "treasury.html", label: "الخزنة", icon: "treasury" },
        { key: "payments", href: "payments.html", label: "المدفوعات", icon: "payments" },
        { key: "income", href: "income.html", label: "الدخل", icon: "income" },
        { key: "expenses", href: "expenses.html", label: "المصروفات", icon: "expenses" },
        { key: "payroll", href: "payroll.html", label: "المرتبات", icon: "payroll" },
      ],
    },
    { group: "التقارير", gk: "g_reports", items: [{ key: "reports", href: "reports.html", label: "التقارير", icon: "reports" }] },
    { group: "النظام", gk: "g_system", items: [
      { key: "settings", href: "settings.html", label: "الإعدادات", icon: "settings" },
      { key: "tax-rates", href: "tax-rates.html", label: "معدلات الضرائب", icon: "taxrates" },
      { key: "email-templates", href: "email-templates.html", label: "قوالب الإيميل", icon: "mail" },
      { key: "custom-fields", href: "custom-fields.html", label: "حقول مخصصة", icon: "fields" },
      { key: "setup", href: "setup.html", label: "معالج الإعداد", icon: "setup" },
    ] },
  ];
  // مفاتيح الترجمة لعناصر القائمة وعناوين الصفحات
  var NAV_I18N = {
    dashboard: "nav_dashboard", "work-orders": "nav_work_orders", "work-order-new": "nav_work_order_new",
    quotations: "nav_quotations", insurance: "nav_insurance", observation: "nav_observation", "gate-pass": "nav_gate_pass",
    customers: "nav_customers", vehicles: "nav_vehicles", compliance: "nav_compliance",
    inventory: "nav_inventory", suppliers: "nav_suppliers", purchases: "nav_purchases",
    "part-sales": "nav_part_sales", invoices: "nav_invoices", payments: "nav_payments",
    income: "nav_income", expenses: "nav_expenses", treasury: "nav_treasury", payroll: "nav_payroll", reports: "nav_reports",
    settings: "nav_settings", "tax-rates": "nav_tax_rates", "email-templates": "nav_email_templates",
    "custom-fields": "nav_custom_fields", setup: "nav_setup"
  };
  var TITLE_I18N = {
    dashboard: ["t_dashboard", "d_dashboard"], "work-orders": ["t_work_orders", "d_work_orders"],
    "work-order-new": ["t_work_order_new", "d_work_order_new"], quotations: ["t_quotations", "d_quotations"], insurance: ["t_insurance", "d_insurance"],
    observation: ["t_observation", "d_observation"], customers: ["t_customers", "d_customers"],
    vehicles: ["t_vehicles", "d_vehicles"], inventory: ["t_inventory", "d_inventory"],
    suppliers: ["t_suppliers", "d_suppliers"], invoices: ["t_invoices", "d_invoices"],
    payments: ["t_payments", "d_payments"], expenses: ["t_expenses", "d_expenses"],
    "gate-pass": ["t_gate_pass", "d_gate_pass"], "part-sales": ["t_part_sales", "d_part_sales"],
    income: ["t_income", "d_income"], treasury: ["t_treasury", "d_treasury"], payroll: ["t_payroll", "d_payroll"], reports: ["t_reports", "d_reports"], settings: ["t_settings", "d_settings"],
    compliance: ["t_compliance", "d_compliance"], "custom-fields": ["t_custom_fields", "d_custom_fields"],
    setup: ["t_setup", "d_setup"], purchases: ["t_purchases", "d_purchases"],
    "tax-rates": ["t_tax_rates", "d_tax_rates"], "email-templates": ["t_email_templates", "d_email_templates"],
    admin: ["t_admin", "d_admin"]
  };
  // [عنوان الصفحة، وصفها] بلغة الواجهة الحالية
  function titleOf(key) {
    var tk = TITLE_I18N[key];
    if (tk) return [I18N.t(tk[0]), I18N.t(tk[1])];
    return TITLES_AR[key] || ["", ""];
  }
  function navLabelOf(item) {
    return NAV_I18N[item.key] ? I18N.t(NAV_I18N[item.key]) : item.label;
  }
  function groupLabelOf(g) {
    return g.gk ? I18N.t(g.gk) : g.group;
  }
  // المجموعة اللي فيها الصفحة دي (للـ breadcrumb)
  function groupOf(key) {
    for (var i = 0; i < NAV.length; i++) {
      for (var j = 0; j < NAV[i].items.length; j++) if (NAV[i].items[j].key === key) return NAV[i];
    }
    return null;
  }
  var TITLES_AR = {
    admin: ["الإدارة", "كل الورش المسجّلة في المنصة"],
  };
  var QUOTE_STATUSES = mk(["draft", "sent", "accepted", "rejected", "converted"], "quote_");
  var QUOTE_I18N = {
    draft: "quote_draft", sent: "quote_sent", accepted: "quote_accepted",
    rejected: "quote_rejected", converted: "quote_converted"
  };
  function quoteStatusLabel(k) {
    if (window.I18N && QUOTE_I18N[k]) return I18N.t(QUOTE_I18N[k]);
    return labelOf(QUOTE_STATUSES, k);
  }

  // ---------- init: كل صفحة بتبدأ بـ  var page = await UI.init("اسم-الصفحة"); ----------
  // الهيكل (القائمة الجانبية + الشريط العلوي) بيتبني مرة واحدة في js/shell.js وبيفضل ثابت طول الجلسة؛
  // init هنا بس بتحدّث "الصفحة النشطة" وبتتأكد من تسجيل الدخول، وبترجّع العنصر اللي الصفحة بتكتب فيه
  // (أو null لو المستخدم اتحوّل لصفحة تانية).
  async function init(active, opts) {
    opts = opts || {};
    var app = document.getElementById("app");

    if (DB.fatal) {
      app.innerHTML = html`<div class="login-wrap"><div class="card login-card error">${DB.fatal}</div></div>`;
      return null;
    }
    var S = window.Shell;
    S.ensure();
    S.setActive(active, opts);
    var pageEl = document.getElementById("page");

    // ---- التحقق من الجلسة: الجلسة محلية وسريعة، فبنتحقق مرة كل 5 دقايق مش في كل تنقّل ----
    if (!DB.demoMode) {
      if (Date.now() - S.state.checkedAt > 300000) {
        var session = null;
        try {
          session = await DB.auth.getSession();
        } catch (e) {
          // فشل تحميل مكتبة Supabase أو الشبكة: نعرض رسالة بدل ما الصفحة تفضل "جارٍ التحميل"
          pageEl.innerHTML = html`<div class="card login-card error">${I18N.t("err_lib_load")}</div>`;
          S.markReady();
          return null;
        }
        if (!session) { location.replace("login.html"); return null; }
        S.state.checkedAt = Date.now();
        S.setUser(session.user);
        await loadCurrency(session.user && session.user.id);
      }
    } else if (!S.state.currencyLoaded) {
      await loadCurrency("demo");
      S.state.currencyLoaded = true;
    }

    // ---- صلاحية الأدمن ----
    // صفحة الإدارة بس هي اللي لازم تستنى التأكيد (والداتابيز نفسها بتحمي الدوال).
    // باقي الصفحات: بنعتمد على القيمة المخزّنة ونأكّدها في الخلفية من غير ما نعطّل الصفحة.
    if (opts.adminOnly) {
      var realAdmin = await DB.isAdmin();
      S.setAdmin(realAdmin);
      if (!realAdmin) { S.go("index.html"); return null; }
    } else if (DB.demoMode) {
      S.setAdmin(true);
    } else if (!S.state.adminChecked) {
      // بنعتبر الفحص "تم" بس بعد وصول النتيجة؛ لو المستخدم سابنا قبل كده بنعيده في الصفحة اللي بعدها
      DB.isAdmin().then(function (v) { S.state.adminChecked = true; S.setAdmin(v); }, function () {});
    }
    return pageEl;
  }

  // ---------- أحداث عامة (event delegation) ----------
  // مستمع واحد على الصفحة كلها بيتعامل مع أي عنصر عليه data-action أو data-href.
  // (أحداث القشرة: القائمة، البحث السريع، اللغة… في js/shell.js)
  document.addEventListener("click", function (e) {
    var row = e.target.closest("tr[data-href]");
    var actionEl = e.target.closest("[data-action]");

    if (actionEl) {
      var action = actionEl.getAttribute("data-action");
      if (action === "signout") {
        DB.auth.signOut().then(function () { location.href = "login.html"; });
        return;
      }
      if (action === "reset-demo") {
        e.preventDefault();
        DB.resetDemo();
        location.reload();
        return;
      }
      if (action === "print") {
        window.print();
        return;
      }
    }
    // صف جدول قابل للضغط: انتقال داخل التطبيق (من غير إعادة تحميل)، وبيحترم Ctrl/⌘ لفتح تبويب جديد
    if (row && !actionEl) {
      var to = row.getAttribute("data-href");
      if (e.ctrlKey || e.metaKey) window.open(to, "_blank");
      else go(to);
    }
  });

  // تنقّل داخل التطبيق (Shell.go) مع رجوع لتحميل عادي لو القشرة مش موجودة
  function go(href) {
    if (window.Shell && Shell.go) return Shell.go(href);
    location.href = href;
  }
  // تسجيل سكربت صفحة: UI.page("اسم", async function () { var page = await UI.init("اسم"); ... })
  function page(name, fn) {
    if (!window.Shell) throw new Error("js/shell.js لازم يتحمّل بعد ui.js وقبل سكربت الصفحة");
    Shell.register(name, fn);
  }

  window.UI = {
    html: html,
    esc: esc,
    money: money,
    dateAr: dateAr,
    isToday: isToday,
    locale: locale,
    t: function (k, p) { return window.I18N ? I18N.t(k, p) : k; },
    STATUSES: STATUSES,
    PAY_METHODS: PAY_METHODS,
    INV_STATUSES: INV_STATUSES,
    PRIORITIES: PRIORITIES,
    priorityLabel: priorityLabel,
    isOverdue: isOverdue,
    invStatusLabel: invStatusLabel,
    statusLabel: statusLabel,
    methodLabel: methodLabel,
    quoteStatusLabel: quoteStatusLabel,
    QUOTE_STATUSES: QUOTE_STATUSES,
    isOpen: isOpen,
    byId: byId,
    option: option,
    enumOptions: enumOptions,
    CURRENCIES: CURRENCIES,
    currencyDefaultSymbol: currencyDefaultSymbol,
    currencyLabel: currencyLabel,
    getCurrency: function () { return { code: curState.code, symbol: curState.symbol }; },
    setCurrency: setCurrency,
    makePager: makePager,
    pageSlice: pageSlice,
    pagerBar: pagerBar,
    bindPager: bindPager,
    flash: flash,
    toast: toast,
    guard: guard,
    init: init,
    page: page,
    go: go,
    setShopName: setShopName,
    meta: {
      NAV: NAV, ICONS: ICONS, icon: icon, titleOf: titleOf,
      navLabelOf: navLabelOf, groupLabelOf: groupLabelOf, groupOf: groupOf,
    },
  };
})();
