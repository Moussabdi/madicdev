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

// MADIC CRIC login: page-specific scripts consolidated.
// config.js and the shared footer are kept as existing dependencies.
(async () => {
  if (!window.supabase) {
    try {
      await new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src =
          "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js";
        script.onload = resolve;
        script.onerror = () => reject(new Error("Supabase SDK unavailable"));
        document.head.appendChild(script);
      });
    } catch (error) {
      const message = document.getElementById("message");
      if (message)
        message.textContent =
          "Impossible de charger le service de connexion Supabase.";
      console.error(error);
      return;
    }
  }
  (() => {
    "use strict";
    const cfg = window.MADIC_CONFIG,
      $ = (id) => document.getElementById(id),
      page = document.body.dataset.page;
    const msg = (s) => {
      if ($("message")) $("message").textContent = s;
    };
    if (!cfg?.url || !cfg?.anonKey || !window.supabase) {
      msg("Configuration Supabase manquante.");
      return;
    }
    const db = window.getMadicSupabase();
    async function getUser() {
      const { data, error } = await db.auth.getUser();
      if (error) throw error;
      return data.user;
    }
    async function clientSpaces() {
      const { data, error } = await db.rpc("madic_my_cric_client_spaces");
      if (error) throw error;
      return data || [];
    }
    // Une notification par session Supabase authentifiee (dedoublonnage SQL par session_id).
    async function recordClientLogin() {
      const { error } = await db.rpc("madic_record_client_portal_login");
      if (error)
        console.warn(
          "MADIC : connexion client non journalisee :",
          error.message,
        );
    }
    async function login(e) {
      e.preventDefault();
      const form = e.currentTarget;
      const email = form.elements.namedItem("email").value.trim(),
        password = form.elements.namedItem("password").value;
      const { data, error } = await db.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        msg(error.message);
        return;
      }
      try {
        if (page === "cric-login") {
          const { data: admin, error: ae } = await db.rpc(
            "madic_is_super_admin",
          );
          if (ae) throw ae;
          const { data: apps, error: pe } = await db
            .from("madic_cric_applications")
            .select("status")
            .eq("user_id", data.user.id)
            .limit(1);
          if (pe) throw pe;
          if (!admin && !apps?.length) {
            msg(
              "Ce compte ne possède pas de demande CRIC. Utilisez le portail client MADIC.",
            );
            return;
          }
          location.replace(
            admin ? "administration.html" : "cric-dashboard.html",
          );
          return;
        }
        const spaces = await clientSpaces();
        if (!spaces.length) {
          msg(
            "Ce compte n’est associé à aucun cabinet CRIC. Contactez votre consultant.",
          );
          return;
        }
        await recordClientLogin();
        location.replace("dashboard-client-cric.html");
      } catch (err) {
        msg("Vérification des accès impossible : " + err.message);
      }
    }
    if (page === "cric-login" || page === "cric-client-login") {
      $("login")?.addEventListener("submit", login);
      $("forgot")?.addEventListener("click", async () => {
        const email = $("email").value.trim();
        if (!email) return msg("Indiquez votre courriel.");
        const { error } = await db.auth.resetPasswordForEmail(email, {
          redirectTo: new URL("reset.html", location.href).href,
        });
        msg(
          error
            ? error.message
            : "Si ce compte existe, un courriel sera envoyé.",
        );
      });
    }
    if (page === "cric-invitation") {
      const storageKey = "madic_cric_pending_invitation";
      const params = new URLSearchParams(location.search);
      const urlToken = params.get("token");
      if (urlToken) {
        sessionStorage.setItem(storageKey, urlToken);
      }
      const token = urlToken || sessionStorage.getItem(storageKey);
      const form = $("invitationForm"),
        submit = $("inviteSubmit"),
        switchBtn = $("switchAccount");
      const showSwitch = () => {
        if (switchBtn) switchBtn.hidden = false;
      };
      if (!token) {
        msg(
          "Lien d’invitation manquant ou expiré dans ce navigateur. Ouvrez le lien original envoyé par votre consultant.",
        );
        if (submit) submit.disabled = true;
      }
      if (switchBtn)
        switchBtn.addEventListener("click", async () => {
          const { error } = await db.auth.signOut();
          if (error) return msg("Déconnexion impossible : " + error.message);
          msg(
            "Vous êtes déconnecté. Connectez-vous avec le courriel invité, puis acceptez l’invitation.",
          );
          switchBtn.hidden = true;
        });
      async function acceptInvitation() {
        const { data: sessionData, error: sessionError } =
          await db.auth.getSession();
        if (sessionError || !sessionData?.session?.access_token) {
          msg(
            "Votre session n’est pas active. Confirmez votre courriel si nécessaire, puis reconnectez-vous avec le compte invité.",
          );
          return false;
        }
        const { error } = await db.rpc("madic_accept_cric_invitation", {
          p_token: token,
        });
        if (error) {
          msg("Invitation non acceptée : " + error.message);
          return false;
        }
        const { data: spaces, error: spaceError } = await db.rpc(
          "madic_my_cric_client_spaces",
        );
        if (spaceError || !spaces?.length) {
          msg(
            "Invitation traitée, mais l’accès au cabinet n’est pas encore confirmé. " +
              (spaceError?.message || "Contactez votre consultant."),
          );
          return false;
        }
        await recordClientLogin();
        sessionStorage.removeItem(storageKey);
        location.replace("dashboard-client-cric.html");
        return true;
      }
      form?.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (!token) return;
        const email = $("inviteEmail").value.trim().toLowerCase(),
          password = $("invitePassword").value;
        if (submit) submit.disabled = true;
        try {
          // getUser() peut lever AuthSessionMissingError si personne n'est connecté.
          // getSession() permet de distinguer proprement une session absente.
          const { data: existingSession, error: existingError } =
            await db.auth.getSession();
          if (existingError) throw existingError;
          let user = existingSession?.session?.user || null;
          if (user && user.email?.toLowerCase() !== email) {
            showSwitch();
            msg(
              "Une autre session est active (" +
                user.email +
                "). Cliquez sur « Changer de compte », puis réessayez.",
            );
            return;
          }
          if (!user) {
            const sign = await db.auth.signInWithPassword({ email, password });
            if (!sign.error) {
              const { data: confirmedSession, error: confirmedError } =
                await db.auth.getSession();
              if (confirmedError) throw confirmedError;
              if (!confirmedSession?.session?.access_token) {
                msg(
                  "Connexion non finalisée. Réessayez ou confirmez votre adresse courriel.",
                );
                return;
              }
              user = confirmedSession.session.user;
            } else {
              // Une erreur de connexion ne prouve pas que le compte est nouveau.
              // Supabase peut retourner une erreur de mot de passe ou de confirmation.
              const reg = await db.auth.signUp({
                email,
                password,
                options: {
                  emailRedirectTo: new URL(
                    "invitation-client-cric.html?token=" +
                      encodeURIComponent(token),
                    location.href,
                  ).href,
                },
              });
              if (reg.error) {
                msg(
                  "Connexion impossible (" +
                    sign.error.message +
                    "). Inscription impossible : " +
                    reg.error.message,
                );
                return;
              }
              if (!reg.data.session) {
                msg(
                  "Si votre compte vient d’être créé, confirmez votre courriel, puis ouvrez de nouveau le lien d’invitation original. Si vous avez déjà un compte, vérifiez votre mot de passe ou utilisez la récupération de mot de passe.",
                );
                return;
              }
              user = reg.data.user;
            }
          }
          if (!user) {
            msg("Connexion requise avant l’acceptation.");
            return;
          }
          msg("Vérification et acceptation de votre invitation…");
          await acceptInvitation();
        } catch (err) {
          msg("Erreur lors de l’acceptation : " + (err.message || String(err)));
        } finally {
          if (submit) submit.disabled = false;
        }
      });
      // Ne pas accepter automatiquement une invitation au nom d’une session préexistante.
      // L’utilisateur confirme toujours son adresse via le formulaire.
    }
    if (page === "cric-client-dashboard") {
      $("logout").addEventListener("click", async () => {
        await db.auth.signOut();
        location.replace("connexion-client-cric.html");
      });
      (async () => {
        try {
          const user = await getUser();
          if (!user) {
            location.replace("connexion-client-cric.html");
            return;
          }
          const spaces = await clientSpaces();
          if (!spaces.length) {
            msg("Aucun cabinet CRIC associé.");
            return;
          }
          const select = $("cabinet");
          for (const s of spaces) {
            const option = document.createElement("option");
            option.value = s.space_id;
            option.textContent = s.space_name;
            select.append(option);
          }

          async function load() {
            const space = select.value;
            if (!spaces.some((s) => s.space_id === space)) return;
            const { data, error } = await db
              .from("dossiers")
              .select("reference,category,status")
              .eq("client_id", user.id)
              .eq("space_id", space);
            if (error) throw error;
            const body = $("clientDossiers");
            body.replaceChildren();
            for (const d of data || []) {
              const row = body.insertRow();
              for (const value of [d.reference, d.category, d.status])
                row.insertCell().textContent = value ?? "";
            }
            if (!data?.length) {
              const row = body.insertRow();
              row.insertCell().colSpan = 3;
              row.cells[0].textContent = "Aucun dossier associé à ce cabinet.";
            }
            msg(
              "Cabinet vérifié : " +
                spaces.find((s) => s.space_id === space).space_name,
            );
          }
          select.addEventListener("change", () =>
            load().catch((e) => msg(e.message)),
          );
          await load();
        } catch (e) {
          msg("Accès impossible : " + e.message);
        }
      })();
    }
  })();
})();
