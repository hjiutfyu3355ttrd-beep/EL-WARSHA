(async function () {
  var page = await UI.init("purchases");
  if (!page) return;
  var html = UI.html;

  var purchases = [], suppliers = {}, parts = [], lines = [];
  var mode = "list", viewId = "";
  var $ = function (id) { return document.getElementById(id); };

  function totalOf(pid) {
    return lines.filter(function (l) { return l.purchase_id === pid; })
      .reduce(function (s, l) { return s + (Number(l.qty) || 0) * (Number(l.unit_cost) || 0); }, 0);
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
          <div><h2>${I18N.t("pu_title")}</h2><p>أوامر شراء من الموردين وزيادة المخزون عند الاستلام.</p></div>
          <button id="btn-new">${I18N.t("pu_new_btn")}</button>
        </div>
        <input id="q" placeholder="${I18N.t("search_pu")}">
        <div class="table-wrap" id="list"></div>
      </div>`;
    function paint() {
      var q = ($("q").value || "").trim().toLowerCase();
      var shown = purchases.filter(function (p) {
        var sn = suppliers[p.supplier_id] ? suppliers[p.supplier_id].name : "";
        return (("" + p.number) + " " + sn).toLowerCase().indexOf(q) !== -1;
      });
      $("list").innerHTML = html`
        <table class="clickable">
          <thead><tr><th>${I18N.t("quote_number")}</th><th>${I18N.t("supplier")}</th><th>${I18N.t("status_filter")}</th><th>${I18N.t("total")}</th><th>${I18N.t("date")}</th></tr></thead>
          <tbody>
            ${shown.length === 0
              ? html`<tr><td colspan="5" class="empty">${I18N.t("purchase_empty")}</td></tr>`
              : shown.map(function (p) {
                  var s = suppliers[p.supplier_id];
                  return html`<tr data-action="view" data-id="${p.id}">
                    <td><b>#${p.number}</b></td>
                    <td>${s ? s.name : "—"}</td>
                    <td><span class="badge ${p.status === "received" ? "paid" : "draft"}">${p.status === "received" ? I18N.t("received_st") : I18N.t("draft_st")}</span></td>
                    <td>${UI.money(p.total != null ? p.total : totalOf(p.id))}</td>
                    <td>${UI.dateAr(p.created_at)}</td>
                  </tr>`;
                })}
          </tbody>
        </table>`;
    }
    paint();
    $("q").addEventListener("input", paint);
    $("btn-new").addEventListener("click", function () { mode = "new"; render(); });
    $("list").addEventListener("click", function (e) {
      var tr = e.target.closest("[data-action='view']");
      if (!tr) return;
      viewId = tr.getAttribute("data-id");
      mode = "view";
      render();
    });
  }

  function renderNew() {
    var supOpts = Object.keys(suppliers).map(function (id) {
      return UI.option(id, suppliers[id].name);
    });
    page.innerHTML = html`
      <div class="stack">
        <div class="head-row">
          <div><h2>${I18N.t("purchase_new")}</h2></div>
          <button class="secondary" id="btn-back">${I18N.t("back")}</button>
        </div>
        <form class="card" id="pu-form">
          <div class="form-grid">
            <div class="field"><label>${I18N.t("supplier")}</label><select id="pu-sup" required>${supOpts.length ? supOpts.join("") : '<option value="">أضف مورد أولاً</option>'}</select></div>
            <div class="field"><label>${I18N.t("notes")}</label><input id="pu-notes"></div>
          </div>
          <h3 style="margin-top:16px">${I18N.t("items")}</h3>
          <div id="line-rows" class="stack"></div>
          <button type="button" class="secondary small" id="add-line" style="margin-top:8px">${I18N.t("add_item")}</button>
          <div class="row between" style="margin-top:16px">
            <b id="pu-total">${I18N.t("total_prefix")} 0</b>
            <button type="submit">${I18N.t("save_receive")}</button>
          </div>
        </form>
      </div>`;

    var draft = [{ part_id: "", description: "", qty: 1, unit_cost: 0 }];
    function paintLines() {
      var partOpts = parts.map(function (p) {
        return UI.option(p.id, p.name + " — " + I18N.t("cost_word") + " " + UI.money(p.cost));
      }).join("");
      $("line-rows").innerHTML = draft.map(function (l, i) {
        return html`<div class="form-grid" data-i="${i}">
          <div class="field"><label>${I18N.t("inv_part")}</label>
            <select data-f="part_id"><option value="">${I18N.t("choose_dash")}</option>${partOpts}</select>
          </div>
          <div class="field"><label>${I18N.t("qty")}</label><input data-f="qty" type="number" min="1" value="${l.qty}"></div>
          <div class="field"><label>${I18N.t("unit_cost")}</label><input data-f="unit_cost" type="number" min="0" step="any" value="${l.unit_cost}"></div>
          <button type="button" class="danger small" data-action="rm" data-i="${i}">${I18N.t("delete")}</button>
        </div>`;
      }).join("");
      $("line-rows").querySelectorAll("[data-i]").forEach(function (row) {
        var i = Number(row.getAttribute("data-i"));
        if (draft[i].part_id) row.querySelector("[data-f='part_id']").value = draft[i].part_id;
      });
      upd();
    }
    function upd() {
      var t = draft.reduce(function (s, l) { return s + (Number(l.qty) || 0) * (Number(l.unit_cost) || 0); }, 0);
      $("pu-total").textContent = I18N.t("total_prefix") + " " + UI.money(t);
    }
    paintLines();
    $("add-line").addEventListener("click", function () {
      draft.push({ part_id: "", description: "", qty: 1, unit_cost: 0 });
      paintLines();
    });
    $("line-rows").addEventListener("change", function (e) {
      var row = e.target.closest("[data-i]");
      if (!row) return;
      var i = Number(row.getAttribute("data-i"));
      var f = e.target.getAttribute("data-f");
      if (f === "part_id") {
        draft[i].part_id = e.target.value;
        var p = parts.filter(function (x) { return x.id === e.target.value; })[0];
        if (p) {
          draft[i].description = p.name;
          draft[i].unit_cost = p.cost;
          row.querySelector("[data-f='unit_cost']").value = p.cost;
        }
      }
      upd();
    });
    $("line-rows").addEventListener("input", function (e) {
      var row = e.target.closest("[data-i]");
      if (!row) return;
      var i = Number(row.getAttribute("data-i"));
      var f = e.target.getAttribute("data-f");
      if (f === "qty") draft[i].qty = Number(e.target.value);
      if (f === "unit_cost") draft[i].unit_cost = Number(e.target.value);
      upd();
    });
    $("line-rows").addEventListener("click", function (e) {
      var btn = e.target.closest("[data-action='rm']");
      if (!btn) return;
      draft.splice(Number(btn.getAttribute("data-i")), 1);
      if (!draft.length) draft.push({ part_id: "", description: "", qty: 1, unit_cost: 0 });
      paintLines();
    });
    $("btn-back").addEventListener("click", function () { mode = "list"; render(); });
    $("pu-form").addEventListener("submit", function (e) {
      e.preventDefault();
      UI.guard(async function () {
        var valid = draft.filter(function (l) { return l.part_id; });
        if (!valid.length) { UI.flash(I18N.t("pick_one_item")); return; }
        if (!$("pu-sup").value) { UI.flash(I18N.t("pick_supplier")); return; }
        var total = valid.reduce(function (s, l) { return s + l.qty * l.unit_cost; }, 0);
        var rec = await DB.insert("purchases", {
          supplier_id: $("pu-sup").value,
          total: total,
          status: "received",
          notes: $("pu-notes").value.trim(),
        });
        for (var j = 0; j < valid.length; j++) {
          var l = valid[j];
          var p = parts.filter(function (x) { return x.id === l.part_id; })[0];
          await DB.insert("purchase_lines", {
            purchase_id: rec.id,
            part_id: l.part_id,
            description: l.description || (p ? p.name : ""),
            qty: l.qty,
            unit_cost: l.unit_cost,
          });
          if (p) await DB.update("parts", p.id, { qty: (Number(p.qty) || 0) + Number(l.qty), cost: l.unit_cost });
        }
        await DB.insert("expenses", {
          label: I18N.t("purchases_n") + " #" + rec.number,
          amount: total,
          notes: $("pu-notes").value.trim() || I18N.t("from_supplier"),
        });
        await load();
        mode = "list";
        render();
        UI.flash(I18N.t("received_stock"), "success");
      });
    });
  }

  function renderView() {
    var p = purchases.filter(function (x) { return x.id === viewId; })[0];
    if (!p) { mode = "list"; return render(); }
    var s = suppliers[p.supplier_id];
    var mine = lines.filter(function (l) { return l.purchase_id === p.id; });
    page.innerHTML = html`
      <div class="stack">
        <div class="head-row">
          <div>
            <h2>${I18N.t("pu_order_n")} #${p.number}</h2>
            <div class="detail-meta">
              <span class="badge paid">${I18N.t("received_st")}</span>
              <span class="chip">${UI.dateAr(p.created_at)}</span>
            </div>
          </div>
          <div class="actions">
            <button class="secondary" id="btn-back">${I18N.t("back")}</button>
            <button class="danger" id="btn-del">${I18N.t("delete")}</button>
          </div>
        </div>
        <div class="detail-grid">
          <div class="card"><div class="label">${I18N.t("supplier")}</div><div class="value">${s ? s.name : "—"}</div></div>
          <div class="card"><div class="label">${I18N.t("total")}</div><div class="value">${UI.money(p.total)}</div></div>
        </div>
        <div class="card">
          <h3 style="margin-top:0">${I18N.t("items")}</h3>
          <div class="table-wrap">
            <table>
              <thead><tr><th>${I18N.t("description")}</th><th>${I18N.t("qty")}</th><th>${I18N.t("unit_cost")}</th><th>${I18N.t("total")}</th></tr></thead>
              <tbody>
                ${mine.map(function (l) {
                  return html`<tr>
                    <td>${l.description}</td><td>${l.qty}</td>
                    <td>${UI.money(l.unit_cost)}</td>
                    <td>${UI.money(l.qty * l.unit_cost)}</td>
                  </tr>`;
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>`;
    $("btn-back").addEventListener("click", function () { mode = "list"; render(); });
    $("btn-del").addEventListener("click", function () {
      if (!confirm(I18N.t("del_pu_q"))) return;
      UI.guard(async function () {
        for (var i = 0; i < mine.length; i++) await DB.remove("purchase_lines", mine[i].id);
        await DB.remove("purchases", p.id);
        await load();
        mode = "list";
        render();
      });
    });
  }

  async function load() {
    var data = await Promise.all([
      DB.list("purchases"), DB.list("suppliers"), DB.list("parts"), DB.list("purchase_lines"),
    ]);
    purchases = data[0];
    suppliers = UI.byId(data[1]);
    parts = data[2];
    lines = data[3];
  }

  await UI.guard(async function () {
    await load();
    render();
  });
})();
