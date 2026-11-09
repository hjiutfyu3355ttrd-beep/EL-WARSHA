// صفحة الخزنة: الرصيد بيتحسب تلقائي من كل حركات الورشة (مفيش حاجة بتتعدّل يدوي):
//   داخل = مدفوعات الأوامر والفواتير + الدخل (مبيعات القطع وغيرها) + الإيداعات اليدوية
//   خارج = المصروفات (والمشتريات بتتسجّل فيها) + المرتبات المصروفة + السحوبات اليدوية
(async function () {
  var page = await UI.init("treasury");
  if (!page) return;
  var html = UI.html;
  var t = I18N.t;
  var $ = function (id) { return document.getElementById(id); };

  var data = {};
  var moves = [];   // كل الحركات (الأقدم أولاً) + الرصيد الجاري
  var mode = null;  // "deposit" | "withdraw" | null (النموذج مقفول)

  page.innerHTML = html`
    <div class="stack">
      <div class="head-row">
        <div>
          <h2>${t("t_treasury")}</h2>
          <p>${t("d_treasury")}</p>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button type="button" id="btn-dep">${t("tr_deposit_btn")}</button>
          <button type="button" class="secondary" id="btn-wd">${t("tr_withdraw_btn")}</button>
        </div>
      </div>

      <form class="card" id="tr-form" style="display:none">
        <h3 style="margin-top:0" id="tf-title"></h3>
        <p style="margin:0 0 12px;color:var(--muted)">${t("tr_manual_hint")}</p>
        <div class="form-grid">
          <div class="field"><label for="tf-amount">${t("amount")}</label><input id="tf-amount" type="number" min="0" step="any" required></div>
          <div class="field"><label for="tf-note">${t("notes")}</label><input id="tf-note"></div>
          <div class="field"><label for="tf-date">${t("date")}</label><input id="tf-date" type="date"></div>
          <div style="display:flex;gap:8px">
            <button>${t("save")}</button>
            <button type="button" class="secondary" id="tf-cancel">${t("cancel")}</button>
          </div>
        </div>
      </form>

      <div id="summary"></div>

      <div class="form-grid" style="align-items:end">
        <input id="q" placeholder="${t("tr_search")}">
        <select id="dir">
          <option value="">${t("tr_filter_all")}</option>
          <option value="in">${t("tr_filter_in")}</option>
          <option value="out">${t("tr_filter_out")}</option>
        </select>
      </div>
      <div class="table-wrap" id="list"><div class="empty">${t("loading")}</div></div>
    </div>`;

  var pg = UI.makePager();
  UI.bindPager($("list"), pg, renderList);

  async function load() {
    // نولّد مستحقات المرتبات الناقصة الأول (عشان "المرتبات المستحقة" تكون محدّثة)
    await DB.syncSalaryAccruals(Treasury.today());
    var names = ["payments", "income", "expenses", "treasury_entries", "salary_payments", "employees", "salary_accruals"];
    var res = await Promise.all(names.map(function (n) { return DB.list(n); }));
    data = {};
    names.forEach(function (n, i) { data[n] = res[i]; });
    moves = Treasury.movements(data);
    renderSummary();
    renderList();
  }

  function renderSummary() {
    var tot = Treasury.totals(data);
    var neg = tot.balance < 0;
    $("summary").innerHTML = html`
      ${neg ? html`<div class="notice error">${t("tr_neg_warn")}</div>` : ""}
      <div class="grid">
        <div class="card stat" style="--accent:${neg ? "var(--error, #dc2626)" : "var(--success)"}">
          <div class="label">${t("tr_balance")}</div>
          <div class="value" style="${neg ? "color:var(--error, #dc2626)" : ""}">${UI.money(tot.balance)}</div>
        </div>
        <div class="card stat" style="--accent:var(--success)">
          <div class="label">${t("tr_total_in")}</div>
          <div class="value">${UI.money(tot.total_in)}</div>
        </div>
        <div class="card stat" style="--accent:var(--primary)">
          <div class="label">${t("tr_total_out")}</div>
          <div class="value">${UI.money(tot.total_out)}</div>
        </div>
        <a class="card stat pick" href="payroll.html" style="--accent:var(--warning);text-decoration:none;color:inherit">
          <div class="label">${t("tr_owed")}</div>
          <div class="value">${UI.money(tot.salary_owed)}</div>
          <div class="sub">${tot.salary_owed > 0 ? t("tr_after_salaries", { amount: UI.money(tot.balance - tot.salary_owed) }) : t("tr_go_payroll")}</div>
        </a>
      </div>`;
  }

  function renderList() {
    var q = ($("q").value || "").trim().toLowerCase();
    var dir = $("dir").value;
    var shown = moves.slice().reverse().filter(function (m) {   // الأحدث أولاً (الرصيد الجاري بيفضل صح لأنه محسوب على الكل)
      if (dir && m.dir !== dir) return false;
      return (m.label + " " + (m.note || "")).toLowerCase().indexOf(q) !== -1;
    });
    var rows = UI.pageSlice(pg, shown, q + "|" + dir);
    var bar = UI.pagerBar(pg, shown.length);
    $("list").innerHTML = shown.length === 0
      ? html`<div class="empty">${t("tr_empty")}</div>`
      : html`<table>
          <thead><tr><th>${t("date")}</th><th>${t("tr_col_desc")}</th><th>${t("tr_col_in")}</th><th>${t("tr_col_out")}</th><th>${t("tr_col_balance")}</th><th></th></tr></thead>
          <tbody>${rows.map(function (m) {
            return html`<tr>
              <td>${UI.dateAr(m.when)}</td>
              <td><b>${m.label}</b>${m.note ? html`<br><small style="color:var(--muted)">${m.note}</small>` : ""}</td>
              <td style="color:var(--success)">${m.dir === "in" ? "+" + UI.money(m.amount) : ""}</td>
              <td style="color:var(--error, #dc2626)">${m.dir === "out" ? "−" + UI.money(m.amount) : ""}</td>
              <td><b style="${m.balance < 0 ? "color:var(--error, #dc2626)" : ""}">${UI.money(m.balance)}</b></td>
              <td>${m.table === "treasury_entries" ? html`<button type="button" class="small danger" data-del="${m.id}">✕</button>` : ""}</td>
            </tr>`;
          })}</tbody></table>${bar}`;
  }

  // ----- حركة يدوية (رصيد افتتاحي / إيداع / سحب) -----
  function openForm(kind) {
    mode = kind;
    $("tf-title").textContent = t(kind === "deposit" ? "tr_manual_deposit" : "tr_manual_withdraw");
    $("tf-amount").value = "";
    $("tf-note").value = "";
    $("tf-date").value = Treasury.today();
    $("tr-form").style.display = "";
    $("tf-amount").focus();
  }
  function closeForm() {
    mode = null;
    $("tr-form").style.display = "none";
  }
  $("btn-dep").addEventListener("click", function () { openForm("deposit"); });
  $("btn-wd").addEventListener("click", function () { openForm("withdraw"); });
  $("tf-cancel").addEventListener("click", closeForm);
  $("tr-form").addEventListener("submit", function (e) {
    e.preventDefault();
    UI.guard(async function () {
      var amount = Number($("tf-amount").value);
      if (!(amount > 0)) { UI.flash(t("tr_amount_required"), "error"); return; }
      await DB.insert("treasury_entries", {
        kind: mode, amount: amount, note: $("tf-note").value.trim(), entry_date: $("tf-date").value || Treasury.today(),
      });
      closeForm();
      await load();
      UI.flash(t("tr_saved"), "success");
    });
  });
  $("list").addEventListener("click", function (e) {
    var b = e.target.closest("button[data-del]");
    if (!b) return;
    if (!confirm(t("tr_del_q"))) return;
    UI.guard(async function () {
      await DB.remove("treasury_entries", b.getAttribute("data-del"));
      await load();
    });
  });
  $("q").addEventListener("input", renderList);
  $("dir").addEventListener("change", renderList);

  UI.guard(load);
})();
