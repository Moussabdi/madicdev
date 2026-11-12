/* Source : config.js */
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

/* Source : cric-registration(2).js */
(() => {
  "use strict";
  const cfg = window.MADIC_CONFIG;
  const msg = document.getElementById("cricMessage");
  // Fenetre modale legere, accessible et refermable, sans changement HTML.
  let popup = null;
  let popupText = null;
  let popupTitle = null;
  let previousFocus = null;
  const closePopup = () => {
    if (!popup || popup.hidden) return;
    popup.hidden = true;
    document.body.style.overflow = popup.dataset.previousOverflow || "";
    if (previousFocus && previousFocus.isConnected) previousFocus.focus();
  };
  const ensurePopup = () => {
    if (popup) return;
    popup = document.createElement("div");
    popup.className = "madic-cric-overlay";
    popup.hidden = true;
    popup.innerHTML = `<section class="madic-cric-dialog" role="dialog" aria-modal="true" aria-labelledby="madicCricDialogTitle" aria-describedby="madicCricDialogText"><button type="button" class="madic-cric-x" aria-label="Fermer la fenêtre">×</button><h2 id="madicCricDialogTitle"></h2><p id="madicCricDialogText"></p><button type="button" class="madic-cric-ok">Fermer</button></section>`;
    document.body.appendChild(popup);
    popupTitle = popup.querySelector("h2");
    popupText = popup.querySelector("p");
    popup
      .querySelectorAll("button")
      .forEach((b) => b.addEventListener("click", closePopup));
    popup.addEventListener("click", (e) => {
      if (e.target === popup) closePopup();
    });
    document.addEventListener("keydown", (e) => {
      if (popup.hidden) return;
      if (e.key === "Escape") {
        e.preventDefault();
        closePopup();
      }
      if (e.key === "Tab") {
        const buttons = [...popup.querySelectorAll("button")];
        const first = buttons[0],
          last = buttons[buttons.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    });
  };
  const openPopup = (message, title = "Information MADIC") => {
    ensurePopup();
    previousFocus = document.activeElement;
    popupTitle.textContent = title;
    popupText.textContent = message;
    popup.dataset.previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    popup.hidden = false;
    popup.querySelector(".madic-cric-x").focus();
  };
  const show = (s) => {
    if (msg) msg.textContent = s;
    if (
      document.body.dataset.page === "cric-signup" &&
      s &&
      !s.startsWith("Demande déjà enregistrée") &&
      !s.startsWith("Permis CRIC confirmé automatiquement")
    ) {
      openPopup(
        s,
        /^Erreur|non confirm|refus|invalide/i.test(s)
          ? "Résultat de la vérification CRIC"
          : "Information sur votre demande CRIC",
      );
    }
  };
  if (!cfg?.url || !cfg?.anonKey || !window.supabase) {
    show("Configuration Supabase manquante.");
    return;
  }
  const db = window.getMadicSupabase();
  const page = document.body.dataset.page;
  if (page === "cric-signup") {
    const guideButton = document.createElement("button");
    guideButton.type = "button";
    guideButton.className = "madic-cric-guide";
    guideButton.textContent = "ⓘ Guide de vérification CRIC";
    guideButton.addEventListener("click", () =>
      openPopup(
        "1. Saisissez votre nom complet et votre numéro de permis CRIC.\n" +
          "2. Cliquez sur « Vérifier mon permis CRIC ». MADIC consulte le registre officiel du CCIC.\n" +
          "3. Si le permis est confirmé, la prévalidation est transmise à MADIC sans création de compte.\n" +
          "4. MADIC examine votre identité dans la page administrative de validation.\n\n" +
          "Si le permis n’est pas confirmé, vérifiez les informations saisies. Vous pouvez fermer cette fenêtre à tout moment.",
        "Guide d'inscription CRIC",
      ),
    );
    const heading = document.querySelector("main h1");
    if (heading) heading.insertAdjacentElement("afterend", guideButton);
    const nameInput = document.getElementById("cricName");
    const licenseInput = document.getElementById("cricLicense");
    const verifyButton = document.getElementById("cricVerify");
    const checkButton = document.getElementById("cricCheckStatus");
    const key = "madic_cric_prevalidation_v1";
    const invoke = async (body) => {
      const { data, error } = await db.functions.invoke(
        "madic-verify-cric-license",
        { body },
      );
      if (error) {
        let message = "La vérification du permis a échoué.";
        try {
          const payload = await error.context?.clone()?.json();
          if (payload?.error) message = payload.error;
        } catch (_) {}
        throw new Error(message);
      }
      if (data?.error) throw new Error(data.error);
      return data;
    };
    const getSaved = () => {
      try {
        return JSON.parse(localStorage.getItem(key) || "null");
      } catch {
        return null;
      }
    };
    const saved = getSaved();
    if (saved?.token && saved.name && saved.license) {
      nameInput.value = saved.name;
      licenseInput.value = saved.license;
      checkButton.hidden = false;
    }
    const invalidate = () => {
      localStorage.removeItem(key);
      checkButton.hidden = true;
    };
    nameInput.addEventListener("input", invalidate);
    licenseInput.addEventListener("input", invalidate);
    verifyButton.addEventListener("click", async () => {
      const name = nameInput.value.trim().replace(/\s+/g, " ");
      const license = licenseInput.value.trim().toUpperCase();
      if (name.length < 3 || !/^R\d{6,}$/.test(license)) {
        show("Saisissez un nom complet et un numéro CRIC valide.");
        return;
      }
      verifyButton.disabled = true;
      try {
        const data = await invoke({
          action: "request",
          full_name: name,
          license_number: license,
        });
        if (
          data.verified !== true ||
          data.registry_verified !== true ||
          data.status !== "pending" ||
          !data.token ||
          data.registry?.registry_license !== license
        )
          throw Error("La vérification officielle n’a pas été confirmée.");
        localStorage.setItem(
          key,
          JSON.stringify({ name, license, token: data.token }),
        );
        checkButton.hidden = false;
        show(
          "Permis vérifié dans le registre officiel CCIC. La demande est enregistrée pour examen administratif MADIC. Aucun compte n’a été créé.",
        );
      } catch (e) {
        show("Erreur : " + e.message);
      } finally {
        verifyButton.disabled = false;
      }
    });
    checkButton.addEventListener("click", async () => {
      const saved = getSaved();
      if (
        !saved?.token ||
        saved.name !== nameInput.value.trim().replace(/\s+/g, " ") ||
        saved.license !== licenseInput.value.trim().toUpperCase()
      ) {
        show("Effectuez une nouvelle vérification.");
        return;
      }
      checkButton.disabled = true;
      try {
        const data = await invoke({ action: "status", token: saved.token });
        if (
          data.full_name !== saved.name ||
          data.license_number !== saved.license
        )
          throw Error("Référence incohérente.");
        const labels = {
          pending: "en attente de validation administrative",
          approved: "validée par MADIC (sans compte créé)",
          rejected: "refusée",
          expired: "expirée",
        };
        show(
          "Demande CRIC : " +
            (labels[data.status] || data.status) +
            ". Aucun compte n’est créé sur cette page.",
        );
      } catch (e) {
        show("Erreur : " + e.message);
      } finally {
        checkButton.disabled = false;
      }
    });
    document
      .getElementById("cricSignup")
      .addEventListener("submit", (e) => e.preventDefault());
  }
  if (page === "cric-approval") {
    (async () => {
      const {
        data: { user },
      } = await db.auth.getUser();
      if (!user) {
        location.replace("connexion.html");
        return;
      }
      const { data: isOwner, error: oe } = await db.rpc("madic_is_super_admin");
      if (oe || isOwner !== true) {
        show("Accès réservé au super administrateur MADIC.");
        return;
      }
      const approvalMain = document.getElementById("cricApprovalMain");
      if (approvalMain) approvalMain.hidden = false;
      async function refresh() {
        const { data, error } = await db
          .from("madic_cric_applications")
          .select(
            "user_id,full_name,license_number,professional_email,status,created_at",
          )
          .order("created_at", { ascending: false });
        if (error) {
          show(error.message);
          return;
        }
        const body = document.getElementById("cricApplications");
        body.replaceChildren();
        if (!data.length) {
          const tr = body.insertRow();
          tr.insertCell().colSpan = 5;
          tr.cells[0].textContent = "Aucune demande visible.";
          return;
        }
        for (const item of data) {
          const tr = body.insertRow();
          [
            item.full_name,
            item.license_number,
            item.professional_email,
            item.status,
          ].forEach((x) => (tr.insertCell().textContent = x));
          const cell = tr.insertCell();
          if (item.status !== "pending") {
            cell.textContent = "Traitée";
            continue;
          }
          for (const [label, approve] of [
            ["Approuver", true],
            ["Refuser", false],
          ]) {
            const button = document.createElement("button");
            button.type = "button";
            button.textContent = label;
            button.className = "secondary";
            button.addEventListener("click", async () => {
              if (
                !confirm(
                  `${label} la demande de ${item.full_name} (${item.license_number}) ?`,
                )
              )
                return;
              if (approve) {
                const registryUrl =
                  "https://registre.college-ic.ca/Public-Register-FR/RCIC_Search.aspx";
                const confirmed = window.prompt(
                  "Avant approbation, consultez le registre officiel du CCIC :\n" +
                    registryUrl +
                    "\n\n" +
                    "Vérifiez le numéro, le nom et le statut professionnel.\n" +
                    "Si et seulement si ces éléments correspondent, saisissez exactement le numéro " +
                    item.license_number +
                    " pour confirmer :",
                  "",
                );
                if (confirmed === null) return;
                if (
                  confirmed.trim().toUpperCase() !==
                  item.license_number.trim().toUpperCase()
                ) {
                  show(
                    "Approbation annulée : vérification du registre non confirmée.",
                  );
                  return;
                }
              }
              const note = prompt("Note interne (facultative) :") ?? "";
              button.disabled = true;
              const { error } = await db.rpc("madic_review_cric", {
                p_user_id: item.user_id,
                p_approve: approve,
                p_note: note,
              });
              if (error) show("Erreur : " + error.message);
              else {
                show("Décision enregistrée.");
                await refresh();
              }
              button.disabled = false;
            });
            cell.append(button, document.createTextNode(" "));
          }
        }
      }
      await refresh();
    })();
  }
})();

/* Source : madic-i18n-login.js */
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
      en: "PROFESSIONAL SPACE",
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

/* Source : madic-footer.js */
/* Footer commun MADIC : traduction des libellés sur les pages sans gestionnaire FR/EN. */
(function () {
  "use strict";
  function apply(lang) {
    lang = lang === "en" ? "en" : "fr";
    document
      .querySelectorAll(".madic-footer [data-fr][data-en]")
      .forEach(function (el) {
        el.textContent = el.getAttribute("data-" + lang);
      });
  }
  var lang = "fr";
  try {
    lang =
      new URLSearchParams(location.search).get("lang") ||
      localStorage.getItem("madic-lang") ||
      "fr";
  } catch (e) {}
  apply(lang);
  window.addEventListener("storage", function (e) {
    if (e.key === "madic-lang") apply(e.newValue);
  });
})();
