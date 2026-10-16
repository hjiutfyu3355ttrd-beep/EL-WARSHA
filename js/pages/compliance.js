(async function () {
  var page = await UI.init("compliance");
  if (!page) return;
  var html = UI.html;

  var taxes = [], vehicles = {}, customers = {};
  var $ = function (id) { return document.getElementById(id); };

  page.innerHTML = html`
    <div class="stack">
      <div class="head-row">
        <div>
          <h2>الضرائب والامتثال</h2>
          <p>رخص التسيير، التأمين الإجباري، وضرائب المركبات.</p>
        </div>
      </div>
      <div class="card" id="summary"></div>
      <form class="card" id="tax-form">
        <h3 style="margin-top:0">سجل ضريبة / رخصة</h3>
        <div class="form-grid">
          <div class="field"><label>السيارة</label><select id="t-vehicle" required></select></div>
          <div class="field"><label>النوع</label>
            <select id="t-type">
              <option>رخصة تسيير</option>
              <option>تأمين إجباري</option>
              <option>ضريبة مركبات</option>
              <option>فحص دوري</option>
              <option>أخرى</option>
            </select>
          </div>
          <div class="field"><label>المبلغ</label><input id="t-amount" type="number" min="0" step="any" value="0"></div>
          <div class="field"><label>تاريخ الاستحقاق</label><input id="t-due" type="date"></div>
          <div class="field"><label>مدفوعة؟</label>
            <select id="t-paid"><option value="false">لا</option><option value="true">نعم</option></select>
          </div>
          <div class="field"><label>ملاحظات</label><input id="t-notes"></div>
          <button>إضافة</button>
        </div>
      </form>
      <div class="tabs" id="tabs">
        <button class="on" data-f="all">الكل</button>
        <button data-f="unpaid">غير مدفوعة</button>
        <button data-f="overdue">متأخرة</button>
        <button data-f="paid">مدفوعة</button>
      </div>
      <div class="table-wrap" id="list"><div class="empty">جارٍ التحميل…</div></div>
    </div>`;

  var filter = "all";

  function isOverdue(t) {
    return !t.paid && t.due_date && new Date(t.due_date).getTime() < Date.now();
  }

  function render() {
    var unpaid = taxes.filter(function (t) { return !t.paid; });
    var overdue = taxes.filter(isOverdue);
    var paid = taxes.filter(function (t) { return t.paid; });
    $("summary").innerHTML = html`
      <div class="grid">
        <div class="card stat pick" style="--accent:var(--warning)" data-f="unpaid">
          <div class="label">غير مدفوعة</div><div class="value">${unpaid.length}</div>
        </div>
        <div class="card stat pick" style="--accent:var(--error)" data-f="overdue">
          <div class="label">متأخرة</div><div class="value">${overdue.length}</div>
        </div>
        <div class="card stat pick" style="--accent:var(--success)" data-f="paid">
          <div class="label">مدفوعة</div><div class="value">${paid.length}</div>
        </div>
      </div>`;

    var shown = taxes.filter(function (t) {
      if (filter === "unpaid") return !t.paid;
      if (filter === "overdue") return isOverdue(t);
      if (filter === "paid") return t.paid;
      return true;
    });

    $("list").innerHTML = html`
      <table>
        <thead><tr><th>السيارة</th><th>النوع</th><th>المبلغ</th><th>الاستحقاق</th><th>الحالة</th><th>ملاحظات</th><th></th></tr></thead>
        <tbody>
          ${shown.length === 0
            ? html`<tr><td colspan="7" class="empty">مفيش سجلات</td></tr>`
            : shown.map(function (t) {
                var v = vehicles[t.vehicle_id];
                var st = t.paid ? "مدفوعة" : isOverdue(t) ? "متأخرة" : "مستحقة";
                var cls = t.paid ? "paid" : isOverdue(t) ? "cancelled" : "awaiting_approval";
                return html`<tr>
                  <td>${v ? v.plate + " — " + v.make : "—"}</td>
                  <td>${t.tax_type}</td>
                  <td>${UI.money(t.amount)}</td>
                  <td>${t.due_date ? UI.dateAr(t.due_date) : "—"}</td>
                  <td><span class="badge ${cls}">${st}</span></td>
                  <td>${t.notes || "—"}</td>
                  <td class="row">
                    ${!t.paid ? html`<button class="small" data-action="pay" data-id="${t.id}">تم الدفع</button>` : ""}
                    <button class="danger small" data-action="del" data-id="${t.id}">حذف</button>
                  </td>
                </tr>`;
              })}
        </tbody>
      </table>`;
  }

  async function load() {
    var data = await Promise.all([DB.list("vehicle_taxes"), DB.list("vehicles"), DB.list("customers")]);
    taxes = data[0];
    vehicles = UI.byId(data[1]);
    customers = UI.byId(data[2]);
    $("t-vehicle").innerHTML = Object.keys(vehicles).map(function (id) {
      var v = vehicles[id];
      return UI.option(id, v.plate + " — " + v.make + " " + v.model);
    }).join("") || '<option value="">مفيش سيارات</option>';
    render();
  }

  $("tabs").addEventListener("click", function (e) {
    var b = e.target.closest("[data-f]");
    if (!b) return;
    filter = b.getAttribute("data-f");
    $("tabs").querySelectorAll("button").forEach(function (x) { x.classList.toggle("on", x === b); });
    render();
  });
  page.addEventListener("click", function (e) {
    var card = e.target.closest(".card.stat[data-f]");
    if (card) {
      filter = card.getAttribute("data-f");
      $("tabs").querySelectorAll("button").forEach(function (x) {
        x.classList.toggle("on", x.getAttribute("data-f") === filter);
      });
      render();
      return;
    }
    var pay = e.target.closest("[data-action='pay']");
    if (pay) {
      UI.guard(async function () {
        await DB.update("vehicle_taxes", pay.getAttribute("data-id"), { paid: true });
        await load();
      });
      return;
    }
    var del = e.target.closest("[data-action='del']");
    if (del) {
      if (!confirm("حذف السجل؟")) return;
      UI.guard(async function () {
        await DB.remove("vehicle_taxes", del.getAttribute("data-id"));
        await load();
      });
    }
  });
  $("tax-form").addEventListener("submit", function (e) {
    e.preventDefault();
    UI.guard(async function () {
      var due = $("t-due").value;
      await DB.insert("vehicle_taxes", {
        vehicle_id: $("t-vehicle").value,
        tax_type: $("t-type").value,
        amount: Number($("t-amount").value) || 0,
        due_date: due ? new Date(due).toISOString() : null,
        paid: $("t-paid").value === "true",
        notes: $("t-notes").value.trim(),
      });
      $("tax-form").reset();
      await load();
    });
  });

  await UI.guard(load);
})();
