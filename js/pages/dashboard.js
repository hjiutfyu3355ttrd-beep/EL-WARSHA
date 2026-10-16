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
      { label: "أوامر شغل مفتوحة", value: String(open.length), color: "var(--st-repair)", soft: "var(--primary-soft)", ic: "M9 11l3 3 8-8M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9" },
      { label: "سيارات جاهزة للتسليم", value: String(ready.length), color: "var(--st-ready)", soft: "var(--success-soft)", ic: "M5 13l4 4L19 7" },
      { label: "إيراد اليوم", value: UI.money(revenueToday), color: "var(--info)", soft: "var(--info-soft)", ic: "M12 2v20M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" },
      { label: "نواقص المخزون", value: String(low.length), color: "var(--error)", soft: "var(--error-soft)", ic: "M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" },
    ];

    var recent = orders.slice(0, 6);
    var total = Math.max(orders.length, 1);
    var dist = [
      { s: "received", c: "var(--st-intake)" }, { s: "inspecting", c: "var(--st-inspect)" },
      { s: "awaiting_approval", c: "var(--warning)" }, { s: "approved", c: "var(--info)" }, { s: "in_progress", c: "var(--st-repair)" },
      { s: "waiting_parts", c: "var(--warning)" }, { s: "testing", c: "var(--st-test)" },
      { s: "ready", c: "var(--st-ready)" }, { s: "delivered", c: "var(--border-strong)" },
    ].map(function (d) {
      var n = orders.filter(function (o) { return o.status === d.s; }).length;
      return { label: UI.statusLabel(d.s), n: n, pct: Math.round((n / total) * 100), c: d.c };
    });

    page.innerHTML = html`
      <div class="stack">
        <div class="grid">
          ${stats.map(function (s) {
            return html`<div class="card stat" style="--accent:${s.color};--accent-soft:${s.soft}">
              <div class="ico"><svg viewBox="0 0 24 24"><path d="${s.ic}"/></svg></div>
              <div class="label">${s.label}</div><div class="value">${s.value}</div></div>`;
          })}
        </div>

        <div class="two-col">
          <div>
            <div class="row between"><h3>أوامر تحتاج متابعة</h3><a class="link" href="work-orders.html">عرض الكل</a></div>
            <div class="table-wrap">
              <table class="clickable">
                <thead><tr><th>رقم الأمر</th><th>العميل</th><th>السيارة / اللوحة</th><th>الحالة</th></tr></thead>
                <tbody>
                  ${recent.length === 0
                    ? html`<tr><td colspan="4" class="empty">مفيش أوامر شغل لسه</td></tr>`
                    : recent.map(function (o) {
                        return html`<tr data-href="work-order.html?id=${o.id}">
                          <td><b>#${o.number}</b></td>
                          <td>${customers[o.customer_id] ? customers[o.customer_id].name : "—"}</td>
                          <td>${vehicles[o.vehicle_id] ? vehicles[o.vehicle_id].plate : "—"}</td>
                          <td><span class="badge ${o.status}">${UI.statusLabel(o.status)}</span></td>
                        </tr>`;
                      })}
                </tbody>
              </table>
            </div>
          </div>

          <div class="card">
            <h3>توزيع الحالات</h3>
            ${dist.map(function (d) {
              return html`<div class="bar-row"><span>${d.label}</span>
                <div class="bar"><i style="width:${d.pct}%;background:${d.c}"></i></div><b>${d.n}</b></div>`;
            })}
          </div>
        </div>

        ${low.length > 0
          ? html`<div class="notice">نواقص: ${low.map(function (p) { return p.name + " (" + p.qty + ")"; }).join(" · ")}
              — <a class="link" href="inventory.html">المخزون</a></div>`
          : ""}
      </div>`;
  });
})();
