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
          <h2>قوالب الإيميل</h2>
          <p>نصوص جاهزة للإشعارات. المتغيرات: {{customer_name}} {{shop_name}} {{number}} {{plate}} {{total}}</p>
        </div>
      </div>
      <div class="two-col">
        <div class="card" id="list-card"></div>
        <div class="card" id="edit-card">
          <h3 style="margin-top:0" id="edit-title">اختر قالباً للتعديل</h3>
          <form id="et-form" style="display:none">
            <div class="field" style="margin-bottom:10px"><label>الاسم</label><input id="et-name" required></div>
            <div class="field" style="margin-bottom:10px"><label>عنوان الرسالة</label><input id="et-subject" required></div>
            <div class="field" style="margin-bottom:10px"><label>نص الرسالة</label><textarea id="et-body" rows="8" required></textarea></div>
            <div class="row">
              <button type="submit">حفظ</button>
              <button type="button" class="secondary" id="btn-preview">معاينة</button>
            </div>
          </form>
          <div id="preview" class="notice" style="display:none;margin-top:12px;white-space:pre-wrap"></div>
        </div>
      </div>
    </div>`;

  function renderList() {
    $("list-card").innerHTML = html`
      <h3 style="margin-top:0">القوالب</h3>
      ${templates.length === 0
        ? html`<div class="empty">مفيش قوالب</div>`
        : templates.map(function (t) {
            return html`<div class="recent" style="cursor:pointer" data-action="edit" data-id="${t.id}">
              <div><b>${t.name}</b><small>${t.key}</small></div>
              <span class="chip">${editId === t.id ? "مفتوح" : "تعديل"}</span>
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
      customer_name: "أحمد محمود",
      shop_name: "ورشة النور",
      number: "1001",
      plate: "ق ن ع 1234",
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
    $("preview").textContent = "العنوان: " + sub + "\n\n" + body;
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
      UI.flash("تم الحفظ", "success");
      await load();
      openEdit(editId);
    });
  });
  $("btn-preview").addEventListener("click", preview);

  await UI.guard(load);
})();
