(async function () {
  var page = await UI.init("invoices");
  if (!page) return;
  var html = UI.html;
  var invId = new URLSearchParams(location.search).get("id");
  var S = { inv: null, customer: null, order: null, lines: [], payments: [] };

  page.innerHTML = html`
    <div class="stack">
      <div class="row between no-print">
        <a class="link" href="invoices.html">← ${I18N.t("invoices_back")}</a>
        <div class="row" id="actions"></div>
      </div>

      <div class="card" id="head"><div class="empty">${I18N.t("loading")}</div></div>

      <div>
        <h3>${I18N.t("lines")}</h3>
        <div class="table-wrap" id="lines"></div>
        <form class="card no-print" id="line-form" style="margin-top:12px">
          <div class="form-grid">
            <div class="field"><label>${I18N.t("type")}</label>
              <select id="ln-kind"><option value="labor">${I18N.t("labor")}</option><option value="part">${I18N.t("part")}</option></select></div>
            <div class="field"><label>${I18N.t("desc")}</label><input id="ln-desc" required></div>
            <div class="field"><label>${I18N.t("qty")}</label><input id="ln-qty" type="number" min="0" step="any" value="1"></div>
            <div class="field"><label>${I18N.t("unit_price")}</label><input id="ln-price" type="number" min="0" step="any"></div>
            <button>${I18N.t("add_line")}</button>
          </div>
        </form>
        <div class="card no-print" style="margin-top:12px">
          <div class="form-grid">
            <div class="field"><label>${I18N.t("discount")}</label><input id="inv-discount" type="number" min="0" step="any"></div>
            <div class="field"><label>${I18N.t("tax")}</label><input id="inv-tax" type="number" min="0" step="any"></div>
          </div>
        </div>
        <div class="totals" id="totals"></div>
      </div>

      <div>
        <h3>${I18N.t("payments")}</h3>
        <div class="table-wrap" id="payments"></div>
        <form class="card no-print" id="pay-form" style="margin-top:12px">
          <div class="form-grid">
            <div class="field"><label>${I18N.t("amount")}</label><input id="pay-amount" type="number" min="0" step="any" required></div>
            <div class="field"><label>${I18N.t("pay_method")}</label>
              <select id="pay-method">${UI.PAY_METHODS.map(function (m) { return html`<option value="${m.key}">${m.label}</option>`; })}</select></div>
            <button>${I18N.t("record_payment")}</button>
          </div>
        </form>
      </div>
    </div>`;

  var $ = function (id) { return document.getElementById(id); };
  var editable = function () { return S.inv && S.inv.status !== "cancelled"; };

  function render() {
    var i = S.inv, c = S.customer;
    $("head").innerHTML = html`
      <div class="row between">
        <div>
          <h2 style="margin:0">${I18N.t("invoice_title")} #${i.number}</h2>
          <div><small>${UI.dateAr(i.issued_at)}</small></div>
        </div>
        <span class="badge ${i.status}">${UI.invStatusLabel(i.status)}</span>
      </div>
      <p style="margin-bottom:0"><b>${I18N.t("customer")}:</b> ${c ? c.name : "—"} ${c && c.phone ? html`· <span dir="ltr">${c.phone}</span>` : ""}
        ${S.order ? html`<br><b>${I18N.t("wo_label")}:</b> <a class="link" href="work-order.html?id=${S.order.id}">#${S.order.number}</a>` : ""}</p>`;

    var a = [];
    if (i.status === "draft") a.push(html`<button data-action="issue">${I18N.t("issue_invoice")}</button>`);
    if (i.status !== "cancelled") a.push(html`<button class="danger" data-action="cancel">${I18N.t("cancel_invoice")}</button>`);
    a.push(html`<button class="secondary" data-action="print">${I18N.t("print")}</button>`);
    $("actions").innerHTML = html`${a}`;

    $("lines").innerHTML = html`
      <table>
        <thead><tr><th>${I18N.t("type")}</th><th>${I18N.t("desc")}</th><th>${I18N.t("qty")}</th><th>${I18N.t("price")}</th><th>${I18N.t("total")}</th><th class="no-print"></th></tr></thead>
        <tbody>
          ${S.lines.length === 0
            ? html`<tr><td colspan="6" class="empty">${I18N.t("empty_lines")}</td></tr>`
            : S.lines.map(function (l) {
                return html`<tr><td>${l.kind === "part" ? I18N.t("part") : I18N.t("labor")}</td><td>${l.description}</td><td>${l.qty}</td>
                  <td>${UI.money(l.unit_price)}</td><td>${UI.money(l.qty * l.unit_price)}</td>
                  <td class="no-print">${editable() ? html`<button class="danger small" data-action="del-line" data-id="${l.id}">${I18N.t("delete")}</button>` : ""}</td></tr>`;
              })}
        </tbody>
      </table>`;

    $("inv-discount").value = i.discount || 0;
    $("inv-tax").value = i.tax || 0;
    var rem = i.status === "cancelled" ? 0 : i.total - i.paid_amount;
    $("totals").innerHTML = html`
      <div class="card"><div class="label">${I18N.t("total")}</div><div class="value">${UI.money(i.total)}</div></div>
      <div class="card"><div class="label">${I18N.t("paid")}</div><div class="value">${UI.money(i.paid_amount)}</div></div>
      <div class="card"><div class="label">${I18N.t("remaining")}</div><div class="value ${rem > 0 ? "low" : ""}">${UI.money(rem)}</div></div>`;

    $("payments").innerHTML = html`
      <table>
        <thead><tr><th>${I18N.t("amount")}</th><th>${I18N.t("method")}</th><th>${I18N.t("date")}</th></tr></thead>
        <tbody>
          ${S.payments.length === 0
            ? html`<tr><td colspan="3" class="empty">${I18N.t("empty_payments")}</td></tr>`
            : S.payments.map(function (p) {
                return html`<tr><td>${UI.money(p.amount)}</td><td>${UI.methodLabel(p.method)}</td><td>${UI.dateAr(p.created_at)}</td></tr>`;
              })}
        </tbody>
      </table>`;

    var dis = !editable();
    ["line-form", "pay-form"].forEach(function (f) {
      var els = $(f).querySelectorAll("input,select,button");
      for (var k = 0; k < els.length; k++) els[k].disabled = dis;
    });
    $("inv-discount").disabled = dis;
    $("inv-tax").disabled = dis;
  }

  async function load() {
    var d = await Promise.all([
      DB.list("invoices"), DB.list("customers"), DB.list("work_orders"), DB.list("invoice_lines"), DB.list("payments"),
    ]);
    var inv = d[0].filter(function (x) { return x.id === invId; })[0];
    if (!inv) {
      page.innerHTML = html`<div class="card empty">${I18N.t("invoice_missing")} <a class="link" href="invoices.html">${I18N.t("back_list")}</a></div>`;
      return false;
    }
    S.inv = inv;
    S.customer = UI.byId(d[1])[inv.customer_id] || null;
    S.order = UI.byId(d[2])[inv.work_order_id] || null;
    S.lines = d[3].filter(function (l) { return l.invoice_id === invId; }).sort(function (a, b) { return a.sort_order - b.sort_order; });
    S.payments = d[4].filter(function (p) { return p.invoice_id === invId; });
    return true;
  }

  async function reload(recalc) {
    if (recalc) await Finance.recalc(invId);
    if (await load()) render();
  }

  page.addEventListener("click", function (e) {
    var el = e.target.closest("[data-action]");
    if (!el) return;
    var a = el.getAttribute("data-action");
    if (a === "issue") {
      UI.guard(async function () { await DB.update("invoices", invId, { status: "issued" }); await reload(true); });
    } else if (a === "cancel") {
      if (!confirm(I18N.t("cancel_inv_q"))) return;
      UI.guard(async function () { await DB.update("invoices", invId, { status: "cancelled" }); await reload(false); });
    } else if (a === "del-line") {
      UI.guard(async function () { await DB.remove("invoice_lines", el.getAttribute("data-id")); await reload(true); });
    }
  });

  $("line-form").addEventListener("submit", function (e) {
    e.preventDefault();
    UI.guard(async function () {
      var qty = Number($("ln-qty").value), price = Number($("ln-price").value);
      if (!(qty > 0) || !(price >= 0)) throw new Error(I18N.t("qty_price_err"));
      await DB.insert("invoice_lines", {
        invoice_id: invId, kind: $("ln-kind").value, description: $("ln-desc").value.trim(),
        qty: qty, unit_price: price, sort_order: S.lines.length,
      });
      $("ln-desc").value = ""; $("ln-price").value = "";
      await reload(true);
    });
  });

  ["inv-discount", "inv-tax"].forEach(function (id) {
    $(id).addEventListener("change", function () {
      UI.guard(async function () {
        var v = Number($(id).value);
        if (!(v >= 0)) throw new Error(I18N.t("value_err"));
        await DB.update("invoices", invId, id === "inv-discount" ? { discount: v } : { tax: v });
        await reload(true);
      });
    });
  });

  $("pay-form").addEventListener("submit", function (e) {
    e.preventDefault();
    UI.guard(async function () {
      var amount = Number($("pay-amount").value);
      if (!(amount > 0)) throw new Error(I18N.t("amount_invalid"));
      var remaining = S.inv.total - S.inv.paid_amount;
      if (amount > remaining + 0.001) throw new Error(I18N.t("amount_gt_remain") + " (" + UI.money(remaining) + ")");
      if (S.inv.status === "draft") await DB.update("invoices", invId, { status: "issued" });
      await DB.insert("payments", {
        invoice_id: invId, work_order_id: S.inv.work_order_id || null, amount: amount, method: $("pay-method").value,
      });
      $("pay-amount").value = "";
      await reload(true);
    });
  });

  await UI.guard(async function () { await reload(false); });
})();
