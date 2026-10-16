(async function () {
  var page = await UI.init("setup");
  if (!page) return;
  var html = UI.html;

  var $ = function (id) { return document.getElementById(id); };

  page.innerHTML = html`
    <div class="stack">
      <div class="head-row">
        <div>
          <h2>معالج الإعداد</h2>
          <p>خطوات تجهيز الورشة — علّم اللي خلصته.</p>
        </div>
      </div>
      <div class="card" id="profile-card">
        <h3 style="margin-top:0">1) بيانات الورشة</h3>
        <form id="prof-form" class="form-grid">
          <div class="field"><label>اسم الورشة</label><input id="p-name" required></div>
          <div class="field"><label>التليفون</label><input id="p-phone" dir="ltr"></div>
          <div class="field"><label>العنوان</label><input id="p-address"></div>
          <div class="field"><label>ساعات العمل</label><input id="p-hours" placeholder="السبت–الخميس 9ص–6م"></div>
          <button>حفظ البيانات</button>
        </form>
      </div>
      <div class="card" id="checklist"></div>
      <div class="card">
        <h3 style="margin-top:0">روابط سريعة</h3>
        <div class="row" style="flex-wrap:wrap;gap:8px">
          <a class="btn secondary" href="settings.html">الفنيين</a>
          <a class="btn secondary" href="customers.html">العملاء</a>
          <a class="btn secondary" href="inventory.html">المخزون</a>
          <a class="btn secondary" href="observation.html">مكتبة الفحص</a>
          <a class="btn secondary" href="suppliers.html">الموردين</a>
          <a class="btn secondary" href="work-order-new.html">استقبال سيارة</a>
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
      { ok: !!(profile.name), label: "بيانات الورشة", href: null },
      { ok: data[1].length > 0, label: "إضافة فني واحد على الأقل", href: "settings.html" },
      { ok: data[2].length > 0, label: "إضافة عميل", href: "customers.html" },
      { ok: data[3].length > 0, label: "إضافة قطع غيار للمخزون", href: "inventory.html" },
      { ok: data[4].length > 0, label: "نقاط فحص في المكتبة", href: "observation.html" },
      { ok: data[5].length > 0, label: "مورد واحد على الأقل", href: "suppliers.html" },
      { ok: data[6].length > 0, label: "أول أمر شغل", href: "work-order-new.html" },
    ];
    var done = steps.filter(function (s) { return s.ok; }).length;
    $("checklist").innerHTML = html`
      <h3 style="margin-top:0">2) قائمة التجهيز (${done}/${steps.length})</h3>
      <div class="bar" style="margin-bottom:14px"><i style="width:${Math.round((done / steps.length) * 100)}%;background:var(--success)"></i></div>
      ${steps.map(function (s, i) {
        return html`<div class="recent">
          <div>
            <b style="color:${s.ok ? "var(--success)" : "var(--text)"}">${s.ok ? "✓" : (i + 1) + "."} ${s.label}</b>
          </div>
          ${s.ok ? html`<span class="badge ready">تم</span>` : s.href ? html`<a class="btn small" href="${s.href}">ابدأ</a>` : ""}
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
      UI.flash("تم حفظ بيانات الورشة", "success");
      await load();
    });
  });

  await UI.guard(load);
})();
