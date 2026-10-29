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
    return (window.I18N && I18N.getLang() === "tr") ? "tr-TR" : "ar-EG";
  }
  function money(n) {
    var cur = (window.I18N && I18N.t("currency")) || "ج.م";
    return new Intl.NumberFormat(locale(), { maximumFractionDigits: 2 }).format(n || 0) + " " + cur;
  }
  function dateAr(s) {
    return new Date(s).toLocaleDateString(locale());
  }
  function isToday(iso) {
    return new Date(iso).toDateString() === new Date().toDateString();
  }

  var STATUSES = [
    { key: "received", label: "استلام" },
    { key: "inspecting", label: "فحص" },
    { key: "awaiting_approval", label: "انتظار موافقة العميل" },
    { key: "approved", label: "معتمد من العميل" },
    { key: "in_progress", label: "تحت التنفيذ" },
    { key: "waiting_parts", label: "بانتظار قطعة غيار" },
    { key: "testing", label: "اختبار" },
    { key: "ready", label: "جاهزة" },
    { key: "delivered", label: "تم التسليم" },
    { key: "cancelled", label: "ملغي" },
  ];
  var PRIORITIES = [
    { key: "low", label: "منخفضة" },
    { key: "normal", label: "عادية" },
    { key: "high", label: "عالية" },
    { key: "critical", label: "حرجة" },
  ];
  var INV_STATUSES = [
    { key: "draft", label: "مسودة" },
    { key: "issued", label: "صادرة" },
    { key: "partially_paid", label: "مدفوعة جزئياً" },
    { key: "paid", label: "مدفوعة" },
    { key: "cancelled", label: "ملغاة" },
  ];
  var PAY_METHODS = [
    { key: "cash", label: "نقدي" },
    { key: "card", label: "بطاقة" },
    { key: "instapay", label: "إنستاباي" },
    { key: "wallet", label: "محفظة (فودافون كاش)" },
    { key: "transfer", label: "تحويل بنكي" },
  ];

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
  function invStatusLabel(k) { return labelOf(INV_STATUSES, k); }
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

  // ---------- رسائل ----------
  function flash(msg, type) {
    var d = document.createElement("div");
    d.className = "toast " + (type || "error");
    d.textContent = msg;
    document.body.appendChild(d);
    setTimeout(function () { d.remove(); }, 4500);
  }

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

  // ---------- الشريط الجانبي + حماية الصفحات ----------
  // أيقونات بسيطة (SVG stroke) — بتتلوّن بلون الحالة من CSS
  var ICONS = {
    dashboard: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
    workorder: '<path d="M9 11l3 3 8-8"/><path d="M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9"/>',
    receive: '<path d="M5 17h14M6 17l1.5-6h9L18 17M7 17v2M17 17v2"/><circle cx="8.5" cy="14" r=".6"/><circle cx="15.5" cy="14" r=".6"/><path d="M12 3v4M10 5l2 2 2-2"/>',
    customers: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.6-3.4 3.2-5.5 6.5-5.5s5.9 2.1 6.5 5.5"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.8c1.8.7 3 2.4 3.5 5.2"/>',
    parts: '<path d="M21 8l-9-5-9 5v8l9 5 9-5z"/><path d="M3.3 7.5L12 12.5l8.7-5M12 22V12.5"/>',
    invoice: '<path d="M6 2h9l4 4v16l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6M9 16h3"/>',
    payments: '<rect x="2" y="5" width="20" height="14" rx="2.5"/><path d="M2 10h20M6 15h4"/>',
    reports: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    admin: '<path d="M12 3l8 3v6c0 4.5-3.2 8-8 9-4.8-1-8-4.5-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
  };
  function icon(name) {
    return '<svg viewBox="0 0 24 24" aria-hidden="true">' + (ICONS[name] || "") + "</svg>";
  }

  // مجموعات القائمة على طراز Garage Master
  var NAV = [
    { group: "الرئيسية", items: [{ key: "dashboard", href: "index.html", label: "لوحة التحكم", icon: "dashboard" }] },
    {
      group: "العمليات",
      items: [
        { key: "work-orders", href: "work-orders.html", label: "أوامر الشغل", icon: "workorder" },
        { key: "work-order-new", href: "work-order-new.html", label: "استقبال سيارة", icon: "receive" },
        { key: "quotations", href: "quotations.html", label: "عروض الأسعار", icon: "invoice" },
        { key: "observation", href: "observation.html", label: "مكتبة الفحص", icon: "workorder" },
        { key: "gate-pass", href: "gate-pass.html", label: "تصاريح الخروج", icon: "receive" },
      ],
    },
    { group: "العملاء والسيارات", items: [
      { key: "customers", href: "customers.html", label: "العملاء", icon: "customers" },
      { key: "vehicles", href: "vehicles.html", label: "السيارات", icon: "receive" },
      { key: "compliance", href: "compliance.html", label: "الضرائب والامتثال", icon: "invoice" },
    ] },
    {
      group: "المخزون",
      items: [
        { key: "inventory", href: "inventory.html", label: "قطع الغيار", icon: "parts" },
        { key: "suppliers", href: "suppliers.html", label: "الموردين", icon: "parts" },
        { key: "purchases", href: "purchases.html", label: "المشتريات", icon: "parts" },
        { key: "part-sales", href: "part-sales.html", label: "بيع قطع غيار", icon: "parts" },
      ],
    },
    {
      group: "المالية",
      items: [
        { key: "invoices", href: "invoices.html", label: "الفواتير", icon: "invoice" },
        { key: "payments", href: "payments.html", label: "المدفوعات", icon: "payments" },
        { key: "income", href: "income.html", label: "الدخل", icon: "payments" },
        { key: "expenses", href: "expenses.html", label: "المصروفات", icon: "payments" },
      ],
    },
    { group: "التقارير", items: [{ key: "reports", href: "reports.html", label: "التقارير", icon: "reports" }] },
    { group: "النظام", items: [
      { key: "settings", href: "settings.html", label: "الإعدادات", icon: "settings" },
      { key: "tax-rates", href: "tax-rates.html", label: "معدلات الضرائب", icon: "invoice" },
      { key: "email-templates", href: "email-templates.html", label: "قوالب الإيميل", icon: "settings" },
      { key: "custom-fields", href: "custom-fields.html", label: "حقول مخصصة", icon: "settings" },
      { key: "setup", href: "setup.html", label: "معالج الإعداد", icon: "dashboard" },
    ] },
  ];
  var TITLES = {
    dashboard: ["لوحة التحكم", "نظرة سريعة على الورشة اليوم"],
    "work-orders": ["أوامر الشغل", "إدارة ومتابعة أوامر الصيانة"],
    "work-order-new": ["استقبال سيارة", "فتح أمر شغل جديد"],
    quotations: ["عروض الأسعار", "إنشاء ومتابعة عروض الأسعار للعملاء"],
    observation: ["مكتبة الفحص", "نقاط الفحص حسب نوع المركبة"],
    customers: ["العملاء", "بيانات العملاء وسياراتهم"],
    vehicles: ["السيارات", "ملفات المركبات والصور وسجل الصيانة"],
    inventory: ["قطع الغيار", "المخزون والنواقص"],
    suppliers: ["الموردين", "إدارة الموردين وبياناتهم"],
    invoices: ["الفواتير", "إصدار الفواتير ومتابعة التحصيل"],
    payments: ["المدفوعات", "سجل كل المبالغ المحصّلة"],
    expenses: ["المصروفات", "تسجيل ومتابعة مصروفات الورشة"],
    "gate-pass": ["تصاريح الخروج", "دخول وخروج المركبات من الورشة"],
    "part-sales": ["بيع قطع غيار", "بيع مباشر لقطع الغيار بدون أمر شغل"],
    income: ["الدخل", "سجل الإيرادات الأخرى والمدفوعات"],
    reports: ["التقارير", "الإيرادات والأداء"],
    settings: ["الإعدادات", "الفنيون وبيانات الورشة"],
    compliance: ["الضرائب والامتثال", "ضرائب ورخص المركبات"],
    "custom-fields": ["حقول مخصصة", "توسيع نماذج العملاء والمركبات"],
    setup: ["معالج الإعداد", "خطوات تجهيز الورشة لأول مرة"],
    purchases: ["المشتريات", "أوامر شراء من الموردين ودخول مخزون"],
    "tax-rates": ["معدلات الضرائب", "ضرائب الخدمة والمنتجات"],
    "email-templates": ["قوالب الإيميل", "نصوص الإشعارات للعملاء"],
    admin: ["الإدارة", "كل الورش المسجّلة في المنصة"],
  };
  var QUOTE_STATUSES = [
    { key: "draft", label: "مسودة" },
    { key: "sent", label: "مرسل" },
    { key: "accepted", label: "مقبول" },
    { key: "rejected", label: "مرفوض" },
    { key: "converted", label: "تحوّل لأمر شغل" },
  ];
  var QUOTE_I18N = {
    draft: "quote_draft", sent: "quote_sent", accepted: "quote_accepted",
    rejected: "quote_rejected", converted: "quote_converted"
  };
  function quoteStatusLabel(k) {
    if (window.I18N && QUOTE_I18N[k]) return I18N.t(QUOTE_I18N[k]);
    return labelOf(QUOTE_STATUSES, k);
  }

  // كل صفحة بتبدأ بـ: const page = await UI.init("اسم-الصفحة");
  // بترجّع العنصر اللي الصفحة بتكتب فيه، أو null لو المستخدم اتحوّل (مش مسجّل دخول مثلاً).
  async function init(active, opts) {
    opts = opts || {};
    var app = document.getElementById("app");

    if (DB.fatal) {
      app.innerHTML = html`<div class="login-wrap"><div class="card login-card error">${DB.fatal}</div></div>`;
      return null;
    }

    // الأدمن بيتخزّن مؤقتًا في الجلسة عشان الشريط الجانبي يتبني فورًا من غير وميض
    var admin = false;
    try { admin = sessionStorage.getItem("ws_admin") === "1"; } catch (e) {}
    var needCheck = !DB.demoMode;

    var title = TITLES[opts.key || active] || TITLES[active] || ["", ""];
    var navLabel = {
      dashboard: "nav_dashboard", "work-orders": "nav_work_orders", "work-order-new": "nav_work_order_new",
      quotations: "nav_quotations", observation: "nav_observation", "gate-pass": "nav_gate_pass",
      customers: "nav_customers", vehicles: "nav_vehicles", compliance: "nav_compliance",
      inventory: "nav_inventory", suppliers: "nav_suppliers", purchases: "nav_purchases",
      "part-sales": "nav_part_sales", invoices: "nav_invoices", payments: "nav_payments",
      income: "nav_income", expenses: "nav_expenses", reports: "nav_reports",
      settings: "nav_settings", "tax-rates": "nav_tax_rates", "email-templates": "nav_email_templates",
      "custom-fields": "nav_custom_fields", setup: "nav_setup"
    };
    var groupLabel = {
      "الرئيسية": "g_home", "العمليات": "g_ops", "التشغيل": "g_ops",
      "العملاء والسيارات": "g_customers", "المخزون": "g_stock",
      "المالية": "g_finance", "التقارير": "g_reports", "النظام": "g_system"
    };
    var titleKey = {
      dashboard: ["t_dashboard","d_dashboard"], "work-orders": ["t_work_orders","d_work_orders"],
      "work-order-new": ["t_work_order_new","d_work_order_new"], quotations: ["t_quotations","d_quotations"],
      observation: ["t_observation","d_observation"], customers: ["t_customers","d_customers"],
      vehicles: ["t_vehicles","d_vehicles"], inventory: ["t_inventory","d_inventory"],
      suppliers: ["t_suppliers","d_suppliers"], invoices: ["t_invoices","d_invoices"],
      payments: ["t_payments","d_payments"], expenses: ["t_expenses","d_expenses"],
      "gate-pass": ["t_gate_pass","d_gate_pass"], "part-sales": ["t_part_sales","d_part_sales"],
      income: ["t_income","d_income"], reports: ["t_reports","d_reports"], settings: ["t_settings","d_settings"],
      compliance: ["t_compliance","d_compliance"], "custom-fields": ["t_custom_fields","d_custom_fields"],
      setup: ["t_setup","d_setup"], purchases: ["t_purchases","d_purchases"],
      "tax-rates": ["t_tax_rates","d_tax_rates"], "email-templates": ["t_email_templates","d_email_templates"],
      admin: ["t_admin","d_admin"]
    };
    var tk = titleKey[opts.key || active] || titleKey[active];
    if (tk) title = [I18N.t(tk[0]), I18N.t(tk[1])];
    var navHtml = NAV.map(function (g) {
      var gname = groupLabel[g.group] ? I18N.t(groupLabel[g.group]) : g.group;
      return html`<div class="nav-group">${gname}</div>
        ${g.items.map(function (l) {
          var lab = navLabel[l.key] ? I18N.t(navLabel[l.key]) : l.label;
          return html`<a class="nav ${l.key === active ? "active" : ""}" href="${l.href}"><span class="ic"></span>${lab}</a>`;
        })}`;
    });
    app.innerHTML = html`
      <div class="layout" id="layout">
        <aside class="sidebar">
          <div class="brand">
            <img src="assets/img/logo.svg" alt="" />
            <div><b>${I18N.t("app_name")}</b><span>${I18N.t("app_tag")}</span></div>
          </div>
          <input class="menu-search" id="menu-search" type="search" placeholder="${I18N.t("menu_search")}" />
          ${navHtml}
          ${admin
            ? html`<div class="nav-group">${I18N.t("platform")}</div><a class="nav ${active === "admin" ? "active" : ""}" href="admin.html"><span class="ic"></span>${I18N.t("admin")}</a>`
            : ""}
          <div class="spacer"></div>
          <div class="lang-box">
            <label class="lang-label">${I18N.t("language")}</label>
            <select id="sidebar-lang" class="lang-select">
              <option value="ar" ${I18N.getLang() === "ar" ? "selected" : ""}>${I18N.t("arabic")}</option>
              <option value="tr" ${I18N.getLang() === "tr" ? "selected" : ""}>${I18N.t("turkish")}</option>
            </select>
          </div>
          ${DB.demoMode ? "" : html`<button class="signout" data-action="signout">${I18N.t("signout")}</button>`}
        </aside>
        <div class="main">
          <header class="topbar no-print">
            <button class="menu-btn" data-action="toggle-nav" aria-label="القائمة">☰</button>
            <div class="crumbs"><a href="index.html">${I18N.t("home")}</a><i>›</i><b>${title[0]}</b></div>
            <a class="btn primary" href="work-order-new.html">${I18N.t("receive_vehicle")}</a>
          </header>
          <main class="content">
            ${DB.demoMode
              ? html`<div class="notice no-print">${I18N.t("demo_notice")}
                  <a class="link" href="#" data-action="reset-demo">${I18N.t("demo_reset")}</a></div>`
              : ""}
            <div id="page"><div class="empty page-skel">جارٍ التحميل…</div></div>
          </main>
        </div>
      </div>`;

    // بحث في القائمة الجانبية (debounce لتقليل شغل DOM أثناء الكتابة)
    var ms = document.getElementById("menu-search");
    var searchTimer = null;
    ms.addEventListener("input", function () {
      if (searchTimer) clearTimeout(searchTimer);
      searchTimer = setTimeout(function () {
        var q = ms.value.trim();
        var links = app.querySelectorAll(".sidebar a.nav");
        for (var k = 0; k < links.length; k++) {
          links[k].style.display = !q || links[k].textContent.indexOf(q) !== -1 ? "" : "none";
        }
      }, 60);
    });

    // الأيقونات: SVG ثابت من عندنا (مش من المستخدم) فبنحقنها بعد الرسم عشان قالب html بيعمل escape
    var ics = app.querySelectorAll(".sidebar a.nav .ic");
    var flat = [];
    NAV.forEach(function (g) { g.items.forEach(function (l) { flat.push(l.icon); }); });
    if (admin) flat.push("admin");
    for (var i = 0; i < ics.length; i++) ics[i].outerHTML = icon(flat[i]);

    // حفظ/استرجاع مكان سكرول السايدبار عشان القائمة ما تقفزش بين الصفحات
    var sb = app.querySelector(".sidebar");
    try { sb.scrollTop = parseInt(sessionStorage.getItem("ws_sb_scroll") || "0", 10); } catch (e) {}
    window.addEventListener("pagehide", function () { try { sessionStorage.setItem("ws_sb_scroll", String(sb.scrollTop)); } catch (e) {} });

    // التحقق الحقيقي بعد ما الهيكل ظهر (الصفحة هتفضل شغالة لو تمام)
    if (needCheck) {
      var session = await DB.auth.getSession();
      if (!session) { location.replace("login.html"); return null; }
    }
    var realAdmin = await DB.isAdmin();
    try { sessionStorage.setItem("ws_admin", realAdmin ? "1" : "0"); } catch (e) {}
    if (opts.adminOnly && !realAdmin) { location.replace("index.html"); return null; }
    // لو حالة الأدمن اتغيّرت: نحدّث الواجهة من غير reload كامل (ثبات التنقل)
    if (realAdmin !== admin) {
      admin = realAdmin;
      var plat = app.querySelector(".sidebar .nav-group");
      // إعادة بناء رابط الأدمن فقط لو لزم
      var side = app.querySelector(".sidebar");
      if (side && realAdmin && !side.querySelector('a.nav[href="admin.html"]')) {
        var langBox = side.querySelector(".lang-box");
        var grp = document.createElement("div");
        grp.className = "nav-group";
        grp.textContent = I18N.t("platform");
        var a = document.createElement("a");
        a.className = "nav" + (active === "admin" ? " active" : "");
        a.href = "admin.html";
        a.innerHTML = '<span class="ic"></span>' + I18N.t("admin");
        if (langBox) {
          side.insertBefore(grp, langBox);
          side.insertBefore(a, langBox);
        }
      }
    }
    var langSel = document.getElementById("sidebar-lang");
    if (langSel) {
      langSel.addEventListener("change", function () {
        if (langSel.value === I18N.getLang()) return;
        I18N.setLang(langSel.value);
        location.reload();
      });
    }
    // Prefetch صفحات التنقل عند المرور بالماوس → انتقال أسرع وأثبت إحساسًا
    var navLinks = app.querySelectorAll(".sidebar a.nav[href], .topbar a.btn[href]");
    var prefetched = {};
    function prefetch(href) {
      if (!href || prefetched[href] || href.indexOf("#") === 0) return;
      prefetched[href] = true;
      var l = document.createElement("link");
      l.rel = "prefetch";
      l.href = href;
      document.head.appendChild(l);
    }
    for (var ni = 0; ni < navLinks.length; ni++) {
      (function (el) {
        el.addEventListener("mouseenter", function () { prefetch(el.getAttribute("href")); }, { passive: true });
        el.addEventListener("touchstart", function () { prefetch(el.getAttribute("href")); }, { passive: true });
      })(navLinks[ni]);
    }
    // تمييز الرابط النشط فور الضغط قبل ما الصفحة تتحمّل (ثبات بصري)
    app.querySelector(".sidebar") && app.querySelector(".sidebar").addEventListener("click", function (e) {
      var a = e.target.closest("a.nav");
      if (!a) return;
      var all = app.querySelectorAll(".sidebar a.nav");
      for (var i = 0; i < all.length; i++) all[i].classList.remove("active");
      a.classList.add("active");
    });
    return document.getElementById("page");
  }

  // ---------- أحداث عامة (event delegation) ----------
  // مستمع واحد على الصفحة كلها بيتعامل مع أي عنصر عليه data-action أو data-href.
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
      if (action === "toggle-nav") {
        document.getElementById("layout").classList.toggle("nav-open");
        return;
      }
      if (action === "print") {
        window.print();
        return;
      }
    }
    if (row && !actionEl) location.href = row.getAttribute("data-href");
  });

  document.addEventListener("click", function (e) {
    var l = document.getElementById("layout");
    if (l && l.classList.contains("nav-open") && !e.target.closest(".sidebar") && !e.target.closest("[data-action='toggle-nav']")) {
      l.classList.remove("nav-open");
    }
  });

  window.UI = {
    html: html,
    esc: esc,
    money: money,
    dateAr: dateAr,
    isToday: isToday,
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
    flash: flash,
    toast: toast,
    guard: guard,
    init: init,
  };
})();
