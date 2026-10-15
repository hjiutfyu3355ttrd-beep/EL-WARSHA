(async function () {
  var page = await UI.init("reports");
  if (!page) return;
  var html = UI.html;

  await UI.guard(async function () {
    var d = await Promise.all([
      DB.list("work_orders"), DB.list("payments"), DB.list("work_order_lines"), DB.list("parts"),
    ]);
    var orders = d[0], payments = d[1], lines = d[2], parts = d[3];
    var partsById = UI.byId(parts);

    // إيراد آخر 7 أيام (من المدفوعات)
    var byDay = [];
    for (var i = 0; i < 7; i++) {
      var day = new Date();
      day.setDate(day.getDate() - i);
      var total = payments
        .filter(function (p) { return new Date(p.created_at).toDateString() === day.toDateString(); })
        .reduce(function (s, p) { return s + p.amount; }, 0);
      byDay.push({
        label: day.toLocaleDateString("ar-EG", { weekday: "long", day: "numeric", month: "numeric" }),
        total: total,
      });
    }
    var weekTotal = byDay.reduce(function (s, x) { return s + x.total; }, 0);

    // أكتر القطع استهلاكاً
    var usage = {};
    lines.forEach(function (l) {
      if (l.part_id) usage[l.part_id] = (usage[l.part_id] || 0) + l.qty;
    });
    var top = Object.keys(usage)
      .map(function (id) { return { name: partsById[id] ? partsById[id].name : "—", qty: usage[id] }; })
      .sort(function (a, b) { return b.qty - a.qty; })
      .slice(0, 5);

    // هامش الربح: بيع - شراء للقطع + الأجور كاملة
    var profit = lines.reduce(function (s, l) {
      var cost = l.part_id && partsById[l.part_id] ? partsById[l.part_id].cost * l.qty : 0;
      return s + l.qty * l.unit_price - cost;
    }, 0);

    page.innerHTML = html`
      <div class="stack">
        <h2 class="page-title" style="margin:0">التقارير</h2>

        <div class="grid">
          <div class="card"><div class="label">إيراد آخر 7 أيام</div><div class="value">${UI.money(weekTotal)}</div></div>
          <div class="card"><div class="label">إجمالي هامش الربح (كل البنود)</div><div class="value">${UI.money(profit)}</div></div>
          <div class="card"><div class="label">إجمالي أوامر الشغل</div><div class="value">${orders.length}</div></div>
        </div>

        <div>
          <h3>الإيراد اليومي</h3>
          <div class="table-wrap"><table>
            <thead><tr><th>اليوم</th><th>المدفوعات</th></tr></thead>
            <tbody>${byDay.map(function (x) { return html`<tr><td>${x.label}</td><td>${UI.money(x.total)}</td></tr>`; })}</tbody>
          </table></div>
        </div>

        <div>
          <h3>أوامر الشغل حسب الحالة</h3>
          <div class="table-wrap"><table>
            <thead><tr><th>الحالة</th><th>العدد</th></tr></thead>
            <tbody>${UI.STATUSES.map(function (s) {
              var n = orders.filter(function (o) { return o.status === s.key; }).length;
              return html`<tr><td>${s.label}</td><td>${n}</td></tr>`;
            })}</tbody>
          </table></div>
        </div>

        <div>
          <h3>أكتر القطع استهلاكاً</h3>
          <div class="table-wrap"><table>
            <thead><tr><th>القطعة</th><th>الكمية المستهلكة</th></tr></thead>
            <tbody>${top.length === 0
              ? html`<tr><td colspan="2" class="empty">لسه مفيش بيانات</td></tr>`
              : top.map(function (x) { return html`<tr><td>${x.name}</td><td>${x.qty}</td></tr>`; })}</tbody>
          </table></div>
        </div>
      </div>`;
  });
})();
