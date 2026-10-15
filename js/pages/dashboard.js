(async function () {
  var page = await UI.init("dashboard");
  if (!page) return;
  var html = UI.html;

  await UI.guard(async function () {
    var data = await Promise.all([
      DB.list("work_orders"),
      DB.list("payments"),
      DB.list("parts"),
      DB.list("customers"),
      DB.list("vehicles"),
    ]);
    var orders = data[0], payments = data[1], parts = data[2];
    var customers = UI.byId(data[3]), vehicles = UI.byId(data[4]);

    var open = orders.filter(function (o) { return UI.isOpen(o.status); });
    var ready = orders.filter(function (o) { return o.status === "ready"; });
    var revenueToday = payments
      .filter(function (p) { return UI.isToday(p.created_at); })
      .reduce(function (s, p) { return s + p.amount; }, 0);
    var low = parts.filter(function (p) { return p.qty <= p.min_qty; });

    var stats = [
      { label: "أوامر شغل مفتوحة", value: String(open.length) },
      { label: "سيارات جاهزة للتسليم", value: String(ready.length) },
      { label: "إيراد اليوم", value: UI.money(revenueToday) },
      { label: "نواقص المخزون", value: String(low.length) },
    ];

    var recent = orders.slice(0, 6);

    page.innerHTML = html`
      <div class="stack">
        <div class="row between">
          <h2 class="page-title" style="margin:0">الرئيسية</h2>
          <a class="btn" href="work-order-new.html">+ أمر شغل جديد</a>
        </div>

        <div class="grid">
          ${stats.map(function (s) {
            return html`<div class="card"><div class="label">${s.label}</div><div class="value">${s.value}</div></div>`;
          })}
        </div>

        <div>
          <h3>آخر أوامر الشغل</h3>
          <div class="table-wrap">
            <table class="clickable">
              <thead><tr><th>رقم</th><th>العميل</th><th>السيارة</th><th>الحالة</th></tr></thead>
              <tbody>
                ${recent.length === 0
                  ? html`<tr><td colspan="4" class="empty">مفيش أوامر شغل لسه</td></tr>`
                  : recent.map(function (o) {
                      return html`<tr data-href="work-order.html?id=${o.id}">
                        <td>#${o.number}</td>
                        <td>${customers[o.customer_id] ? customers[o.customer_id].name : "—"}</td>
                        <td>${vehicles[o.vehicle_id] ? vehicles[o.vehicle_id].plate : "—"}</td>
                        <td><span class="badge ${o.status}">${UI.statusLabel(o.status)}</span></td>
                      </tr>`;
                    })}
              </tbody>
            </table>
          </div>
        </div>

        ${low.length > 0
          ? html`<div class="notice">نواقص: ${low.map(function (p) { return p.name + " (" + p.qty + ")"; }).join(" · ")}
              — <a class="link" href="inventory.html">المخزون</a></div>`
          : ""}
      </div>`;
  });
})();
