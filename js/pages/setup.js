(async function () {
  var page = await UI.init("setup");
  if (!page) return;
  var html = UI.html;

  var $ = function (id) { return document.getElementById(id); };

  page.innerHTML = html`
    <div class="stack">
      <div class="head-row">
        <div>
          <h2>${I18N.t("setup_title")}</h2>
          <p>${I18N.t("setup_sub")}</p>
        </div>
      </div>
      <div class="card" id="profile-card">
        <h3 style="margin-top:0">${I18N.t("shop_data")}</h3>
        <form id="prof-form" class="form-grid">
          <div class="field"><label>${I18N.t("shop_name")}</label><input id="p-name" required></div>
          <div class="field"><label>${I18N.t("shop_phone")}</label><input id="p-phone" dir="ltr"></div>
          <div class="field"><label>${I18N.t("shop_address")}</label><input id="p-address"></div>
          <div class="field"><label>${I18N.t("shop_hours")}</label><input id="p-hours" placeholder="${I18N.t("shop_hours_ph")}"></div>
          <button>${I18N.t("save_data")}</button>
        </form>
      </div>
      <div class="card" id="checklist"></div>
      <div class="card">
        <h3 style="margin-top:0">${I18N.t("quick_links")}</h3>
        <div class="row" style="flex-wrap:wrap;gap:8px">
          <a class="btn secondary" href="settings.html">${I18N.t("technicians")}</a>
          <a class="btn secondary" href="customers.html">${I18N.t("nav_customers")}</a>
          <a class="btn secondary" href="inventory.html">${I18N.t("nav_inventory")}</a>
          <a class="btn secondary" href="observation.html">${I18N.t("nav_observation")}</a>
          <a class="btn secondary" href="suppliers.html">${I18N.t("nav_suppliers")}</a>
          <a class="btn secondary" href="work-order-new.html">${I18N.t("nav_work_order_new")}</a>
        </div>
      </div>
    </div>`;

  async function load() {
    var data = await Promise.all([
      DB.list("shop_profile"),
      DB.list("technicians"),
      DB.list("customers"),
      DB.list("parts"),
      DB.list("observation_points"),
      DB.list("suppliers"),
      DB.list("work_orders"),
    ]);
    var profile = data[0][0] || { name: "", phone: "", address: "", business_hours: "" };
    $("p-name").value = profile.name || "";
    $("p-phone").value = profile.phone || "";
    $("p-address").value = profile.address || "";
    $("p-hours").value = profile.business_hours || "";

    var steps = [
      { ok: !!(profile.name), label: I18N.t("chk_shop"), href: null },
      { ok: data[1].length > 0, label: I18N.t("chk_tech"), href: "settings.html" },
      { ok: data[2].length > 0, label: I18N.t("chk_customer"), href: "customers.html" },
      { ok: data[3].length > 0, label: I18N.t("chk_parts"), href: "inventory.html" },
      { ok: data[4].length > 0, label: I18N.t("chk_obs"), href: "observation.html" },
      { ok: data[5].length > 0, label: I18N.t("chk_supplier"), href: "suppliers.html" },
      { ok: data[6].length > 0, label: I18N.t("chk_first_wo"), href: "work-order-new.html" },
    ];
    var done = steps.filter(function (s) { return s.ok; }).length;
    $("checklist").innerHTML = html`
      <h3 style="margin-top:0">${I18N.t("setup_list")} (${done}/${steps.length})</h3>
      <div class="bar" style="margin-bottom:14px"><i style="width:${Math.round((done / steps.length) * 100)}%;background:var(--success)"></i></div>
      ${steps.map(function (s, i) {
        return html`<div class="recent">
          <div>
            <b style="color:${s.ok ? "var(--success)" : "var(--text)"}">${s.ok ? "✓" : (i + 1) + "."} ${s.label}</b>
          </div>
          ${s.ok ? html`<span class="badge ready">${I18N.t("done_badge")}</span>` : s.href ? html`<a class="btn small" href="${s.href}">${I18N.t("start_btn")}</a>` : ""}
        </div>`;
      })}`;
  }

  $("prof-form").addEventListener("submit", function (e) {
    e.preventDefault();
    UI.guard(async function () {
      var rows = await DB.list("shop_profile");
      var payload = {
        name: $("p-name").value.trim(),
        phone: $("p-phone").value.trim(),
        address: $("p-address").value.trim(),
        business_hours: $("p-hours").value.trim(),
        logo_text: $("p-name").value.trim(),
      };
      if (rows.length) {
        await DB.update("shop_profile", rows[0].id, payload);
      } else {
        await DB.insert("shop_profile", payload);
      }
      UI.flash(I18N.t("shop_saved"), "success");
      await load();
    });
  });

  await UI.guard(load);
})();
