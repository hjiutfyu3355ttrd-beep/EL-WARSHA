(async function () {
  var page = await UI.init("tax-rates");
  if (!page) return;
  var html = UI.html;
  var rates = [];
  var $ = function (id) { return document.getElementById(id); };

  page.innerHTML = html`
    <div class="stack">
      <div class="head-row">
        <div>
          <h2>${I18N.t("tax_title")}</h2>
          <p>${I18N.t("tax_sub")}</p>
        </div>
      </div>
      <form class="card" id="tr-form">
        <h3 style="margin-top:0">${I18N.t("tax_new")}</h3>
        <div class="form-grid">
          <div class="field"><label>${I18N.t("name")}</label><input id="tr-name" required placeholder="${I18N.t("tax_name_ph")}"></div>
          <div class="field"><label>${I18N.t("tax_rate_pct")}</label><input id="tr-rate" type="number" min="0" max="100" step="any" required></div>
          <div class="field"><label>${I18N.t("tax_default_q")}</label>
            <select id="tr-def"><option value="false">${I18N.t("no")}</option><option value="true">${I18N.t("yes")}</option></select>
          </div>
          <button>${I18N.t("add")}</button>
        </div>
      </form>
      <div class="table-wrap" id="list"><div class="empty">${I18N.t("loading")}</div></div>
    </div>`;

  function render() {
    $("list").innerHTML = html`
      <table>
        <thead><tr><th>${I18N.t("name")}</th><th>${I18N.t("ratio_col")}</th><th>${I18N.t("default_col")}</th><th></th></tr></thead>
        <tbody>
          ${rates.length === 0
            ? html`<tr><td colspan="4" class="empty">${I18N.t("empty_rates")}</td></tr>`
            : rates.map(function (r) {
                return html`<tr>
                  <td><b>${r.name}</b></td>
                  <td>${r.rate}%</td>
                  <td>${r.is_default ? html`<span class="badge paid">${I18N.t("yes")}</span>` : "—"}</td>
                  <td class="row">
                    ${!r.is_default ? html`<button class="small secondary" data-action="def" data-id="${r.id}">${I18N.t("make_default")}</button>` : ""}
                    <button class="danger small" data-action="del" data-id="${r.id}">${I18N.t("delete")}</button>
                  </td>
                </tr>`;
              })}
        </tbody>
      </table>`;
  }

  async function load() {
    rates = await DB.list("tax_rates");
    render();
  }

  $("tr-form").addEventListener("submit", function (e) {
    e.preventDefault();
    UI.guard(async function () {
      var isDef = $("tr-def").value === "true";
      if (isDef) {
        for (var i = 0; i < rates.length; i++) {
          if (rates[i].is_default) await DB.update("tax_rates", rates[i].id, { is_default: false });
        }
      }
      await DB.insert("tax_rates", {
        name: $("tr-name").value.trim(),
        rate: Number($("tr-rate").value) || 0,
        is_default: isDef,
      });
      $("tr-form").reset();
      await load();
    });
  });
  page.addEventListener("click", function (e) {
    var def = e.target.closest("[data-action='def']");
    if (def) {
      UI.guard(async function () {
        for (var i = 0; i < rates.length; i++) {
          await DB.update("tax_rates", rates[i].id, { is_default: rates[i].id === def.getAttribute("data-id") });
        }
        await load();
      });
      return;
    }
    var del = e.target.closest("[data-action='del']");
    if (del) {
      if (!confirm(I18N.t("del_rate_q"))) return;
      UI.guard(async function () {
        await DB.remove("tax_rates", del.getAttribute("data-id"));
        await load();
      });
    }
  });

  await UI.guard(load);
})();
