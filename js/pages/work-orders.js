UI.page("work-orders", async function () {
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
    // أوامر التأمين اللي فلوسها لسه ما اتستلمتش (حتى لو السيارة اتسلّمت)
    { key: "insurance", labelKey: "ins_tab_ins", test: function (o) { return Insurance.isPending(o); } },
  ];

  function insBadge(o) {
    if (!Insurance.isInsurance(o)) return "";
    var done = Insurance.isSettled(o);
    return html` <span class="badge ${done ? "ready" : "draft"}" title="${o.insurance_company}">🛡 ${I18N.t(done ? "ins_short_settled" : "ins_short_pending")}</span>`;
  }
  TABS.forEach(function (tab) { tab.label = I18N.t(tab.labelKey); });

  var st = { tab: "all", card: "", view: "list", q: "", status: "all", priority: "all" };
  try {
    var params = new URLSearchParams(location.search);
    var tabQ = params.get("tab");
    if (tabQ && ["all", "open", "progress", "done", "late", "insurance"].indexOf(tabQ) !== -1) st.tab = tabQ;
    var viewQ = params.get("view") || sessionStorage.getItem("ws_wo_view");
    if (viewQ === "grid" || viewQ === "list") st.view = viewQ;
  } catch (e) {}
  var orders = [], customers = {}, vehicles = {}, techs = {}, lines = [], allVehicles = [], allCustomers = [], allTechs = [];

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

  var pg = UI.makePager();
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
    var rows = UI.pageSlice(pg, shown, [st.tab, st.q, st.status, st.priority, st.view].join("|"));
    var bar = UI.pagerBar(pg, shown.length);
    if (st.view === "grid") {
      $("list").innerHTML = html`<div class="cards-grid">${rows.map(function (o) {
        var c = customers[o.customer_id], v = vehicles[o.vehicle_id];
        return html`<a class="wo-card" href="work-order.html?id=${o.id}">
          <div class="top"><b>#${o.number}</b><span class="badge ${o.status}">${UI.statusLabel(o.status)}</span>${insBadge(o)}</div>
          <div><b>${c ? c.name : "—"}</b></div>
          <p>${v ? v.plate + " — " + v.make + " " + v.model : "—"}</p>
          <p><span class="badge prio-${o.priority || "normal"}">${UI.priorityLabel(o.priority)}</span>
            · ${UI.money(total(o.id))}${UI.isOverdue(o) ? html` · <span class="late">${I18N.t("late_badge")}</span>` : ""}</p></a>`;
      })}</div>${bar}`;
      return;
    }
    $("list").innerHTML = html`<div class="table-wrap"><table class="clickable">
      <thead><tr><th>${I18N.t("number_col")}</th><th>${I18N.t("customer")}</th><th>${I18N.t("vehicle")}</th><th>${I18N.t("priority_filter")}</th><th>${I18N.t("status_filter")}</th><th>${I18N.t("technician")}</th><th>${I18N.t("expected_delivery")}</th><th>${I18N.t("total")}</th><th class="no-print">${I18N.t("sh_actions")}</th></tr></thead>
      <tbody>${rows.map(function (o) {
        return html`<tr data-href="work-order.html?id=${o.id}">
          <td><b>#${o.number}</b></td>
          <td>${customers[o.customer_id] ? customers[o.customer_id].name : "—"}</td>
          <td>${vehicles[o.vehicle_id] ? vehicles[o.vehicle_id].plate : "—"}</td>
          <td><span class="badge prio-${o.priority || "normal"}">${UI.priorityLabel(o.priority)}</span></td>
          <td><span class="badge ${o.status}">${UI.statusLabel(o.status)}</span>${insBadge(o)}</td>
          <td>${techs[o.technician_id] ? techs[o.technician_id].name : "—"}</td>
          <td class="${UI.isOverdue(o) ? "late" : ""}">${o.expected_delivery_at ? UI.dateAr(o.expected_delivery_at) : "—"}</td>
          <td>${UI.money(total(o.id))}</td>
          <td class="no-print" style="white-space:nowrap">
            <button class="secondary small" data-act="edit" data-id="${o.id}">${I18N.t("edit")}</button>
            <button class="danger small" data-act="del" data-id="${o.id}">${I18N.t("delete")}</button>
          </td></tr>`;
      })}</tbody></table></div>${bar}`;
  }


  // ---------- حذف أمر شغل ----------
  async function deleteOrder(id) {
    var o = orders.filter(function (x) { return x.id === id; })[0];
    if (!o) return;
    await UI.guard(async function () {
      var d = await Promise.all([DB.list("payments"), DB.list("invoices")]);
      var pays = d[0].filter(function (p) { return p.work_order_id === id; });
      var invs = d[1].filter(function (i) { return i.work_order_id === id; });
      var msg = I18N.t("wo_del_q").replace("{n}", o.number);
      if (pays.length) msg += "\n\n" + I18N.t("wo_del_pay_warn").replace("{p}", pays.length);
      if (invs.length) msg += "\n\n" + I18N.t("wo_del_inv_warn").replace("{i}", invs.length);
      if (!window.confirm(msg)) return;

      var orderLines = lines.filter(function (l) { return l.work_order_id === id; });
      // في وضع Demo مفيش cascade، فبنمسح التوابع بإيدينا. في Supabase الداتابيز بتعمل cascade.
      if (DB.demoMode) {
        var ins = await DB.list("work_order_inspections");
        for (var i = 0; i < orderLines.length; i++) await DB.remove("work_order_lines", orderLines[i].id);
        for (var j = 0; j < pays.length; j++) await DB.remove("payments", pays[j].id);
        for (var k = 0; k < ins.length; k++) if (ins[k].work_order_id === id) await DB.remove("work_order_inspections", ins[k].id);
      }
      await DB.remove("work_orders", id);

      // رجّع القطع المستهلكة للمخزون (بعد نجاح الحذف)
      var parts = await DB.list("parts"), byPart = {};
      orderLines.forEach(function (l) { if (l.part_id) byPart[l.part_id] = (byPart[l.part_id] || 0) + Number(l.qty || 0); });
      for (var pid in byPart) {
        var part = parts.filter(function (p) { return p.id === pid; })[0];
        if (part) await DB.update("parts", pid, { qty: Number(part.qty) + byPart[pid] });
      }
      UI.flash(I18N.t("wo_deleted_ok"), "success");
      await load(); renderAll();
    });
  }

  // ---------- تعديل سريع لأمر شغل ----------
  function openEditor(id) {
    var o = orders.filter(function (x) { return x.id === id; })[0];
    if (!o) return;
    var overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    function vehOptions(custId, sel) {
      return allVehicles.filter(function (v) { return v.customer_id === custId; })
        .map(function (v) { return html`<option value="${v.id}" ${v.id === sel ? "selected" : ""}>${v.plate + " — " + (v.make || "") + " " + (v.model || "")}</option>`; });
    }
    overlay.innerHTML = html`
      <div class="modal card" style="max-width:640px;width:95%">
        <h3 style="margin-top:0">${I18N.t("wo_edit_title")} #${o.number}</h3>
        <form id="wo-edit-form" class="stack">
          <div class="form-grid">
            <div class="field"><label>${I18N.t("customer")}</label>
              <select id="e-cust">${allCustomers.map(function (c) { return html`<option value="${c.id}" ${c.id === o.customer_id ? "selected" : ""}>${c.name}</option>`; })}</select></div>
            <div class="field"><label>${I18N.t("vehicle")}</label>
              <select id="e-veh">${vehOptions(o.customer_id, o.vehicle_id)}</select></div>
            <div class="field"><label>${I18N.t("technician")}</label>
              <select id="e-tech"><option value="">${I18N.t("none")}</option>
                ${allTechs.map(function (t) { return html`<option value="${t.id}" ${t.id === o.technician_id ? "selected" : ""}>${t.name}</option>`; })}</select></div>
            <div class="field"><label>${I18N.t("status_filter")}</label>
              <select id="e-status">${UI.STATUSES.map(function (s) { return html`<option value="${s.key}" ${s.key === o.status ? "selected" : ""}>${UI.statusLabel(s.key)}</option>`; })}</select></div>
            <div class="field"><label>${I18N.t("priority_filter")}</label>
              <select id="e-prio">${UI.PRIORITIES.map(function (p) { return html`<option value="${p.key}" ${p.key === (o.priority || "normal") ? "selected" : ""}>${UI.priorityLabel(p.key)}</option>`; })}</select></div>
            <div class="field"><label>${I18N.t("expected_delivery")}</label>
              <input id="e-exp" type="date" value="${o.expected_delivery_at ? String(o.expected_delivery_at).slice(0, 10) : ""}"></div>
          </div>
          <div class="field"><label>${I18N.t("complaint")}</label><textarea id="e-complaint" rows="2">${o.complaint || ""}</textarea></div>
          <div class="row gap" style="justify-content:space-between">
            <a class="link" href="work-order.html?id=${o.id}">${I18N.t("wo_open_details")}</a>
            <span class="row gap">
              <button type="button" class="ghost" data-x="close">${I18N.t("cancel")}</button>
              <button type="submit" class="primary">${I18N.t("save")}</button>
            </span>
          </div>
        </form>
      </div>`;
    document.body.appendChild(overlay);
    var g = function (i) { return overlay.querySelector("#" + i); };
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay || e.target.getAttribute("data-x") === "close") overlay.remove();
    });
    // تغيير العميل بيغيّر قائمة سياراته
    g("e-cust").addEventListener("change", function () {
      g("e-veh").innerHTML = html`${vehOptions(this.value, "")}`.toString();
    });
    g("wo-edit-form").addEventListener("submit", function (e) {
      e.preventDefault();
      UI.guard(async function () {
        var patch = {
          customer_id: g("e-cust").value,
          vehicle_id: g("e-veh").value,
          technician_id: g("e-tech").value || null,
          status: g("e-status").value,
          priority: g("e-prio").value,
          expected_delivery_at: g("e-exp").value || null,
          complaint: g("e-complaint").value.trim(),
        };
        if (!patch.vehicle_id) throw new Error(I18N.t("vehicle"));
        await DB.update("work_orders", id, patch);
        overlay.remove();
        UI.flash(I18N.t("wo_saved_ok"), "success");
        await load(); renderAll();
      });
    });
  }

  function renderAll() { renderCards(); renderTabs(); renderList(); }
  UI.bindPager($("list"), pg, renderList);

  async function load() {
    var d = await Promise.all([
      DB.list("work_orders"), DB.list("customers"), DB.list("vehicles"), DB.list("work_order_lines"), DB.list("technicians"),
    ]);
    orders = d[0]; customers = UI.byId(d[1]); vehicles = UI.byId(d[2]); lines = d[3]; techs = UI.byId(d[4]);
    allCustomers = d[1]; allVehicles = d[2]; allTechs = d[4];
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
    if (a === "edit") { e.stopPropagation(); openEditor(t.getAttribute("data-id")); return; }
    if (a === "del") { e.stopPropagation(); deleteOrder(t.getAttribute("data-id")); return; }
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
});
