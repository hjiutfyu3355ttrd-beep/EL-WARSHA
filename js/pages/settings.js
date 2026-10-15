(async function () {
  var page = await UI.init("settings");
  if (!page) return;
  var html = UI.html;

  var techs = [];

  page.innerHTML = html`
    <div class="stack">
      <h2 class="page-title" style="margin:0">الإعدادات</h2>

      <div class="card stack">
        <h3 style="margin:0">الفنيين</h3>
        <div class="table-wrap" id="list"><div class="empty">جارٍ التحميل…</div></div>
        <form id="tech-form">
          <div class="form-grid">
            <div class="field"><label>اسم الفني</label><input id="t-name" required></div>
            <div class="field"><label>نسبة العمولة %</label><input id="t-pct" type="number" min="0" max="100" step="any" value="0"></div>
            <button>إضافة فني</button>
          </div>
        </form>
      </div>

      <div class="card">
        <h3 style="margin-top:0">قريباً</h3>
        <p style="margin-bottom:0">بيانات الورشة والشعار، وإدارة الموظفين وصلاحياتهم (مالك / موظف / فني)، وتصميم الفاتورة.</p>
      </div>
    </div>`;

  var $ = function (id) { return document.getElementById(id); };

  function render() {
    $("list").innerHTML = html`
      <table>
        <thead><tr><th>الاسم</th><th>نسبة العمولة %</th><th></th></tr></thead>
        <tbody>
          ${techs.length === 0
            ? html`<tr><td colspan="3" class="empty">مفيش فنيين</td></tr>`
            : techs.map(function (t) {
                return html`<tr>
                  <td>${t.name}</td><td>${t.commission_pct}%</td>
                  <td><button class="danger small" data-id="${t.id}">حذف</button></td>
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
