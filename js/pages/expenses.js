(async function () {
  var page = await UI.init("expenses");
  if (!page) return;
  var html = UI.html;

  var expenses = [];
  var $ = function (id) { return document.getElementById(id); };

  page.innerHTML = html`
    <div class="stack">
      <div class="head-row">
        <div>
          <h2>المصروفات</h2>
          <p>تسجيل مصروفات الورشة وتقارير حسب الفترة.</p>
        </div>
      </div>
      <form class="card" id="ex-form">
        <h3 style="margin-top:0">مصروف جديد</h3>
        <div class="form-grid">
          <div class="field"><label>البيان</label><input id="e-label" required placeholder="مثال: إيجار / كهرباء"></div>
          <div class="field"><label>المبلغ (ج.م)</label><input id="e-amount" type="number" min="0" step="any" required></div>
          <div class="field"><label>ملاحظات</label><input id="e-notes"></div>
          <button>إضافة</button>
        </div>
      </form>
      <div class="card" id="summary"></div>
      <input id="q" placeholder="بحث بالبيان">
      <div class="table-wrap" id="list"><div class="empty">جارٍ التحميل…</div></div>
    </div>`;

  function render() {
    var q = ($("q").value || "").trim().toLowerCase();
    var shown = expenses.filter(function (e) {
      return (e.label + " " + (e.notes || "")).toLowerCase().indexOf(q) !== -1;
    });
    var total = expenses.reduce(function (s, e) { return s + (Number(e.amount) || 0); }, 0);
    var monthTotal = expenses.filter(function (e) {
      var d = new Date(e.created_at);
      var now = new Date();
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).reduce(function (s, e) { return s + (Number(e.amount) || 0); }, 0);

    $("summary").innerHTML = html`
      <div class="grid">
        <div class="card stat" style="--accent:var(--error)">
          <div class="label">إجمالي المصروفات</div>
          <div class="value">${UI.money(total)}</div>
        </div>
        <div class="card stat" style="--accent:var(--warning)">
          <div class="label">مصروفات هذا الشهر</div>
          <div class="value">${UI.money(monthTotal)}</div>
        </div>
        <div class="card stat" style="--accent:var(--info)">
          <div class="label">عدد القيود</div>
          <div class="value">${expenses.length}</div>
        </div>
      </div>`;

    $("list").innerHTML = html`
      <table>
        <thead><tr><th>البيان</th><th>المبلغ</th><th>ملاحظات</th><th>التاريخ</th><th></th></tr></thead>
        <tbody>
          ${shown.length === 0
            ? html`<tr><td colspan="5" class="empty">مفيش مصروفات</td></tr>`
            : shown.map(function (e) {
                return html`<tr>
                  <td><b>${e.label}</b></td>
                  <td>${UI.money(e.amount)}</td>
                  <td>${e.notes || "—"}</td>
                  <td>${UI.dateAr(e.created_at)}</td>
                  <td><button class="danger small" data-action="del" data-id="${e.id}">حذف</button></td>
                </tr>`;
              })}
        </tbody>
      </table>`;
  }

  async function load() {
    expenses = await DB.list("expenses");
    render();
  }

  $("q").addEventListener("input", render);
  $("ex-form").addEventListener("submit", function (e) {
    e.preventDefault();
    UI.guard(async function () {
      await DB.insert("expenses", {
        label: $("e-label").value.trim(),
        amount: Number($("e-amount").value) || 0,
        notes: $("e-notes").value.trim(),
      });
      $("ex-form").reset();
      await load();
    });
  });
  page.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-action='del']");
    if (!btn) return;
    if (!confirm("حذف المصروف؟")) return;
    UI.guard(async function () {
      await DB.remove("expenses", btn.getAttribute("data-id"));
      await load();
    });
  });

  await UI.guard(load);
})();
