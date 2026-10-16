(async function () {
  var page = await UI.init("dashboard");
  if (!page) return;
  var html = UI.html;

  var MONTHS = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];

  // مسار منحنى ناعم (Catmull-Rom → Bézier) بين النقاط
  function smooth(pts, lo, hi) {
    if (pts.length < 2) return "";
    var cl = function (v) { return Math.max(lo, Math.min(hi, v)); };
    var d = "M" + pts[0][0] + "," + pts[0][1];
    for (var i = 0; i < pts.length - 1; i++) {
      var p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      d += " C" + (p1[0] + (p2[0] - p0[0]) / 6) + "," + cl(p1[1] + (p2[1] - p0[1]) / 6) + " " +
        (p2[0] - (p3[0] - p1[0]) / 6) + "," + cl(p2[1] - (p3[1] - p1[1]) / 6) + " " + p2[0] + "," + p2[1];
    }
    return d;
  }

  // رسم أوامر الشغل آخر 12 شهر
  function trendChart(orders) {
    var now = new Date(), buckets = [];
    for (var i = 11; i >= 0; i--) {
      var d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      buckets.push({ y: d.getFullYear(), m: d.getMonth(), n: 0 });
    }
    orders.forEach(function (o) {
      var d = new Date(o.created_at);
      buckets.forEach(function (b) { if (b.y === d.getFullYear() && b.m === d.getMonth()) b.n++; });
    });
    var max = Math.max(5, Math.ceil(Math.max.apply(null, buckets.map(function (b) { return b.n; })) / 5) * 5);
    var W = 700, H = 230, L = 34, R = 12, T = 12, B = 30;
    var x = function (i) { return L + (i * (W - L - R)) / 11; };
    var y = function (v) { return T + (H - T - B) * (1 - v / max); };
    var pts = buckets.map(function (b, i) { return [Math.round(x(i)), Math.round(y(b.n))]; });
    var ticks = [0, 1, 2, 3, 4].map(function (k) { return Math.round((max * k) / 4); });
    return html`<svg viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;direction:ltr" role="img" aria-label="أوامر الشغل خلال 12 شهر">
      ${ticks.map(function (t) {
        return html`<line x1="${L}" x2="${W - R}" y1="${y(t)}" y2="${y(t)}" stroke="#eef0f3"/>
          <text x="${L - 8}" y="${y(t) + 4}" font-size="11" text-anchor="end" fill="#6b7280">${t}</text>`;
      })}
      ${buckets.map(function (b, i) {
        return html`<text x="${x(i)}" y="${H - 8}" font-size="10.5" text-anchor="middle" fill="#6b7280">${MONTHS[b.m]}</text>`;
      })}
      <path d="${smooth(pts, T, H - B)}" fill="none" stroke="#3b82f6" stroke-width="2.2" stroke-linecap="round"/>
      ${pts.map(function (p) { return html`<circle cx="${p[0]}" cy="${p[1]}" r="3.2" fill="#fff" stroke="#3b82f6" stroke-width="2"/>`; })}
    </svg>`;
  }

  await UI.guard(async function () {
    var data = await Promise.all([
      DB.list("work_orders"), DB.list("payments"), DB.list("parts"), DB.list("customers"), DB.list("vehicles"),
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
      { label: "أوامر شغل مفتوحة", value: String(open.length), c: "var(--primary)", soft: "var(--success-soft)", ic: "M9 11l3 3 8-8M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9" },
      { label: "سيارات جاهزة للتسليم", value: String(ready.length), c: "var(--info)", soft: "var(--info-soft)", ic: "M5 13l4 4L19 7" },
      { label: "إيراد اليوم", value: UI.money(revenueToday), c: "var(--orange)", soft: "var(--orange-soft)", ic: "M12 2v20M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" },
      { label: "نواقص المخزون", value: String(low.length), c: "var(--purple)", soft: "var(--purple-soft)", ic: "M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" },
    ];

    var recent = orders.slice(0, 5);
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
        <div class="hero">
          <div><div class="eyebrow">لوحة التحكم</div><h1>أهلاً بيك في نظام الورشة</h1><p>ملخص أوامر الشغل والإيرادات والمخزون النهاردة.</p></div>
          <a class="btn" href="work-order-new.html">＋ استقبال سيارة</a>
        </div>

        <div class="grid">
          ${stats.map(function (s) {
            return html`<div class="card stat" style="--accent:${s.c};--accent-soft:${s.soft}">
              <div class="ico"><svg viewBox="0 0 24 24"><path d="${s.ic}"/></svg></div>
              <div class="label">${s.label}</div><div class="value">${s.value}</div></div>`;
          })}
        </div>

        <div class="card">
          <h3>اتجاه أوامر الشغل (آخر 12 شهر)</h3>
          ${trendChart(orders)}
        </div>

        <div class="two-col">
          <div class="card">
            <div class="row between"><h3>آخر أوامر الشغل</h3><a class="link" href="work-orders.html">عرض الكل</a></div>
            ${recent.length === 0
              ? html`<div class="empty">مفيش أوامر شغل لسه</div>`
              : recent.map(function (o) {
                  return html`<a class="recent" href="work-order.html?id=${o.id}">
                    <div><b>#${o.number} — ${customers[o.customer_id] ? customers[o.customer_id].name : "—"}</b>
                      <small>${vehicles[o.vehicle_id] ? vehicles[o.vehicle_id].plate : "—"} · ${UI.dateAr(o.created_at)}</small></div>
                    <span class="badge ${o.status}">${UI.statusLabel(o.status)}</span></a>`;
                })}
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
