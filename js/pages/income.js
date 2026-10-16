(async function () {
  var page = await UI.init("income");
  if (!page) return;
  var html = UI.html;

  var income = [], payments = [];
  var $ = function (id) { return document.getElementById(id); };

  page.innerHTML = html`
    <div class="stack">
      <div class="head-row">
        <div>
          <h2>الدخل</h2>
          <p>إيرادات الورشة: مدفوعات أوامر الشغل + بيع قطع + قيود يدوية.</p>
        </div>
      </div>
      <form class="card" id="in-form">
        <h3 style="margin-top:0">قيد دخل يدوي</h3>
        <div class="form-grid">
          <div class="field"><label>البيان</label><input id="i-label" required></div>
          <div class="field"><label>المبلغ</label><input id="i-amount" type="number" min="0" step="any" required></div>
          <div class="field"><label>ملاحظات</label><input id="i-notes"></div>
          <button>إضافة</button>
        </div>
      </form>
      <div class="card" id="summary"></div>
      <input id="q" placeholder="بحث بالبيان">
      <div class="table-wrap" id="list"><div class="empty">جارٍ التحميل…</div></div>
    </div>`;

  function render() {
    // دمج مدفوعات أوامر الشغل كدخل تلقائي للعرض
    var fromPayments = payments.map(function (p) {
      return {
        id: "pay:" + p.id,
        label: "دفعة أمر شغل",
        amount: p.amount,
        notes: "طريقة: " + UI.methodLabel(p.method),
        source: "payment",
        created_at: p.created_at,
        _readonly: true,
      };
    });
    var all = income.concat(fromPayments).sort(function (a, b) {
      return new Date(b.created_at) - new Date(a.created_at);
    });
    var q = ($("q").value || "").trim().toLowerCase();
    var shown = all.filter(function (r) {
      return (r.label + " " + (r.notes || "")).toLowerCase().indexOf(q) !== -1;
    });
    var total = all.reduce(function (s, r) { return s + (Number(r.amount) || 0); }, 0);
    var monthTotal = all.filter(function (r) {
      var d = new Date(r.created_at), now = new Date();
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).reduce(function (s, r) { return s + (Number(r.amount) || 0); }, 0);

    $("summary").innerHTML = html`
      <div class="grid">
        <div class="card stat" style="--accent:var(--success)">
          <div class="label">إجمالي الدخل</div>
          <div class="value">${UI.money(total)}</div>
        </div>
        <div class="card stat" style="--accent:var(--primary)">
          <div class="label">دخل هذا الشهر</div>
          <div class="value">${UI.money(monthTotal)}</div>
        </div>
        <div class="card stat" style="--accent:var(--info)">
          <div class="label">عدد القيود</div>
          <div class="value">${all.length}</div>
        </div>
      </div>`;

    $("list").innerHTML = html`
      <table>
        <thead><tr><th>البيان</th><th>المصدر</th><th>المبلغ</th><th>ملاحظات</th><th>التاريخ</th><th></th></tr></thead>
        <tbody>
          ${shown.length === 0
            ? html`<tr><td colspan="6" class="empty">مفيش قيود</td></tr>`
            : shown.map(function (r) {
                var src = r.source === "payment" ? "دفعة" : r.source === "part_sale" ? "بيع قطع" : r.source === "work_order" ? "أمر شغل" : "يدوي";
                return html`<tr>
                  <td><b>${r.label}</b></td>
                  <td><span class="chip">${src}</span></td>
                  <td>${UI.money(r.amount)}</td>
                  <td>${r.notes || "—"}</td>
                  <td>${UI.dateAr(r.created_at)}</td>
                  <td>${r._readonly ? "" : html`<button class="danger small" data-action="del" data-id="${r.id}">حذف</button>`}</td>
                </tr>`;
              })}
        </tbody>
      </table>`;
  }

  async function load() {
    var data = await Promise.all([DB.list("income"), DB.list("payments")]);
    income = data[0];
    payments = data[1];
    render();
  }

  $("q").addEventListener("input", render);
  $("in-form").addEventListener("submit", function (e) {
    e.preventDefault();
    UI.guard(async function () {
      await DB.insert("income", {
        label: $("i-label").value.trim(),
        amount: Number($("i-amount").value) || 0,
        notes: $("i-notes").value.trim(),
        source: "manual",
        ref_id: null,
      });
      $("in-form").reset();
      await load();
    });
  });
  page.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-action='del']");
    if (!btn) return;
    if (!confirm("حذف القيد؟")) return;
    UI.guard(async function () {
      await DB.remove("income", btn.getAttribute("data-id"));
      await load();
    });
  });

  await UI.guard(load);
})();
