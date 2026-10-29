(async function () {
  var page = await UI.init("work-orders");
  if (!page) return;
  var html = UI.html;
  var t = UI.t;

  page.innerHTML = html`
    <div class="stack">
      <div class="row between">
        <h2 class="page-title" style="margin:0">${t("work_orders_title")}</h2>
        <a class="btn" href="work-order-new.html">${t("work_orders_new")}</a>
      </div>
      <div class="form-grid">
        <input id="q" placeholder="${t("work_orders_search")}">
        <select id="filter">
          <option value="all">${t("work_orders_filter_all")}</option>
          ${UI.STATUSES.map(function (s) { return html`<option value="${s.key}">${s.label}</option>`; })}
        </select>
      </div>
      <div class="table-wrap" id="list"><div class="empty">${t("loading")}</div></div>
    </div>`;

  var orders = [], customers = {}, vehicles = {}, lines = [];

  function total(id) {
    return lines
      .filter(function (l) { return l.work_order_id === id; })
      .reduce(function (s, l) { return s + l.qty * l.unit_price; }, 0);
  }

  function renderList() {
    var filter = document.getElementById("filter").value;
    var q = document.getElementById("q").value.trim().toLowerCase();

    var shown = orders.filter(function (o) {
      if (filter !== "all" && o.status !== filter) return false;
      var c = customers[o.customer_id], v = vehicles[o.vehicle_id];
      var text = (o.number + " " + (c ? c.name : "") + " " + (v ? v.plate : "")).toLowerCase();
      return text.indexOf(q) !== -1;
    });

    document.getElementById("list").innerHTML = html`
      <table class="clickable">
        <thead><tr><th>${t("col_number")}</th><th>${t("col_customer")}</th><th>${t("col_vehicle")}</th><th>${t("col_status")}</th><th>${t("col_total")}</th><th>${t("col_date")}</th></tr></thead>
        <tbody>
          ${shown.length === 0
            ? html`<tr><td colspan="6" class="empty">${t("work_orders_empty")}</td></tr>`
            : shown.map(function (o) {
                return html`<tr data-href="work-order.html?id=${o.id}">
                  <td>#${o.number}</td>
                  <td>${customers[o.customer_id] ? customers[o.customer_id].name : t("none")}</td>
                  <td>${vehicles[o.vehicle_id] ? vehicles[o.vehicle_id].plate : t("none")}</td>
                  <td><span class="badge ${o.status}">${UI.statusLabel(o.status)}</span></td>
                  <td>${UI.money(total(o.id))}</td>
                  <td>${UI.dateAr(o.created_at)}</td>
                </tr>`;
              })}
        </tbody>
      </table>`;
  }

  await UI.guard(async function () {
    var data = await Promise.all([
      DB.list("work_orders"), DB.list("customers"), DB.list("vehicles"), DB.list("work_order_lines"),
    ]);
    orders = data[0];
    customers = UI.byId(data[1]);
    vehicles = UI.byId(data[2]);
    lines = data[3];
    renderList();
  });

  document.getElementById("q").addEventListener("input", renderList);
  document.getElementById("filter").addEventListener("change", renderList);
})();
