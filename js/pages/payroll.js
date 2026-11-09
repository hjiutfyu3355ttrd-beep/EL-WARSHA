// صفحة المرتبات.
// الفكرة: لكل عامل مرتب ثابت (أسبوعي/شهري) بيتحسب مستحق تلقائي كل فترة. أنت بتسجّل بس "اتصرف كام"،
// واللي بيتخصم من الخزنة هو المبلغ المصروف فعلاً. الباقي بيفضل للعامل ويتراكم للفترة اللي بعدها.
(async function () {
  var page = await UI.init("payroll");
  if (!page) return;
  var html = UI.html;
  var t = I18N.t;
  var $ = function (id) { return document.getElementById(id); };

  var employees = [], accruals = [], payments = [];
  var balance = 0;           // رصيد الخزنة الحالي (للتحذير بس)
  var editing = null;        // id العامل اللي بيتعدّل (أو null = إضافة)
  var paying = null;         // id العامل اللي بنصرفله
  var history = null;        // id العامل اللي بنشوف سجله

  page.innerHTML = html`
    <div class="stack">
      <div class="head-row">
        <div>
          <h2>${t("t_payroll")}</h2>
          <p>${t("d_payroll")}</p>
        </div>
        <button type="button" id="btn-add">${t("pr_add_btn")}</button>
      </div>

      <form class="card" id="emp-form" style="display:none">
        <h3 style="margin-top:0" id="ef-title"></h3>
        <div class="form-grid">
          <div class="field"><label for="ef-name">${t("pr_name")}</label><input id="ef-name" required></div>
          <div class="field"><label for="ef-role">${t("pr_role")}</label><input id="ef-role"></div>
          <div class="field"><label for="ef-salary">${t("pr_salary")} (${UI.currencyLabel()})</label><input id="ef-salary" type="number" min="0" step="any" required></div>
          <div class="field"><label for="ef-period">${t("pr_period")}</label>
            <select id="ef-period"><option value="week">${t("pr_week")}</option><option value="month">${t("pr_month")}</option></select></div>
          <div class="field"><label for="ef-start">${t("pr_start")}</label><input id="ef-start" type="date"></div>
        </div>
        <p style="margin:10px 0;color:var(--muted)" id="ef-hint"></p>
        <div style="display:flex;gap:8px">
          <button>${t("save")}</button>
          <button type="button" class="secondary" id="ef-cancel">${t("cancel")}</button>
        </div>
      </form>

      <div id="pay-panel"></div>
      <div id="summary"></div>
      <div class="table-wrap" id="list"><div class="empty">${t("loading")}</div></div>
      <div id="hist-panel"></div>
    </div>`;

  async function load() {
    await DB.syncSalaryAccruals(Treasury.today());
    var res = await Promise.all([DB.list("employees"), DB.list("salary_accruals"), DB.list("salary_payments"), DB.treasuryTotals().catch(function () { return null; })]);
    employees = res[0].slice().sort(function (a, b) { return new Date(a.created_at) - new Date(b.created_at); });
    accruals = res[1];
    payments = res[2];
    balance = res[3] ? res[3].balance : 0;
    render();
  }

  function status(e) { return Treasury.employeeStatus(e, accruals, payments, Treasury.today()); }
  function isStopped(e) { return !!e.end_date && String(e.end_date).slice(0, 10) <= Treasury.today(); }
  function salaryText(e) {
    return t(e.salary_period === "month" ? "pr_per_month" : "pr_per_week", { amount: UI.money(e.salary_amount) });
  }

  function render() {
    renderSummary();
    renderList();
    renderPay();
    renderHistory();
  }

  function renderSummary() {
    var due = 0, active = 0;
    employees.forEach(function (e) { due += status(e).remaining; if (!isStopped(e)) active++; });
    var ym = Treasury.today().slice(0, 7);
    var paidMonth = payments.filter(function (p) { return String(p.paid_at).slice(0, 7) === ym; })
      .reduce(function (s, p) { return s + (Number(p.amount) || 0); }, 0);
    $("summary").innerHTML = html`
      <div class="grid">
        <div class="card stat" style="--accent:var(--warning)"><div class="label">${t("pr_total_due")}</div><div class="value">${UI.money(due)}</div></div>
        <div class="card stat" style="--accent:var(--primary)"><div class="label">${t("pr_paid_month")}</div><div class="value">${UI.money(paidMonth)}</div></div>
        <div class="card stat" style="--accent:var(--info)"><div class="label">${t("pr_workers")}</div><div class="value">${active}</div></div>
      </div>`;
  }

  function renderList() {
    if (employees.length === 0) {
      $("list").innerHTML = html`<div class="empty">${t("pr_empty")}</div>`;
      return;
    }
    $("list").innerHTML = html`<table>
      <thead><tr><th>${t("pr_col_worker")}</th><th>${t("pr_col_salary")}</th><th>${t("pr_col_accrued")}</th><th>${t("pr_col_paid")}</th><th>${t("pr_col_remaining")}</th><th></th></tr></thead>
      <tbody>${employees.map(function (e) {
        var st = status(e), stopped = isStopped(e);
        var hasPay = payments.some(function (p) { return p.employee_id === e.id; });
        return html`<tr style="${stopped ? "opacity:.65" : ""}">
          <td><b>${e.name}</b>${stopped ? html` <span class="badge cancelled">${t("pr_stopped")}</span>` : ""}
            ${e.role ? html`<br><small style="color:var(--muted)">${e.role}</small>` : ""}</td>
          <td>${salaryText(e)}</td>
          <td>${UI.money(st.accrued)}</td>
          <td>${UI.money(st.paid)}</td>
          <td>${st.remaining > 0
            ? html`<b style="color:#b45309">${UI.money(st.remaining)}</b>`
            : st.advance > 0
              ? html`<span class="badge ready">${t("pr_advance", { amount: UI.money(st.advance) })}</span>`
              : html`<span style="color:var(--muted)">${t("pr_settled")}</span>`}</td>
          <td style="white-space:nowrap">
            <button type="button" class="small" data-act="pay" data-id="${e.id}">${t("pr_pay")}</button>
            <button type="button" class="small secondary" data-act="hist" data-id="${e.id}">${t("pr_history")}</button>
            <button type="button" class="small secondary" data-act="edit" data-id="${e.id}">${t("pr_edit")}</button>
            ${stopped ? "" : html`<button type="button" class="small secondary" data-act="stop" data-id="${e.id}">${t("pr_stop")}</button>`}
            ${hasPay ? "" : html`<button type="button" class="small danger" data-act="del" data-id="${e.id}">${t("pr_delete")}</button>`}
          </td>
        </tr>`;
      })}</tbody></table>`;
  }

  // ----- صرف مرتب -----
  function renderPay() {
    var e = employees.filter(function (x) { return x.id === paying; })[0];
    if (!e) { $("pay-panel").innerHTML = ""; return; }
    var st = status(e);
    $("pay-panel").innerHTML = html`
      <form class="card" id="pay-form">
        <h3 style="margin-top:0">${t("pr_pay_title", { name: e.name })}</h3>
        <p style="margin:0 0 12px;color:var(--muted)">${t("pr_pay_hint", { due: UI.money(st.remaining) })}</p>
        <div class="form-grid">
          <div class="field"><label for="pf-amount">${t("pr_pay_amount")} (${UI.currencyLabel()})</label>
            <input id="pf-amount" type="number" min="0" step="any" value="${st.remaining > 0 ? st.remaining : ""}" required></div>
          <div class="field"><label for="pf-date">${t("date")}</label><input id="pf-date" type="date" value="${Treasury.today()}"></div>
          <div class="field"><label for="pf-note">${t("notes")}</label><input id="pf-note"></div>
          <div style="display:flex;gap:8px">
            <button>${t("pr_pay_save")}</button>
            <button type="button" class="secondary" id="pf-cancel">${t("cancel")}</button>
          </div>
        </div>
        <p style="margin:12px 0 0;font-weight:600" id="pf-preview"></p>
      </form>`;
    updatePreview(e);
    $("pf-amount").addEventListener("input", function () { updatePreview(e); });
    $("pf-cancel").addEventListener("click", function () { paying = null; renderPay(); });
    $("pay-form").addEventListener("submit", function (ev) {
      ev.preventDefault();
      UI.guard(async function () {
        var amount = Number($("pf-amount").value);
        if (!(amount > 0)) { UI.flash(t("tr_amount_required"), "error"); return; }
        await DB.insert("salary_payments", {
          employee_id: e.id, amount: amount, paid_at: $("pf-date").value || Treasury.today(), note: $("pf-note").value.trim(),
        });
        paying = null;
        await load();
        UI.flash(t("pr_paid_ok"), "success");
      });
    });
    $("pay-form").scrollIntoView({ block: "nearest" });
    $("pf-amount").focus();
  }
  function updatePreview(e) {
    var amount = Number($("pf-amount").value) || 0;
    var left = status(e).remaining - amount;
    var msg = left >= 0
      ? t("pr_pay_preview", { paid: UI.money(amount), left: UI.money(left) })
      : t("pr_pay_preview_adv", { paid: UI.money(amount), over: UI.money(-left) });
    if (amount > balance) msg += "  ⚠ " + t("pr_pay_neg", { bal: UI.money(balance) });
    $("pf-preview").textContent = msg;
  }

  // ----- سجل الصرف -----
  function renderHistory() {
    var e = employees.filter(function (x) { return x.id === history; })[0];
    if (!e) { $("hist-panel").innerHTML = ""; return; }
    var rows = payments.filter(function (p) { return p.employee_id === e.id; }).sort(function (a, b) {
      return String(b.paid_at).localeCompare(String(a.paid_at)) || new Date(b.created_at) - new Date(a.created_at);
    });
    $("hist-panel").innerHTML = html`
      <div class="card">
        <h3 style="margin-top:0">${t("pr_hist_title", { name: e.name })}</h3>
        ${rows.length === 0 ? html`<div class="empty">${t("pr_hist_empty")}</div>` : html`
          <table><thead><tr><th>${t("date")}</th><th>${t("amount")}</th><th>${t("notes")}</th><th></th></tr></thead>
          <tbody>${rows.map(function (p) {
            return html`<tr><td>${UI.dateAr(String(p.paid_at).slice(0, 10) + "T12:00:00")}</td><td>${UI.money(p.amount)}</td><td>${p.note || ""}</td>
              <td><button type="button" class="small danger" data-act="delpay" data-id="${p.id}">✕</button></td></tr>`;
          })}</tbody></table>`}
      </div>`;
  }

  // ----- إضافة / تعديل عامل -----
  function openForm(emp) {
    editing = emp ? emp.id : null;
    $("ef-title").textContent = t(emp ? "pr_edit_title" : "pr_add_title");
    $("ef-name").value = emp ? emp.name : "";
    $("ef-role").value = emp ? emp.role || "" : "";
    $("ef-salary").value = emp ? emp.salary_amount : "";
    $("ef-period").value = emp ? emp.salary_period : "week";
    $("ef-start").value = emp ? String(emp.start_date).slice(0, 10) : Treasury.today();
    // الفترة وتاريخ البداية بيتقفلوا بعد ما يتولّد مستحق (عشان ما نبوّظش الحسابات القديمة)
    $("ef-period").disabled = $("ef-start").disabled = !!emp;
    $("ef-hint").textContent = emp ? t("pr_salary_change_hint") : t("pr_start_hint");
    $("emp-form").style.display = "";
    $("ef-name").focus();
  }
  function closeForm() {
    editing = null;
    $("emp-form").style.display = "none";
  }
  $("btn-add").addEventListener("click", function () { openForm(null); });
  $("ef-cancel").addEventListener("click", closeForm);
  $("emp-form").addEventListener("submit", function (ev) {
    ev.preventDefault();
    UI.guard(async function () {
      var name = $("ef-name").value.trim();
      var salary = Number($("ef-salary").value);
      if (!name) { UI.flash(t("pr_name_required"), "error"); return; }
      if (!(salary >= 0)) return;
      if (editing) {
        var emp = employees.filter(function (x) { return x.id === editing; })[0];
        await DB.update("employees", editing, { name: name, role: $("ef-role").value.trim(), salary_amount: salary });
        // تغيير المرتب بيتطبّق على الفترة الحالية وللي بعدها بس (القديمة بتفضل زي ما هي)
        if (Number(emp.salary_amount) !== salary) {
          var cur = status(emp).currentPeriodStart;
          var mine = accruals.filter(function (a) { return a.employee_id === emp.id && cur && String(a.period_start).slice(0, 10) >= cur; });
          for (var i = 0; i < mine.length; i++) await DB.update("salary_accruals", mine[i].id, { amount: salary });
        }
      } else {
        var start = $("ef-start").value || Treasury.today();
        var limit = Treasury.addDays(Treasury.today(), -365 * 5);
        if (start < limit) { UI.flash(t("pr_start_old"), "error"); return; }
        await DB.insert("employees", {
          name: name, role: $("ef-role").value.trim(), salary_amount: salary,
          salary_period: $("ef-period").value, start_date: start,
        });
      }
      closeForm();
      await load();
      UI.flash(t("pr_saved"), "success");
    });
  });

  // ----- أزرار الجدول -----
  page.addEventListener("click", function (ev) {
    var b = ev.target.closest("button[data-act]");
    if (!b) return;
    var id = b.getAttribute("data-id"), act = b.getAttribute("data-act");
    var emp = employees.filter(function (x) { return x.id === id; })[0];
    if (act === "pay") { paying = id; renderPay(); }
    else if (act === "hist") { history = history === id ? null : id; renderHistory(); }
    else if (act === "edit" && emp) openForm(emp);
    else if (act === "stop" && emp) {
      if (!confirm(t("pr_stop_q", { name: emp.name }))) return;
      UI.guard(async function () { await DB.update("employees", id, { end_date: Treasury.today() }); await load(); });
    } else if (act === "del" && emp) {
      if (!confirm(t("pr_del_q", { name: emp.name }))) return;
      UI.guard(async function () {
        try {
          // المستحقات بتتمسح مع العامل (في الداتابيز cascade). الصرف ممنوع الحذف معاه بقيد في الداتابيز.
          await DB.remove("employees", id);
          if (DB.demoMode) {
            var mine = accruals.filter(function (a) { return a.employee_id === id; });
            for (var i = 0; i < mine.length; i++) await DB.remove("salary_accruals", mine[i].id);
          }
        } catch (e) {
          if (/foreign key|violates/i.test(e.message || "")) { UI.flash(t("pr_del_blocked"), "error"); return; }
          throw e;
        }
        if (paying === id) paying = null;
        if (history === id) history = null;
        await load();
      });
    } else if (act === "delpay") {
      if (!confirm(t("pr_del_pay_q"))) return;
      UI.guard(async function () { await DB.remove("salary_payments", id); await load(); });
    }
  });

  UI.guard(load);
})();
