(async function () {
  var page = await UI.init("quotations");
  if (!page) return;
  var html = UI.html;

  var quotations = [], customers = {}, vehicles = {}, lines = [];
  var mode = "list"; // list | new | view
  var viewId = "";

  var $ = function (id) { return document.getElementById(id); };

  function totalOf(qid) {
    return lines
      .filter(function (l) { return l.quotation_id === qid; })
      .reduce(function (s, l) { return s + (Number(l.qty) || 0) * (Number(l.unit_price) || 0); }, 0);
  }

  function render() {
    if (mode === "new") return renderNew();
    if (mode === "view") return renderView();
    renderList();
  }

  function renderList() {
    page.innerHTML = html`
      <div class="stack">
        <div class="head-row">
          <div>
            <h2>${I18N.t("quote_title")}</h2>
            <p>${I18N.t("quote_sub")}</p>
          </div>
          <div class="actions">
            <button id="btn-new">＋ ${I18N.t("quote_new")}</button>
          </div>
        </div>
        <input id="q" placeholder="${I18N.t("quote_search")}">
        <div class="table-wrap" id="list"></div>
      </div>`;

    function paint() {
      var q = ($("q").value || "").trim().toLowerCase();
      var shown = quotations.filter(function (r) {
        var cn = customers[r.customer_id] ? customers[r.customer_id].name : "";
        return (("" + r.number) + " " + cn).toLowerCase().indexOf(q) !== -1;
      });
      $("list").innerHTML = html`
        <table class="clickable">
          <thead><tr><th>${I18N.t("quote_number")}</th><th>${I18N.t("customer")}</th><th>${I18N.t("vehicle")}</th><th>${I18N.t("status_filter")}</th><th>${I18N.t("total")}</th><th>التاريخ</th></tr></thead>
          <tbody>
            ${shown.length === 0
              ? html`<tr><td colspan="6" class="empty">${I18N.t("quote_empty")}</td></tr>`
              : shown.map(function (r) {
                  var c = customers[r.customer_id];
                  var v = vehicles[r.vehicle_id];
                  return html`<tr data-action="view" data-id="${r.id}">
                    <td><b>#${r.number}</b></td>
                    <td>${c ? c.name : "—"}</td>
                    <td>${v ? v.plate : "—"}</td>
                    <td><span class="badge ${r.status}">${UI.quoteStatusLabel(r.status)}</span></td>
                    <td>${UI.money(r.total != null ? r.total : totalOf(r.id))}</td>
                    <td>${UI.dateAr(r.created_at)}</td>
                  </tr>`;
                })}
          </tbody>
        </table>`;
    }
    paint();
    $("q").addEventListener("input", paint);
    $("btn-new").addEventListener("click", function () { mode = "new"; render(); });
    page.querySelector("#list").addEventListener("click", function (e) {
      var tr = e.target.closest("[data-action='view']");
      if (!tr) return;
      viewId = tr.getAttribute("data-id");
      mode = "view";
      render();
    });
  }

  function renderNew() {
    var custOpts = Object.keys(customers).map(function (id) {
      return UI.option(id, customers[id].name);
    });
    page.innerHTML = html`
      <div class="stack">
        <div class="head-row">
          <div><h2>${I18N.t("quote_new")}</h2><p>${I18N.t("quote_new_hint")}</p></div>
          <button class="secondary" id="btn-back">${I18N.t("back")}</button>
        </div>
        <form class="card" id="q-form">
          <div class="form-grid">
            <div class="field"><label>${I18N.t("customer")}</label><select id="q-customer" required>${custOpts}</select></div>
            <div class="field"><label>${I18N.t("vehicle")}</label><select id="q-vehicle" required></select></div>
            <div class="field"><label>${I18N.t("notes")}</label><input id="q-notes"></div>
          </div>
          <h3 style="margin-top:16px">${I18N.t("quote_lines")}</h3>
          <div id="line-rows" class="stack"></div>
          <button type="button" class="secondary small" id="add-line" style="margin-top:8px">${I18N.t("quote_add_line")}</button>
          <div class="row between" style="margin-top:16px">
            <b id="q-total">${I18N.t("total_prefix")} 0</b>
            <button type="submit">${I18N.t("quote_save")}</button>
          </div>
        </form>
      </div>`;

    function fillVehicles() {
      var cid = $("q-customer").value;
      var opts = Object.keys(vehicles)
        .filter(function (id) { return vehicles[id].customer_id === cid; })
        .map(function (id) {
          var v = vehicles[id];
          return UI.option(id, v.plate + " — " + v.make + " " + v.model);
        });
      $("q-vehicle").innerHTML = opts.length ? opts.join("") : '<option value="">${I18N.t("empty_vehicles")}</option>';
    }
    fillVehicles();
    $("q-customer").addEventListener("change", fillVehicles);

    var draftLines = [{ description: "", qty: 1, unit_price: 0, kind: "labor" }];
    function paintLines() {
      $("line-rows").innerHTML = draftLines.map(function (l, i) {
        return html`<div class="form-grid" data-i="${i}">
          <div class="field"><label>${I18N.t("description")}</label><input data-f="description" value="${l.description}" required></div>
          <div class="field"><label>${I18N.t("qty")}</label><input data-f="qty" type="number" min="1" step="1" value="${l.qty}"></div>
          <div class="field"><label>${I18N.t("price")}</label><input data-f="unit_price" type="number" min="0" step="any" value="${l.unit_price}"></div>
          <div class="field"><label>${I18N.t("type")}</label>
            <select data-f="kind">
              <option value="labor" ${l.kind === "labor" ? "selected" : ""}>${I18N.t("labor")}</option>
              <option value="part" ${l.kind === "part" ? "selected" : ""}>${I18N.t("part")}</option>
            </select>
          </div>
          <button type="button" class="danger small" data-action="rm-line" data-i="${i}">${I18N.t("delete")}</button>
        </div>`;
      }).join("");
      var t = draftLines.reduce(function (s, l) { return s + (Number(l.qty) || 0) * (Number(l.unit_price) || 0); }, 0);
      $("q-total").textContent = I18N.t("total_prefix") + " " + UI.money(t);
    }
    paintLines();

    $("add-line").addEventListener("click", function () {
      draftLines.push({ description: "", qty: 1, unit_price: 0, kind: "labor" });
      paintLines();
    });
    $("line-rows").addEventListener("input", function (e) {
      var row = e.target.closest("[data-i]");
      if (!row) return;
      var i = Number(row.getAttribute("data-i"));
      var f = e.target.getAttribute("data-f");
      if (!f) return;
      draftLines[i][f] = e.target.type === "number" ? Number(e.target.value) : e.target.value;
      var t = draftLines.reduce(function (s, l) { return s + (Number(l.qty) || 0) * (Number(l.unit_price) || 0); }, 0);
      $("q-total").textContent = I18N.t("total_prefix") + " " + UI.money(t);
    });
    $("line-rows").addEventListener("click", function (e) {
      var btn = e.target.closest("[data-action='rm-line']");
      if (!btn) return;
      draftLines.splice(Number(btn.getAttribute("data-i")), 1);
      if (!draftLines.length) draftLines.push({ description: "", qty: 1, unit_price: 0, kind: "labor" });
      paintLines();
    });

    $("btn-back").addEventListener("click", function () { mode = "list"; render(); });
    $("q-form").addEventListener("submit", function (e) {
      e.preventDefault();
      UI.guard(async function () {
        var total = draftLines.reduce(function (s, l) { return s + (Number(l.qty) || 0) * (Number(l.unit_price) || 0); }, 0);
        var rec = await DB.insert("quotations", {
          customer_id: $("q-customer").value,
          vehicle_id: $("q-vehicle").value,
          status: "draft",
          notes: $("q-notes").value.trim(),
          total: total,
        });
        for (var i = 0; i < draftLines.length; i++) {
          var l = draftLines[i];
          if (!l.description) continue;
          await DB.insert("quotation_lines", {
            quotation_id: rec.id,
            kind: l.kind,
            description: l.description,
            qty: Number(l.qty) || 1,
            unit_price: Number(l.unit_price) || 0,
            part_id: null,
          });
        }
        await load();
        mode = "list";
        render();
        UI.flash(I18N.t("quote_saved") + " #" + rec.number, "success");
      });
    });
  }

  function renderView() {
    var r = quotations.filter(function (x) { return x.id === viewId; })[0];
    if (!r) { mode = "list"; return render(); }
    var c = customers[r.customer_id];
    var v = vehicles[r.vehicle_id];
    var mine = lines.filter(function (l) { return l.quotation_id === r.id; });
    var total = r.total != null ? r.total : totalOf(r.id);

    page.innerHTML = html`
      <div class="stack">
        <div class="head-row">
          <div>
            <h2>${I18N.t("quote_new")} #${r.number}</h2>
            <div class="detail-meta">
              <span class="badge ${r.status}">${UI.quoteStatusLabel(r.status)}</span>
              <span class="chip">${UI.dateAr(r.created_at)}</span>
            </div>
          </div>
          <div class="actions">
            <button class="secondary" id="btn-back">${I18N.t("back")}</button>
            ${r.status === "draft" || r.status === "sent" ? html`<button data-st="accepted">${I18N.t("accept_quote")}</button>` : ""}
            ${r.status === "draft" || r.status === "sent" ? html`<button class="secondary" data-st="rejected">${I18N.t("reject_quote")}</button>` : ""}
            ${r.status === "draft" ? html`<button class="secondary" data-st="sent">${I18N.t("send_quote")}</button>` : ""}
            ${r.status === "accepted" ? html`<button id="btn-convert">${I18N.t("quote_convert")}</button>` : ""}
            <button class="danger" id="btn-del">${I18N.t("delete")}</button>
          </div>
        </div>
        <div class="detail-grid">
          <div class="card"><div class="label">${I18N.t("customer")}</div><div class="value">${c ? c.name : "—"}</div></div>
          <div class="card"><div class="label">${I18N.t("phone")}</div><div class="value" dir="ltr">${c ? c.phone : "—"}</div></div>
          <div class="card"><div class="label">${I18N.t("vehicle")}</div><div class="value">${v ? v.plate + " — " + v.make + " " + v.model : "—"}</div></div>
          <div class="card"><div class="label">${I18N.t("total")}</div><div class="value">${UI.money(total)}</div></div>
        </div>
        ${r.notes ? html`<div class="card"><div class="label">${I18N.t("notes")}</div><div>${r.notes}</div></div>` : ""}
        <div class="card">
          <h3 style="margin-top:0">${I18N.t("quote_lines")}</h3>
          <div class="table-wrap">
            <table>
              <thead><tr><th>${I18N.t("description")}</th><th>${I18N.t("type")}</th><th>${I18N.t("qty")}</th><th>${I18N.t("price")}</th><th>الإجمالي</th></tr></thead>
              <tbody>
                ${mine.length === 0
                  ? html`<tr><td colspan="5" class="empty">${I18N.t("empty_lines")}</td></tr>`
                  : mine.map(function (l) {
                      return html`<tr>
                        <td>${l.description}</td>
                        <td>${l.kind === "part" ? I18N.t("part") : I18N.t("labor")}</td>
                        <td>${l.qty}</td>
                        <td>${UI.money(l.unit_price)}</td>
                        <td>${UI.money((Number(l.qty) || 0) * (Number(l.unit_price) || 0))}</td>
                      </tr>`;
                    })}
              </tbody>
            </table>
          </div>
        </div>
      </div>`;

    $("btn-back").addEventListener("click", function () { mode = "list"; render(); });
    page.querySelectorAll("[data-st]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        UI.guard(async function () {
          await DB.update("quotations", r.id, { status: btn.getAttribute("data-st") });
          await load();
          render();
        });
      });
    });
    var conv = $("btn-convert");
    if (conv) {
      conv.addEventListener("click", function () {
        UI.guard(async function () {
          var wo = await DB.insert("work_orders", {
            customer_id: r.customer_id,
            vehicle_id: r.vehicle_id,
            technician_id: null,
            status: "received",
            priority: "normal",
            complaint: r.notes || (I18N.t("quote_new") + " #" + r.number),
            expected_delivery_at: null,
          });
          for (var i = 0; i < mine.length; i++) {
            var l = mine[i];
            await DB.insert("work_order_lines", {
              work_order_id: wo.id,
              kind: l.kind,
              description: l.description,
              qty: l.qty,
              unit_price: l.unit_price,
              part_id: l.part_id || null,
            });
          }
          await DB.update("quotations", r.id, { status: "converted" });
          await load();
          location.href = "work-order.html?id=" + wo.id;
        });
      });
    }
    $("btn-del").addEventListener("click", function () {
      if (!confirm(I18N.t("del_quote_q"))) return;
      UI.guard(async function () {
        for (var i = 0; i < mine.length; i++) await DB.remove("quotation_lines", mine[i].id);
        await DB.remove("quotations", r.id);
        await load();
        mode = "list";
        render();
      });
    });
  }

  async function load() {
    var data = await Promise.all([
      DB.list("quotations"),
      DB.list("customers"),
      DB.list("vehicles"),
      DB.list("quotation_lines"),
    ]);
    quotations = data[0];
    customers = UI.byId(data[1]);
    vehicles = UI.byId(data[2]);
    lines = data[3];
  }

  // toast success style
  var style = document.createElement("style");
  style.textContent = ".toast.success{background:var(--success)}";
  document.head.appendChild(style);

  await UI.guard(async function () {
    await load();
    render();
  });
})();
