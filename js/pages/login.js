(function () {
  // في الوضع التجريبي مفيش دخول — نروح للرئيسية
  if (DB.demoMode) {
    location.replace("index.html");
    return;
  }
  var msg = document.getElementById("msg");
  if (DB.fatal) {
    msg.textContent = DB.fatal;
    return;
  }

  function applyLoginI18n() {
    if (!window.I18N) return;
    var lang = I18N.getLang();
    var sel = document.getElementById("login-lang");
    if (sel) sel.value = lang;
    var map = [
      ["lbl-lang", "language"], ["login-h2", "login_title"], ["login-sub", "login_sub"],
      ["lbl-phone", "login_phone"], ["lbl-pass", "login_password"], ["btn", "login_btn"],
      ["login-reg", "login_register"]
    ];
    map.forEach(function (m) {
      var el = document.getElementById(m[0]);
      if (el) el.textContent = I18N.t(m[1]);
    });
    var foot = document.getElementById("login-foot");
    if (foot) {
      foot.innerHTML = I18N.t("login_no_account") + ' <a class="link" href="signup.html" id="login-reg">' + I18N.t("login_register") + '</a>';
    }
    var h1 = document.querySelector(".login-hero h1");
    if (h1) h1.textContent = I18N.t("app_name");
    var hp = document.querySelector(".login-hero p");
    if (hp) hp.textContent = I18N.t("login_hero");
  }
  applyLoginI18n();
  var langSel = document.getElementById("login-lang");
  if (langSel) {
    langSel.addEventListener("change", function () {
      I18N.setLang(langSel.value);
      location.reload();
    });
  }


  // لو مسجّل دخول بالفعل
  DB.auth.getSession().then(function (s) {
    if (s) location.replace("index.html");
  });

  document.getElementById("form").addEventListener("submit", async function (e) {
    e.preventDefault();
    var btn = document.getElementById("btn");
    btn.disabled = true;
    msg.textContent = "";
    try {
      await DB.auth.signIn(document.getElementById("phone").value, document.getElementById("password").value);
      location.href = "index.html";
    } catch (err) {
      msg.textContent = err.message;
      btn.disabled = false;
    }
  });
})();
