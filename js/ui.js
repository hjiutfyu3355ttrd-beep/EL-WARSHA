// ============================================================
// أدوات الواجهة المشتركة: القوالب الآمنة، التنسيق، الشريط الجانبي.
// ============================================================
(function () {
  "use strict";

  // ---------- قوالب HTML آمنة ----------
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

  // ---------- تنسيق (حسب اللغة) ----------
  function locale() {
    return I18N.getLang() === "tr" ? "tr-TR" : "ar-EG";
  }

  function money(n) {
    return new Intl.NumberFormat(locale(), { maximumFractionDigits: 2 }).format(n || 0) + " " + I18N.t("currency");
  }
  function dateAr(s) {
    return new Date(s).toLocaleDateString(locale());
  }
  function isToday(iso) {
    return new Date(iso).toDateString() === new Date().toDateString();
  }

  function buildStatuses() {
    return [
      { key: "received", label: I18N.t("status_received") },
      { key: "inspecting", label: I18N.t("status_inspecting") },
      { key: "awaiting_approval", label: I18N.t("status_awaiting_approval") },
      { key: "in_progress", label: I18N.t("status_in_progress") },
      { key: "ready", label: I18N.t("status_ready") },
      { key: "delivered", label: I18N.t("status_delivered") },
      { key: "cancelled", label: I18N.t("status_cancelled") },
    ];
  }
  function buildPayMethods() {
    return [
      { key: "cash", label: I18N.t("pay_cash") },
      { key: "card", label: I18N.t("pay_card") },
      { key: "instapay", label: I18N.t("pay_instapay") },
      { key: "wallet", label: I18N.t("pay_wallet") },
      { key: "transfer", label: I18N.t("pay_transfer") },
    ];
  }

  function labelOf(list, key) {
    var f = list.filter(function (x) { return x.key === key; })[0];
    return f ? f.label : key;
  }
  function statusLabel(k) { return labelOf(buildStatuses(), k); }
  function methodLabel(k) { return labelOf(buildPayMethods(), k); }
  function isOpen(status) { return status !== "delivered" && status !== "cancelled"; }

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

  async function guard(fn) {
    try {
      await fn();
    } catch (e) {
      flash((e && e.message) || String(e));
    }
  }

  // ---------- الشريط الجانبي + حماية الصفحات ----------
  function buildLinks() {
    return [
      { key: "dashboard", href: "index.html", label: I18N.t("nav_dashboard") },
      { key: "work-orders", href: "work-orders.html", label: I18N.t("nav_work_orders") },
      { key: "customers", href: "customers.html", label: I18N.t("nav_customers") },
      { key: "inventory", href: "inventory.html", label: I18N.t("nav_inventory") },
      { key: "reports", href: "reports.html", label: I18N.t("nav_reports") },
      { key: "settings", href: "settings.html", label: I18N.t("nav_settings") },
    ];
  }

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

    var LINKS = buildLinks();

    app.innerHTML = html`
      <div class="layout">
        <aside class="sidebar">
          <h1>🔧 ${I18N.t("app_name")}</h1>
          ${LINKS.map(function (l) {
            return html`<a href="${l.href}" class="${l.key === active ? "active" : ""}">${l.label}</a>`;
          })}
          ${admin
            ? html`<div class="sep"></div><a href="admin.html" class="${active === "admin" ? "active" : ""}">🛡️ ${I18N.t("admin")}</a>`
            : ""}
          <div class="spacer"></div>
          <div class="lang-box">
            <label class="lang-label">${I18N.t("language")}</label>
            <select id="sidebar-lang" class="lang-select">
              <option value="ar" ${I18N.getLang() === "ar" ? "selected" : ""}>${I18N.t("arabic")}</option>
              <option value="tr" ${I18N.getLang() === "tr" ? "selected" : ""}>${I18N.t("turkish")}</option>
            </select>
          </div>
          ${DB.demoMode ? "" : html`<button class="ghost" data-action="signout">${I18N.t("signout")}</button>`}
        </aside>
        <main class="content">
          ${DB.demoMode
            ? html`<div class="notice no-print">${I18N.t("demo_notice")}
                <a class="link" href="#" data-action="reset-demo">${I18N.t("demo_reset")}</a></div>`
            : ""}
          <div id="page"><div class="empty">${I18N.t("loading")}</div></div>
        </main>
      </div>`;

    var langSel = document.getElementById("sidebar-lang");
    if (langSel) {
      langSel.addEventListener("change", function () {
        var lang = langSel.value;
        if (lang === I18N.getLang()) return;
        I18N.setLang(lang);
        location.reload();
      });
    }

    return document.getElementById("page");
  }

  // ---------- أحداث عامة ----------
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
    get STATUSES() { return buildStatuses(); },
    get PAY_METHODS() { return buildPayMethods(); },
    statusLabel: statusLabel,
    methodLabel: methodLabel,
    isOpen: isOpen,
    byId: byId,
    option: option,
    flash: flash,
    guard: guard,
    init: init,
    t: function (key, params) { return I18N.t(key, params); },
  };
})();
