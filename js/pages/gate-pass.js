(async function () {
  var page = await UI.init("gate-pass");
  if (!page) return;
  var html = UI.html;

  var passes = [], orders = {}, vehicles = {}, customers = {};
  var $ = function (id) { return document.getElementById(id); };

  page.innerHTML = html`
    <div class="stack">
      <div class="head-row">
        <div>
          <h2>${I18N.t("gp_title")}</h2>
          <p>${I18N.t("gp_sub")}</p>
        </div>
      </div>
      <form class="card" id="gp-form">
        <h3 style="margin-top:0">${I18N.t("gp_new")}</h3>
        <div class="form-grid">
          <div class="field"><label>${I18N.t("direction")}</label>
            <select id="gp-dir">
              <option value="in">${I18N.t("dir_in")}</option>
              <option value="out">${I18N.t("dir_out")}</option>
            </select>
          </div>
          <div class="field"><label>${I18N.t("wo_optional")}</label><select id="gp-wo"><option value="">${I18N.t("without")}</option></select></div>
          <div class="field"><label>${I18N.t("vehicle")}</label><select id="gp-vehicle" required></select></div>
          <div class="field"><label>${I18N.t("notes")}</label><input id="gp-notes"></div>
          <button>${I18N.t("register")}</button>
        </div>
      </form>
      <input id="q" placeholder="${I18N.t("search_gp")}">
      <div class="table-wrap" id="list"><div class="empty">${I18N.t("loading")}</div></div>
    </div>`;

  function fillSelects() {
    var woOpts = Object.keys(orders).map(function (id) {
      var o = orders[id];
      var v = vehicles[o.vehicle_id];
      return UI.option(id, "#" + o.number + (v ? " — " + v.plate : ""));
    });
    $("gp-wo").innerHTML = '<option value="">${I18N.t("without")}</option>' + woOpts.join("");
    var vOpts = Object.keys(vehicles).map(function (id) {
      var v = vehicles[id];
      return UI.option(id, v.plate + " — " + v.make + " " + v.model);
    });
    $("gp-vehicle").innerHTML = vOpts.length ? vOpts.join("") : '<option value="">${I18N.t("empty_vehicles")}</option>';
  }

  function render() {
    var q = ($("q").value || "").trim().toLowerCase();
    var shown = passes.filter(function (p) {
      var v = vehicles[p.vehicle_id];
      var plate = v ? v.plate : "";
      return (("" + p.number) + " " + plate).toLowerCase().indexOf(q) !== -1;
    });
    $("list").innerHTML = html`
      <table>
        <thead><tr><th>${I18N.t("number_col")}</th><th>${I18N.t("direction")}</th><th>${I18N.t("vehicle")}</th><th>${I18N.t("wo_label")}</th><th>${I18N.t("notes")}</th><th>${I18N.t("date")}</th><th></th></tr></thead>
        <tbody>
          ${shown.length === 0
            ? html`<tr><td colspan="7" class="empty">${I18N.t("empty_gp")}</td></tr>`
            : shown.map(function (p) {
                var v = vehicles[p.vehicle_id];
                var o = p.work_order_id ? orders[p.work_order_id] : null;
                return html`<tr>
                  <td><b>#${p.number}</b></td>
                  <td><span class="badge ${p.direction === "out" ? "ready" : "received"}">${p.direction === "out" ? I18N.t("dir_out") : I18N.t("dir_in")}</span></td>
                  <td>${v ? v.plate : "—"}</td>
                  <td>${o ? "#" + o.number : "—"}</td>
                  <td>${p.notes || "—"}</td>
                  <td>${UI.dateAr(p.created_at)}</td>
                  <td><button class="danger small" data-action="del" data-id="${p.id}">${I18N.t("delete")}</button></td>
                </tr>`;
              })}
        </tbody>
      </table>`;
  }

  async function load() {
    var data = await Promise.all([
      DB.list("gate_passes"),
      DB.list("work_orders"),
      DB.list("vehicles"),
      DB.list("customers"),
    ]);
    passes = data[0];
    orders = UI.byId(data[1]);
    vehicles = UI.byId(data[2]);
    customers = UI.byId(data[3]);
    fillSelects();
    render();
  }

  $("gp-wo").addEventListener("change", function () {
    var oid = $("gp-wo").value;
    if (oid && orders[oid]) $("gp-vehicle").value = orders[oid].vehicle_id || "";
  });

  $("q").addEventListener("input", render);
  $("gp-form").addEventListener("submit", function (e) {
    e.preventDefault();
    UI.guard(async function () {
      var dir = $("gp-dir").value;
      var woId = $("gp-wo").value || null;
      // تصريح خروج: يفضّل أمر شغل جاهز أو مسلّم
      if (dir === "out" && woId) {
        var o = orders[woId];
        if (o && o.status !== "ready" && o.status !== "delivered") {
          if (!confirm(I18N.t("gp_not_ready"))) return;
        }
      }
      await DB.insert("gate_passes", {
        work_order_id: woId,
        vehicle_id: $("gp-vehicle").value,
        direction: dir,
        notes: $("gp-notes").value.trim(),
      });
      $("gp-notes").value = "";
      await load();
      UI.flash(I18N.t("gp_saved"), "success");
    });
  });
  page.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-action='del']");
    if (!btn) return;
    if (!confirm(I18N.t("del_gp_q"))) return;
    UI.guard(async function () {
      await DB.remove("gate_passes", btn.getAttribute("data-id"));
      await load();
    });
  });

  await UI.guard(load);
})();
