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
        <div class="form-grid" id="quick-fields" style="display:none">
          <p class="muted" style="grid-column:1/-1;margin:0">${I18N.t("quick_hint")}</p>
          <div class="field"><label>${I18N.t("plate_no")}</label><input id="q-plate" maxlength="30"></div>
          <div class="field"><label>${I18N.t("make")}</label><input id="q-make" maxlength="60"></div>
          <div class="field"><label>${I18N.t("model")}</label><input id="q-model" maxlength="60"></div>
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
          <div class="field"><label>${I18N.t("ins_owner")}</label><input id="ins-owner" maxlength="120"></div>
          <div class="field"><label>${I18N.t("ins_driver")}</label><input id="ins-driver" maxlength="120"></div>
          <div class="field"><label>${I18N.t("ins_expert")}</label><input id="ins-expert" maxlength="120"></div>
          <div class="field"><label>${I18N.t("ins_expert_no")}</label><input id="ins-expert-no" maxlength="60" dir="ltr"></div>
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

  var QUICK = "__quick__", WALKIN = "__walkin__";
  function renderVehicles() {
    var cid = elCustomer.value;
    var quick = cid === QUICK;
    document.getElementById("quick-fields").style.display = quick ? "" : "none";
    elVehicle.parentNode.style.display = quick ? "none" : "";
    if (quick) return;
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
    elCustomer.innerHTML = html`<option value="">— ${I18N.t("choose")} —</option><option value="__quick__">${I18N.t("quick_customer")}</option>${customers.filter(function (c) { return c.notes !== WALKIN; }).map(function (c) {
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
    var quick = elCustomer.value === QUICK;
    if (quick ? !document.getElementById("q-plate").value.trim() : (!elCustomer.value || !elVehicle.value)) {
      UI.flash(I18N.t(quick ? "quick_plate_required" : "wo_new_pick"));
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
      var custId = elCustomer.value, vehId = elVehicle.value;
      if (quick) {
        // «عميل سريع»: عميل واحد ثابت للورشة (علامته notes = __walkin__) بيشيل السيارات اللي اتسجّلت من غير عميل
        var wk = customers.filter(function (c) { return c.notes === WALKIN; })[0];
        if (!wk) wk = await DB.insert("customers", { name: I18N.t("quick_customer_name"), phone: "", notes: WALKIN });
        var plate = document.getElementById("q-plate").value.trim();
        var veh = vehicles.filter(function (v) { return v.customer_id === wk.id && v.plate === plate; })[0];
        if (!veh) veh = await DB.insert("vehicles", {
          customer_id: wk.id, plate: plate,
          make: document.getElementById("q-make").value.trim(), model: document.getElementById("q-model").value.trim(),
        });
        custId = wk.id; vehId = veh.id;
      }
      var row = await DB.insert("work_orders", {
        customer_id: custId,
        vehicle_id: vehId,
        technician_id: elTech.value || null,
        status: "received",
        priority: document.getElementById("priority").value,
        expected_delivery_at: document.getElementById("expected").value
          ? new Date(document.getElementById("expected").value + "T23:59:00").toISOString() : null,
        complaint: document.getElementById("complaint").value.trim(),
        payer_type: payer,
        insurance_company: payer === "insurance" ? company : "",
        insurance_claim_no: payer === "insurance" ? document.getElementById("ins-claim").value.trim() : "",
        insurance_owner_name: payer === "insurance" ? document.getElementById("ins-owner").value.trim() : "",
        insurance_driver_name: payer === "insurance" ? document.getElementById("ins-driver").value.trim() : "",
        insurance_expert_name: payer === "insurance" ? document.getElementById("ins-expert").value.trim() : "",
        insurance_expert_no: payer === "insurance" ? document.getElementById("ins-expert-no").value.trim() : "",
      });
      UI.go("work-order.html?id=" + encodeURIComponent(row.id));
    } catch (err) {
      UI.flash(err.message);
      btn.disabled = false;
    }
  });
});
