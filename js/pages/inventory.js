(async function () {
  var page = await UI.init("inventory");
  if (!page) return;
  var html = UI.html;
  var t = UI.t;

  var parts = [];

  page.innerHTML = html`
    <div class="stack">
      <h2 class="page-title" style="margin:0">${t("inventory_title")}</h2>

      <form class="card" id="part-form">
        <h3 style="margin-top:0">${t("inventory_new")}</h3>
        <div class="form-grid">
          <div class="field"><label>${t("inventory_name")}</label><input id="p-name" required></div>
          <div class="field"><label>${t("inventory_sku")}</label><input id="p-sku" dir="ltr"></div>
          <div class="field"><label>${t("inventory_qty")}</label><input id="p-qty" type="number" min="0" value="0"></div>
          <div class="field"><label>${t("inventory_min")}</label><input id="p-min" type="number" min="0" value="0"></div>
          <div class="field"><label>${t("inventory_cost")}</label><input id="p-cost" type="number" min="0" step="any" value="0"></div>
          <div class="field"><label>${t("inventory_price")}</label><input id="p-price" type="number" min="0" step="any" value="0"></div>
          <button>${t("inventory_add")}</button>
        </div>
      </form>

      <input id="q" placeholder="${t("inventory_search")}">
      <div id="low"></div>
      <div class="table-wrap" id="list"><div class="empty">${t("loading")}</div></div>
    </div>`;

  var $ = function (id) { return document.getElementById(id); };

  function render() {
    var q = $("q").value.trim().toLowerCase();
    var shown = parts.filter(function (p) {
      return (p.name + " " + (p.sku || "")).toLowerCase().indexOf(q) !== -1;
    });
    var lowCount = parts.filter(function (p) { return p.qty <= p.min_qty; }).length;

    $("low").innerHTML = lowCount > 0 ? html`<div class="notice">${t("inventory_low", { n: lowCount })}</div>` : "";

    $("list").innerHTML = html`
      <table>
        <thead><tr><th>${t("col_part")}</th><th>${t("col_sku")}</th><th>${t("col_qty")}</th><th>${t("col_min")}</th><th>${t("col_cost")}</th><th>${t("col_sell")}</th><th></th></tr></thead>
        <tbody>
          ${shown.length === 0
            ? html`<tr><td colspan="7" class="empty">${t("inventory_empty")}</td></tr>`
            : shown.map(function (p) {
                return html`<tr>
                  <td>${p.name}</td>
                  <td dir="ltr">${p.sku || t("none")}</td>
                  <td class="${p.qty <= p.min_qty ? "low" : ""}">${p.qty}</td>
                  <td>${p.min_qty}</td>
                  <td>${UI.money(p.cost)}</td>
                  <td>${UI.money(p.price)}</td>
                  <td><div class="row">
                    <button class="secondary small" data-action="inc" data-id="${p.id}">+1</button>
                    <button class="secondary small" data-action="dec" data-id="${p.id}">−1</button>
                    <button class="danger small" data-action="del" data-id="${p.id}">${t("delete")}</button>
                  </div></td>
                </tr>`;
              })}
        </tbody>
      </table>`;
  }

  async function load() {
    parts = await DB.list("parts");
    render();
  }

  $("part-form").addEventListener("submit", function (e) {
    e.preventDefault();
    UI.guard(async function () {
      await DB.insert("parts", {
        name: $("p-name").value.trim(),
        sku: $("p-sku").value.trim(),
        qty: Number($("p-qty").value),
        min_qty: Number($("p-min").value),
        cost: Number($("p-cost").value),
        price: Number($("p-price").value),
      });
      $("part-form").reset();
      await load();
    });
  });

  $("q").addEventListener("input", render);

  $("list").addEventListener("click", function (e) {
    var el = e.target.closest("[data-action]");
    if (!el) return;
    var part = parts.filter(function (p) { return p.id === el.getAttribute("data-id"); })[0];
    if (!part) return;
    var action = el.getAttribute("data-action");
    UI.guard(async function () {
      if (action === "inc") await DB.update("parts", part.id, { qty: part.qty + 1 });
      if (action === "dec") await DB.update("parts", part.id, { qty: Math.max(0, part.qty - 1) });
      if (action === "del") await DB.remove("parts", part.id);
      await load();
    });
  });

  await UI.guard(load);
})();
