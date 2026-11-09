(async function () {
  var page = await UI.init("settings");
  if (!page) return;
  var html = UI.html;

  var techs = [];
  var cur = UI.getCurrency();

  // اسم العملة بلغة الواجهة (من المتصفح) + الكود
  function currencyName(code) {
    var n = "";
    try { n = new Intl.DisplayNames([UI.locale()], { type: "currency" }).of(code) || ""; } catch (e) {}
    return n ? code + " — " + n : code;
  }

  page.innerHTML = html`
    <div class="stack">
      <h2 class="page-title" style="margin:0">${I18N.t("t_settings")}</h2>

      <div class="card stack">
        <h3 style="margin:0">${I18N.t("settings_lang")}</h3>
        <p style="margin:0;color:var(--muted)">${I18N.t("settings_lang_hint")}</p>
        <div class="field" style="max-width:280px">
          <label>${I18N.t("language")}</label>
          <select id="settings-lang">
            <option value="ar" ${I18N.getLang() === "ar" ? "selected" : ""}>${I18N.t("lang_native_ar")}</option>
            <option value="tr" ${I18N.getLang() === "tr" ? "selected" : ""}>${I18N.t("lang_native_tr")}</option>
          </select>
        </div>
      </div>

      <div class="card stack">
        <h3 style="margin:0">${I18N.t("cur_title")}</h3>
        <p style="margin:0;color:var(--muted)">${I18N.t("cur_hint")}</p>
        <div class="form-grid">
          <div class="field">
            <label for="cur-code">${I18N.t("cur_select")}</label>
            <select id="cur-code">
              ${UI.CURRENCIES.map(function (c) { return UI.option(c.code, currencyName(c.code), c.code === cur.code); })}
              ${UI.option("OTHER", I18N.t("cur_other"), cur.code === "OTHER")}
            </select>
          </div>
          <div class="field">
            <label for="cur-sym">${I18N.t("cur_symbol")}</label>
            <input id="cur-sym" maxlength="12" value="${cur.symbol}">
            <small style="color:var(--muted)">${I18N.t("cur_symbol_hint")}</small>
          </div>
          <button type="button" id="cur-save">${I18N.t("cur_save")}</button>
        </div>
        <div><span style="color:var(--muted)">${I18N.t("cur_preview")}:</span> <b id="cur-preview"></b></div>
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
        <thead><tr><th>${I18N.t("name")}</th><th>${I18N.t("commission_pct")}</th><th></th></tr></thead>
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

  // ---- العملة ----
  function chosenSymbol() {
    var code = $("cur-code").value, typed = $("cur-sym").value.trim();
    return typed || (code === "OTHER" ? "" : UI.currencyDefaultSymbol(code));
  }
  function updateCurPreview() {
    var code = $("cur-code").value;
    $("cur-sym").placeholder = code === "OTHER" ? "" : UI.currencyDefaultSymbol(code);
    $("cur-preview").textContent = new Intl.NumberFormat(UI.locale(), { maximumFractionDigits: 2 }).format(1234.5) + " " + chosenSymbol();
  }
  $("cur-code").addEventListener("change", updateCurPreview);
  $("cur-sym").addEventListener("input", updateCurPreview);
  updateCurPreview();
  $("cur-save").addEventListener("click", function () {
    UI.guard(async function () {
      var code = $("cur-code").value, typed = $("cur-sym").value.trim();
      if (code === "OTHER" && !typed) { UI.flash(I18N.t("cur_symbol_required"), "error"); return; }
      // الرمز المخصص بيتخزّن بس لو مختلف عن الافتراضي (فيتبع اللغة تلقائياً)
      var symbol = typed && typed !== UI.currencyDefaultSymbol(code) ? typed : null;
      var payload = { currency: code, currency_symbol: symbol };
      var rows = await DB.list("shop_profile");
      if (rows.length) await DB.update("shop_profile", rows[0].id, payload);
      else await DB.insert("shop_profile", payload);
      UI.setCurrency(code, symbol || "");
      updateCurPreview();
      UI.flash(I18N.t("cur_saved"), "success");
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
