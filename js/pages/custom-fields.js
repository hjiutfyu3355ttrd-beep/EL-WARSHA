(async function () {
  var page = await UI.init("custom-fields");
  if (!page) return;
  var html = UI.html;

  var fields = [];
  var $ = function (id) { return document.getElementById(id); };

  var MODULES = [
    { key: "customer", label: "العملاء" },
    { key: "vehicle", label: "المركبات" },
    { key: "employee", label: "الموظفين" },
    { key: "supplier", label: "الموردين" },
  ];
  var TYPES = [
    { key: "text", label: "نص" },
    { key: "number", label: "رقم" },
    { key: "select", label: "قائمة اختيار" },
    { key: "date", label: "تاريخ" },
  ];

  page.innerHTML = html`
    <div class="stack">
      <div class="head-row">
        <div>
          <h2>حقول مخصصة</h2>
          <p>أضف حقول إضافية لنماذج العملاء والمركبات والموردين.</p>
        </div>
      </div>
      <form class="card" id="cf-form">
        <h3 style="margin-top:0">حقل جديد</h3>
        <div class="form-grid">
          <div class="field"><label>الوحدة</label>
            <select id="cf-module">${MODULES.map(function (m) { return UI.option(m.key, m.label); })}</select>
          </div>
          <div class="field"><label>اسم الحقل</label><input id="cf-label" required placeholder="مثال: الرقم الضريبي"></div>
          <div class="field"><label>النوع</label>
            <select id="cf-type">${TYPES.map(function (t) { return UI.option(t.key, t.label); })}</select>
          </div>
          <div class="field" id="opts-wrap" style="display:none"><label>خيارات القائمة (مفصولة بفاصلة)</label>
            <input id="cf-options" placeholder="فيسبوك,جوجل,ترشيح">
          </div>
          <div class="field"><label>إلزامي؟</label>
            <select id="cf-req"><option value="false">لا</option><option value="true">نعم</option></select>
          </div>
          <button>إضافة</button>
        </div>
      </form>
      <div id="list"><div class="empty">جارٍ التحميل…</div></div>
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
          ? html`<div class="empty" style="padding:12px">مفيش حقول</div>`
          : html`<table>
              <thead><tr><th>الاسم</th><th>النوع</th><th>إلزامي</th><th>خيارات</th><th></th></tr></thead>
              <tbody>
                ${list.map(function (f) {
                  var tl = TYPES.filter(function (x) { return x.key === f.field_type; })[0];
                  return html`<tr>
                    <td><b>${f.label}</b></td>
                    <td>${tl ? tl.label : f.field_type}</td>
                    <td>${f.required ? "نعم" : "لا"}</td>
                    <td>${f.options || "—"}</td>
                    <td><button class="danger small" data-action="del" data-id="${f.id}">حذف</button></td>
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
    if (!confirm("حذف الحقل؟")) return;
    UI.guard(async function () {
      await DB.remove("custom_fields", btn.getAttribute("data-id"));
      await load();
    });
  });

  await UI.guard(load);
})();
