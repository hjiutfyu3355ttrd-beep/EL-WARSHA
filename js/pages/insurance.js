// صفحة التأمين: كل أوامر الشغل اللي شركة تأمين هي اللي بتدفع فيها.
// السيارة بتتسلّم عادي حتى لو التأمين ما دفعش، والمطالبة بتفضل معلّقة هنا لحد ما تسجّل استلام الفلوس
// (من صفحة الأمر: "تسجيل دفع شركة التأمين").
UI.page("insurance", async function () {
  var page = await UI.init("insurance");
  if (!page) return;
  var html = UI.html;
  var t = I18N.t;
  var $ = function (id) { return document.getElementById(id); };

  var orders = [], customers = {}, vehicles = {}, lines = [], payments = [];
  var st = { tab: "pending", q: "" };
  var open = {};   // أوامر مفتوحة التفاصيل
  var pg = UI.makePager();

  var TABS = [
    { key: "pending", label: t("ins_tab_pending"), test: Insurance.isPending },
    { key: "delivered", label: t("ins_tab_delivered"), test: Insurance.isDeliveredPending },
    { key: "settled", label: t("ins_tab_settled"), test: Insurance.isSettled },
    { key: "all", label: t("all"), test: function () { return true; } },
  ];

  page.innerHTML = html`
    <div class="stack">
      <div class="head-row">
        <div><h2>${t("t_insurance")}</h2><p>${t("d_insurance")}</p></div>
        <a class="btn primary no-print" href="work-order-new.html">＋ ${t("create_wo")}</a>
      </div>
      <div class="grid" id="cards"></div>
      <div class="toolbar">
        <div class="tabs" id="tabs"></div>
        <div class="right"><input id="q" type="search" placeholder="${t("ins_search")}"></div>
      </div>
      <div id="list"><div class="empty">${t("loading")}</div></div>
    </div>`;
  UI.bindPager($("list"), pg, renderList);

  async function load() {
    var d = await Promise.all([DB.list("work_orders"), DB.list("customers"), DB.list("vehicles"), DB.list("work_order_lines"), DB.list("payments")]);
    orders = d[0].filter(Insurance.isInsurance);
    customers = UI.byId(d[1]);
    vehicles = UI.byId(d[2]);
    lines = d[3];
    payments = d[4];
    renderAll();
  }

  function renderAll() { renderCards(); renderTabs(); renderList(); }

  function renderCards() {
    var s = Insurance.summary(orders, lines, payments);
    $("cards").innerHTML = html`
      <div class="card stat" style="--accent:var(--warning)"><div class="label">${t("ins_c_pending")}</div><div class="value">${s.pending}</div></div>
      <div class="card stat" style="--accent:var(--primary)"><div class="label">${t("ins_c_delivered")}</div><div class="value">${s.deliveredPending}</div></div>
      <div class="card stat" style="--accent:var(--error, #dc2626)"><div class="label">${t("ins_c_outstanding")}</div><div class="value">${UI.money(s.outstanding)}</div></div>
      <div class="card stat" style="--accent:var(--success)"><div class="label">${t("ins_c_settled")}</div><div class="value">${s.settled}</div></div>`;
  }

  function renderTabs() {
    // لازم html`` حوالين map وإلا المصفوفة بتتحوّل لنص بفواصل (,)
    $("tabs").innerHTML = html`${TABS.map(function (tab) {
      var n = orders.filter(tab.test).length;
      return html`<button class="${st.tab === tab.key ? "on" : ""}" data-tab="${tab.key}">${tab.label}<span>${n}</span></button>`;
    })}`;
  }

  function daysWaiting(o) {
    var from = new Date(o.delivered_at || o.created_at).getTime();
    return Math.max(0, Math.floor((Date.now() - from) / 86400000));
  }

  function detailRow(o) {
    var mine = lines.filter(function (l) { return l.work_order_id === o.id; });
    var labor = mine.filter(function (l) { return l.kind !== "part"; });
    var parts = mine.filter(function (l) { return l.kind === "part"; });
    function table(rows) {
      return rows.length === 0 ? html`<div class="empty">${t("ins_no_lines")}</div>` : html`
        <table><thead><tr><th>${t("desc")}</th><th>${t("qty")}</th><th>${t("price_col")}</th><th>${t("total")}</th></tr></thead>
        <tbody>${rows.map(function (l) {
          return html`<tr><td>${l.description}</td><td>${l.qty}</td><td>${UI.money(l.unit_price)}</td><td>${UI.money(l.qty * l.unit_price)}</td></tr>`;
        })}</tbody></table>`;
    }
    return html`<tr class="ins-detail"><td colspan="9" style="background:var(--surface-sunken, #f6f7f9)">
      <div class="form-grid" style="align-items:start">
        <div><h4 style="margin:0 0 8px">${t("ins_work_done")}</h4>${table(labor)}</div>
        <div><h4 style="margin:0 0 8px">${t("ins_parts")}</h4>${table(parts)}</div>
      </div>
      <p style="margin:10px 0 0"><a class="link" href="work-order.html?id=${o.id}">${t("ins_open_order")} →</a></p>
    </td></tr>`;
  }

  function renderList() {
    var tab = TABS.filter(function (x) { return x.key === st.tab; })[0];
    var q = st.q.trim().toLowerCase();
    var shown = orders.filter(tab.test).filter(function (o) {
      if (!q) return true;
      var c = customers[o.customer_id], v = vehicles[o.vehicle_id];
      return [o.number, o.insurance_company, o.insurance_claim_no, c && c.name, c && c.phone, v && v.plate, v && v.make, v && v.model]
        .join(" ").toLowerCase().indexOf(q) !== -1;
    }).sort(function (a, b) { return new Date(b.created_at) - new Date(a.created_at); });
    var rows = UI.pageSlice(pg, shown, st.tab + "|" + q);
    var bar = UI.pagerBar(pg, shown.length);
    if (shown.length === 0) { $("list").innerHTML = html`<div class="empty card">${t("ins_empty")}</div>`; return; }
    $("list").innerHTML = html`<div class="table-wrap"><table>
      <thead><tr>
        <th>${t("ins_col_order")}</th><th>${t("ins_col_vehicle")}</th><th>${t("ins_col_owner")}</th><th>${t("ins_col_company")}</th>
        <th>${t("ins_col_car_status")}</th><th>${t("total")}</th><th>${t("ins_received")}</th><th>${t("ins_remaining")}</th><th></th>
      </tr></thead>
      <tbody>${rows.map(function (o) {
        var c = customers[o.customer_id], v = vehicles[o.vehicle_id], tt = Insurance.orderTotals(o, lines, payments);
        var settled = Insurance.isSettled(o), hang = Insurance.isDeliveredPending(o);
        return html`<tr style="${hang ? "background:#fffaf0" : ""}">
          <td><a class="link" href="work-order.html?id=${o.id}"><b>#${o.number}</b></a><br>
            <small style="color:var(--muted)">${UI.dateAr(o.created_at)}${!settled ? " · " + t("ins_waiting_days", { n: daysWaiting(o) }) : ""}</small></td>
          <td><b>${v ? v.make + " " + v.model : "—"}</b><br><small style="color:var(--muted)">${v ? v.plate : ""}</small></td>
          <td>${c ? c.name : "—"}${c && c.phone ? html`<br><small dir="ltr" style="color:var(--muted)">${c.phone}</small>` : ""}</td>
          <td><b>${o.insurance_company}</b>${o.insurance_claim_no ? html`<br><small style="color:var(--muted)">${o.insurance_claim_no}</small>` : ""}</td>
          <td><span class="badge ${o.status}">${UI.statusLabel(o.status)}</span>
            <br><span class="badge ${settled ? "ready" : "draft"}" style="margin-top:4px">${t(settled ? "ins_short_settled" : "ins_short_pending")}</span></td>
          <td>${UI.money(tt.total)}</td>
          <td>${UI.money(tt.paid)}</td>
          <td>${settled
            ? (tt.remaining > 0 ? html`<span style="color:var(--muted)">${UI.money(tt.remaining)}</span>` : "—")
            : html`<b style="color:#b45309">${UI.money(tt.remaining)}</b>`}</td>
          <td style="white-space:nowrap">
            <button type="button" class="small secondary" data-det="${o.id}">${t("ins_details")}</button>
            <a class="btn small" href="work-order.html?id=${o.id}">${t("ins_open_order")}</a>
          </td>
        </tr>${open[o.id] ? detailRow(o) : ""}`;
      })}</tbody></table></div>${bar}`;
  }

  page.addEventListener("click", function (e) {
    var tb = e.target.closest("[data-tab]");
    if (tb) { st.tab = tb.getAttribute("data-tab"); renderTabs(); renderList(); return; }
    var d = e.target.closest("[data-det]");
    if (d) { var id = d.getAttribute("data-det"); open[id] = !open[id]; renderList(); }
  });
  $("q").addEventListener("input", function () { st.q = $("q").value; renderList(); });

  UI.guard(load);
});
