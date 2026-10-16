(async function () {
  var page = await UI.init("invoices");
  if (!page) return;
  var html = UI.html;

  page.innerHTML = html`
    <div class="stack">
      <div class="grid" id="stats"></div>

      <form class="card no-print" id="new-form">
        <div class="form-grid">
          <div class="field"><label>إنشاء فاتورة من أمر شغل</label><select id="wo"></select></div>
          <button>＋ فاتورة جديدة</button>
        </div>
      </form>

      <div class="form-grid">
        <input id="q" placeholder="بحث برقم الفاتورة أو العميل">
        <select id="filter">
          <option value="all">كل الحالات</option>
          ${UI.INV_STATUSES.map(function (s) { return html`<option value="${s.key}">${s.label}</option>`; })}
        </select>
      </div>
      <div class="table-wrap" id="list"><div class="empty">جارٍ التحميل…</div></div>
    </div>`;

  var $ = function (id) { return document.getElementById(id); };
  var invoices = [], customers = {}, orders = [];

  function renderStats() {
    var live = invoices.filter(function (i) { return i.status !== "cancelled" && i.status !== "draft"; });
    var total = live.reduce(function (s, i) { return s + i.total; }, 0);
    var paid = live.reduce(function (s, i) { return s + i.paid_amount; }, 0);
    var items = [
      { label: "إجمالي الفواتير الصادرة", value: UI.money(total), color: "var(--info)", soft: "var(--info-soft)" },
      { label: "المحصّل", value: UI.money(paid), color: "var(--st-ready)", soft: "var(--success-soft)" },
      { label: "المتبقي عند العملاء", value: UI.money(total - paid), color: "var(--error)", soft: "var(--error-soft)" },
      { label: "مسودات", value: String(invoices.filter(function (i) { return i.status === "draft"; }).length), color: "var(--warning)", soft: "var(--warning-soft)" },
    ];
    $("stats").innerHTML = html`${items.map(function (s) {
      return html`<div class="card stat" style="--accent:${s.color};--accent-soft:${s.soft}"><div class="label">${s.label}</div><div class="value">${s.value}</div></div>`;
    })}`;
  }

  function renderOrderOptions() {
    var invoiced = {};
    invoices.forEach(function (i) { if (i.work_order_id && i.status !== "cancelled") invoiced[i.work_order_id] = true; });
    var avail = orders.filter(function (o) { return !invoiced[o.id] && o.status !== "cancelled"; });
    $("wo").innerHTML = html`<option value="">— اختار أمر شغل —</option>${avail.map(function (o) {
      return UI.option(o.id, "#" + o.number + " — " + (customers[o.customer_id] ? customers[o.customer_id].name : "—"), false);
    })}`;
  }

  function renderList() {
    var q = $("q").value.trim().toLowerCase();
    var f = $("filter").value;
    var shown = invoices.filter(function (i) {
      if (f !== "all" && i.status !== f) return false;
      var name = customers[i.customer_id] ? customers[i.customer_id].name : "";
      return ("#" + i.number + " " + name).toLowerCase().indexOf(q) !== -1;
    });
    $("list").innerHTML = html`
      <table class="clickable">
        <thead><tr><th>الرقم</th><th>العميل</th><th>التاريخ</th><th>الحالة</th><th>الإجمالي</th><th>المدفوع</th><th>المتبقي</th></tr></thead>
        <tbody>
          ${shown.length === 0
            ? html`<tr><td colspan="7" class="empty">مفيش فواتير</td></tr>`
            : shown.map(function (i) {
                var rem = i.status === "cancelled" ? 0 : i.total - i.paid_amount;
                return html`<tr data-href="invoice.html?id=${i.id}">
                  <td><b>#${i.number}</b></td>
                  <td>${customers[i.customer_id] ? customers[i.customer_id].name : "—"}</td>
                  <td>${UI.dateAr(i.issued_at)}</td>
                  <td><span class="badge ${i.status}">${UI.invStatusLabel(i.status)}</span></td>
                  <td>${UI.money(i.total)}</td>
                  <td>${UI.money(i.paid_amount)}</td>
                  <td class="${rem > 0 ? "low" : ""}">${UI.money(rem)}</td>
                </tr>`;
              })}
        </tbody>
      </table>`;
  }

  await UI.guard(async function () {
    var d = await Promise.all([DB.list("invoices"), DB.list("customers"), DB.list("work_orders")]);
    invoices = d[0];
    customers = UI.byId(d[1]);
    orders = d[2];
    renderStats();
    renderOrderOptions();
    renderList();
  });

  $("q").addEventListener("input", renderList);
  $("filter").addEventListener("change", renderList);
  $("new-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var id = $("wo").value;
    if (!id) return UI.flash("اختار أمر شغل الأول");
    UI.guard(async function () {
      var inv = await Finance.createFromWorkOrder(id);
      location.href = "invoice.html?id=" + inv.id;
    });
  });
})();
