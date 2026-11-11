(() => {
  "use strict";
  const dict = {
    "signup.client.title": {
      fr: "Accès client sur invitation | MADIC PORTAIL",
      en: "Invitation-only client access | MADIC PORTAL",
    },
    "signup.client.navlogin": { fr: "Connexion client", en: "Client sign-in" },
    "signup.client.navcric": { fr: "Accès CRIC", en: "RCIC access" },
    "signup.client.eyebrow": { fr: "Espace client", en: "Client portal" },
    "signup.client.heading": {
      fr: "Accès sur invitation uniquement",
      en: "Invitation-only access",
    },
    "signup.client.p1": {
      fr: "La création et l’activation de votre accès sont gérées exclusivement par votre consultant réglementé en immigration canadienne (CRIC).",
      en: "Your account access is created and activated exclusively by your Regulated Canadian Immigration Consultant (RCIC).",
    },
    "signup.client.p2": {
      fr: "Pour obtenir votre invitation, veuillez communiquer directement avec votre CRIC.",
      en: "To receive an invitation, please contact your RCIC directly.",
    },
    "signup.client.existing": {
      fr: "Vous disposez déjà d’un accès activé ?",
      en: "Already have an active account?",
    },
    "signup.client.signin": { fr: "Connectez-vous", en: "Sign in" },
    "signup.client.footer": {
      fr: "© MADIC PORTAIL · Plateforme professionnelle",
      en: "© MADIC PORTAL · Professional platform",
    },
    "signup.cric.title": {
      fr: "Inscription CRIC | MADIC",
      en: "RCIC registration | MADIC",
    },
    "signup.cric.brand": { fr: "PROFESSIONNEL", en: "PROFESSIONAL" },
    "signup.cric.nav": { fr: "Connexion CRIC", en: "RCIC sign-in" },
    "signup.cric.eyebrow": {
      fr: "ESPACE PROFESSIONNEL",
      en: "PROFESSIONAL PORTAL",
    },
    "signup.cric.heading": {
      fr: "Demande d’accès CRIC",
      en: "RCIC access request",
    },
    "signup.cric.description": {
      fr: "Cette page publique transmet uniquement une demande de vérification du permis. Aucun compte professionnel n’est créé ici. MADIC examine ensuite la demande dans son espace administratif.",
      en: "This public page only submits a request for licence verification. No professional account is created here. MADIC subsequently reviews the request through its administrative portal.",
    },
    "signup.cric.name": { fr: "Nom complet", en: "Full name" },
    "signup.cric.license": {
      fr: "Numéro de permis CRIC",
      en: "RCIC licence number",
    },
    "signup.cric.register": {
      fr: "registre officiel du CCIC",
      en: "official CICC public register",
    },
    "signup.cric.verifyintro": {
      fr: "Vérification du nom, du numéro et du statut professionnel dans le",
      en: "Verify the name, licence number and professional status in the",
    },
    "signup.cric.verify": {
      fr: "Vérifier mon permis CRIC",
      en: "Verify my RCIC licence",
    },
    "signup.cric.status": {
      fr: "Vérifier le statut de ma demande",
      en: "Check my request status",
    },
    "common.brand.portal": { fr: "PORTAIL", en: "PORTAL" },
    "client.login.madic_portail_acc_s_client_sur_invitation": {
      fr: "© MADIC PORTAIL · Accès client sur invitation",
      en: "© MADIC PORTAL · Invitation-only client access",
    },
    "client.login.acc_dez_vos_dossiers_et_vos_documents": {
      fr: "Accédez à vos dossiers et à vos documents.",
      en: "Access your cases and documents.",
    },
    "client.login.mot_de_passe_oubli": {
      fr: "Mot de passe oublié ?",
      en: "Forgot password?",
    },
    "client.login.espace_client_madic": {
      fr: "Espace client MADIC",
      en: "MADIC client portal",
    },
    "client.login.acc_s_professionnel": {
      fr: "Accès professionnel",
      en: "Professional access",
    },
    "client.login.consultant_cric": {
      fr: "Consultant CRIC ?",
      en: "RCIC consultant?",
    },
    "client.login.mot_de_passe": { fr: "Mot de passe", en: "Password" },
    "client.login.se_connecter": { fr: "Se connecter", en: "Sign in" },
    "client.login.acc_s_cric": { fr: "Accès CRIC", en: "RCIC access" },
    "client.login.mon_espace": { fr: "Mon espace", en: "My portal" },
    "client.login.connexion": { fr: "Connexion", en: "Login" },
    "client.login.courriel": { fr: "Courriel", en: "Email" },
    "cric.login.mad_immigration_canadienne_portail_client_s_curis": {
      fr: "© MAD Immigration Canadienne · Portail client sécurisé",
      en: "© MAD Immigration Canadienne · Secure client portal",
    },
    "cric.login.demander_un_acc_s_professionnel": {
      fr: "Demander un accès professionnel",
      en: "Request professional access",
    },
    "cric.login.espace_professionnel_cric": {
      fr: "ESPACE PROFESSIONNEL CRIC",
      en: "RCIC PROFESSIONAL PORTAL",
    },
    "cric.login.nouveau_consultant_cric": {
      fr: "Nouveau consultant CRIC ?",
      en: "New RCIC consultant?",
    },
    "cric.login.mot_de_passe_oubli": {
      fr: "Mot de passe oublié ?",
      en: "Forgot password?",
    },
    "cric.login.mon_espace_cric": {
      fr: "Mon espace CRIC",
      en: "My RCIC portal",
    },
    "cric.login.mot_de_passe": { fr: "Mot de passe", en: "Password" },
    "cric.login.se_connecter": { fr: "Se connecter", en: "Sign in" },
    "cric.login.inscription": { fr: "Inscription", en: "Register" },
    "cric.login.connexion": { fr: "Connexion", en: "Login" },
    "cric.login.courriel": { fr: "Courriel", en: "Email" },
    "common.password.show": { fr: "Afficher", en: "Show" },
    "common.password.hide": { fr: "Masquer", en: "Hide" },
    "client.notice": {
      fr: "Accès client sur invitation uniquement. Votre consultant CRIC doit vous inviter et activer votre accès avant votre première connexion.",
      en: "Client access is by invitation only. Your RCIC consultant must invite you and activate your access before your first sign-in.",
    },
    "cric.description": {
      fr: "Connectez-vous à votre espace professionnel et gérez uniquement les clients de votre cabinet.",
      en: "Sign in to your professional portal and manage only your firm’s clients.",
    },
  };
  const supported = new Set(["fr", "en"]);
  let language = "fr";
  try {
    const stored = localStorage.getItem("madic_ui_language");
    if (supported.has(stored)) language = stored;
  } catch {}
  function apply(lang) {
    language = supported.has(lang) ? lang : "fr";
    document.documentElement.lang = language === "fr" ? "fr-CA" : "en-CA";
    const pageTitle = document.querySelector("title[data-i18n]");
    if (pageTitle) {
      const t = dict[pageTitle.dataset.i18n];
      if (t) document.title = t[language];
    }
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const t = dict[el.getAttribute("data-i18n")];
      if (t && t[language] !== undefined) el.textContent = t[language];
    });
    document
      .querySelectorAll(".madic-lang-switch [data-lang]")
      .forEach((el) =>
        el.setAttribute("aria-pressed", String(el.dataset.lang === language)),
      );
    updatePasswordToggle();
    try {
      localStorage.setItem("madic_ui_language", language);
    } catch {}
  }
  function updatePasswordToggle() {
    const button = document.getElementById("password-toggle");
    const input = document.getElementById("password");
    if (!button || !input) return;
    const visible = input.type === "text";
    const key = visible ? "common.password.hide" : "common.password.show";
    const label = dict[key][language];
    const span = button.querySelector("span");
    if (span) {
      span.dataset.i18n = key;
      span.textContent = label;
    }
    button.setAttribute("aria-pressed", String(visible));
    button.setAttribute(
      "aria-label",
      visible
        ? language === "fr"
          ? "Masquer le mot de passe"
          : "Hide password"
        : language === "fr"
          ? "Afficher le mot de passe"
          : "Show password",
    );
  }
  function init() {
    const button = document.getElementById("password-toggle");
    const input = document.getElementById("password");
    if (button && input)
      button.addEventListener("click", () => {
        input.type = input.type === "password" ? "text" : "password";
        updatePasswordToggle();
      });
    document
      .querySelectorAll(".madic-lang-switch [data-lang]")
      .forEach((el) =>
        el.addEventListener("click", () => apply(el.dataset.lang)),
      );
    apply(language);
  }
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();


/* Footer commun MADIC : traduction des libellés sur les pages sans gestionnaire FR/EN. */
(function(){"use strict";function apply(lang){lang=lang==="en"?"en":"fr";document.querySelectorAll(".madic-footer [data-fr][data-en]").forEach(function(el){el.textContent=el.getAttribute("data-"+lang);});}var lang="fr";try{lang=new URLSearchParams(location.search).get("lang")||localStorage.getItem("madic-lang")||"fr";}catch(e){}apply(lang);window.addEventListener("storage",function(e){if(e.key==="madic-lang")apply(e.newValue);});})();


/* Synchronisation de la traduction du pied de page avec les boutons FR/EN. */
(function(){"use strict";function update(lang){lang=lang==="en"?"en":"fr";document.querySelectorAll(".madic-footer [data-fr][data-en]").forEach(function(el){el.textContent=el.getAttribute("data-"+lang);});try{localStorage.setItem("madic-lang",lang);}catch(e){}}function init(){var lang="fr";try{lang=localStorage.getItem("madic_ui_language")||"fr";}catch(e){}update(lang);document.querySelectorAll(".madic-lang-switch [data-lang]").forEach(function(button){button.addEventListener("click",function(){update(button.dataset.lang);});});}if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});else init();})();
