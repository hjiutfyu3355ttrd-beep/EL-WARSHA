(async function () {
  var page = await UI.init("invoices");
  if (!page) return;
  var html = UI.html;
  var invId = new URLSearchParams(location.search).get("id");
  var S = { inv: null, customer: null, order: null, lines: [], payments: [] };

  page.innerHTML = html`
    <div class="stack">
      <div class="row between no-print">
        <a class="link" href="invoices.html">← الفواتير</a>
        <div class="row" id="actions"></div>
      </div>

      <div class="card" id="head"><div class="empty">جارٍ التحميل…</div></div>

      <div>
        <h3>البنود</h3>
        <div class="table-wrap" id="lines"></div>
        <form class="card no-print" id="line-form" style="margin-top:12px">
          <div class="form-grid">
            <div class="field"><label>النوع</label>
              <select id="ln-kind"><option value="labor">أجرة</option><option value="part">قطعة</option></select></div>
            <div class="field"><label>البيان</label><input id="ln-desc" required></div>
            <div class="field"><label>الكمية</label><input id="ln-qty" type="number" min="0" step="any" value="1"></div>
            <div class="field"><label>سعر الوحدة</label><input id="ln-price" type="number" min="0" step="any"></div>
            <button>إضافة بند</button>
          </div>
        </form>
        <div class="card no-print" style="margin-top:12px">
          <div class="form-grid">
            <div class="field"><label>الخصم</label><input id="inv-discount" type="number" min="0" step="any"></div>
            <div class="field"><label>الضريبة</label><input id="inv-tax" type="number" min="0" step="any"></div>
          </div>
        </div>
        <div class="totals" id="totals"></div>
      </div>

      <div>
        <h3>المدفوعات</h3>
        <div class="table-wrap" id="payments"></div>
        <form class="card no-print" id="pay-form" style="margin-top:12px">
          <div class="form-grid">
            <div class="field"><label>المبلغ</label><input id="pay-amount" type="number" min="0" step="any" required></div>
            <div class="field"><label>طريقة الدفع</label>
              <select id="pay-method">${UI.PAY_METHODS.map(function (m) { return html`<option value="${m.key}">${m.label}</option>`; })}</select></div>
            <button>تسجيل دفعة</button>
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
          <h2 style="margin:0">فاتورة #${i.number}</h2>
          <div><small>${UI.dateAr(i.issued_at)}</small></div>
        </div>
        <span class="badge ${i.status}">${UI.invStatusLabel(i.status)}</span>
      </div>
      <p style="margin-bottom:0"><b>العميل:</b> ${c ? c.name : "—"} ${c && c.phone ? html`· <span dir="ltr">${c.phone}</span>` : ""}
        ${S.order ? html`<br><b>أمر الشغل:</b> <a class="link" href="work-order.html?id=${S.order.id}">#${S.order.number}</a>` : ""}</p>`;

    var a = [];
    if (i.status === "draft") a.push(html`<button data-action="issue">إصدار الفاتورة</button>`);
    if (i.status !== "cancelled") a.push(html`<button class="danger" data-action="cancel">إلغاء الفاتورة</button>`);
    a.push(html`<button class="secondary" data-action="print">طباعة</button>`);
    $("actions").innerHTML = html`${a}`;

    $("lines").innerHTML = html`
      <table>
        <thead><tr><th>النوع</th><th>البيان</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th><th class="no-print"></th></tr></thead>
        <tbody>
          ${S.lines.length === 0
            ? html`<tr><td colspan="6" class="empty">مفيش بنود</td></tr>`
            : S.lines.map(function (l) {
                return html`<tr><td>${l.kind === "part" ? "قطعة" : "أجرة"}</td><td>${l.description}</td><td>${l.qty}</td>
                  <td>${UI.money(l.unit_price)}</td><td>${UI.money(l.qty * l.unit_price)}</td>
                  <td class="no-print">${editable() ? html`<button class="danger small" data-action="del-line" data-id="${l.id}">حذف</button>` : ""}</td></tr>`;
              })}
        </tbody>
      </table>`;

    $("inv-discount").value = i.discount || 0;
    $("inv-tax").value = i.tax || 0;
    var rem = i.status === "cancelled" ? 0 : i.total - i.paid_amount;
    $("totals").innerHTML = html`
      <div class="card"><div class="label">الإجمالي</div><div class="value">${UI.money(i.total)}</div></div>
      <div class="card"><div class="label">المدفوع</div><div class="value">${UI.money(i.paid_amount)}</div></div>
      <div class="card"><div class="label">المتبقي</div><div class="value ${rem > 0 ? "low" : ""}">${UI.money(rem)}</div></div>`;

    $("payments").innerHTML = html`
      <table>
        <thead><tr><th>المبلغ</th><th>الطريقة</th><th>التاريخ</th></tr></thead>
        <tbody>
          ${S.payments.length === 0
            ? html`<tr><td colspan="3" class="empty">مفيش مدفوعات</td></tr>`
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
      page.innerHTML = html`<div class="card empty">الفاتورة مش موجودة. <a class="link" href="invoices.html">رجوع للقائمة</a></div>`;
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
      if (!confirm("إلغاء الفاتورة دي؟")) return;
      UI.guard(async function () { await DB.update("invoices", invId, { status: "cancelled" }); await reload(false); });
    } else if (a === "del-line") {
      UI.guard(async function () { await DB.remove("invoice_lines", el.getAttribute("data-id")); await reload(true); });
    }
  });

  $("line-form").addEventListener("submit", function (e) {
    e.preventDefault();
    UI.guard(async function () {
      var qty = Number($("ln-qty").value), price = Number($("ln-price").value);
      if (!(qty > 0) || !(price >= 0)) throw new Error("الكمية والسعر لازم أرقام صحيحة");
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
        if (!(v >= 0)) throw new Error("القيمة لازم تكون رقم صحيح");
        await DB.update("invoices", invId, id === "inv-discount" ? { discount: v } : { tax: v });
        await reload(true);
      });
    });
  });

  $("pay-form").addEventListener("submit", function (e) {
    e.preventDefault();
    UI.guard(async function () {
      var amount = Number($("pay-amount").value);
      if (!(amount > 0)) throw new Error("اكتب مبلغ صحيح");
      var remaining = S.inv.total - S.inv.paid_amount;
      if (amount > remaining + 0.001) throw new Error("المبلغ أكبر من المتبقي (" + UI.money(remaining) + ")");
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
