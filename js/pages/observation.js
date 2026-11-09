(async function () {
  var page = await UI.init("observation");
  if (!page) return;
  var html = UI.html;

  var points = [];
  var $ = function (id) { return document.getElementById(id); };

  page.innerHTML = html`
    <div class="stack">
      <div class="head-row">
        <div>
          <h2>${I18N.t("obs_title")}</h2>
          <p>${I18N.t("obs_sub")}</p>
        </div>
      </div>
      <form class="card" id="op-form">
        <h3 style="margin-top:0">${I18N.t("obs_new")}</h3>
        <div class="form-grid">
          <div class="field"><label>${I18N.t("category")}</label>
            <select id="op-cat">
              ${UI.enumOptions("obs_cat", "engine")}
            </select>
          </div>
          <div class="field"><label>${I18N.t("point_name")}</label><input id="op-name" required placeholder="${I18N.t("point_ph")}"></div>
          <div class="field"><label>${I18N.t("default_fee")}</label><input id="op-charge" type="number" min="0" step="any" value="0"></div>
          <button>${I18N.t("add")}</button>
        </div>
      </form>
      <input id="q" placeholder="${I18N.t("search_obs")}">
      <div class="table-wrap" id="list"><div class="empty">${I18N.t("loading")}</div></div>
    </div>`;

  function render() {
    var q = ($("q").value || "").trim().toLowerCase();
    var shown = points.filter(function (p) {
      return (I18N.enumLabel("obs_cat", p.category) + " " + p.name).toLowerCase().indexOf(q) !== -1;
    });
    // group by category
    var cats = {};
    shown.forEach(function (p) {
      var ck = I18N.enumCode("obs_cat", p.category) || p.category;  // عربي/تركي قديم + رمز جديد = نفس المجموعة
      if (!cats[ck]) cats[ck] = [];
      cats[ck].push(p);
    });
    var keys = Object.keys(cats).sort(function (a, b) {
      return I18N.enumLabel("obs_cat", a).localeCompare(I18N.enumLabel("obs_cat", b), UI.locale());
    });
    if (!keys.length) {
      $("list").innerHTML = html`<div class="empty">${I18N.t("obs_empty_full")}</div>`;
      return;
    }
    $("list").innerHTML = keys.map(function (cat) {
      return html`<div class="card" style="margin-bottom:12px">
        <h3 style="margin:0 0 10px">${I18N.enumLabel("obs_cat", cat)}</h3>
        <table>
          <thead><tr><th>${I18N.t("insp_point_col")}</th><th>${I18N.t("default_fee_col")}</th><th></th></tr></thead>
          <tbody>
            ${cats[cat].map(function (p) {
              return html`<tr>
                <td>${p.name}</td>
                <td>${Number(p.default_charge) ? UI.money(p.default_charge) : "—"}</td>
                <td><button class="danger small" data-action="del" data-id="${p.id}">${I18N.t("delete")}</button></td>
              </tr>`;
            })}
          </tbody>
        </table>
      </div>`;
    }).join("");
  }

  async function load() {
    points = await DB.list("observation_points");
    render();
  }

  $("q").addEventListener("input", render);
  $("op-form").addEventListener("submit", function (e) {
    e.preventDefault();
    UI.guard(async function () {
      await DB.insert("observation_points", {
        category: $("op-cat").value,
        name: $("op-name").value.trim(),
        default_charge: Number($("op-charge").value) || 0,
      });
      $("op-name").value = "";
      $("op-charge").value = "0";
      await load();
    });
  });
  page.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-action='del']");
    if (!btn) return;
    if (!confirm(I18N.t("del_point_q"))) return;
    UI.guard(async function () {
      await DB.remove("observation_points", btn.getAttribute("data-id"));
      await load();
    });
  });

  await UI.guard(load);
})();
