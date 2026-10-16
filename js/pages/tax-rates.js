(async function () {
  var page = await UI.init("tax-rates");
  if (!page) return;
  var html = UI.html;
  var rates = [];
  var $ = function (id) { return document.getElementById(id); };

  page.innerHTML = html`
    <div class="stack">
      <div class="head-row">
        <div>
          <h2>معدلات الضرائب</h2>
          <p>ضريبة القيمة المضافة وضرائب الخدمة تُستخدم في العروض والفواتير.</p>
        </div>
      </div>
      <form class="card" id="tr-form">
        <h3 style="margin-top:0">معدل جديد</h3>
        <div class="form-grid">
          <div class="field"><label>الاسم</label><input id="tr-name" required placeholder="ضريبة قيمة مضافة"></div>
          <div class="field"><label>النسبة %</label><input id="tr-rate" type="number" min="0" max="100" step="any" required></div>
          <div class="field"><label>افتراضي؟</label>
            <select id="tr-def"><option value="false">لا</option><option value="true">نعم</option></select>
          </div>
          <button>إضافة</button>
        </div>
      </form>
      <div class="table-wrap" id="list"><div class="empty">جارٍ التحميل…</div></div>
    </div>`;

  function render() {
    $("list").innerHTML = html`
      <table>
        <thead><tr><th>الاسم</th><th>النسبة</th><th>افتراضي</th><th></th></tr></thead>
        <tbody>
          ${rates.length === 0
            ? html`<tr><td colspan="4" class="empty">مفيش معدلات</td></tr>`
            : rates.map(function (r) {
                return html`<tr>
                  <td><b>${r.name}</b></td>
                  <td>${r.rate}%</td>
                  <td>${r.is_default ? html`<span class="badge paid">نعم</span>` : "—"}</td>
                  <td class="row">
                    ${!r.is_default ? html`<button class="small secondary" data-action="def" data-id="${r.id}">اجعله افتراضي</button>` : ""}
                    <button class="danger small" data-action="del" data-id="${r.id}">حذف</button>
                  </td>
                </tr>`;
              })}
        </tbody>
      </table>`;
  }

  async function load() {
    rates = await DB.list("tax_rates");
    render();
  }

  $("tr-form").addEventListener("submit", function (e) {
    e.preventDefault();
    UI.guard(async function () {
      var isDef = $("tr-def").value === "true";
      if (isDef) {
        for (var i = 0; i < rates.length; i++) {
          if (rates[i].is_default) await DB.update("tax_rates", rates[i].id, { is_default: false });
        }
      }
      await DB.insert("tax_rates", {
        name: $("tr-name").value.trim(),
        rate: Number($("tr-rate").value) || 0,
        is_default: isDef,
      });
      $("tr-form").reset();
      await load();
    });
  });
  page.addEventListener("click", function (e) {
    var def = e.target.closest("[data-action='def']");
    if (def) {
      UI.guard(async function () {
        for (var i = 0; i < rates.length; i++) {
          await DB.update("tax_rates", rates[i].id, { is_default: rates[i].id === def.getAttribute("data-id") });
        }
        await load();
      });
      return;
    }
    var del = e.target.closest("[data-action='del']");
    if (del) {
      if (!confirm("حذف المعدل؟")) return;
      UI.guard(async function () {
        await DB.remove("tax_rates", del.getAttribute("data-id"));
        await load();
      });
    }
  });

  await UI.guard(load);
})();
