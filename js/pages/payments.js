(async function () {
  var page = await UI.init("payments");
  if (!page) return;
  var html = UI.html;

  page.innerHTML = html`
    <div class="stack">
      <div class="grid" id="stats"></div>
      <div class="form-grid">
        <select id="method">
          <option value="all">${I18N.t("all_methods")}</option>
          ${UI.PAY_METHODS.map(function (m) { return html`<option value="${m.key}">${m.label}</option>`; })}
        </select>
      </div>
      <div class="table-wrap" id="list"><div class="empty">${I18N.t("loading")}</div></div>
    </div>`;

  var $ = function (id) { return document.getElementById(id); };
  var pays = [], invoices = {}, orders = {}, customers = {};

  function render() {
    var m = $("method").value;
    var shown = pays.filter(function (p) { return m === "all" || p.method === m; });
    var sum = function (arr) { return arr.reduce(function (s, p) { return s + p.amount; }, 0); };

    var today = pays.filter(function (p) { return UI.isToday(p.created_at); });
    var cash = pays.filter(function (p) { return p.method === "cash"; });
    var items = [
      { label: I18N.t("total_collected"), value: UI.money(sum(pays)), color: "var(--st-ready)", soft: "var(--success-soft)" },
      { label: I18N.t("collected_today"), value: UI.money(sum(today)), color: "var(--info)", soft: "var(--info-soft)" },
      { label: I18N.t("cash_only"), value: UI.money(sum(cash)), color: "var(--primary)", soft: "var(--primary-soft)" },
      { label: I18N.t("non_cash"), value: UI.money(sum(pays) - sum(cash)), color: "var(--st-inspect)", soft: "#f4ebff" },
    ];
    $("stats").innerHTML = html`${items.map(function (s) {
      return html`<div class="card stat" style="--accent:${s.color};--accent-soft:${s.soft}"><div class="label">${s.label}</div><div class="value">${s.value}</div></div>`;
    })}`;

    $("list").innerHTML = html`
      <table>
        <thead><tr><th>${I18N.t("date")}</th><th>${I18N.t("amount")}</th><th>${I18N.t("method")}</th><th>${I18N.t("customer")}</th><th>${I18N.t("reference")}</th></tr></thead>
        <tbody>
          ${shown.length === 0
            ? html`<tr><td colspan="5" class="empty">${I18N.t("empty_payments")}</td></tr>`
            : shown.map(function (p) {
                var inv = invoices[p.invoice_id], wo = orders[p.work_order_id];
                var cid = inv ? inv.customer_id : wo ? wo.customer_id : null;
                return html`<tr>
                  <td>${UI.dateAr(p.created_at)}</td>
                  <td><b>${UI.money(p.amount)}</b></td>
                  <td>${UI.methodLabel(p.method)}</td>
                  <td>${customers[cid] ? customers[cid].name : "—"}</td>
                  <td>${inv ? html`<a class="link" href="invoice.html?id=${inv.id}">${I18N.t("invoice_n")} #${inv.number}</a>`
                    : wo ? html`<a class="link" href="work-order.html?id=${wo.id}">${I18N.t("order_n")} #${wo.number}</a>` : "—"}</td>
                </tr>`;
              })}
        </tbody>
      </table>`;
  }

  await UI.guard(async function () {
    var d = await Promise.all([DB.list("payments"), DB.list("invoices"), DB.list("work_orders"), DB.list("customers")]);
    pays = d[0]; invoices = UI.byId(d[1]); orders = UI.byId(d[2]); customers = UI.byId(d[3]);
    render();
  });
  $("method").addEventListener("change", render);
})();
