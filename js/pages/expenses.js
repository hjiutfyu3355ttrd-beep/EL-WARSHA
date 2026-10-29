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
          <h2>${I18N.t("nav_expenses")}</h2>
          <p>${I18N.t("exp_sub")}</p>
        </div>
      </div>
      <form class="card" id="ex-form">
        <h3 style="margin-top:0">${I18N.t("exp_new")}</h3>
        <div class="form-grid">
          <div class="field"><label>${I18N.t("exp_label")}</label><input id="e-label" required placeholder="${I18N.t("exp_placeholder")}"></div>
          <div class="field"><label>${I18N.t("exp_amount")}</label><input id="e-amount" type="number" min="0" step="any" required></div>
          <div class="field"><label>${I18N.t("notes")}</label><input id="e-notes"></div>
          <button>${I18N.t("add")}</button>
        </div>
      </form>
      <div class="card" id="summary"></div>
      <input id="q" placeholder="${I18N.t("search_label")}">
      <div class="table-wrap" id="list"><div class="empty">${I18N.t("loading")}</div></div>
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
          <div class="label">إجمالي ${I18N.t("nav_expenses")}</div>
          <div class="value">${UI.money(total)}</div>
        </div>
        <div class="card stat" style="--accent:var(--warning)">
          <div class="label">${I18N.t("exp_month")}</div>
          <div class="value">${UI.money(monthTotal)}</div>
        </div>
        <div class="card stat" style="--accent:var(--info)">
          <div class="label">${I18N.t("entries_count")}</div>
          <div class="value">${expenses.length}</div>
        </div>
      </div>`;

    $("list").innerHTML = html`
      <table>
        <thead><tr><th>${I18N.t("exp_label")}</th><th>${I18N.t("amount")}</th><th>${I18N.t("notes")}</th><th>${I18N.t("date")}</th><th></th></tr></thead>
        <tbody>
          ${shown.length === 0
            ? html`<tr><td colspan="5" class="empty">${I18N.t("empty_generic")}</td></tr>`
            : shown.map(function (e) {
                return html`<tr>
                  <td><b>${e.label}</b></td>
                  <td>${UI.money(e.amount)}</td>
                  <td>${e.notes || "—"}</td>
                  <td>${UI.dateAr(e.created_at)}</td>
                  <td><button class="danger small" data-action="del" data-id="${e.id}">${I18N.t("delete")}</button></td>
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
    if (!confirm(I18N.t("del_exp_q"))) return;
    UI.guard(async function () {
      await DB.remove("expenses", btn.getAttribute("data-id"));
      await load();
    });
  });

  await UI.guard(load);
})();
