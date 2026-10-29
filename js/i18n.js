// ============================================================
// نظام الترجمة (عربي + تركي)
// الاستخدام: I18N.t("key") أو I18N.t("key", {name: "..."})
// ============================================================
(function () {
  "use strict";

  var STORAGE_KEY = "workshop_lang";

  var dict = {
    ar: {
      // عام
      app_name: "نظام الورشة",
      loading: "جارٍ التحميل…",
      save: "حفظ",
      add: "إضافة",
      delete: "حذف",
      edit: "تعديل",
      cancel: "إلغاء",
      search: "بحث",
      back: "رجوع",
      print: "طباعة",
      yes: "نعم",
      no: "لا",
      none: "—",
      actions: "",
      signout: "تسجيل الخروج",
      admin: "الإدارة",
      language: "اللغة",
      arabic: "العربية",
      turkish: "التركية",
      currency: "ج.م",

      // تنقل
      nav_dashboard: "الرئيسية",
      nav_work_orders: "أوامر الشغل",
      nav_customers: "العملاء والسيارات",
      nav_inventory: "المخزون",
      nav_reports: "التقارير",
      nav_settings: "الإعدادات",

      // حالات أمر الشغل
      status_received: "استلام",
      status_inspecting: "فحص",
      status_awaiting_approval: "انتظار موافقة العميل",
      status_in_progress: "تحت التنفيذ",
      status_ready: "جاهزة",
      status_delivered: "تم التسليم",
      status_cancelled: "ملغي",

      // طرق الدفع
      pay_cash: "نقدي",
      pay_card: "بطاقة",
      pay_instapay: "إنستاباي",
      pay_wallet: "محفظة (فودافون كاش)",
      pay_transfer: "تحويل بنكي",

      // دخول / تسجيل
      login_title: "دخول نظام الورشة",
      login_email: "البريد الإلكتروني",
      login_password: "كلمة المرور",
      login_btn: "دخول",
      login_no_account: "ماعندكش حساب؟",
      login_register: "سجّل ورشتك",
      signup_title: "سجّل ورشتك",
      signup_shop: "اسم الورشة",
      signup_password_hint: "كلمة المرور (6 أحرف على الأقل)",
      signup_btn: "إنشاء الحساب",
      signup_have_account: "عندك حساب؟",
      signup_login: "دخول",
      signup_confirm: "تم إنشاء الحساب. افتح بريدك وأكّد الإيميل، وبعدها سجّل دخولك.",
      signup_go_login: "الذهاب لتسجيل الدخول",

      // Demo
      demo_notice: "وضع تجريبي: البيانات محفوظة في متصفحك فقط ومفيش اتصال بـ Supabase.",
      demo_reset: "إعادة ضبط البيانات التجريبية",

      // الرئيسية
      dashboard_title: "الرئيسية",
      dashboard_new_order: "+ أمر شغل جديد",
      dashboard_open_orders: "أوامر شغل مفتوحة",
      dashboard_ready: "سيارات جاهزة للتسليم",
      dashboard_revenue_today: "إيراد اليوم",
      dashboard_low_stock: "نواقص المخزون",
      dashboard_recent: "آخر أوامر الشغل",
      dashboard_no_orders: "مفيش أوامر شغل لسه",
      col_number: "رقم",
      col_customer: "العميل",
      col_vehicle: "السيارة",
      col_status: "الحالة",
      low_stock_prefix: "نواقص:",

      // العملاء
      customers_title: "العملاء والسيارات",
      customers_new: "عميل جديد",
      customers_name: "الاسم",
      customers_phone: "الموبايل",
      customers_notes: "ملاحظات",
      customers_add: "إضافة عميل",
      customers_search: "بحث بالاسم أو الموبايل",
      customers_empty: "مفيش عملاء",
      customers_vehicles: "السيارات",
      customers_vehicles_of: "سيارات",
      customers_plate: "اللوحة",
      customers_type: "النوع",
      customers_year: "السنة",
      customers_odometer: "العداد",
      customers_add_vehicle: "إضافة سيارة",
      customers_no_vehicles: "مفيش سيارات",
      customers_vehicle_make: "الماركة / النوع",
      customers_vehicle_plate: "رقم اللوحة",
      customers_vehicle_year: "سنة الصنع",
      customers_vehicle_odometer: "العداد (كم)",

      // أوامر الشغل
      work_orders_title: "أوامر الشغل",
      work_orders_new: "+ أمر شغل جديد",
      work_orders_search: "بحث برقم الأمر أو العميل أو اللوحة",
      work_orders_empty: "مفيش أوامر شغل",
      work_orders_filter_all: "الكل",
      work_orders_filter_open: "مفتوحة",
      work_orders_filter_closed: "مغلقة",
      col_date: "التاريخ",
      col_total: "الإجمالي",

      // أمر شغل جديد
      work_order_new_title: "أمر شغل جديد",
      work_order_select_customer: "اختر العميل",
      work_order_select_vehicle: "اختر السيارة",
      work_order_complaint: "شكوى العميل",
      work_order_create: "إنشاء أمر الشغل",
      work_order_no_customers: "لازم تضيف عميل وسيارة الأول",

      // تفاصيل أمر الشغل
      work_order_title: "أمر شغل",
      work_order_info: "بيانات الأمر",
      work_order_customer: "العميل",
      work_order_vehicle: "السيارة",
      work_order_status: "الحالة",
      work_order_complaint_label: "الشكوى",
      work_order_items: "بنود الشغل",
      work_order_add_item: "إضافة بند",
      work_order_item_desc: "الوصف",
      work_order_item_qty: "الكمية",
      work_order_item_price: "السعر",
      work_order_item_type: "النوع",
      work_order_type_labor: "عمالة",
      work_order_type_part: "قطعة",
      work_order_type_other: "أخرى",
      work_order_no_items: "مفيش بنود",
      work_order_payments: "المدفوعات",
      work_order_add_payment: "إضافة دفعة",
      work_order_amount: "المبلغ",
      work_order_method: "طريقة الدفع",
      work_order_no_payments: "مفيش مدفوعات",
      work_order_summary: "الملخص",
      work_order_subtotal: "المجموع",
      work_order_paid: "المدفوع",
      work_order_remaining: "المتبقي",
      work_order_tech: "الفني",
      work_order_select_tech: "اختر فني (اختياري)",
      work_order_notes: "ملاحظات داخلية",
      work_order_update_status: "تحديث الحالة",
      work_order_save_notes: "حفظ الملاحظات",

      // المخزون
      inventory_title: "المخزون",
      inventory_new: "قطعة جديدة",
      inventory_name: "اسم القطعة",
      inventory_sku: "الكود",
      inventory_qty: "الكمية",
      inventory_min: "حد الطلب",
      inventory_cost: "سعر الشراء",
      inventory_price: "سعر البيع",
      inventory_add: "إضافة قطعة",
      inventory_search: "بحث بالاسم أو الكود",
      inventory_empty: "مفيش أصناف",
      inventory_low: "فيه {n} صنف وصل لحد الطلب أو أقل.",
      col_part: "القطعة",
      col_sku: "الكود",
      col_qty: "الكمية",
      col_min: "حد الطلب",
      col_cost: "الشراء",
      col_sell: "البيع",

      // التقارير
      reports_title: "التقارير",
      reports_revenue: "الإيرادات",
      reports_orders: "أوامر الشغل",
      reports_payments: "المدفوعات",
      reports_period: "الفترة",
      reports_today: "اليوم",
      reports_week: "آخر 7 أيام",
      reports_month: "هذا الشهر",
      reports_all: "الكل",
      reports_total_revenue: "إجمالي الإيراد",
      reports_orders_count: "عدد الأوامر",
      reports_avg: "متوسط الأمر",
      reports_by_method: "حسب طريقة الدفع",
      reports_by_status: "حسب الحالة",
      reports_no_data: "مفيش بيانات",

      // الإعدادات
      settings_title: "الإعدادات",
      settings_techs: "الفنيين",
      settings_tech_name: "اسم الفني",
      settings_tech_pct: "نسبة العمولة %",
      settings_tech_add: "إضافة فني",
      settings_techs_empty: "مفيش فنيين",
      settings_coming: "قريباً",
      settings_coming_text: "بيانات الورشة والشعار، وإدارة الموظفين وصلاحياتهم (مالك / موظف / فني)، وتصميم الفاتورة.",
      settings_lang: "لغة الواجهة",
      settings_lang_hint: "اختر لغة العرض. التغيير يتطبق فورًا.",

      // الإدارة
      admin_title: "إدارة المنصة",
      admin_shops: "الورش",
      admin_shop_name: "اسم الورشة",
      admin_owner: "المالك",
      admin_status: "الحالة",
      admin_expires: "تنتهي في",
      admin_active: "نشطة",
      admin_suspended: "موقوفة",
      admin_suspend: "إيقاف",
      admin_activate: "تفعيل",
      admin_extend: "تمديد 30 يوم",
      admin_empty: "مفيش ورش",
    },

    tr: {
      // Genel
      app_name: "Atölye Sistemi",
      loading: "Yükleniyor…",
      save: "Kaydet",
      add: "Ekle",
      delete: "Sil",
      edit: "Düzenle",
      cancel: "İptal",
      search: "Ara",
      back: "Geri",
      print: "Yazdır",
      yes: "Evet",
      no: "Hayır",
      none: "—",
      actions: "",
      signout: "Çıkış yap",
      admin: "Yönetim",
      language: "Dil",
      arabic: "Arapça",
      turkish: "Türkçe",
      currency: "EGP",

      // Navigasyon
      nav_dashboard: "Ana Sayfa",
      nav_work_orders: "İş Emirleri",
      nav_customers: "Müşteriler ve Araçlar",
      nav_inventory: "Stok",
      nav_reports: "Raporlar",
      nav_settings: "Ayarlar",

      // İş emri durumları
      status_received: "Teslim alındı",
      status_inspecting: "İnceleme",
      status_awaiting_approval: "Müşteri onayı bekleniyor",
      status_in_progress: "Devam ediyor",
      status_ready: "Hazır",
      status_delivered: "Teslim edildi",
      status_cancelled: "İptal",

      // Ödeme yöntemleri
      pay_cash: "Nakit",
      pay_card: "Kart",
      pay_instapay: "InstaPay",
      pay_wallet: "Cüzdan (Vodafone Cash)",
      pay_transfer: "Banka havalesi",

      // Giriş / Kayıt
      login_title: "Atölye Sistemine Giriş",
      login_email: "E-posta",
      login_password: "Şifre",
      login_btn: "Giriş",
      login_no_account: "Hesabınız yok mu?",
      login_register: "Atölyenizi kaydedin",
      signup_title: "Atölyenizi kaydedin",
      signup_shop: "Atölye adı",
      signup_password_hint: "Şifre (en az 6 karakter)",
      signup_btn: "Hesap oluştur",
      signup_have_account: "Zaten hesabınız var mı?",
      signup_login: "Giriş",
      signup_confirm: "Hesap oluşturuldu. E-postanızı açıp onaylayın, ardından giriş yapın.",
      signup_go_login: "Giriş sayfasına git",

      // Demo
      demo_notice: "Demo modu: veriler yalnızca tarayıcınızda saklanır, Supabase bağlantısı yok.",
      demo_reset: "Demo verilerini sıfırla",

      // Ana sayfa
      dashboard_title: "Ana Sayfa",
      dashboard_new_order: "+ Yeni iş emri",
      dashboard_open_orders: "Açık iş emirleri",
      dashboard_ready: "Teslime hazır araçlar",
      dashboard_revenue_today: "Bugünkü gelir",
      dashboard_low_stock: "Düşük stok",
      dashboard_recent: "Son iş emirleri",
      dashboard_no_orders: "Henüz iş emri yok",
      col_number: "No",
      col_customer: "Müşteri",
      col_vehicle: "Araç",
      col_status: "Durum",
      low_stock_prefix: "Düşük stok:",

      // Müşteriler
      customers_title: "Müşteriler ve Araçlar",
      customers_new: "Yeni müşteri",
      customers_name: "Ad",
      customers_phone: "Telefon",
      customers_notes: "Notlar",
      customers_add: "Müşteri ekle",
      customers_search: "Ad veya telefon ile ara",
      customers_empty: "Müşteri yok",
      customers_vehicles: "Araçlar",
      customers_vehicles_of: "Araçları",
      customers_plate: "Plaka",
      customers_type: "Tip",
      customers_year: "Yıl",
      customers_odometer: "Kilometre",
      customers_add_vehicle: "Araç ekle",
      customers_no_vehicles: "Araç yok",
      customers_vehicle_make: "Marka / Model",
      customers_vehicle_plate: "Plaka no",
      customers_vehicle_year: "Üretim yılı",
      customers_vehicle_odometer: "Kilometre",

      // İş emirleri
      work_orders_title: "İş Emirleri",
      work_orders_new: "+ Yeni iş emri",
      work_orders_search: "Emir no, müşteri veya plaka ile ara",
      work_orders_empty: "İş emri yok",
      work_orders_filter_all: "Tümü",
      work_orders_filter_open: "Açık",
      work_orders_filter_closed: "Kapalı",
      col_date: "Tarih",
      col_total: "Toplam",

      // Yeni iş emri
      work_order_new_title: "Yeni iş emri",
      work_order_select_customer: "Müşteri seç",
      work_order_select_vehicle: "Araç seç",
      work_order_complaint: "Müşteri şikayeti",
      work_order_create: "İş emri oluştur",
      work_order_no_customers: "Önce müşteri ve araç eklemelisiniz",

      // İş emri detayı
      work_order_title: "İş Emri",
      work_order_info: "Emir bilgileri",
      work_order_customer: "Müşteri",
      work_order_vehicle: "Araç",
      work_order_status: "Durum",
      work_order_complaint_label: "Şikayet",
      work_order_items: "İş kalemleri",
      work_order_add_item: "Kalem ekle",
      work_order_item_desc: "Açıklama",
      work_order_item_qty: "Miktar",
      work_order_item_price: "Fiyat",
      work_order_item_type: "Tür",
      work_order_type_labor: "İşçilik",
      work_order_type_part: "Parça",
      work_order_type_other: "Diğer",
      work_order_no_items: "Kalem yok",
      work_order_payments: "Ödemeler",
      work_order_add_payment: "Ödeme ekle",
      work_order_amount: "Tutar",
      work_order_method: "Ödeme yöntemi",
      work_order_no_payments: "Ödeme yok",
      work_order_summary: "Özet",
      work_order_subtotal: "Ara toplam",
      work_order_paid: "Ödenen",
      work_order_remaining: "Kalan",
      work_order_tech: "Teknisyen",
      work_order_select_tech: "Teknisyen seç (isteğe bağlı)",
      work_order_notes: "İç notlar",
      work_order_update_status: "Durumu güncelle",
      work_order_save_notes: "Notları kaydet",

      // Stok
      inventory_title: "Stok",
      inventory_new: "Yeni parça",
      inventory_name: "Parça adı",
      inventory_sku: "Kod",
      inventory_qty: "Miktar",
      inventory_min: "Min. stok",
      inventory_cost: "Alış fiyatı",
      inventory_price: "Satış fiyatı",
      inventory_add: "Parça ekle",
      inventory_search: "Ad veya kod ile ara",
      inventory_empty: "Parça yok",
      inventory_low: "{n} ürün min. stok seviyesine ulaştı veya altına düştü.",
      col_part: "Parça",
      col_sku: "Kod",
      col_qty: "Miktar",
      col_min: "Min. stok",
      col_cost: "Alış",
      col_sell: "Satış",

      // Raporlar
      reports_title: "Raporlar",
      reports_revenue: "Gelirler",
      reports_orders: "İş emirleri",
      reports_payments: "Ödemeler",
      reports_period: "Dönem",
      reports_today: "Bugün",
      reports_week: "Son 7 gün",
      reports_month: "Bu ay",
      reports_all: "Tümü",
      reports_total_revenue: "Toplam gelir",
      reports_orders_count: "Emir sayısı",
      reports_avg: "Ortalama emir",
      reports_by_method: "Ödeme yöntemine göre",
      reports_by_status: "Duruma göre",
      reports_no_data: "Veri yok",

      // Ayarlar
      settings_title: "Ayarlar",
      settings_techs: "Teknisyenler",
      settings_tech_name: "Teknisyen adı",
      settings_tech_pct: "Komisyon %",
      settings_tech_add: "Teknisyen ekle",
      settings_techs_empty: "Teknisyen yok",
      settings_coming: "Yakında",
      settings_coming_text: "Atölye bilgileri ve logo, personel yönetimi ve yetkiler (sahip / çalışan / teknisyen), fatura tasarımı.",
      settings_lang: "Arayüz dili",
      settings_lang_hint: "Görüntüleme dilini seçin. Değişiklik hemen uygulanır.",

      // Yönetim
      admin_title: "Platform yönetimi",
      admin_shops: "Atölyeler",
      admin_shop_name: "Atölye adı",
      admin_owner: "Sahip",
      admin_status: "Durum",
      admin_expires: "Bitiş",
      admin_active: "Aktif",
      admin_suspended: "Askıda",
      admin_suspend: "Askıya al",
      admin_activate: "Aktifleştir",
      admin_extend: "30 gün uzat",
      admin_empty: "Atölye yok",
    },
  };

  function getLang() {
    var stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "ar" || stored === "tr") return stored;
    return "ar";
  }

  function setLang(lang) {
    if (lang !== "ar" && lang !== "tr") return;
    localStorage.setItem(STORAGE_KEY, lang);
    applyDir(lang);
  }

  function applyDir(lang) {
    var html = document.documentElement;
    if (lang === "tr") {
      html.lang = "tr";
      html.dir = "ltr";
    } else {
      html.lang = "ar";
      html.dir = "rtl";
    }
  }

  function t(key, params) {
    var lang = getLang();
    var str = (dict[lang] && dict[lang][key]) || (dict.ar && dict.ar[key]) || key;
    if (params) {
      Object.keys(params).forEach(function (k) {
        str = str.replace(new RegExp("\\{" + k + "\\}", "g"), params[k]);
      });
    }
    return str;
  }

  // تطبيق الاتجاه فور تحميل الملف
  applyDir(getLang());

  window.I18N = {
    t: t,
    getLang: getLang,
    setLang: setLang,
    applyDir: applyDir,
  };
})();
