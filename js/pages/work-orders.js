(async function () {
  var page = await UI.init("work-orders");
  if (!page) return;
  var html = UI.html;

  // تقسيم الحالات على التبويبات
  var TABS = [
    { key: "all", labelKey: "all", test: function () { return true; } },
    { key: "open", labelKey: "open_tab", test: function (o) { return ["received", "inspecting", "awaiting_approval", "approved"].indexOf(o.status) !== -1; } },
    { key: "progress", labelKey: "progress_tab", test: function (o) { return ["in_progress", "waiting_parts", "testing"].indexOf(o.status) !== -1; } },
    { key: "done", labelKey: "done_tab", test: function (o) { return o.status === "ready" || o.status === "delivered"; } },
    { key: "late", labelKey: "late_tab", test: function (o) { return UI.isOverdue(o); } },
  ];
  TABS.forEach(function (tab) { tab.label = I18N.t(tab.labelKey); });

  var st = { tab: "all", card: "", view: "list", q: "", status: "all", priority: "all" };
  try {
    var params = new URLSearchParams(location.search);
    var tabQ = params.get("tab");
    if (tabQ && ["all", "open", "progress", "done", "late"].indexOf(tabQ) !== -1) st.tab = tabQ;
    var viewQ = params.get("view") || sessionStorage.getItem("ws_wo_view");
    if (viewQ === "grid" || viewQ === "list") st.view = viewQ;
  } catch (e) {}
  var orders = [], customers = {}, vehicles = {}, techs = {}, lines = [];

  page.innerHTML = html`
    <div class="stack">
      <div class="head-row">
        <div><h2>${I18N.t("t_work_orders")}</h2><p>${I18N.t("d_work_orders")}</p></div>
        <div class="actions no-print">
          <button class="secondary" data-act="refresh">⟳ ${I18N.t("refresh")}</button>
          <button class="secondary" data-act="export">⭳ ${I18N.t("export")}</button>
          <a class="btn primary" href="work-order-new.html">＋ ${I18N.t("create_wo")}</a>
        </div>
      </div>

      <div class="grid" id="cards"></div>

      <div class="toolbar">
        <div class="tabs" id="tabs"></div>
        <div class="right">
          <input id="q" type="search" placeholder="${I18N.t("search_wo")}">
          <button class="secondary" data-act="filters">⚲ ${I18N.t("filter")}</button>
          <button class="secondary icon-btn on" data-act="view" data-v="list" title="${I18N.t("view_list")}">☰</button>
          <button class="secondary icon-btn" data-act="view" data-v="grid" title="${I18N.t("view_cards")}">▦</button>
        </div>
      </div>

      <div class="card filters" id="filters">
        <div class="field"><label>${I18N.t("status_filter")}</label>
          <select id="f-status"><option value="all">${I18N.t("all_statuses")}</option>
            ${UI.STATUSES.map(function (s) { return html`<option value="${s.key}">${UI.statusLabel(s.key)}</option>`; })}</select></div>
        <div class="field"><label>${I18N.t("priority_filter")}</label>
          <select id="f-priority"><option value="all">${I18N.t("all_priorities")}</option>
            ${UI.PRIORITIES.map(function (p) { return html`<option value="${p.key}">${UI.priorityLabel(p.key)}</option>`; })}</select></div>
      </div>

      <div id="list"><div class="empty">${I18N.t("loading")}</div></div>
    </div>`;

  var $ = function (id) { return document.getElementById(id); };

  function total(id) {
    return lines.filter(function (l) { return l.work_order_id === id; })
      .reduce(function (s, l) { return s + l.qty * l.unit_price; }, 0);
  }

  function renderCards() {
    var live = orders.filter(function (o) { return o.status !== "cancelled"; });
    var items = [
      { k: "", label: I18N.t("total_orders"), v: String(orders.length), sub: I18N.t("all_orders_sub"), c: "#64748b" },
      { k: "high", label: I18N.t("high_priority"), v: String(orders.filter(function (o) { return (o.priority === "high" || o.priority === "critical") && UI.isOpen(o.status); }).length), sub: I18N.t("high_priority_sub"), c: "#eab308" },
      { k: "approval", label: I18N.t("awaiting_approval_card"), v: String(orders.filter(function (o) { return o.status === "awaiting_approval"; }).length), sub: I18N.t("awaiting_approval_sub"), c: "#d97706" },
      { k: "cost", label: I18N.t("total_cost"), v: UI.money(live.reduce(function (s, o) { return s + total(o.id); }, 0)), sub: I18N.t("total_cost_sub"), c: "#10b26c" },
      { k: "late", label: I18N.t("late_orders"), v: String(orders.filter(UI.isOverdue).length), sub: I18N.t("late_orders_sub"), c: "#b91c1c" },
    ];
    $("cards").innerHTML = html`${items.map(function (i) {
      var pick = i.k !== "cost";
      return html`<div class="card stat ${pick ? "pick" : ""} ${st.card === i.k && i.k ? "on" : ""}" style="--accent:${i.c}" data-card="${pick ? i.k : "cost"}">
        <div class="label">${i.label}</div><div class="value">${i.v}</div><small>${i.sub}</small></div>`;
    })}`;
  }

  function filtered(ignoreTab) {
    var q = st.q.trim().toLowerCase();
    return orders.filter(function (o) {
      if (!ignoreTab && !TABS.filter(function (t) { return t.key === st.tab; })[0].test(o)) return false;
      if (st.card === "high" && !((o.priority === "high" || o.priority === "critical") && UI.isOpen(o.status))) return false;
      if (st.card === "approval" && o.status !== "awaiting_approval") return false;
      if (st.status !== "all" && o.status !== st.status) return false;
      if (st.priority !== "all" && (o.priority || "normal") !== st.priority) return false;
      var c = customers[o.customer_id], v = vehicles[o.vehicle_id];
      return (o.number + " " + (c ? c.name : "") + " " + (v ? v.plate : "")).toLowerCase().indexOf(q) !== -1;
    });
  }

  function renderTabs() {
    var base = filtered(true);
    $("tabs").innerHTML = html`${TABS.map(function (t) {
      var n = base.filter(t.test).length;
      return html`<button class="${st.tab === t.key ? "on" : ""}" data-tab="${t.key}">${t.label}<span>${n}</span></button>`;
    })}`;
  }

  function renderList() {
    var shown = filtered(false);
    if (shown.length === 0) {
      $("list").innerHTML = html`<div class="card empty-state">
        <svg viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4h6a1 1 0 0 1 1 1v1H8V5a1 1 0 0 1 1-1z"/><path d="M8 6H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-2"/><path d="M9 12h6M9 16h4"/></svg>
        <h3>${I18N.t("empty_wo")}</h3>
        <p>${orders.length === 0 ? I18N.t("empty_wo_hint_new") : I18N.t("empty_wo_hint_filter")}</p>
        ${orders.length === 0 ? html`<a class="btn" href="work-order-new.html">＋ ${I18N.t("create_first_wo")}</a>` : ""}</div>`;
      return;
    }
    if (st.view === "grid") {
      $("list").innerHTML = html`<div class="cards-grid">${shown.map(function (o) {
        var c = customers[o.customer_id], v = vehicles[o.vehicle_id];
        return html`<a class="wo-card" href="work-order.html?id=${o.id}">
          <div class="top"><b>#${o.number}</b><span class="badge ${o.status}">${UI.statusLabel(o.status)}</span></div>
          <div><b>${c ? c.name : "—"}</b></div>
          <p>${v ? v.plate + " — " + v.make + " " + v.model : "—"}</p>
          <p><span class="badge prio-${o.priority || "normal"}">${UI.priorityLabel(o.priority)}</span>
            · ${UI.money(total(o.id))}${UI.isOverdue(o) ? html` · <span class="late">${I18N.t("late_badge")}</span>` : ""}</p></a>`;
      })}</div>`;
      return;
    }
    $("list").innerHTML = html`<div class="table-wrap"><table class="clickable">
      <thead><tr><th>${I18N.t("number_col")}</th><th>${I18N.t("customer")}</th><th>${I18N.t("vehicle")}</th><th>${I18N.t("priority_filter")}</th><th>${I18N.t("status_filter")}</th><th>${I18N.t("technician")}</th><th>${I18N.t("expected_delivery")}</th><th>${I18N.t("total")}</th></tr></thead>
      <tbody>${shown.map(function (o) {
        return html`<tr data-href="work-order.html?id=${o.id}">
          <td><b>#${o.number}</b></td>
          <td>${customers[o.customer_id] ? customers[o.customer_id].name : "—"}</td>
          <td>${vehicles[o.vehicle_id] ? vehicles[o.vehicle_id].plate : "—"}</td>
          <td><span class="badge prio-${o.priority || "normal"}">${UI.priorityLabel(o.priority)}</span></td>
          <td><span class="badge ${o.status}">${UI.statusLabel(o.status)}</span></td>
          <td>${techs[o.technician_id] ? techs[o.technician_id].name : "—"}</td>
          <td class="${UI.isOverdue(o) ? "late" : ""}">${o.expected_delivery_at ? UI.dateAr(o.expected_delivery_at) : "—"}</td>
          <td>${UI.money(total(o.id))}</td></tr>`;
      })}</tbody></table></div>`;
  }

  function renderAll() { renderCards(); renderTabs(); renderList(); }

  async function load() {
    var d = await Promise.all([
      DB.list("work_orders"), DB.list("customers"), DB.list("vehicles"), DB.list("work_order_lines"), DB.list("technicians"),
    ]);
    orders = d[0]; customers = UI.byId(d[1]); vehicles = UI.byId(d[2]); lines = d[3]; techs = UI.byId(d[4]);
  }

  function exportCsv() {
    var rows = [[I18N.t("number_col"), I18N.t("customer"), I18N.t("plate"), I18N.t("priority_filter"), I18N.t("status_filter"), I18N.t("technician"), I18N.t("expected_delivery"), I18N.t("total"), I18N.t("opened_at")]];
    filtered(false).forEach(function (o) {
      rows.push([
        o.number, customers[o.customer_id] ? customers[o.customer_id].name : "", vehicles[o.vehicle_id] ? vehicles[o.vehicle_id].plate : "",
        UI.priorityLabel(o.priority), UI.statusLabel(o.status), techs[o.technician_id] ? techs[o.technician_id].name : "",
        o.expected_delivery_at ? o.expected_delivery_at.slice(0, 10) : "", total(o.id), o.created_at.slice(0, 10),
      ]);
    });
    var csv = rows.map(function (r) {
      return r.map(function (v) { return '"' + String(v).replace(/"/g, '""') + '"'; }).join(",");
    }).join("\r\n");
    var a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }));
    a.download = "work-orders.csv";
    document.body.appendChild(a); a.click(); a.remove();
  }

  page.addEventListener("click", function (e) {
    var t = e.target.closest("[data-tab],[data-card],[data-act]");
    if (!t) return;
    if (t.hasAttribute("data-tab")) { st.tab = t.getAttribute("data-tab"); st.card = st.tab === "late" ? "" : st.card; renderAll(); return; }
    if (t.hasAttribute("data-card")) {
      var k = t.getAttribute("data-card");
      if (k === "cost") return;
      if (k === "late") { st.tab = st.tab === "late" ? "all" : "late"; st.card = ""; }
      else { st.card = st.card === k ? "" : k; if (st.card) st.tab = "all"; }
      renderAll(); return;
    }
    var a = t.getAttribute("data-act");
    if (a === "refresh") UI.guard(async function () { await load(); renderAll(); });
    else if (a === "export") exportCsv();
    else if (a === "filters") $("filters").classList.toggle("open");
    else if (a === "view") {
      st.view = t.getAttribute("data-v"); try { sessionStorage.setItem("ws_wo_view", st.view); } catch (e) {}
      var vb = page.querySelectorAll("[data-act=view]");
      for (var i = 0; i < vb.length; i++) vb[i].classList.toggle("on", vb[i] === t);
      renderList();
    }
  });
  $("q").addEventListener("input", function () { st.q = this.value; renderTabs(); renderList(); });
  $("f-status").addEventListener("change", function () { st.status = this.value; renderTabs(); renderList(); });
  $("f-priority").addEventListener("change", function () { st.priority = this.value; renderTabs(); renderList(); });

  await UI.guard(async function () { await load(); renderAll(); });
})();
