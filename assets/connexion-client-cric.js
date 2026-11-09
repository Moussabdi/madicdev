/* MADIC - Connexion client CRIC : authentification et interface FR/EN. */
(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const translations = {
    brand: ["PORTAIL", "PORTAL"],
    "nav.login": ["Connexion", "Sign in"],
    "nav.signup": ["Inscription", "Register"],
    "nav.space": ["Mon espace client", "My client portal"],
    eyebrow: ["PORTAIL CLIENT DE VOTRE CONSULTANT", "YOUR CONSULTANT’S CLIENT PORTAL"],
    heading: ["Connexion", "Sign in"],
    description: ["Consultez les dossiers associés au cabinet qui vous a invité.", "View the cases associated with the firm that invited you."],
    email: ["Courriel", "Email"],
    password: ["Mot de passe", "Password"],
    submit: ["Se connecter", "Sign in"],
    forgot: ["Mot de passe oublié ?", "Forgot password?"],
    invite: ["Votre consultant vous transmet un lien d’invitation personnel.", "Your consultant will send you a personal invitation link."],
  };
  let lang = "fr";
  try {
    const urlLang = new URLSearchParams(location.search).get("lang");
    const stored = localStorage.getItem("madic_ui_language") || localStorage.getItem("madic-lang");
    lang = (urlLang === "fr" || urlLang === "en") ? urlLang : stored === "en" ? "en" : "fr";
  } catch (_) {}
  const password = $("password");
  const toggle = $("password-toggle");
  const message = $("message");
  const tr = (fr, en) => lang === "en" ? en : fr;
  const msg = (fr, en) => { if (message) message.textContent = tr(fr, en || fr); };

  function render() {
    document.documentElement.lang = lang === "en" ? "en-CA" : "fr-CA";
    document.title = tr("Connexion client CRIC | MADIC", "CRIC client sign in | MADIC");
    document.querySelectorAll("[data-i18n]").forEach(el => {
      const pair = translations[el.dataset.i18n];
      if (pair) el.textContent = pair[lang === "en" ? 1 : 0];
    });
    document.querySelectorAll("[data-fr][data-en]").forEach(el => {
      el.textContent = el.getAttribute("data-" + lang);
    });
    document.querySelectorAll(".madic-lang-switch [data-lang]").forEach(btn => {
      btn.setAttribute("aria-pressed", String(btn.dataset.lang === lang));
    });
    const label = $("password-toggle-label");
    if (password && toggle && label) {
      const hidden = password.type === "password";
      label.textContent = tr(hidden ? "Afficher" : "Masquer", hidden ? "Show" : "Hide");
      toggle.setAttribute("aria-label", tr(hidden ? "Afficher le mot de passe" : "Masquer le mot de passe", hidden ? "Show password" : "Hide password"));
      toggle.setAttribute("aria-pressed", String(!hidden));
    }
    const skip = document.querySelector(".madic8-skip");
    if (skip) skip.textContent = tr("Aller au contenu principal", "Skip to main content");
    const footer = document.querySelector("footer.madic-footer");
    if (footer) footer.setAttribute("aria-label", tr("Pied de page MADIC", "MADIC footer"));
    const footerNav = document.querySelector(".madic-footer-right");
    if (footerNav) footerNav.setAttribute("aria-label", tr("Liens du pied de page", "Footer links"));
    try {
      localStorage.setItem("madic_ui_language", lang);
      localStorage.setItem("madic-lang", lang);
    } catch (_) {}
  }
  document.querySelectorAll(".madic-lang-switch [data-lang]").forEach(btn => {
    btn.addEventListener("click", () => { lang = btn.dataset.lang === "en" ? "en" : "fr"; render(); });
  });
  if (toggle && password) toggle.addEventListener("click", () => {
    password.type = password.type === "password" ? "text" : "password";
    render();
  });
  render();

  const cfg = window.MADIC_CONFIG;
  if (!cfg?.url || !cfg?.anonKey || !window.supabase || typeof window.getMadicSupabase !== "function") {
    msg("Configuration Supabase manquante.", "Supabase configuration is missing.");
    return;
  }
  const db = window.getMadicSupabase();
  const form = $("login");
  if (form) form.addEventListener("submit", async event => {
    event.preventDefault();
    const email = form.elements.namedItem("email").value.trim();
    const pass = form.elements.namedItem("password").value;
    const submit = form.querySelector('[type="submit"]');
    if (submit) submit.disabled = true;
    try {
      const { error } = await db.auth.signInWithPassword({ email, password: pass });
      if (error) { msg(error.message); return; }
      const { data: spaces, error: spacesError } = await db.rpc("madic_my_cric_client_spaces");
      if (spacesError) throw spacesError;
      if (!spaces?.length) {
        msg("Ce compte n’est associé à aucun cabinet CRIC. Contactez votre consultant.", "This account is not associated with any RCIC firm. Contact your consultant.");
        return;
      }
      const { error: logError } = await db.rpc("madic_record_client_portal_login");
      if (logError) console.warn("MADIC : connexion client non journalisée :", logError.message);
      location.replace("dashboard-client-cric.html");
    } catch (error) {
      msg("Vérification des accès impossible : " + error.message, "Unable to verify access: " + error.message);
    } finally { if (submit) submit.disabled = false; }
  });
  $("forgot")?.addEventListener("click", async () => {
    const email = $("email")?.value.trim();
    if (!email) { msg("Indiquez votre courriel.", "Enter your email address."); return; }
    try {
      const { error } = await db.auth.resetPasswordForEmail(email, {
        redirectTo: new URL("reset.html", location.href).href,
      });
      if (error) msg(error.message);
      else msg("Si ce compte existe, un courriel sera envoyé.", "If this account exists, an email will be sent.");
    } catch (error) { msg(error.message); }
  });
})();
