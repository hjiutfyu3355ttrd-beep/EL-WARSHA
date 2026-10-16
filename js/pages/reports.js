(async function () {
  var page = await UI.init("reports");
  if (!page) return;
  var html = UI.html;

  await UI.guard(async function () {
    var d = await Promise.all([
      DB.list("work_orders"),
      DB.list("payments"),
      DB.list("work_order_lines"),
      DB.list("parts"),
      DB.list("income"),
      DB.list("expenses"),
      DB.list("quotations"),
      DB.list("part_sales"),
      DB.list("vehicle_taxes"),
    ]);
    var orders = d[0], payments = d[1], lines = d[2], parts = d[3];
    var income = d[4], expenses = d[5], quotations = d[6], partSales = d[7], taxes = d[8];
    var partsById = UI.byId(parts);

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

    var usage = {};
    lines.forEach(function (l) {
      if (l.part_id) usage[l.part_id] = (usage[l.part_id] || 0) + l.qty;
    });
    var top = Object.keys(usage)
      .map(function (id) { return { name: partsById[id] ? partsById[id].name : "—", qty: usage[id] }; })
      .sort(function (a, b) { return b.qty - a.qty; })
      .slice(0, 5);

    var profit = lines.reduce(function (s, l) {
      var cost = l.part_id && partsById[l.part_id] ? partsById[l.part_id].cost * l.qty : 0;
      return s + l.qty * l.unit_price - cost;
    }, 0);

    var incomeTotal = income.reduce(function (s, r) { return s + (Number(r.amount) || 0); }, 0)
      + payments.reduce(function (s, p) { return s + p.amount; }, 0);
    var expenseTotal = expenses.reduce(function (s, r) { return s + (Number(r.amount) || 0); }, 0);
    var net = incomeTotal - expenseTotal;

    var maxDay = Math.max(1, Math.max.apply(null, byDay.map(function (x) { return x.total; })));

    page.innerHTML = html`
      <div class="stack">
        <div class="head-row">
          <div>
            <h2>التقارير</h2>
            <p>ملخص الإيرادات والمصروفات وأداء الورشة.</p>
          </div>
        </div>

        <div class="grid">
          <div class="card stat" style="--accent:var(--success)">
            <div class="label">إيراد 7 أيام</div>
            <div class="value">${UI.money(weekTotal)}</div>
          </div>
          <div class="card stat" style="--accent:var(--primary)">
            <div class="label">صافي (دخل − مصروف)</div>
            <div class="value">${UI.money(net)}</div>
          </div>
          <div class="card stat" style="--accent:var(--info)">
            <div class="label">هامش البنود</div>
            <div class="value">${UI.money(profit)}</div>
          </div>
          <div class="card stat" style="--accent:var(--purple)">
            <div class="label">أوامر الشغل</div>
            <div class="value">${orders.length}</div>
          </div>
        </div>

        <div class="two-col">
          <div class="card">
            <h3 style="margin-top:0">الإيراد اليومي (7 أيام)</h3>
            ${byDay.map(function (x) {
              var pct = Math.round((x.total / maxDay) * 100);
              return html`<div class="bar-row">
                <span>${x.label}</span>
                <div class="bar"><i style="width:${pct}%;background:var(--primary)"></i></div>
                <b style="font-size:12px">${UI.money(x.total)}</b>
              </div>`;
            })}
          </div>
          <div class="card">
            <h3 style="margin-top:0">ملخص مالي</h3>
            <div class="bar-row"><span>إجمالي الدخل</span><div class="bar"><i style="width:100%;background:var(--success)"></i></div><b>${UI.money(incomeTotal)}</b></div>
            <div class="bar-row"><span>إجمالي المصروف</span><div class="bar"><i style="width:${incomeTotal ? Math.min(100, Math.round((expenseTotal / incomeTotal) * 100)) : 0}%;background:var(--error)"></i></div><b>${UI.money(expenseTotal)}</b></div>
            <div class="bar-row"><span>بيع قطع غيار</span><div></div><b>${UI.money(partSales.reduce(function (s, x) { return s + (Number(x.total) || 0); }, 0))}</b></div>
            <div class="bar-row"><span>عروض أسعار</span><div></div><b>${quotations.length}</b></div>
            <div class="bar-row"><span>ضرائب غير مدفوعة</span><div></div><b>${taxes.filter(function (t) { return !t.paid; }).length}</b></div>
          </div>
        </div>

        <div class="two-col">
          <div class="card">
            <h3 style="margin-top:0">أوامر الشغل حسب الحالة</h3>
            ${UI.STATUSES.map(function (s) {
              var n = orders.filter(function (o) { return o.status === s.key; }).length;
              var pct = orders.length ? Math.round((n / orders.length) * 100) : 0;
              return html`<div class="bar-row">
                <span>${s.label}</span>
                <div class="bar"><i style="width:${pct}%;background:var(--info)"></i></div>
                <b>${n}</b>
              </div>`;
            })}
          </div>
          <div class="card">
            <h3 style="margin-top:0">أكتر القطع استهلاكاً</h3>
            <div class="table-wrap">
              <table>
                <thead><tr><th>القطعة</th><th>الكمية</th></tr></thead>
                <tbody>
                  ${top.length === 0
                    ? html`<tr><td colspan="2" class="empty">لسه مفيش بيانات</td></tr>`
                    : top.map(function (x) { return html`<tr><td>${x.name}</td><td>${x.qty}</td></tr>`; })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>`;
  });
})();
