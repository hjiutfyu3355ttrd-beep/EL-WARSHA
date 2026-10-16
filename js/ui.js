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
  function money(n) {
    return new Intl.NumberFormat("ar-EG", { maximumFractionDigits: 2 }).format(n || 0) + " ج.م";
  }
  function dateAr(s) {
    return new Date(s).toLocaleDateString("ar-EG");
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
  function statusLabel(k) { return labelOf(STATUSES, k); }
  function invStatusLabel(k) { return labelOf(INV_STATUSES, k); }
  function methodLabel(k) { return labelOf(PAY_METHODS, k); }
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

  // نفس مجموعات القائمة في برنامج الورشة (الصفحات الموجودة بس)
  var NAV = [
    { group: "الرئيسية", items: [{ key: "dashboard", href: "index.html", label: "لوحة التحكم", icon: "dashboard" }] },
    {
      group: "العمليات",
      items: [
        { key: "work-orders", href: "work-orders.html", label: "أوامر الشغل", icon: "workorder" },
        { key: "work-order-new", href: "work-order-new.html", label: "استقبال سيارة", icon: "receive" },
      ],
    },
    { group: "العملاء والسيارات", items: [{ key: "customers", href: "customers.html", label: "العملاء والسيارات", icon: "customers" }] },
    { group: "المخزون", items: [{ key: "inventory", href: "inventory.html", label: "قطع الغيار", icon: "parts" }] },
    {
      group: "المالية",
      items: [
        { key: "invoices", href: "invoices.html", label: "الفواتير", icon: "invoice" },
        { key: "payments", href: "payments.html", label: "المدفوعات", icon: "payments" },
      ],
    },
    { group: "التقارير", items: [{ key: "reports", href: "reports.html", label: "التقارير", icon: "reports" }] },
    { group: "النظام", items: [{ key: "settings", href: "settings.html", label: "الإعدادات", icon: "settings" }] },
  ];
  var TITLES = {
    dashboard: ["لوحة التحكم", "نظرة سريعة على الورشة اليوم"],
    "work-orders": ["أوامر الشغل", "متابعة كل أوامر الإصلاح"],
    "work-order-new": ["استقبال سيارة", "فتح أمر شغل جديد"],
    customers: ["العملاء والسيارات", "بيانات العملاء وسياراتهم"],
    inventory: ["قطع الغيار", "المخزون والنواقص"],
    invoices: ["الفواتير", "إصدار الفواتير ومتابعة التحصيل"],
    payments: ["المدفوعات", "سجل كل المبالغ المحصّلة"],
    reports: ["التقارير", "الإيرادات والأداء"],
    settings: ["الإعدادات", "الفنيون وبيانات الورشة"],
    admin: ["الإدارة", "كل الورش المسجّلة في المنصة"],
  };

  // كل صفحة بتبدأ بـ: const page = await UI.init("اسم-الصفحة");
  // بترجّع العنصر اللي الصفحة بتكتب فيه، أو null لو المستخدم اتحوّل (مش مسجّل دخول مثلاً).
  async function init(active, opts) {
    opts = opts || {};
    var app = document.getElementById("app");

    if (DB.fatal) {
      app.innerHTML = html`<div class="login-wrap"><div class="card login-card error">${DB.fatal}</div></div>`;
      return null;
    }

    if (!DB.demoMode) {
      var session = await DB.auth.getSession();
      if (!session) {
        location.replace("login.html");
        return null;
      }
    }

    var admin = await DB.isAdmin();
    if (opts.adminOnly && !admin) {
      location.replace("index.html");
      return null;
    }

    var title = TITLES[opts.key || active] || TITLES[active] || ["", ""];
    var navHtml = NAV.map(function (g) {
      return html`<div class="nav-group">${g.group}</div>
        ${g.items.map(function (l) {
          return html`<a class="nav ${l.key === active ? "active" : ""}" href="${l.href}"><span class="ic"></span>${l.label}</a>`;
        })}`;
    });
    app.innerHTML = html`
      <div class="layout" id="layout">
        <aside class="sidebar">
          <div class="brand"><img src="assets/img/logo.png" alt="" /><div><b>EL WARSHA</b><span>نظام إدارة الورش</span></div></div>
          ${navHtml}
          ${admin
            ? html`<div class="nav-group">المنصة</div><a class="nav ${active === "admin" ? "active" : ""}" href="admin.html"><span class="ic"></span>الإدارة</a>`
            : ""}
          <div class="spacer"></div>
          ${DB.demoMode ? "" : html`<button class="signout" data-action="signout">تسجيل الخروج</button>`}
        </aside>
        <div class="main">
          <header class="topbar no-print">
            <button class="menu-btn" data-action="toggle-nav" aria-label="القائمة">☰</button>
            <div class="ttl"><b>${title[0]}</b><span>${title[1]}</span></div>
            <a class="btn" href="work-order-new.html">＋ استقبال سيارة</a>
          </header>
          <main class="content">
            ${DB.demoMode
              ? html`<div class="notice no-print">وضع تجريبي: البيانات محفوظة في متصفحك فقط ومفيش اتصال بـ Supabase.
                  <a class="link" href="#" data-action="reset-demo">إعادة ضبط البيانات التجريبية</a></div>`
              : ""}
            <div id="page"><div class="empty">جارٍ التحميل…</div></div>
          </main>
        </div>
      </div>`;

    // الأيقونات: SVG ثابت من عندنا (مش من المستخدم) فبنحقنها بعد الرسم عشان قالب html بيعمل escape
    var ics = app.querySelectorAll(".sidebar a.nav .ic");
    var flat = [];
    NAV.forEach(function (g) { g.items.forEach(function (l) { flat.push(l.icon); }); });
    if (admin) flat.push("admin");
    for (var i = 0; i < ics.length; i++) ics[i].outerHTML = icon(flat[i]);

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
    STATUSES: STATUSES,
    PAY_METHODS: PAY_METHODS,
    INV_STATUSES: INV_STATUSES,
    invStatusLabel: invStatusLabel,
    statusLabel: statusLabel,
    methodLabel: methodLabel,
    isOpen: isOpen,
    byId: byId,
    option: option,
    flash: flash,
    guard: guard,
    init: init,
  };
})();
