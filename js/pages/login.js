(function () {
  var t = I18N.t;

  // تطبيق الترجمة على عناصر الصفحة
  function applyLoginI18n() {
    document.title = t("login_title") + " — " + t("app_name");
    document.getElementById("login-title").textContent = "🔧 " + t("login_title");
    document.getElementById("email").placeholder = t("login_email");
    document.getElementById("password").placeholder = t("login_password");
    document.getElementById("btn").textContent = t("login_btn");
    document.getElementById("login-footer").innerHTML =
      t("login_no_account") + ' <a class="link" href="signup.html">' + t("login_register") + "</a>";
  }
  applyLoginI18n();

  var langSel = document.getElementById("login-lang");
  if (langSel) {
    langSel.value = I18N.getLang();
    var lbl = document.getElementById("login-lang-label");
    if (lbl) lbl.textContent = t("language");
    langSel.options[0].text = t("arabic");
    langSel.options[1].text = t("turkish");
    langSel.addEventListener("change", function () {
      if (langSel.value === I18N.getLang()) return;
      I18N.setLang(langSel.value);
      location.reload();
    });
  }

  if (DB.demoMode) {
    location.replace("index.html");
    return;
  }
  var msg = document.getElementById("msg");
  if (DB.fatal) {
    msg.textContent = DB.fatal;
    return;
  }

  DB.auth.getSession().then(function (s) {
    if (s) location.replace("index.html");
  });

  document.getElementById("form").addEventListener("submit", async function (e) {
    e.preventDefault();
    var btn = document.getElementById("btn");
    btn.disabled = true;
    msg.textContent = "";
    try {
      await DB.auth.signIn(document.getElementById("email").value, document.getElementById("password").value);
      location.href = "index.html";
    } catch (err) {
      msg.textContent = err.message;
      btn.disabled = false;
    }
  });
})();
