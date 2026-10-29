(async function () {
  var page = await UI.init("reports");
  if (!page) return;
  var html = UI.html;
  var t = UI.t;

  await UI.guard(async function () {
    var d = await Promise.all([
      DB.list("work_orders"), DB.list("payments"), DB.list("work_order_lines"), DB.list("parts"),
    ]);
    var orders = d[0], payments = d[1], lines = d[2], parts = d[3];
    var partsById = UI.byId(parts);

    var byDay = [];
    for (var i = 0; i < 7; i++) {
      var day = new Date();
      day.setDate(day.getDate() - i);
      var total = payments
        .filter(function (p) { return new Date(p.created_at).toDateString() === day.toDateString(); })
        .reduce(function (s, p) { return s + p.amount; }, 0);
      byDay.push({
        label: day.toLocaleDateString(I18N.getLang() === "tr" ? "tr-TR" : "ar-EG", { weekday: "long", day: "numeric", month: "numeric" }),
        total: total,
      });
    }
    var weekTotal = byDay.reduce(function (s, x) { return s + x.total; }, 0);

    var usage = {};
    lines.forEach(function (l) {
      if (l.part_id) usage[l.part_id] = (usage[l.part_id] || 0) + l.qty;
    });
    var top = Object.keys(usage)
      .map(function (id) { return { name: partsById[id] ? partsById[id].name : t("none"), qty: usage[id] }; })
      .sort(function (a, b) { return b.qty - a.qty; })
      .slice(0, 5);

    var profit = lines.reduce(function (s, l) {
      var cost = l.part_id && partsById[l.part_id] ? partsById[l.part_id].cost * l.qty : 0;
      return s + l.qty * l.unit_price - cost;
    }, 0);

    page.innerHTML = html`
      <div class="stack">
        <h2 class="page-title" style="margin:0">${t("reports_title")}</h2>

        <div class="grid">
          <div class="card"><div class="label">${t("reports_week")}</div><div class="value">${UI.money(weekTotal)}</div></div>
          <div class="card"><div class="label">${t("reports_total_revenue")}</div><div class="value">${UI.money(profit)}</div></div>
          <div class="card"><div class="label">${t("reports_orders_count")}</div><div class="value">${orders.length}</div></div>
        </div>

        <div>
          <h3>${t("reports_revenue")}</h3>
          <div class="table-wrap"><table>
            <thead><tr><th>${t("col_date")}</th><th>${t("reports_payments")}</th></tr></thead>
            <tbody>${byDay.map(function (x) { return html`<tr><td>${x.label}</td><td>${UI.money(x.total)}</td></tr>`; })}</tbody>
          </table></div>
        </div>

        <div>
          <h3>${t("reports_by_status")}</h3>
          <div class="table-wrap"><table>
            <thead><tr><th>${t("col_status")}</th><th>${t("reports_orders_count")}</th></tr></thead>
            <tbody>${UI.STATUSES.map(function (s) {
              var n = orders.filter(function (o) { return o.status === s.key; }).length;
              return html`<tr><td>${s.label}</td><td>${n}</td></tr>`;
            })}</tbody>
          </table></div>
        </div>

        <div>
          <h3>${t("col_part")}</h3>
          <div class="table-wrap"><table>
            <thead><tr><th>${t("col_part")}</th><th>${t("col_qty")}</th></tr></thead>
            <tbody>${top.length === 0
              ? html`<tr><td colspan="2" class="empty">${t("reports_no_data")}</td></tr>`
              : top.map(function (x) { return html`<tr><td>${x.name}</td><td>${x.qty}</td></tr>`; })}</tbody>
          </table></div>
        </div>
      </div>`;
  });
})();
