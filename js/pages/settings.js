(async function () {
  var page = await UI.init("settings");
  if (!page) return;
  var html = UI.html;
  var t = UI.t;

  var techs = [];

  page.innerHTML = html`
    <div class="stack">
      <h2 class="page-title" style="margin:0">${t("settings_title")}</h2>

      <div class="card stack">
        <h3 style="margin:0">${t("settings_lang")}</h3>
        <p style="margin:0;color:var(--muted)">${t("settings_lang_hint")}</p>
        <div class="field" style="max-width:280px">
          <label>${t("language")}</label>
          <select id="settings-lang">
            <option value="ar" ${I18N.getLang() === "ar" ? "selected" : ""}>${t("arabic")}</option>
            <option value="tr" ${I18N.getLang() === "tr" ? "selected" : ""}>${t("turkish")}</option>
          </select>
        </div>
      </div>

      <div class="card stack">
        <h3 style="margin:0">${t("settings_techs")}</h3>
        <div class="table-wrap" id="list"><div class="empty">${t("loading")}</div></div>
        <form id="tech-form">
          <div class="form-grid">
            <div class="field"><label>${t("settings_tech_name")}</label><input id="t-name" required></div>
            <div class="field"><label>${t("settings_tech_pct")}</label><input id="t-pct" type="number" min="0" max="100" step="any" value="0"></div>
            <button>${t("settings_tech_add")}</button>
          </div>
        </form>
      </div>

      <div class="card">
        <h3 style="margin-top:0">${t("settings_coming")}</h3>
        <p style="margin-bottom:0">${t("settings_coming_text")}</p>
      </div>
    </div>`;

  var $ = function (id) { return document.getElementById(id); };

  var langSel = document.getElementById("settings-lang");
  if (langSel) {
    langSel.addEventListener("change", function () {
      var lang = langSel.value;
      if (lang === I18N.getLang()) return;
      I18N.setLang(lang);
      location.reload();
    });
  }

  function render() {
    $("list").innerHTML = html`
      <table>
        <thead><tr><th>${t("customers_name")}</th><th>${t("settings_tech_pct")}</th><th></th></tr></thead>
        <tbody>
          ${techs.length === 0
            ? html`<tr><td colspan="3" class="empty">${t("settings_techs_empty")}</td></tr>`
            : techs.map(function (tech) {
                return html`<tr>
                  <td>${tech.name}</td><td>${tech.commission_pct}%</td>
                  <td><button class="danger small" data-id="${tech.id}">${t("delete")}</button></td>
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

  await UI.guard(load);
})();
