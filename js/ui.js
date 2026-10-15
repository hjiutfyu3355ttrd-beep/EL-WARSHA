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
    { key: "in_progress", label: "تحت التنفيذ" },
    { key: "ready", label: "جاهزة" },
    { key: "delivered", label: "تم التسليم" },
    { key: "cancelled", label: "ملغي" },
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
  var LINKS = [
    { key: "dashboard", href: "index.html", label: "الرئيسية" },
    { key: "work-orders", href: "work-orders.html", label: "أوامر الشغل" },
    { key: "customers", href: "customers.html", label: "العملاء والسيارات" },
    { key: "inventory", href: "inventory.html", label: "المخزون" },
    { key: "reports", href: "reports.html", label: "التقارير" },
    { key: "settings", href: "settings.html", label: "الإعدادات" },
  ];

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

    app.innerHTML = html`
      <div class="layout">
        <aside class="sidebar">
          <h1>🔧 نظام الورشة</h1>
          ${LINKS.map(function (l) {
            return html`<a href="${l.href}" class="${l.key === active ? "active" : ""}">${l.label}</a>`;
          })}
          ${admin
            ? html`<div class="sep"></div><a href="admin.html" class="${active === "admin" ? "active" : ""}">🛡️ الإدارة</a>`
            : ""}
          <div class="spacer"></div>
          ${DB.demoMode ? "" : html`<button class="ghost" data-action="signout">تسجيل الخروج</button>`}
        </aside>
        <main class="content">
          ${DB.demoMode
            ? html`<div class="notice no-print">وضع تجريبي: البيانات محفوظة في متصفحك فقط ومفيش اتصال بـ Supabase.
                <a class="link" href="#" data-action="reset-demo">إعادة ضبط البيانات التجريبية</a></div>`
            : ""}
          <div id="page"><div class="empty">جارٍ التحميل…</div></div>
        </main>
      </div>`;

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
      if (action === "print") {
        window.print();
        return;
      }
    }
    if (row && !actionEl) location.href = row.getAttribute("data-href");
  });

  window.UI = {
    html: html,
    esc: esc,
    money: money,
    dateAr: dateAr,
    isToday: isToday,
    STATUSES: STATUSES,
    PAY_METHODS: PAY_METHODS,
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
