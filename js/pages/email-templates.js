(async function () {
  var page = await UI.init("email-templates");
  if (!page) return;
  var html = UI.html;
  var templates = [];
  var editId = "";
  var $ = function (id) { return document.getElementById(id); };

  page.innerHTML = html`
    <div class="stack">
      <div class="head-row">
        <div>
          <h2>${I18N.t("et_title")}</h2>
          <p>${I18N.t("et_sub2")}</p>
        </div>
      </div>
      <div class="two-col">
        <div class="card" id="list-card"></div>
        <div class="card" id="edit-card">
          <h3 style="margin-top:0" id="edit-title">${I18N.t("et_pick")}</h3>
          <form id="et-form" style="display:none">
            <div class="field" style="margin-bottom:10px"><label>${I18N.t("name")}</label><input id="et-name" required></div>
            <div class="field" style="margin-bottom:10px"><label>${I18N.t("et_subject")}</label><input id="et-subject" required></div>
            <div class="field" style="margin-bottom:10px"><label>${I18N.t("et_body")}</label><textarea id="et-body" rows="8" required></textarea></div>
            <div class="row">
              <button type="submit">${I18N.t("save")}</button>
              <button type="button" class="secondary" id="btn-preview">${I18N.t("preview")}</button>
            </div>
          </form>
          <div id="preview" class="notice" style="display:none;margin-top:12px;white-space:pre-wrap"></div>
        </div>
      </div>
    </div>`;

  function renderList() {
    $("list-card").innerHTML = html`
      <h3 style="margin-top:0">${I18N.t("templates")}</h3>
      ${templates.length === 0
        ? html`<div class="empty">${I18N.t("empty_templates")}</div>`
        : templates.map(function (t) {
            return html`<div class="recent" style="cursor:pointer" data-action="edit" data-id="${t.id}">
              <div><b>${t.name}</b><small>${t.key}</small></div>
              <span class="chip">${editId === t.id ? I18N.t("opened") : I18N.t("edit")}</span>
            </div>`;
          })}`;
  }

  function openEdit(id) {
    var t = templates.filter(function (x) { return x.id === id; })[0];
    if (!t) return;
    editId = id;
    $("edit-title").textContent = t.name;
    $("et-form").style.display = "";
    $("et-name").value = t.name;
    $("et-subject").value = t.subject;
    $("et-body").value = t.body;
    $("preview").style.display = "none";
    renderList();
  }

  function preview() {
    var map = {
      customer_name: "Ahmet",
      shop_name: "Atölye",
      number: "1001",
      plate: "34 ABC 123",
      total: "850",
    };
    var sub = $("et-subject").value;
    var body = $("et-body").value;
    Object.keys(map).forEach(function (k) {
      var re = new RegExp("\\{\\{" + k + "\\}\\}", "g");
      sub = sub.replace(re, map[k]);
      body = body.replace(re, map[k]);
    });
    $("preview").style.display = "";
    $("preview").textContent = I18N.t("preview_subject") + " " + sub + "\n\n" + body;
  }

  async function load() {
    templates = await DB.list("email_templates");
    renderList();
  }

  page.addEventListener("click", function (e) {
    var row = e.target.closest("[data-action='edit']");
    if (row) openEdit(row.getAttribute("data-id"));
  });
  $("et-form").addEventListener("submit", function (e) {
    e.preventDefault();
    if (!editId) return;
    UI.guard(async function () {
      await DB.update("email_templates", editId, {
        name: $("et-name").value.trim(),
        subject: $("et-subject").value.trim(),
        body: $("et-body").value,
      });
      UI.flash(I18N.t("saved_ok2"), "success");
      await load();
      openEdit(editId);
    });
  });
  $("btn-preview").addEventListener("click", preview);

  await UI.guard(load);
})();
