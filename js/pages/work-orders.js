(async function () {
  var page = await UI.init("work-orders");
  if (!page) return;
  var html = UI.html;

  // تقسيم الحالات على التبويبات
  var TABS = [
    { key: "all", label: "الكل", test: function () { return true; } },
    { key: "open", label: "مفتوحة", test: function (o) { return ["received", "inspecting", "awaiting_approval", "approved"].indexOf(o.status) !== -1; } },
    { key: "progress", label: "تحت التنفيذ", test: function (o) { return ["in_progress", "waiting_parts", "testing"].indexOf(o.status) !== -1; } },
    { key: "done", label: "مكتملة", test: function (o) { return o.status === "ready" || o.status === "delivered"; } },
    { key: "late", label: "متأخرة", test: function (o) { return UI.isOverdue(o); } },
  ];

  var st = { tab: "all", card: "", view: "list", q: "", status: "all", priority: "all" };
  var orders = [], customers = {}, vehicles = {}, techs = {}, lines = [];

  page.innerHTML = html`
    <div class="stack">
      <div class="head-row">
        <div><h2>أوامر الشغل</h2><p>إدارة ومتابعة أوامر الصيانة في الورشة</p></div>
        <div class="actions no-print">
          <button class="secondary" data-act="refresh">⟳ تحديث</button>
          <button class="secondary" data-act="export">⭳ تصدير</button>
          <a class="btn" href="work-order-new.html">＋ إنشاء أمر شغل</a>
        </div>
      </div>

      <div class="grid" id="cards"></div>

      <div class="toolbar">
        <div class="tabs" id="tabs"></div>
        <div class="right">
          <input id="q" type="search" placeholder="بحث برقم الأمر أو العميل أو اللوحة...">
          <button class="secondary" data-act="filters">⚲ تصفية</button>
          <button class="secondary icon-btn on" data-act="view" data-v="list" title="قائمة">☰</button>
          <button class="secondary icon-btn" data-act="view" data-v="grid" title="كروت">▦</button>
        </div>
      </div>

      <div class="card filters" id="filters">
        <div class="field"><label>الحالة</label>
          <select id="f-status"><option value="all">كل الحالات</option>
            ${UI.STATUSES.map(function (s) { return html`<option value="${s.key}">${s.label}</option>`; })}</select></div>
        <div class="field"><label>الأولوية</label>
          <select id="f-priority"><option value="all">كل الأولويات</option>
            ${UI.PRIORITIES.map(function (p) { return html`<option value="${p.key}">${p.label}</option>`; })}</select></div>
      </div>

      <div id="list"><div class="empty">جارٍ التحميل…</div></div>
    </div>`;

  var $ = function (id) { return document.getElementById(id); };

  function total(id) {
    return lines.filter(function (l) { return l.work_order_id === id; })
      .reduce(function (s, l) { return s + l.qty * l.unit_price; }, 0);
  }

  function renderCards() {
    var live = orders.filter(function (o) { return o.status !== "cancelled"; });
    var items = [
      { k: "", label: "إجمالي الأوامر", v: String(orders.length), sub: "كل أوامر الشغل", c: "#64748b" },
      { k: "high", label: "أولوية عالية", v: String(orders.filter(function (o) { return (o.priority === "high" || o.priority === "critical") && UI.isOpen(o.status); }).length), sub: "عالية وحرجة ومفتوحة", c: "#eab308" },
      { k: "approval", label: "بانتظار الموافقة", v: String(orders.filter(function (o) { return o.status === "awaiting_approval"; }).length), sub: "أوامر بانتظار موافقة العميل", c: "#d97706" },
      { k: "cost", label: "إجمالي التكلفة", v: UI.money(live.reduce(function (s, o) { return s + total(o.id); }, 0)), sub: "قيمة بنود الأوامر", c: "#10b26c" },
      { k: "late", label: "أوامر متأخرة", v: String(orders.filter(UI.isOverdue).length), sub: "عدّى موعد تسليمها", c: "#b91c1c" },
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
        <h3>مفيش أوامر شغل</h3>
        <p>${orders.length === 0 ? "افتح أول أمر شغل عشان تبدأ" : "جرّب تغيّر البحث أو التصفية"}</p>
        ${orders.length === 0 ? html`<a class="btn" href="work-order-new.html">＋ إنشاء أول أمر شغل</a>` : ""}</div>`;
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
            · ${UI.money(total(o.id))}${UI.isOverdue(o) ? html` · <span class="late">متأخر</span>` : ""}</p></a>`;
      })}</div>`;
      return;
    }
    $("list").innerHTML = html`<div class="table-wrap"><table class="clickable">
      <thead><tr><th>رقم</th><th>العميل</th><th>السيارة</th><th>الأولوية</th><th>الحالة</th><th>الفني</th><th>التسليم المتوقع</th><th>الإجمالي</th></tr></thead>
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
    var rows = [["رقم", "العميل", "اللوحة", "الأولوية", "الحالة", "الفني", "التسليم المتوقع", "الإجمالي", "تاريخ الفتح"]];
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
      st.view = t.getAttribute("data-v");
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
