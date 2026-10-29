(async function () {
  var page = await UI.init("settings");
  if (!page) return;
  var html = UI.html;

  var techs = [];

  page.innerHTML = html`
    <div class="stack">
      <h2 class="page-title" style="margin:0">${I18N.t("t_settings")}</h2>

      <div class="card stack">
        <h3 style="margin:0">${I18N.t("settings_lang")}</h3>
        <p style="margin:0;color:var(--muted)">${I18N.t("settings_lang_hint")}</p>
        <div class="field" style="max-width:280px">
          <label>${I18N.t("language")}</label>
          <select id="settings-lang">
            <option value="ar" ${I18N.getLang() === "ar" ? "selected" : ""}>${I18N.t("arabic")}</option>
            <option value="tr" ${I18N.getLang() === "tr" ? "selected" : ""}>${I18N.t("turkish")}</option>
          </select>
        </div>
      </div>

      <div class="card stack">
        <h3 style="margin:0">${I18N.t("technicians")}</h3>
        <div class="table-wrap" id="list"><div class="empty">${I18N.t("loading")}</div></div>
        <form id="tech-form">
          <div class="form-grid">
            <div class="field"><label>${I18N.t("tech_name")}</label><input id="t-name" required></div>
            <div class="field"><label>${I18N.t("tech_commission")}</label><input id="t-pct" type="number" min="0" max="100" step="any" value="0"></div>
            <button>${I18N.t("add_tech")}</button>
          </div>
        </form>
      </div>

      <div class="card">
        <h3 style="margin-top:0">${I18N.t("coming_soon")}</h3>
        <p style="margin-bottom:0">${I18N.t("settings_soon")}</p>
      </div>
    </div>`;

  var $ = function (id) { return document.getElementById(id); };

  function render() {
    $("list").innerHTML = html`
      <table>
        <thead><tr><th>الاسم</th><th>${I18N.t("commission_pct")}</th><th></th></tr></thead>
        <tbody>
          ${techs.length === 0
            ? html`<tr><td colspan="3" class="empty">${I18N.t("empty_techs")}</td></tr>`
            : techs.map(function (t) {
                return html`<tr>
                  <td>${t.name}</td><td>${t.commission_pct}%</td>
                  <td><button class="danger small" data-id="${t.id}">${I18N.t("delete")}</button></td>
                </tr>`;
              })}
        </tbody>
      </table>`;
  }

  async function load() {
    techs = await DB.list("technicians");
    render();
  }

  $("tech-form").addEventListener("submit", function (e) {
    e.preventDefault();
    UI.guard(async function () {
      await DB.insert("technicians", { name: $("t-name").value.trim(), commission_pct: Number($("t-pct").value) });
      $("tech-form").reset();
      await load();
    });
  });

  $("list").addEventListener("click", function (e) {
    var btn = e.target.closest("button[data-id]");
    if (!btn) return;
    UI.guard(async function () {
      await DB.remove("technicians", btn.getAttribute("data-id"));
      await load();
    });
  });

  var langSel = document.getElementById("settings-lang");
  if (langSel) {
    langSel.addEventListener("change", function () {
      if (langSel.value === I18N.getLang()) return;
      I18N.setLang(langSel.value);
      location.reload();
    });
  }

  await UI.guard(load);
})();
