(async function () {
  var page = await UI.init("work-orders");
  if (!page) return;
  var html = UI.html;
  var t = UI.t;

  var orderId = new URLSearchParams(location.search).get("id");

  var S = { order: null, customer: null, vehicle: null, tech: null, lines: [], payments: [], parts: [] };

  page.innerHTML = html`
    <div class="stack">
      <div class="row between no-print">
        <a class="link" href="work-orders.html">← ${t("nav_work_orders")}</a>
        <button class="secondary" data-action="print">${t("print")}</button>
      </div>

      <div class="card" id="head"><div class="empty">${t("loading")}</div></div>

      <div>
        <h3>${t("work_order_items")}</h3>
        <div class="table-wrap" id="lines"></div>

        <form class="card no-print" id="line-form" style="margin-top:12px">
          <div class="form-grid">
            <div class="field"><label>${t("nav_inventory")} (${t("work_order_select_tech").indexOf("optional") >= 0 ? "" : ""})</label><select id="ln-part"></select></div>
            <div class="field"><label>${t("work_order_item_type")}</label>
              <select id="ln-kind"><option value="labor">${t("work_order_type_labor")}</option><option value="part">${t("work_order_type_part")}</option></select>
            </div>
            <div class="field"><label>${t("work_order_item_desc")}</label><input id="ln-desc"></div>
            <div class="field"><label>${t("work_order_item_qty")}</label><input id="ln-qty" type="number" min="0" step="any" value="1"></div>
            <div class="field"><label>${t("work_order_item_price")}</label><input id="ln-price" type="number" min="0" step="any"></div>
            <button>${t("work_order_add_item")}</button>
          </div>
        </form>

        <div class="totals" id="totals"></div>
      </div>

      <div>
        <h3>${t("work_order_payments")}</h3>
        <div class="table-wrap" id="payments"></div>
        <form class="card no-print" id="pay-form" style="margin-top:12px">
          <div class="form-grid">
            <div class="field"><label>${t("work_order_amount")}</label><input id="pay-amount" type="number" min="0" step="any"></div>
            <div class="field"><label>${t("work_order_method")}</label>
              <select id="pay-method">
                ${UI.PAY_METHODS.map(function (m) { return html`<option value="${m.key}">${m.label}</option>`; })}
              </select>
            </div>
            <button>${t("work_order_add_payment")}</button>
          </div>
        </form>
      </div>
    </div>`;

  var $ = function (id) { return document.getElementById(id); };

  function totals() {
    var total = S.lines.reduce(function (s, l) { return s + l.qty * l.unit_price; }, 0);
    var paid = S.payments.reduce(function (s, p) { return s + p.amount; }, 0);
    return { total: total, paid: paid, remaining: total - paid };
  }

  function renderHead() {
    var o = S.order, c = S.customer, v = S.vehicle;
    $("head").innerHTML = html`
      <div class="row between">
        <h2 style="margin:0">${t("work_order_title")} #${o.number}</h2>
        <span class="badge ${o.status}">${UI.statusLabel(o.status)}</span>
      </div>
      <p>
        <b>${t("work_order_customer")}:</b> ${c ? c.name : t("none")} (${c ? c.phone : t("none")})<br>
        <b>${t("work_order_vehicle")}:</b> ${v ? v.plate + " — " + (v.make || "") + " " + (v.model || "") + " " + (v.year || "") : t("none")}<br>
        <b>${t("work_order_tech")}:</b> ${S.tech ? S.tech.name : t("none")} · <b>${t("col_date")}:</b> ${UI.dateAr(o.created_at)}
      </p>
      <p><b>${t("work_order_complaint_label")}:</b> ${o.complaint || t("none")}</p>
      <div class="no-print field">
        <label>${t("work_order_update_status")}</label>
        <select id="status">
          ${UI.STATUSES.map(function (s) { return UI.option(s.key, s.label, s.key === o.status); })}
        </select>
      </div>`;
  }

  function renderLines() {
    $("lines").innerHTML = html`
      <table>
        <thead><tr><th>${t("work_order_item_type")}</th><th>${t("work_order_item_desc")}</th><th>${t("work_order_item_qty")}</th><th>${t("work_order_item_price")}</th><th>${t("col_total")}</th><th class="no-print"></th></tr></thead>
        <tbody>
          ${S.lines.length === 0
            ? html`<tr><td colspan="6" class="empty">${t("work_order_no_items")}</td></tr>`
            : S.lines.map(function (l) {
                return html`<tr>
                  <td>${l.kind === "part" ? t("work_order_type_part") : t("work_order_type_labor")}</td>
                  <td>${l.description}</td>
                  <td>${l.qty}</td>
                  <td>${UI.money(l.unit_price)}</td>
                  <td>${UI.money(l.qty * l.unit_price)}</td>
                  <td class="no-print"><button class="danger small" data-action="del-line" data-id="${l.id}">${t("delete")}</button></td>
                </tr>`;
              })}
        </tbody>
      </table>`;

    var tot = totals();
    $("totals").innerHTML = html`
      <div class="card"><div class="label">${t("work_order_subtotal")}</div><div class="value">${UI.money(tot.total)}</div></div>
      <div class="card"><div class="label">${t("work_order_paid")}</div><div class="value">${UI.money(tot.paid)}</div></div>
      <div class="card"><div class="label">${t("work_order_remaining")}</div><div class="value ${tot.remaining > 0 ? "low" : ""}">${UI.money(tot.remaining)}</div></div>`;
  }

  function renderPayments() {
    $("payments").innerHTML = html`
      <table>
        <thead><tr><th>${t("work_order_amount")}</th><th>${t("work_order_method")}</th><th>${t("col_date")}</th></tr></thead>
        <tbody>
          ${S.payments.length === 0
            ? html`<tr><td colspan="3" class="empty">${t("work_order_no_payments")}</td></tr>`
            : S.payments.map(function (p) {
                return html`<tr><td>${UI.money(p.amount)}</td><td>${UI.methodLabel(p.method)}</td><td>${UI.dateAr(p.created_at)}</td></tr>`;
              })}
        </tbody>
      </table>`;
  }

  function renderPartOptions() {
    var current = $("ln-part").value;
    $("ln-part").innerHTML = html`<option value="">—</option>${S.parts.map(function (p) {
      return UI.option(p.id, p.name + " (" + p.qty + ")", p.id === current);
    })}`;
  }

  function renderAll() {
    renderHead();
    renderLines();
    renderPayments();
    renderPartOptions();
  }

  async function load() {
    var d = await Promise.all([
      DB.list("work_orders"), DB.list("customers"), DB.list("vehicles"), DB.list("technicians"),
      DB.list("work_order_lines"), DB.list("payments"), DB.list("parts"),
    ]);
    var order = d[0].filter(function (o) { return o.id === orderId; })[0];
    if (!order) {
      page.innerHTML = html`<div class="card empty">${t("work_orders_empty")} <a class="link" href="work-orders.html">${t("back")}</a></div>`;
      return false;
    }
    S.order = order;
    S.customer = UI.byId(d[1])[order.customer_id] || null;
    S.vehicle = UI.byId(d[2])[order.vehicle_id] || null;
    S.tech = UI.byId(d[3])[order.technician_id] || null;
    S.lines = d[4].filter(function (l) { return l.work_order_id === orderId; });
    S.payments = d[5].filter(function (p) { return p.work_order_id === orderId; });
    S.parts = d[6];
    return true;
  }

  async function reload() {
    if (await load()) renderAll();
  }

  page.addEventListener("change", function (e) {
    if (e.target.id !== "status") return;
    UI.guard(async function () {
      await DB.update("work_orders", orderId, { status: e.target.value });
      await reload();
    });
  });

  $("ln-part").addEventListener("change", function () {
    var part = S.parts.filter(function (p) { return p.id === $("ln-part").value; })[0];
    $("ln-kind").disabled = !!part;
    if (part) {
      $("ln-kind").value = "part";
      $("ln-desc").value = part.name;
      $("ln-price").value = part.price;
    }
  });

  page.addEventListener("click", function (e) {
    var btn = e.target.closest('[data-action="del-line"]');
    if (!btn) return;
    UI.guard(async function () {
      var line = S.lines.filter(function (l) { return l.id === btn.getAttribute("data-id"); })[0];
      if (!line) return;
      await DB.remove("work_order_lines", line.id);
      var part = line.part_id ? S.parts.filter(function (p) { return p.id === line.part_id; })[0] : null;
      if (part) await DB.update("parts", part.id, { qty: part.qty + line.qty });
      await reload();
    });
  });

  $("line-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var qty = Number($("ln-qty").value);
    var price = Number($("ln-price").value);
    var desc = $("ln-desc").value.trim();
    if (!desc || !(qty > 0) || !(price >= 0)) {
      UI.flash(I18N.getLang() === "tr" ? "Açıklama, miktar ve fiyatı doğru girin" : "اكتب البيان والكمية والسعر بشكل صحيح");
      return;
    }
    UI.guard(async function () {
      var partId = $("ln-part").value;
      var part = partId ? S.parts.filter(function (p) { return p.id === partId; })[0] : null;
      if (part && part.qty < qty) {
        throw new Error(I18N.getLang() === "tr"
          ? part.name + " için mevcut miktar sadece " + part.qty
          : "الكمية المتاحة من " + part.name + " هي " + part.qty + " فقط");
      }

      await DB.insert("work_order_lines", {
        work_order_id: orderId,
        kind: part ? "part" : $("ln-kind").value,
        description: desc,
        qty: qty,
        unit_price: price,
        part_id: partId || null,
      });
      if (part) await DB.update("parts", part.id, { qty: part.qty - qty });

      $("line-form").reset();
      $("ln-kind").disabled = false;
      await reload();
    });
  });

  $("pay-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var amount = Number($("pay-amount").value);
    if (!(amount > 0)) {
      UI.flash(I18N.getLang() === "tr" ? "Geçerli bir tutar girin" : "اكتب مبلغ صحيح");
      return;
    }
    UI.guard(async function () {
      await DB.insert("payments", { work_order_id: orderId, amount: amount, method: $("pay-method").value });
      $("pay-form").reset();
      await reload();
    });
  });

  await UI.guard(reload);
})();
