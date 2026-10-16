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
          <h2>مكتبة الفحص</h2>
          <p>نقاط فحص جاهزة (محرك، فرامل، إطارات...) تستخدم أثناء أمر الشغل.</p>
        </div>
      </div>
      <form class="card" id="op-form">
        <h3 style="margin-top:0">نقطة فحص جديدة</h3>
        <div class="form-grid">
          <div class="field"><label>التصنيف</label>
            <select id="op-cat">
              <option>المحرك</option>
              <option>الفرامل</option>
              <option>الإطارات</option>
              <option>الكهرباء</option>
              <option>الهيكل</option>
              <option>التكييف</option>
              <option>أخرى</option>
            </select>
          </div>
          <div class="field"><label>اسم النقطة</label><input id="op-name" required placeholder="مثال: مستوى الزيت"></div>
          <div class="field"><label>رسوم افتراضية (ج.م)</label><input id="op-charge" type="number" min="0" step="any" value="0"></div>
          <button>إضافة</button>
        </div>
      </form>
      <input id="q" placeholder="بحث بالاسم أو التصنيف">
      <div class="table-wrap" id="list"><div class="empty">جارٍ التحميل…</div></div>
    </div>`;

  function render() {
    var q = ($("q").value || "").trim().toLowerCase();
    var shown = points.filter(function (p) {
      return (p.category + " " + p.name).toLowerCase().indexOf(q) !== -1;
    });
    // group by category
    var cats = {};
    shown.forEach(function (p) {
      if (!cats[p.category]) cats[p.category] = [];
      cats[p.category].push(p);
    });
    var keys = Object.keys(cats).sort();
    if (!keys.length) {
      $("list").innerHTML = html`<div class="empty">مفيش نقاط فحص</div>`;
      return;
    }
    $("list").innerHTML = keys.map(function (cat) {
      return html`<div class="card" style="margin-bottom:12px">
        <h3 style="margin:0 0 10px">${cat}</h3>
        <table>
          <thead><tr><th>نقطة الفحص</th><th>الرسوم الافتراضية</th><th></th></tr></thead>
          <tbody>
            ${cats[cat].map(function (p) {
              return html`<tr>
                <td>${p.name}</td>
                <td>${Number(p.default_charge) ? UI.money(p.default_charge) : "—"}</td>
                <td><button class="danger small" data-action="del" data-id="${p.id}">حذف</button></td>
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
    if (!confirm("حذف نقطة الفحص؟")) return;
    UI.guard(async function () {
      await DB.remove("observation_points", btn.getAttribute("data-id"));
      await load();
    });
  });

  await UI.guard(load);
})();
