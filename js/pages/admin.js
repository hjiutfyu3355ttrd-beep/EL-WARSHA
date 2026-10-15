(async function () {
  // adminOnly: لو المستخدم مش أدمن بيتحوّل للرئيسية. (الحماية الحقيقية في الداتابيز مش هنا.)
  var page = await UI.init("admin", { adminOnly: true });
  if (!page) return;
  var html = UI.html;

  var shops = [];
  var STATUS_LABEL = { trial: "تجربة", active: "مفعّل", suspended: "موقوف" };

  page.innerHTML = html`
    <div class="stack">
      <h2 class="page-title" style="margin:0">🛡️ لوحة الإدارة</h2>
      <div class="notice">
        الصفحة دي بتعرض بيانات الحسابات فقط (الورشة، الإيميل، الحالة) — مش بيانات شغل العملاء.
        الصلاحية بتتأكد منها قاعدة البيانات مش الواجهة.
      </div>
      <div class="grid" id="stats"></div>
      <input id="q" placeholder="بحث باسم الورشة أو الإيميل">
      <div class="table-wrap" id="list"><div class="empty">جارٍ التحميل…</div></div>
    </div>`;

  var $ = function (id) { return document.getElementById(id); };

  function render() {
    var weekAgo = Date.now() - 7 * 86400000;
    var today = new Date().toDateString();
    function count(fn) { return shops.filter(fn).length; }

    var stats = [
      { label: "إجمالي الورش", value: shops.length },
      { label: "مسجّلين اليوم", value: count(function (s) { return new Date(s.created_at).toDateString() === today; }) },
      { label: "مسجّلين آخر 7 أيام", value: count(function (s) { return new Date(s.created_at).getTime() >= weekAgo; }) },
      { label: "مفعّلين", value: count(function (s) { return s.status === "active"; }) },
      { label: "تجربة", value: count(function (s) { return s.status === "trial"; }) },
      { label: "موقوفين", value: count(function (s) { return s.status === "suspended"; }) },
    ];
    $("stats").innerHTML = html`${stats.map(function (s) {
      return html`<div class="card"><div class="label">${s.label}</div><div class="value">${s.value}</div></div>`;
    })}`;

    var q = $("q").value.trim().toLowerCase();
    var shown = shops.filter(function (s) { return (s.name + " " + s.owner_email).toLowerCase().indexOf(q) !== -1; });

    $("list").innerHTML = html`
      <table>
        <thead><tr><th>الورشة</th><th>الإيميل</th><th>التسجيل</th><th>الحالة</th><th>نهاية التجربة</th><th></th></tr></thead>
        <tbody>
          ${shown.length === 0
            ? html`<tr><td colspan="6" class="empty">مفيش حسابات</td></tr>`
            : shown.map(function (s) {
                return html`<tr>
                  <td>${s.name}</td>
                  <td dir="ltr" style="text-align:right">${s.owner_email}</td>
                  <td>${UI.dateAr(s.created_at)}</td>
                  <td><span class="badge ${s.status}">${STATUS_LABEL[s.status] || s.status}</span></td>
                  <td>${s.trial_ends_at ? UI.dateAr(s.trial_ends_at) : "—"}</td>
                  <td><div class="row">
                    ${s.status !== "active" ? html`<button class="small" data-action="activate" data-id="${s.id}">تفعيل</button>` : ""}
                    ${s.status !== "suspended" ? html`<button class="danger small" data-action="suspend" data-id="${s.id}">إيقاف</button>` : ""}
                    <button class="secondary small" data-action="extend" data-id="${s.id}">تجربة +7 أيام</button>
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
