(async function () {
  var page = await UI.init("admin", { adminOnly: true });
  if (!page) return;
  var html = UI.html;
  var t = UI.t;

  var shops = [];
  function statusLabel(s) {
    if (s === "active") return t("admin_active");
    if (s === "suspended") return t("admin_suspended");
    if (s === "trial") return I18N.getLang() === "tr" ? "Deneme" : "تجربة";
    return s;
  }

  page.innerHTML = html`
    <div class="stack">
      <h2 class="page-title" style="margin:0">🛡️ ${t("admin_title")}</h2>
      <div class="grid" id="stats"></div>
      <input id="q" placeholder="${t("search")}">
      <div class="table-wrap" id="list"><div class="empty">${t("loading")}</div></div>
    </div>`;

  var $ = function (id) { return document.getElementById(id); };

  function render() {
    var weekAgo = Date.now() - 7 * 86400000;
    var today = new Date().toDateString();
    function count(fn) { return shops.filter(fn).length; }

    var stats = [
      { label: t("admin_shops"), value: shops.length },
      { label: t("admin_active"), value: count(function (s) { return s.status === "active"; }) },
      { label: t("admin_suspended"), value: count(function (s) { return s.status === "suspended"; }) },
    ];
    $("stats").innerHTML = html`${stats.map(function (s) {
      return html`<div class="card"><div class="label">${s.label}</div><div class="value">${s.value}</div></div>`;
    })}`;

    var q = $("q").value.trim().toLowerCase();
    var shown = shops.filter(function (s) { return (s.name + " " + (s.owner_email || "")).toLowerCase().indexOf(q) !== -1; });

    $("list").innerHTML = html`
      <table>
        <thead><tr><th>${t("admin_shop_name")}</th><th>${t("login_email")}</th><th>${t("col_date")}</th><th>${t("admin_status")}</th><th>${t("admin_expires")}</th><th></th></tr></thead>
        <tbody>
          ${shown.length === 0
            ? html`<tr><td colspan="6" class="empty">${t("admin_empty")}</td></tr>`
            : shown.map(function (s) {
                return html`<tr>
                  <td>${s.name}</td>
                  <td dir="ltr">${s.owner_email}</td>
                  <td>${UI.dateAr(s.created_at)}</td>
                  <td><span class="badge ${s.status}">${statusLabel(s.status)}</span></td>
                  <td>${s.trial_ends_at ? UI.dateAr(s.trial_ends_at) : t("none")}</td>
                  <td><div class="row">
                    ${s.status !== "active" ? html`<button class="small" data-action="activate" data-id="${s.id}">${t("admin_activate")}</button>` : ""}
                    ${s.status !== "suspended" ? html`<button class="danger small" data-action="suspend" data-id="${s.id}">${t("admin_suspend")}</button>` : ""}
                    <button class="secondary small" data-action="extend" data-id="${s.id}">${t("admin_extend")}</button>
                  </div></td>
                </tr>`;
              })}
        </tbody>
      </table>`;
  }

  async function load() {
    shops = await DB.adminListShops();
    render();
  }

  $("q").addEventListener("input", render);

  $("list").addEventListener("click", function (e) {
    var el = e.target.closest("[data-action]");
    if (!el) return;
    var shop = shops.filter(function (s) { return s.id === el.getAttribute("data-id"); })[0];
    if (!shop) return;
    var action = el.getAttribute("data-action");

    UI.guard(async function () {
      if (action === "activate") await DB.adminUpdateShop(shop.id, "active", null);
      if (action === "suspend") await DB.adminUpdateShop(shop.id, "suspended", null);
      if (action === "extend") {
        var base = shop.trial_ends_at && new Date(shop.trial_ends_at) > new Date() ? new Date(shop.trial_ends_at) : new Date();
        base.setDate(base.getDate() + 7);
        await DB.adminUpdateShop(shop.id, "trial", base.toISOString());
      }
      await load();
    });
  });

  await UI.guard(load);
})();
