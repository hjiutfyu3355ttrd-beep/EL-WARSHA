UI.page("work-order-new", async function () {
  var page = await UI.init("work-order-new");
  if (!page) return;
  var html = UI.html;

  var customers = [], vehicles = [], techs = [];

  page.innerHTML = html`
    <div class="stack" style="max-width:640px">
      <h2 class="page-title" style="margin:0">${I18N.t("wo_new_title")}</h2>
      <form class="card stack" id="form">
        <div class="field">
          <label>${I18N.t("wo_customer")}</label>
          <select id="customer"></select>
          <small>${I18N.t("wo_no_customer")} <a class="link" href="customers.html">${I18N.t("wo_add_here")}</a></small>
        </div>
        <div class="field">
          <label>${I18N.t("wo_vehicle")}</label>
          <select id="vehicle" disabled></select>
        </div>
        <div class="field">
          <label>${I18N.t("wo_tech")}</label>
          <select id="tech"></select>
        </div>
        <div class="field">
          <label>${I18N.t("ins_payer")}</label>
          <select id="payer">
            <option value="customer">${I18N.t("ins_payer_customer")}</option>
            <option value="insurance">${I18N.t("ins_payer_insurance")}</option>
          </select>
        </div>
        <div class="form-grid" id="ins-fields" style="display:none">
          <div class="field"><label>${I18N.t("ins_company")}</label><input id="ins-company" maxlength="120"></div>
          <div class="field"><label>${I18N.t("ins_claim_no")}</label><input id="ins-claim" maxlength="60"></div>
        </div>
        <div class="form-grid">
          <div class="field"><label>${I18N.t("wo_priority")}</label>
            <select id="priority">${UI.PRIORITIES.map(function (p) { return UI.option(p.key, p.label, p.key === "normal"); })}</select></div>
          <div class="field"><label>${I18N.t("wo_delivery")}</label><input id="expected" type="date"></div>
        </div>
        <div class="field">
          <label>${I18N.t("wo_complaint")}</label>
          <textarea id="complaint"></textarea>
        </div>
        <div class="row">
          <button id="save">${I18N.t("wo_open")}</button>
          <a class="btn secondary" href="work-orders.html">${I18N.t("cancel")}</a>
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
    elVehicle.innerHTML = html`<option value="">— ${I18N.t("choose")} —</option>${list.map(function (v) {
      return UI.option(v.id, v.plate + " — " + v.make + " " + v.model);
    })}`;
  }

  await UI.guard(async function () {
    var data = await Promise.all([DB.list("customers"), DB.list("vehicles"), DB.list("technicians")]);
    customers = data[0];
    vehicles = data[1];
    techs = data[2];
    elCustomer.innerHTML = html`<option value="">— ${I18N.t("choose")} —</option>${customers.map(function (c) {
      return UI.option(c.id, c.name + " — " + c.phone);
    })}`;
    elTech.innerHTML = html`<option value="">— ${I18N.t("none")} —</option>${techs.map(function (t) {
      return UI.option(t.id, t.name);
    })}`;
    renderVehicles();
  });

  elCustomer.addEventListener("change", renderVehicles);
  document.getElementById("payer").addEventListener("change", function () {
    document.getElementById("ins-fields").style.display = this.value === "insurance" ? "" : "none";
    if (this.value === "insurance") document.getElementById("ins-company").focus();
  });

  document.getElementById("form").addEventListener("submit", async function (e) {
    e.preventDefault();
    if (!elCustomer.value || !elVehicle.value) {
      UI.flash(I18N.t("wo_new_pick"));
      return;
    }
    var payer = document.getElementById("payer").value;
    var company = document.getElementById("ins-company").value.trim();
    if (payer === "insurance" && !company) {
      UI.flash(I18N.t("ins_company_required"));
      document.getElementById("ins-company").focus();
      return;
    }
    var btn = document.getElementById("save");
    btn.disabled = true;
    try {
      var row = await DB.insert("work_orders", {
        customer_id: elCustomer.value,
        vehicle_id: elVehicle.value,
        technician_id: elTech.value || null,
        status: "received",
        priority: document.getElementById("priority").value,
        expected_delivery_at: document.getElementById("expected").value
          ? new Date(document.getElementById("expected").value + "T23:59:00").toISOString() : null,
        complaint: document.getElementById("complaint").value.trim(),
        payer_type: payer,
        insurance_company: payer === "insurance" ? company : "",
        insurance_claim_no: payer === "insurance" ? document.getElementById("ins-claim").value.trim() : "",
      });
      UI.go("work-order.html?id=" + encodeURIComponent(row.id));
    } catch (err) {
      UI.flash(err.message);
      btn.disabled = false;
    }
  });
});
