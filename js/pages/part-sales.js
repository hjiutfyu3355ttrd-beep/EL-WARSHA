(async function () {
  var page = await UI.init("part-sales");
  if (!page) return;
  var html = UI.html;

  var sales = [], customers = {}, parts = [], lines = [];
  var mode = "list";
  var viewId = "";
  var $ = function (id) { return document.getElementById(id); };

  function totalOf(sid) {
    return lines
      .filter(function (l) { return l.part_sale_id === sid; })
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
            <h2>${I18N.t("ps_title")}</h2>
            <p>${I18N.t("ps_sub")}</p>
          </div>
          <button id="btn-new">${I18N.t("ps_new_btn")}</button>
        </div>
        <input id="q" placeholder="${I18N.t("search_ps")}">
        <div class="table-wrap" id="list"></div>
      </div>`;

    function paint() {
      var q = ($("q").value || "").trim().toLowerCase();
      var shown = sales.filter(function (s) {
        var cn = customers[s.customer_id] ? customers[s.customer_id].name : "";
        return (("" + s.number) + " " + cn).toLowerCase().indexOf(q) !== -1;
      });
      $("list").innerHTML = html`
        <table class="clickable">
          <thead><tr><th>${I18N.t("quote_number")}</th><th>${I18N.t("customer")}</th><th>${I18N.t("status_filter")}</th><th>${I18N.t("total")}</th><th>${I18N.t("date")}</th></tr></thead>
          <tbody>
            ${shown.length === 0
              ? html`<tr><td colspan="5" class="empty">${I18N.t("ps_empty")}</td></tr>`
              : shown.map(function (s) {
                  var c = customers[s.customer_id];
                  return html`<tr data-action="view" data-id="${s.id}">
                    <td><b>#${s.number}</b></td>
                    <td>${c ? c.name : "—"}</td>
                    <td><span class="badge ${s.status === "paid" ? "paid" : "draft"}">${s.status === "paid" ? I18N.t("paid_badge") : I18N.t("draft_st")}</span></td>
                    <td>${UI.money(s.total != null ? s.total : totalOf(s.id))}</td>
                    <td>${UI.dateAr(s.created_at)}</td>
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
    var custOpts = Object.keys(customers).map(function (id) {
      return UI.option(id, customers[id].name);
    });
    page.innerHTML = html`
      <div class="stack">
        <div class="head-row">
          <div><h2>${I18N.t("ps_new_title")}</h2></div>
          <button class="secondary" id="btn-back">${I18N.t("back")}</button>
        </div>
        <form class="card" id="ps-form">
          <div class="form-grid">
            <div class="field"><label>${I18N.t("customer")}</label><select id="ps-customer" required>${custOpts}</select></div>
            <div class="field"><label>${I18N.t("notes")}</label><input id="ps-notes"></div>
          </div>
          <h3 style="margin-top:16px">${I18N.t("the_parts")}</h3>
          <div id="line-rows" class="stack"></div>
          <button type="button" class="secondary small" id="add-line" style="margin-top:8px">${I18N.t("add_part_btn")}</button>
          <div class="row between" style="margin-top:16px">
            <b id="ps-total">${I18N.t("total_prefix")} 0</b>
            <button type="submit">${I18N.t("save_collect")}</button>
          </div>
        </form>
      </div>`;

    var draft = [{ part_id: "", description: "", qty: 1, unit_price: 0 }];
    function paintLines() {
      var partOpts = parts.map(function (p) {
        return UI.option(p.id, p.name + " (" + I18N.t("available_short") + ": " + p.qty + ") — " + UI.money(p.price));
      }).join("");
      $("line-rows").innerHTML = draft.map(function (l, i) {
        return html`<div class="form-grid" data-i="${i}">
          <div class="field"><label>${I18N.t("inv_part")}</label>
            <select data-f="part_id"><option value="">${I18N.t("choose_dash")}</option>${partOpts.replace('value="' + l.part_id + '"', 'value="' + l.part_id + '" selected')}</select>
          </div>
          <div class="field"><label>${I18N.t("qty")}</label><input data-f="qty" type="number" min="1" value="${l.qty}"></div>
          <div class="field"><label>${I18N.t("price")}</label><input data-f="unit_price" type="number" min="0" step="any" value="${l.unit_price}"></div>
          <button type="button" class="danger small" data-action="rm" data-i="${i}">${I18N.t("delete")}</button>
        </div>`;
      }).join("");
      // fix selected
      $("line-rows").querySelectorAll("[data-i]").forEach(function (row) {
        var i = Number(row.getAttribute("data-i"));
        var sel = row.querySelector("[data-f='part_id']");
        if (draft[i].part_id) sel.value = draft[i].part_id;
      });
      updTotal();
    }
    function updTotal() {
      var t = draft.reduce(function (s, l) { return s + (Number(l.qty) || 0) * (Number(l.unit_price) || 0); }, 0);
      $("ps-total").textContent = I18N.t("total_prefix") + " " + UI.money(t);
    }
    paintLines();

    $("add-line").addEventListener("click", function () {
      draft.push({ part_id: "", description: "", qty: 1, unit_price: 0 });
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
          draft[i].unit_price = p.price;
          row.querySelector("[data-f='unit_price']").value = p.price;
        }
      } else if (f === "qty") {
        draft[i].qty = Number(e.target.value);
      } else if (f === "unit_price") {
        draft[i].unit_price = Number(e.target.value);
      }
      updTotal();
    });
    $("line-rows").addEventListener("input", function (e) {
      var row = e.target.closest("[data-i]");
      if (!row) return;
      var i = Number(row.getAttribute("data-i"));
      var f = e.target.getAttribute("data-f");
      if (f === "qty") draft[i].qty = Number(e.target.value);
      if (f === "unit_price") draft[i].unit_price = Number(e.target.value);
      updTotal();
    });
    $("line-rows").addEventListener("click", function (e) {
      var btn = e.target.closest("[data-action='rm']");
      if (!btn) return;
      draft.splice(Number(btn.getAttribute("data-i")), 1);
      if (!draft.length) draft.push({ part_id: "", description: "", qty: 1, unit_price: 0 });
      paintLines();
    });

    $("btn-back").addEventListener("click", function () { mode = "list"; render(); });
    $("ps-form").addEventListener("submit", function (e) {
      e.preventDefault();
      UI.guard(async function () {
        var valid = draft.filter(function (l) { return l.part_id; });
        if (!valid.length) { UI.flash(I18N.t("pick_one_part")); return; }
        // stock check
        for (var i = 0; i < valid.length; i++) {
          var p = parts.filter(function (x) { return x.id === valid[i].part_id; })[0];
          if (p && p.qty < valid[i].qty) {
            UI.flash(I18N.t("qty_low") + ": " + p.name + " (" + I18N.t("available") + " " + p.qty + ")");
            return;
          }
        }
        var total = valid.reduce(function (s, l) { return s + l.qty * l.unit_price; }, 0);
        var rec = await DB.insert("part_sales", {
          customer_id: $("ps-customer").value,
          total: total,
          status: "paid",
          notes: $("ps-notes").value.trim(),
        });
        for (var j = 0; j < valid.length; j++) {
          var l = valid[j];
          var p = parts.filter(function (x) { return x.id === l.part_id; })[0];
          await DB.insert("part_sale_lines", {
            part_sale_id: rec.id,
            part_id: l.part_id,
            description: l.description || (p ? p.name : ""),
            qty: l.qty,
            unit_price: l.unit_price,
          });
          if (p) await DB.update("parts", p.id, { qty: p.qty - l.qty });
        }
        await DB.insert("income", {
          label: I18N.t("ps_title") + " #" + rec.number,
          amount: total,
          notes: $("ps-notes").value.trim(),
          source: "part_sale",
          ref_id: rec.id,
        });
        await load();
        mode = "list";
        render();
        UI.flash(I18N.t("sale_done"), "success");
      });
    });
  }

  function renderView() {
    var s = sales.filter(function (x) { return x.id === viewId; })[0];
    if (!s) { mode = "list"; return render(); }
    var c = customers[s.customer_id];
    var mine = lines.filter(function (l) { return l.part_sale_id === s.id; });
    page.innerHTML = html`
      <div class="stack">
        <div class="head-row">
          <div>
            <h2>${I18N.t("sale_invoice")} #${s.number}</h2>
            <div class="detail-meta">
              <span class="badge paid">${I18N.t("paid_badge")}</span>
              <span class="chip">${UI.dateAr(s.created_at)}</span>
            </div>
          </div>
          <div class="actions">
            <button class="secondary" id="btn-back">${I18N.t("back")}</button>
            <button class="secondary" data-action="print">${I18N.t("print")}</button>
            <button class="danger" id="btn-del">${I18N.t("delete")}</button>
          </div>
        </div>
        <div class="detail-grid">
          <div class="card"><div class="label">${I18N.t("customer")}</div><div class="value">${c ? c.name : "—"}</div></div>
          <div class="card"><div class="label">${I18N.t("total")}</div><div class="value">${UI.money(s.total)}</div></div>
        </div>
        <div class="card">
          <h3 style="margin-top:0">${I18N.t("the_parts")}</h3>
          <div class="table-wrap">
            <table>
              <thead><tr><th>${I18N.t("description")}</th><th>${I18N.t("qty")}</th><th>${I18N.t("price")}</th><th>${I18N.t("total")}</th></tr></thead>
              <tbody>
                ${mine.map(function (l) {
                  return html`<tr>
                    <td>${l.description}</td>
                    <td>${l.qty}</td>
                    <td>${UI.money(l.unit_price)}</td>
                    <td>${UI.money(l.qty * l.unit_price)}</td>
                  </tr>`;
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>`;
    $("btn-back").addEventListener("click", function () { mode = "list"; render(); });
    $("btn-del").addEventListener("click", function () {
      if (!confirm(I18N.t("del_sale_q"))) return;
      UI.guard(async function () {
        for (var i = 0; i < mine.length; i++) await DB.remove("part_sale_lines", mine[i].id);
        await DB.remove("part_sales", s.id);
        await load();
        mode = "list";
        render();
      });
    });
  }

  async function load() {
    var data = await Promise.all([
      DB.list("part_sales"),
      DB.list("customers"),
      DB.list("parts"),
      DB.list("part_sale_lines"),
    ]);
    sales = data[0];
    customers = UI.byId(data[1]);
    parts = data[2];
    lines = data[3];
  }

  await UI.guard(async function () {
    await load();
    render();
  });
})();
