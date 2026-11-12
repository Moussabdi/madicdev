window.MADIC_CONFIG = {
  url: "https://ezijsozitnydhjkxzqem.supabase.co",
  anonKey: "sb_publishable_MQjW5_va454CjZ7weau0iQ_AdJ41yvi",
};
window.getMadicSupabase = function () {
  if (!window.madicSupabaseClient) {
    const cfg = window.MADIC_CONFIG;

    window.madicSupabaseClient = window.supabase.createClient(
      cfg.url,
      cfg.anonKey,
    );
  }

  return window.madicSupabaseClient;
};

/* MADIC : demande initiale après soumission, sans modifier le formulaire existant. */
(async () => {
  "use strict";
  const status = document.getElementById("status"),
    form = document.getElementById("request"),
    send = document.getElementById("send");
  let en = false;
  const say = (fr, eng) => {
    status.textContent = en ? eng : fr;
  };
  const lang = () => {
    document.documentElement.lang = en ? "en" : "fr";
    document
      .querySelectorAll("[data-fr][data-en]")
      .forEach((e) => (e.textContent = e.dataset[en ? "en" : "fr"]));
    document.getElementById("lang").textContent = en ? "Français" : "English";
  };
  document.getElementById("lang").addEventListener("click", () => {
    en = !en;
    lang();
  });
  if (
    !window.MADIC_CONFIG?.url ||
    !window.MADIC_CONFIG?.anonKey ||
    !window.supabase
  ) {
    say("Configuration Supabase manquante.", "Supabase configuration missing.");
    send.disabled = true;
    return;
  }
  const db =
    typeof window.getMadicSupabase === "function"
      ? window.getMadicSupabase()
      : window.supabase.createClient(
          window.MADIC_CONFIG.url,
          window.MADIC_CONFIG.anonKey,
        );
  const {
    data: { user },
    error: authError,
  } = await db.auth.getUser();
  if (authError || !user) {
    location.replace("connexion-client-cric.html");
    return;
  }
  const { data: intake, error: intakeError } = await db
    .from("madic_client_intake")
    .select("status")
    .eq("user_id", user.id)
    .maybeSingle();
  if (intakeError || intake?.status !== "submitted") {
    say(
      "Vous devez d’abord soumettre votre formulaire.",
      "You must submit your form first.",
    );
    send.disabled = true;
    return;
  }
  try {
    const { data, error } = await db
      .from("madic_initial_service_requests")
      .select("service_type,tariff_code")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!error && data?.service_type) {
      const r = form.querySelector('input[value="' + data.service_type + '"]');
      if (r) r.checked = true;
      const t = form.querySelector('input[name="tariff"][value="' + data.tariff_code + '"]');
      if (t) t.checked = true;
    }
  } catch (e) {
    console.warn("MADIC: initial service request unavailable", e);
  }
  const tariffBox = document.getElementById("consultationTariffs");
  const tariffPrices = { hourly: 159, single: 599, couple: 749 };
  const updateTariff = () => {
    const choice = form.querySelector('input[name="service"]:checked');
    tariffBox.hidden = choice?.value !== "consultation";
  };
  form
    .querySelectorAll('input[name="service"]')
    .forEach((r) => r.addEventListener("change", updateTariff));
  updateTariff();
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const choice = form.querySelector('input[name="service"]:checked');
    if (!choice) return;
    const tariff =
      form.querySelector('input[name="tariff"]:checked')?.value || null;
    if (
      choice.value === "consultation" &&
      !Object.hasOwn(tariffPrices, tariff)
    ) {
      say(
        "Veuillez choisir une formule tarifaire.",
        "Please choose a pricing option.",
      );
      return;
    }
    send.disabled = true;
    say("Enregistrement de votre demande…", "Saving your request…");
    try {
      const { error } = await db
        .from("madic_initial_service_requests")
        .upsert(
          {
            user_id: user.id,
            service_type: choice.value,
            tariff_code: choice.value === "consultation" ? tariff : null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" },
        );
      if (error) throw error;
      try {
        sessionStorage.setItem(
          "madic_service_tariff_v1",
          JSON.stringify({
            userId: user.id,
            service: choice.value,
            tariff: choice.value === "consultation" ? tariff : null,
            amount:
              choice.value === "consultation" ? tariffPrices[tariff] : null,
            currency: "USD",
            savedAt: Date.now(),
          }),
        );
      } catch (storageError) {
        console.warn("MADIC: tariff session storage unavailable", storageError);
      }
      location.assign("paiement-service-client.html");
    } catch (err) {
      say(
        "Enregistrement impossible : " + err.message,
        "Unable to save: " + err.message,
      );
    } finally {
      send.disabled = false;
    }
  });
})();


/* MADIC : choix de langue persistant et deconnexion client */
(() => {
  const key = 'madic-lang';
  const langButton = document.getElementById('lang');
  const originalText = { fr: 'English', en: 'Français' };
  const setLanguage = (code) => {
    document.documentElement.lang = code === 'en' ? 'en' : 'fr';
    document.querySelectorAll('[data-fr][data-en]').forEach(el => { el.textContent = el.dataset[code]; });
    if (langButton) langButton.textContent = originalText[code];
    try { localStorage.setItem(key, code); } catch (_) {}
  };
  const saved = (() => { try { return localStorage.getItem(key); } catch (_) { return null; } })();
  if (saved === 'en') { setLanguage('en'); if (langButton) langButton.click(); }
  if (langButton) langButton.addEventListener('click', () => {
    const code = document.documentElement.lang === 'en' ? 'en' : 'fr';
    setLanguage(code);
  });
  document.getElementById('madicSignout')?.addEventListener('click', async () => {
    const btn = document.getElementById('madicSignout');
    btn.disabled = true;
    try {
      const db = window.getMadicSupabase();
      const { error } = await db.auth.signOut();
      if (error) throw error;
      location.assign('connexion-client-cric.html');
    } catch (err) { console.error('MADIC signout', err); btn.disabled = false; }
  });
})();
