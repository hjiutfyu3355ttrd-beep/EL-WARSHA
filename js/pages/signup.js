(function () {
  var t = I18N.t;

  function applySignupI18n() {
    document.title = t("signup_title") + " — " + t("app_name");
    document.getElementById("signup-title").textContent = t("signup_title");
    document.getElementById("shop").placeholder = t("signup_shop");
    document.getElementById("email").placeholder = t("login_email");
    document.getElementById("password").placeholder = t("signup_password_hint");
    document.getElementById("btn").textContent = t("signup_btn");
    document.getElementById("signup-confirm").textContent = t("signup_confirm");
    document.getElementById("signup-go-login").textContent = t("signup_go_login");
    document.getElementById("signup-footer").innerHTML =
      t("signup_have_account") + ' <a class="link" href="login.html">' + t("signup_login") + "</a>";
  }
  applySignupI18n();

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

  document.getElementById("form").addEventListener("submit", async function (e) {
    e.preventDefault();
    var btn = document.getElementById("btn");
    btn.disabled = true;
    msg.textContent = "";
    try {
      var session = await DB.auth.signUp(
        document.getElementById("email").value,
        document.getElementById("password").value,
        document.getElementById("shop").value.trim()
      );
      if (session) {
        location.href = "index.html";
      } else {
        document.getElementById("form").style.display = "none";
        document.getElementById("info").style.display = "block";
      }
    } catch (err) {
      msg.textContent = err.message;
      btn.disabled = false;
    }
  });
})();
