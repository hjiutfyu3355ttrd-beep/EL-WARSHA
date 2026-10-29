(async function () {
  var page = await UI.init("work-orders");
  if (!page) return;
  var html = UI.html;
  var t = UI.t;

  var customers = [], vehicles = [], techs = [];

  page.innerHTML = html`
    <div class="stack" style="max-width:640px">
      <h2 class="page-title" style="margin:0">${t("work_order_new_title")}</h2>
      <form class="card stack" id="form">
        <div class="field">
          <label>${t("work_order_customer")}</label>
          <select id="customer"></select>
          <small>${t("work_order_no_customers")} — <a class="link" href="customers.html">${t("nav_customers")}</a></small>
        </div>
        <div class="field">
          <label>${t("work_order_vehicle")}</label>
          <select id="vehicle" disabled></select>
        </div>
        <div class="field">
          <label>${t("work_order_tech")}</label>
          <select id="tech"></select>
        </div>
        <div class="field">
          <label>${t("work_order_complaint")}</label>
          <textarea id="complaint"></textarea>
        </div>
        <div class="row">
          <button id="save">${t("work_order_create")}</button>
          <a class="btn secondary" href="work-orders.html">${t("cancel")}</a>
        </div>
      </form>
    </div>`;

  var elCustomer = document.getElementById("customer");
  var elVehicle = document.getElementById("vehicle");
  var elTech = document.getElementById("tech");

  function renderVehicles() {
    var cid = elCustomer.value;
    var list = vehicles.filter(function (v) { return v.customer_id === cid; });
    elVehicle.disabled = !cid;
    elVehicle.innerHTML = html`<option value="">—</option>${list.map(function (v) {
      return UI.option(v.id, v.plate + " — " + (v.make || "") + " " + (v.model || ""));
    })}`;
  }

  await UI.guard(async function () {
    var data = await Promise.all([DB.list("customers"), DB.list("vehicles"), DB.list("technicians")]);
    customers = data[0];
    vehicles = data[1];
    techs = data[2];
    elCustomer.innerHTML = html`<option value="">—</option>${customers.map(function (c) {
      return UI.option(c.id, c.name + " — " + (c.phone || ""));
    })}`;
    elTech.innerHTML = html`<option value="">—</option>${techs.map(function (tech) {
      return UI.option(tech.id, tech.name);
    })}`;
    renderVehicles();
  });

  elCustomer.addEventListener("change", renderVehicles);

  document.getElementById("form").addEventListener("submit", async function (e) {
    e.preventDefault();
    if (!elCustomer.value || !elVehicle.value) {
      UI.flash(t("work_order_no_customers"));
      return;
    }
    var btn = document.getElementById("save");
    btn.disabled = true;
    try {
      var order = await DB.insert("work_orders", {
        customer_id: elCustomer.value,
        vehicle_id: elVehicle.value,
        technician_id: elTech.value || null,
        complaint: document.getElementById("complaint").value.trim(),
        status: "received",
      });
      location.href = "work-order.html?id=" + order.id;
    } catch (err) {
      UI.flash(err.message);
      btn.disabled = false;
    }
  });
})();
