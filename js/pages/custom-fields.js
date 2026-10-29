(async function () {
  var page = await UI.init("custom-fields");
  if (!page) return;
  var html = UI.html;

  var fields = [];
  var $ = function (id) { return document.getElementById(id); };

  var MODULES = [
    { key: "customer", labelKey: "mod_customer" },
    { key: "vehicle", labelKey: "mod_vehicle" },
    { key: "employee", labelKey: "mod_employee" },
    { key: "supplier", labelKey: "mod_supplier" },
  ];
  var TYPES = [
    { key: "text", labelKey: "type_text" },
    { key: "number", labelKey: "type_number" },
    { key: "select", labelKey: "type_select" },
    { key: "date", labelKey: "type_date" },
  ];
  MODULES.forEach(function (m) { m.label = I18N.t(m.labelKey); });
  TYPES.forEach(function (x) { x.label = I18N.t(x.labelKey); });

  page.innerHTML = html`
    <div class="stack">
      <div class="head-row">
        <div>
          <h2>${I18N.t("cf_title")}</h2>
          <p>${I18N.t("cf_sub2")}</p>
        </div>
      </div>
      <form class="card" id="cf-form">
        <h3 style="margin-top:0">${I18N.t("cf_new2")}</h3>
        <div class="form-grid">
          <div class="field"><label>${I18N.t("cf_unit")}</label>
            <select id="cf-module">${MODULES.map(function (m) { return UI.option(m.key, m.label); })}</select>
          </div>
          <div class="field"><label>${I18N.t("cf_field_name")}</label><input id="cf-label" required placeholder="${I18N.t("cf_field_ph")}"></div>
          <div class="field"><label>${I18N.t("type")}</label>
            <select id="cf-type">${TYPES.map(function (t) { return UI.option(t.key, t.label); })}</select>
          </div>
          <div class="field" id="opts-wrap" style="display:none"><label>${I18N.t("cf_options")}</label>
            <input id="cf-options" placeholder="${I18N.t("cf_options_ph")}">
          </div>
          <div class="field"><label>${I18N.t("cf_required")}</label>
            <select id="cf-req"><option value="false">${I18N.t("no")}</option><option value="true">${I18N.t("yes")}</option></select>
          </div>
          <button>${I18N.t("add")}</button>
        </div>
      </form>
      <div id="list"><div class="empty">${I18N.t("loading")}</div></div>
    </div>`;

  function render() {
    var byMod = {};
    fields.forEach(function (f) {
      if (!byMod[f.module]) byMod[f.module] = [];
      byMod[f.module].push(f);
    });
    $("list").innerHTML = MODULES.map(function (m) {
      var list = byMod[m.key] || [];
      return html`<div class="card" style="margin-bottom:12px">
        <h3 style="margin:0 0 10px">${m.label}</h3>
        ${list.length === 0
          ? html`<div class="empty" style="padding:12px">${I18N.t("empty_fields")}</div>`
          : html`<table>
              <thead><tr><th>${I18N.t("name")}</th><th>${I18N.t("type")}</th><th>${I18N.t("cf_required")}</th><th>${I18N.t("options_col")}</th><th></th></tr></thead>
              <tbody>
                ${list.map(function (f) {
                  var tl = TYPES.filter(function (x) { return x.key === f.field_type; })[0];
                  return html`<tr>
                    <td><b>${f.label}</b></td>
                    <td>${tl ? tl.label : f.field_type}</td>
                    <td>${f.required ? I18N.t("yes") : I18N.t("no")}</td>
                    <td>${f.options || "—"}</td>
                    <td><button class="danger small" data-action="del" data-id="${f.id}">${I18N.t("delete")}</button></td>
                  </tr>`;
                })}
              </tbody>
            </table>`}
      </div>`;
    }).join("");
  }

  async function load() {
    fields = await DB.list("custom_fields");
    render();
  }

  $("cf-type").addEventListener("change", function () {
    $("opts-wrap").style.display = $("cf-type").value === "select" ? "" : "none";
  });
  $("cf-form").addEventListener("submit", function (e) {
    e.preventDefault();
    UI.guard(async function () {
      await DB.insert("custom_fields", {
        module: $("cf-module").value,
        label: $("cf-label").value.trim(),
        field_type: $("cf-type").value,
        options: $("cf-type").value === "select" ? $("cf-options").value.trim() : "",
        required: $("cf-req").value === "true",
      });
      $("cf-label").value = "";
      $("cf-options").value = "";
      await load();
    });
  });
  page.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-action='del']");
    if (!btn) return;
    if (!confirm(I18N.t("del_field_q"))) return;
    UI.guard(async function () {
      await DB.remove("custom_fields", btn.getAttribute("data-id"));
      await load();
    });
  });

  await UI.guard(load);
})();
