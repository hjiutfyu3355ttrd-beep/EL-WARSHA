(async function () {
  // adminOnly: لو المستخدم مش أدمن بيتحوّل للرئيسية. (الحماية الحقيقية في الداتابيز مش هنا.)
  var page = await UI.init("admin", { adminOnly: true });
  if (!page) return;
  var html = UI.html;

  var shops = [];
  var STATUS_LABEL = { trial: I18N.t("st_trial"), active: I18N.t("st_active"), suspended: I18N.t("st_suspended") };

  page.innerHTML = html`
    <div class="stack">
      <h2 class="page-title" style="margin:0">🛡️ لوحة ${I18N.t("admin_title")}</h2>
      <div class="notice">
        ${I18N.t("admin_hint")}
        ${I18N.t("admin_hint2")}
      </div>
      <div class="grid" id="stats"></div>
      <input id="q" placeholder="${I18N.t("search_shop")}">
      <div class="table-wrap" id="list"><div class="empty">${I18N.t("loading")}</div></div>
    </div>`;

  var $ = function (id) { return document.getElementById(id); };

  function render() {
    var weekAgo = Date.now() - 7 * 86400000;
    var today = new Date().toDateString();
    function count(fn) { return shops.filter(fn).length; }

    var stats = [
      { label: I18N.t("total_shops"), value: shops.length },
      { label: I18N.t("reg_today"), value: count(function (s) { return new Date(s.created_at).toDateString() === today; }) },
      { label: I18N.t("reg_week"), value: count(function (s) { return new Date(s.created_at).getTime() >= weekAgo; }) },
      { label: I18N.t("actives"), value: count(function (s) { return s.status === "active"; }) },
      { label: I18N.t("trials"), value: count(function (s) { return s.status === "trial"; }) },
      { label: I18N.t("suspendeds"), value: count(function (s) { return s.status === "suspended"; }) },
    ];
    $("stats").innerHTML = html`${stats.map(function (s) {
      return html`<div class="card"><div class="label">${s.label}</div><div class="value">${s.value}</div></div>`;
    })}`;

    var q = $("q").value.trim().toLowerCase();
    var shown = shops.filter(function (s) { return (s.name + " " + DB.auth.emailToPhone(s.owner_email)).toLowerCase().indexOf(q) !== -1; });

    $("list").innerHTML = html`
      <table>
        <thead><tr><th>${I18N.t("shop")}</th><th>${I18N.t("shop_phone")}</th><th>${I18N.t("reg_date")}</th><th>${I18N.t("status_filter")}</th><th>${I18N.t("trial_end")}</th><th></th></tr></thead>
        <tbody>
          ${shown.length === 0
            ? html`<tr><td colspan="6" class="empty">${I18N.t("empty_shops")}</td></tr>`
            : shown.map(function (s) {
                return html`<tr>
                  <td>${s.name}</td>
                  <td dir="ltr" style="text-align:right">${DB.auth.emailToPhone(s.owner_email)}</td>
                  <td>${UI.dateAr(s.created_at)}</td>
                  <td><span class="badge ${s.status}">${STATUS_LABEL[s.status] || s.status}</span></td>
                  <td>${s.trial_ends_at ? UI.dateAr(s.trial_ends_at) : "—"}</td>
                  <td><div class="row">
                    ${s.status !== "active" ? html`<button class="small" data-action="activate" data-id="${s.id}">${I18N.t("activate")}</button>` : ""}
                    ${s.status !== "suspended" ? html`<button class="danger small" data-action="suspend" data-id="${s.id}">${I18N.t("suspend")}</button>` : ""}
                    <button class="secondary small" data-action="extend" data-id="${s.id}">${I18N.t("extend_trial")}</button>
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
