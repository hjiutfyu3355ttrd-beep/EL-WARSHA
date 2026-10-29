(async function () {
  var page = await UI.init("customers");
  if (!page) return;
  var html = UI.html;
  var t = UI.t;

  var customers = [], vehicles = [], sel = "";

  page.innerHTML = html`
    <div class="stack">
      <h2 class="page-title" style="margin:0">${t("customers_title")}</h2>

      <form class="card" id="cust-form">
        <h3 style="margin-top:0">${t("customers_new")}</h3>
        <div class="form-grid">
          <div class="field"><label>${t("customers_name")}</label><input id="c-name" required></div>
          <div class="field"><label>${t("customers_phone")}</label><input id="c-phone" dir="ltr"></div>
          <div class="field"><label>${t("customers_notes")}</label><input id="c-notes"></div>
          <button>${t("customers_add")}</button>
        </div>
      </form>

      <input id="q" placeholder="${t("customers_search")}">
      <div class="table-wrap" id="list"><div class="empty">${t("loading")}</div></div>
      <div id="detail"></div>
    </div>`;

  var $ = function (id) { return document.getElementById(id); };

  function renderList() {
    var q = $("q").value.trim().toLowerCase();
    var shown = customers.filter(function (c) {
      return (c.name + " " + (c.phone || "")).toLowerCase().indexOf(q) !== -1;
    });
    $("list").innerHTML = html`
      <table class="clickable">
        <thead><tr><th>${t("col_customer")}</th><th>${t("customers_phone")}</th><th>${t("customers_vehicles")}</th></tr></thead>
        <tbody>
          ${shown.length === 0
            ? html`<tr><td colspan="3" class="empty">${t("customers_empty")}</td></tr>`
            : shown.map(function (c) {
                var count = vehicles.filter(function (v) { return v.customer_id === c.id; }).length;
                return html`<tr class="${c.id === sel ? "sel-row" : ""}" data-action="select" data-id="${c.id}">
                  <td>${c.name}</td>
                  <td dir="ltr">${c.phone || t("none")}</td>
                  <td>${count}</td>
                </tr>`;
              })}
        </tbody>
      </table>`;
  }

  function renderDetail() {
    var c = customers.filter(function (x) { return x.id === sel; })[0];
    if (!c) {
      $("detail").innerHTML = "";
      return;
    }
    var mine = vehicles.filter(function (v) { return v.customer_id === sel; });
    $("detail").innerHTML = html`
      <div class="card stack">
        <h3 style="margin:0">${t("customers_vehicles_of")} ${c.name}</h3>
        <div class="table-wrap">
          <table>
            <thead><tr><th>${t("customers_plate")}</th><th>${t("customers_type")}</th><th>${t("customers_year")}</th><th>${t("customers_odometer")}</th><th></th></tr></thead>
            <tbody>
              ${mine.length === 0
                ? html`<tr><td colspan="5" class="empty">${t("customers_no_vehicles")}</td></tr>`
                : mine.map(function (v) {
                    return html`<tr>
                      <td>${v.plate}</td>
                      <td>${(v.make || "") + " " + (v.model || "")}</td>
                      <td>${v.year || t("none")}</td>
                      <td>${v.odometer != null ? v.odometer : t("none")}</td>
                      <td><button class="danger small" data-action="del-vehicle" data-id="${v.id}">${t("delete")}</button></td>
                    </tr>`;
                  })}
            </tbody>
          </table>
        </div>
        <form id="veh-form">
          <div class="form-grid">
            <div class="field"><label>${t("customers_vehicle_plate")}</label><input id="v-plate" required></div>
            <div class="field"><label>${t("customers_vehicle_make")}</label><input id="v-make"></div>
            <div class="field"><label>Model</label><input id="v-model"></div>
            <div class="field"><label>${t("customers_vehicle_year")}</label><input id="v-year" type="number"></div>
            <div class="field"><label>${t("customers_vehicle_odometer")}</label><input id="v-odo" type="number"></div>
            <button>${t("customers_add_vehicle")}</button>
          </div>
        </form>
      </div>`;
  }

  async function load() {
    var d = await Promise.all([DB.list("customers"), DB.list("vehicles")]);
    customers = d[0];
    vehicles = d[1];
    renderList();
    renderDetail();
  }

  $("cust-form").addEventListener("submit", function (e) {
    e.preventDefault();
    UI.guard(async function () {
      var row = await DB.insert("customers", {
        name: $("c-name").value.trim(),
        phone: $("c-phone").value.trim(),
        notes: $("c-notes").value.trim(),
      });
      $("cust-form").reset();
      sel = row.id;
      await load();
    });
  });

  $("q").addEventListener("input", renderList);

  page.addEventListener("click", function (e) {
    var el = e.target.closest("[data-action]");
    if (!el) return;
    var action = el.getAttribute("data-action");
    var id = el.getAttribute("data-id");

    if (action === "select") {
      sel = id;
      renderList();
      renderDetail();
    }
    if (action === "del-vehicle") {
      UI.guard(async function () {
        try {
          await DB.remove("vehicles", id);
        } catch (err) {
          throw new Error(I18N.getLang() === "tr" ? "İş emri olan araç silinemez" : "مينفعش تحذف سيارة عليها أوامر شغل");
        }
        await load();
      });
    }
  });

  page.addEventListener("submit", function (e) {
    if (e.target.id !== "veh-form") return;
    e.preventDefault();
    UI.guard(async function () {
      await DB.insert("vehicles", {
        customer_id: sel,
        plate: $("v-plate").value.trim(),
        make: $("v-make").value.trim(),
        model: $("v-model").value.trim(),
        year: $("v-year").value ? Number($("v-year").value) : null,
        odometer: $("v-odo").value ? Number($("v-odo").value) : null,
      });
      await load();
    });
  });

  await UI.guard(load);
})();
