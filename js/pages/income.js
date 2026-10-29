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
          <h2>${I18N.t("income_title")}</h2>
          <p>${I18N.t("income_sub2")}</p>
        </div>
      </div>
      <form class="card" id="in-form">
        <h3 style="margin-top:0">${I18N.t("manual_income")}</h3>
        <div class="form-grid">
          <div class="field"><label>${I18N.t("exp_label")}</label><input id="i-label" required></div>
          <div class="field"><label>${I18N.t("amount")}</label><input id="i-amount" type="number" min="0" step="any" required></div>
          <div class="field"><label>${I18N.t("notes")}</label><input id="i-notes"></div>
          <button>${I18N.t("add")}</button>
        </div>
      </form>
      <div class="card" id="summary"></div>
      <input id="q" placeholder="${I18N.t("search_label")}">
      <div class="table-wrap" id="list"><div class="empty">${I18N.t("loading")}</div></div>
    </div>`;

  function render() {
    // دمج مدفوعات أوامر الشغل كدخل تلقائي للعرض
    var fromPayments = payments.map(function (p) {
      return {
        id: "pay:" + p.id,
        label: I18N.t("wo_payment_label"),
        amount: p.amount,
        notes: I18N.t("method_prefix") + " " + UI.methodLabel(p.method),
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
          <div class="label">إجمالي ${I18N.t("income_title")}</div>
          <div class="value">${UI.money(total)}</div>
        </div>
        <div class="card stat" style="--accent:var(--primary)">
          <div class="label">${I18N.t("income_month")}</div>
          <div class="value">${UI.money(monthTotal)}</div>
        </div>
        <div class="card stat" style="--accent:var(--info)">
          <div class="label">${I18N.t("entries_count")}</div>
          <div class="value">${all.length}</div>
        </div>
      </div>`;

    $("list").innerHTML = html`
      <table>
        <thead><tr><th>${I18N.t("exp_label")}</th><th>${I18N.t("source")}</th><th>${I18N.t("amount")}</th><th>${I18N.t("notes")}</th><th>${I18N.t("date")}</th><th></th></tr></thead>
        <tbody>
          ${shown.length === 0
            ? html`<tr><td colspan="6" class="empty">${I18N.t("empty_entries")}</td></tr>`
            : shown.map(function (r) {
                var src = r.source === "payment" ? "دفعة" : r.source === "part_sale" ? I18N.t("src_ps") : r.source === "work_order" ? I18N.t("src_wo") : I18N.t("src_manual");
                return html`<tr>
                  <td><b>${r.label}</b></td>
                  <td><span class="chip">${src}</span></td>
                  <td>${UI.money(r.amount)}</td>
                  <td>${r.notes || "—"}</td>
                  <td>${UI.dateAr(r.created_at)}</td>
                  <td>${r._readonly ? "" : html`<button class="danger small" data-action="del" data-id="${r.id}">${I18N.t("delete")}</button>`}</td>
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
    if (!confirm(I18N.t("del_entry_q"))) return;
    UI.guard(async function () {
      await DB.remove("income", btn.getAttribute("data-id"));
      await load();
    });
  });

  await UI.guard(load);
})();
