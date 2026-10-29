(async function () {
  var page = await UI.init("work-orders");
  if (!page) return;
  var html = UI.html;

  var orderId = new URLSearchParams(location.search).get("id");

  // الحالة الحالية للصفحة (بنجيبها من الداتابيز ونرسم منها)
  var S = { order: null, customer: null, vehicle: null, tech: null, lines: [], payments: [], parts: [], obsPoints: [], inspections: [] };

  // ---------- الهيكل الثابت (الفورمز بتتكتب مرة واحدة عشان ما يضيعش اللي بتكتبه) ----------
  page.innerHTML = html`
    <div class="stack">
      <div class="row between no-print">
        <a class="link" href="work-orders.html">← ${I18N.t("nav_work_orders")}</a>
        <button class="secondary" data-action="print">${I18N.t("print")}</button>
      </div>

      <div class="card" id="head"><div class="empty">${I18N.t("loading")}</div></div>

      <div>
        <h3>${I18N.t("inspection")}</h3>
        <div class="table-wrap" id="inspections"></div>
        <form class="card no-print" id="insp-form" style="margin-top:12px">
          <div class="form-grid">
            <div class="field"><label>${I18N.t("insp_point")}</label><select id="insp-point" required></select></div>
            <div class="field"><label>${I18N.t("result")}</label>
              <select id="insp-status">
                <option value="pass">${I18N.t("pass")}</option>
                <option value="fail">${I18N.t("needs_service")}</option>
                <option value="na">${I18N.t("na")}</option>
              </select>
            </div>
            <div class="field"><label>${I18N.t("notes")}</label><input id="insp-notes"></div>
            <div class="field"><label>${I18N.t("fees")}</label><input id="insp-charge" type="number" min="0" step="any" value="0"></div>
            <button>${I18N.t("add_inspection")}</button>
          </div>
        </form>
      </div>

      <div>
        <h3>${I18N.t("lines")}</h3>
        <div class="table-wrap" id="lines"></div>

        <form class="card no-print" id="line-form" style="margin-top:12px">
          <div class="form-grid">
            <div class="field"><label>${I18N.t("from_stock")}</label><select id="ln-part"></select></div>
            <div class="field"><label>${I18N.t("type")}</label>
              <select id="ln-kind"><option value="labor">${I18N.t("labor")}</option><option value="part">${I18N.t("part")}</option></select>
            </div>
            <div class="field"><label>${I18N.t("desc")}</label><input id="ln-desc"></div>
            <div class="field"><label>${I18N.t("qty")}</label><input id="ln-qty" type="number" min="0" step="any" value="1"></div>
            <div class="field"><label>${I18N.t("unit_price")}</label><input id="ln-price" type="number" min="0" step="any"></div>
            <button>${I18N.t("add_line")}</button>
          </div>
        </form>

        <div class="totals" id="totals"></div>
      </div>

      <div>
        <h3>${I18N.t("payments")}</h3>
        <div class="table-wrap" id="payments"></div>
        <form class="card no-print" id="pay-form" style="margin-top:12px">
          <div class="form-grid">
            <div class="field"><label>${I18N.t("amount")}</label><input id="pay-amount" type="number" min="0" step="any"></div>
            <div class="field"><label>${I18N.t("pay_method")}</label>
              <select id="pay-method">
                ${UI.PAY_METHODS.map(function (m) { return html`<option value="${m.key}">${m.label}</option>`; })}
              </select>
            </div>
            <button>${I18N.t("record_payment")}</button>
          </div>
        </form>
      </div>
    </div>`;

  var $ = function (id) { return document.getElementById(id); };

  // ---------- الرسم ----------
  function totals() {
    var total = S.lines.reduce(function (s, l) { return s + l.qty * l.unit_price; }, 0);
    var paid = S.payments.reduce(function (s, p) { return s + p.amount; }, 0);
    return { total: total, paid: paid, remaining: total - paid };
  }

  function renderHead() {
    var o = S.order, c = S.customer, v = S.vehicle;
    $("head").innerHTML = html`
      <div class="row between">
        <h2 style="margin:0">${I18N.t("wo_title")} #${o.number}</h2>
        <div class="row"><span class="badge prio-${o.priority || "normal"}">${I18N.t("priority_word")} ${UI.priorityLabel(o.priority)}</span>
          <span class="badge ${o.status}">${UI.statusLabel(o.status)}</span></div>
      </div>
      <p>
        <b>${I18N.t("customer")}:</b> ${c ? c.name : "—"} (${c ? c.phone : "—"})<br>
        <b>${I18N.t("vehicle")}:</b> ${v ? v.plate + " — " + v.make + " " + v.model + " " + (v.year || "") : "—"}<br>
        <b>${I18N.t("technician")}:</b> ${S.tech ? S.tech.name : "—"} · <b>${I18N.t("date")}:</b> ${UI.dateAr(o.created_at)}
        ${o.expected_delivery_at ? html`<br><b>${I18N.t("delivery_date")}:</b> ${UI.dateAr(o.expected_delivery_at)}` : ""}
      </p>
      <p><b>${I18N.t("complaint")}:</b> ${o.complaint || "—"}</p>
      <div class="no-print form-grid">
        <div class="field"><label>${I18N.t("change_status")}</label>
          <select id="status">${UI.STATUSES.map(function (s) { return UI.option(s.key, s.label, s.key === o.status); })}</select></div>
        <div class="field"><label>${I18N.t("priority_filter")}</label>
          <select id="priority">${UI.PRIORITIES.map(function (p) { return UI.option(p.key, p.label, p.key === (o.priority || "normal")); })}</select></div>
      </div>`;
  }

  function renderInspections() {
    var pts = UI.byId(S.obsPoints);
    $("inspections").innerHTML = html`
      <table>
        <thead><tr><th>${I18N.t("category")}</th><th>${I18N.t("point")}</th><th>${I18N.t("result")}</th><th>${I18N.t("notes")}</th><th>${I18N.t("fees")}</th><th class="no-print"></th></tr></thead>
        <tbody>
          ${S.inspections.length === 0
            ? html`<tr><td colspan="6" class="empty">${I18N.t("empty_inspections")}</td></tr>`
            : S.inspections.map(function (ins) {
                var pt = pts[ins.observation_point_id];
                var stLabel = ins.status === "pass" ? I18N.t("pass") : ins.status === "fail" ? I18N.t("needs_service") : I18N.t("na");
                var stClass = ins.status === "pass" ? "ready" : ins.status === "fail" ? "cancelled" : "draft";
                return html`<tr>
                  <td>${pt ? pt.category : "—"}</td>
                  <td>${pt ? pt.name : "—"}</td>
                  <td><span class="badge ${stClass}">${stLabel}</span></td>
                  <td>${ins.notes || "—"}</td>
                  <td>${Number(ins.charge) ? UI.money(ins.charge) : "—"}</td>
                  <td class="no-print"><button class="danger small" data-action="del-insp" data-id="${ins.id}">${I18N.t("delete")}</button></td>
                </tr>`;
              })}
        </tbody>
      </table>`;
    $("insp-point").innerHTML = S.obsPoints.map(function (p) {
      return UI.option(p.id, p.category + " — " + p.name);
    }).join("") || '<option value="">${I18N.t("no_obs_points")}</option>';
  }

  function renderLines() {
    $("lines").innerHTML = html`
      <table>
        <thead><tr><th>${I18N.t("type")}</th><th>${I18N.t("desc")}</th><th>${I18N.t("qty")}</th><th>${I18N.t("price_col")}</th><th>${I18N.t("total")}</th><th class="no-print"></th></tr></thead>
        <tbody>
          ${S.lines.length === 0
            ? html`<tr><td colspan="6" class="empty">${I18N.t("empty_lines")}</td></tr>`
            : S.lines.map(function (l) {
                return html`<tr>
                  <td>${l.kind === "part" ? I18N.t("part") : I18N.t("labor")}</td>
                  <td>${l.description}</td>
                  <td>${l.qty}</td>
                  <td>${UI.money(l.unit_price)}</td>
                  <td>${UI.money(l.qty * l.unit_price)}</td>
                  <td class="no-print"><button class="danger small" data-action="del-line" data-id="${l.id}">${I18N.t("delete")}</button></td>
                </tr>`;
              })}
        </tbody>
      </table>`;

    var t = totals();
    $("totals").innerHTML = html`
      <div class="card"><div class="label">${I18N.t("total")}</div><div class="value">${UI.money(t.total)}</div></div>
      <div class="card"><div class="label">${I18N.t("paid")}</div><div class="value">${UI.money(t.paid)}</div></div>
      <div class="card"><div class="label">${I18N.t("remaining")}</div><div class="value ${t.remaining > 0 ? "low" : ""}">${UI.money(t.remaining)}</div></div>`;
  }

  function renderPayments() {
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
  }

  function renderPartOptions() {
    var current = $("ln-part").value;
    $("ln-part").innerHTML = html`<option value="">${I18N.t("free_line")}</option>${S.parts.map(function (p) {
      return UI.option(p.id, p.name + " (" + I18N.t("available_short") + " " + p.qty + ")", p.id === current);
    })}`;
  }

  function renderAll() {
    renderHead();
    renderInspections();
    renderLines();
    renderPayments();
    renderPartOptions();
  }

  // ---------- تحميل البيانات ----------
  async function load() {
    var d = await Promise.all([
      DB.list("work_orders"), DB.list("customers"), DB.list("vehicles"), DB.list("technicians"),
      DB.list("work_order_lines"), DB.list("payments"), DB.list("parts"),
      DB.list("observation_points"), DB.list("work_order_inspections"),
    ]);
    var order = d[0].filter(function (o) { return o.id === orderId; })[0];
    if (!order) {
      page.innerHTML = html`<div class="card empty">${I18N.t("wo_not_found")} <a class="link" href="work-orders.html">${I18N.t("back_list")}</a></div>`;
      return false;
    }
    S.order = order;
    S.customer = UI.byId(d[1])[order.customer_id] || null;
    S.vehicle = UI.byId(d[2])[order.vehicle_id] || null;
    S.tech = UI.byId(d[3])[order.technician_id] || null;
    S.lines = d[4].filter(function (l) { return l.work_order_id === orderId; });
    S.payments = d[5].filter(function (p) { return p.work_order_id === orderId; });
    S.parts = d[6];
    S.obsPoints = d[7];
    S.inspections = d[8].filter(function (i) { return i.work_order_id === orderId; });
    return true;
  }

  async function reload() {
    if (await load()) renderAll();
  }

  // ---------- الأحداث ----------
  // تغيير الحالة (الـ select بيتعاد رسمه مع كل تحديث، فبنسمع على الصفحة كلها)
  page.addEventListener("change", function (e) {
    if (e.target.id !== "status" && e.target.id !== "priority") return;
    var patch = {};
    patch[e.target.id] = e.target.value;
    UI.guard(async function () {
      await DB.update("work_orders", orderId, patch);
      await reload();
    });
  });

  // اختيار قطعة من المخزون بيملى البيان والسعر
  $("ln-part").addEventListener("change", function () {
    var part = S.parts.filter(function (p) { return p.id === $("ln-part").value; })[0];
    $("ln-kind").disabled = !!part;
    if (part) {
      $("ln-kind").value = "part";
      $("ln-desc").value = part.name;
      $("ln-price").value = part.price;
    }
  });

  // حذف بند أو نقطة فحص
  page.addEventListener("click", function (e) {
    var btnInsp = e.target.closest('[data-action="del-insp"]');
    if (btnInsp) {
      UI.guard(async function () {
        await DB.remove("work_order_inspections", btnInsp.getAttribute("data-id"));
        await reload();
      });
      return;
    }
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

  // إضافة بند
  $("line-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var qty = Number($("ln-qty").value);
    var price = Number($("ln-price").value);
    var desc = $("ln-desc").value.trim();
    if (!desc || !(qty > 0) || !(price >= 0)) {
      UI.flash(I18N.t("line_invalid"));
      return;
    }
    UI.guard(async function () {
      var partId = $("ln-part").value;
      var part = partId ? S.parts.filter(function (p) { return p.id === partId; })[0] : null;
      if (part && part.qty < qty) throw new Error(I18N.t("qty_only_of") + " " + part.name + " " + I18N.t("is_only") + " " + part.qty);

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

  // إضافة نقطة فحص
  $("insp-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var pid = $("insp-point").value;
    if (!pid) { UI.flash(I18N.t("pick_insp")); return; }
    UI.guard(async function () {
      var pt = S.obsPoints.filter(function (p) { return p.id === pid; })[0];
      var charge = Number($("insp-charge").value);
      if (!(charge >= 0) && pt) charge = Number(pt.default_charge) || 0;
      await DB.insert("work_order_inspections", {
        work_order_id: orderId,
        observation_point_id: pid,
        status: $("insp-status").value,
        notes: $("insp-notes").value.trim(),
        charge: charge || 0,
      });
      // لو فيه رسوم و fail نقدر نضيف بند أجرة تلقائي
      if (charge > 0 && $("insp-status").value === "fail") {
        await DB.insert("work_order_lines", {
          work_order_id: orderId,
          kind: "labor",
          description: I18N.t("insp_prefix") + " " + (pt ? pt.name : ""),
          qty: 1,
          unit_price: charge,
          part_id: null,
        });
      }
      $("insp-notes").value = "";
      $("insp-charge").value = "0";
      await reload();
    });
  });

  // عند اختيار نقطة فحص املأ الرسوم الافتراضية
  $("insp-point").addEventListener("change", function () {
    var pt = S.obsPoints.filter(function (p) { return p.id === $("insp-point").value; })[0];
    if (pt) $("insp-charge").value = pt.default_charge || 0;
  });

  // تسجيل دفعة
  $("pay-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var amount = Number($("pay-amount").value);
    if (!(amount > 0)) {
      UI.flash(I18N.t("amount_invalid"));
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
