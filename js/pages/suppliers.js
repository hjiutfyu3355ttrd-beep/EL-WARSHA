(async function () {
  var page = await UI.init("suppliers");
  if (!page) return;
  var html = UI.html;

  var suppliers = [];
  var $ = function (id) { return document.getElementById(id); };

  page.innerHTML = html`
    <div class="stack">
      <div class="head-row">
        <div>
          <h2>الموردين</h2>
          <p>إدارة موردي قطع الغيار والمواد.</p>
        </div>
      </div>
      <form class="card" id="sup-form">
        <h3 style="margin-top:0">مورد جديد</h3>
        <div class="form-grid">
          <div class="field"><label>الاسم</label><input id="s-name" required></div>
          <div class="field"><label>الشركة</label><input id="s-company"></div>
          <div class="field"><label>الموبايل</label><input id="s-phone" dir="ltr"></div>
          <div class="field"><label>ملاحظات</label><input id="s-notes"></div>
          <button>إضافة</button>
        </div>
      </form>
      <input id="q" placeholder="بحث بالاسم أو الشركة أو الموبايل">
      <div class="table-wrap" id="list"><div class="empty">جارٍ التحميل…</div></div>
    </div>`;

  function render() {
    var q = ($("q").value || "").trim().toLowerCase();
    var shown = suppliers.filter(function (s) {
      return (s.name + " " + (s.company || "") + " " + (s.phone || "")).toLowerCase().indexOf(q) !== -1;
    });
    $("list").innerHTML = html`
      <table>
        <thead><tr><th>الاسم</th><th>الشركة</th><th>الموبايل</th><th>ملاحظات</th><th></th></tr></thead>
        <tbody>
          ${shown.length === 0
            ? html`<tr><td colspan="5" class="empty">مفيش موردين</td></tr>`
            : shown.map(function (s) {
                return html`<tr>
                  <td><b>${s.name}</b></td>
                  <td>${s.company || "—"}</td>
                  <td dir="ltr" style="text-align:right">${s.phone || "—"}</td>
                  <td>${s.notes || "—"}</td>
                  <td><button class="danger small" data-action="del" data-id="${s.id}">حذف</button></td>
                </tr>`;
              })}
        </tbody>
      </table>`;
  }

  async function load() {
    suppliers = await DB.list("suppliers");
    render();
  }

  $("q").addEventListener("input", render);
  $("sup-form").addEventListener("submit", function (e) {
    e.preventDefault();
    UI.guard(async function () {
      await DB.insert("suppliers", {
        name: $("s-name").value.trim(),
        company: $("s-company").value.trim(),
        phone: $("s-phone").value.trim(),
        notes: $("s-notes").value.trim(),
      });
      $("sup-form").reset();
      await load();
    });
  });
  page.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-action='del']");
    if (!btn) return;
    if (!confirm("حذف المورد؟")) return;
    UI.guard(async function () {
      await DB.remove("suppliers", btn.getAttribute("data-id"));
      await load();
    });
  });

  await UI.guard(load);
})();
