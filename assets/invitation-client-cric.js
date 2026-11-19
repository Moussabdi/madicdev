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

function isMadicGuestPage() {
  const params = new URLSearchParams(location.search);
  return params.has("invite") || params.has("guest");
}

(()=>{"use strict";if(isMadicGuestPage())return;const cfg=window.MADIC_CONFIG,$=id=>document.getElementById(id),page=document.body.dataset.page;const msg=s=>{if($("message"))$("message").textContent=s;};if(!cfg?.url||!cfg?.anonKey||!window.supabase){msg("Configuration Supabase manquante.");return;}const db=window.getMadicSupabase();async function recordClientLogin(){const {error}=await db.rpc("madic_record_client_portal_login");if(error)console.warn("MADIC : connexion client non journalisee :",error.message);}
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

})();
(() => {
  "use strict";
  const labels = document.querySelectorAll("[data-fr][data-en]");
  const languageButtons = document.querySelectorAll(".madic-lang-switch button[data-lang]");
  const passwordToggles = Array.from(document.querySelectorAll("[data-password-toggle]"), button => ({
    button,
    field: document.getElementById(button.getAttribute("aria-controls")),
    label: button.querySelector("[data-password-label]"),
  })).filter(control => control.field && control.label);
  let language = "fr";

  function renderPasswordToggle({ button, field, label }) {
    const visible = field.type === "text";
    button.setAttribute("aria-pressed", String(visible));
    label.textContent = language === "en"
      ? (visible ? "Hide" : "Show")
      : (visible ? "Masquer" : "Afficher");
    button.setAttribute("aria-label", language === "en"
      ? (visible ? "Hide password" : "Show password")
      : (visible ? "Masquer le mot de passe" : "Afficher le mot de passe"));
  }

  function setLanguage(value) {
    language = String(value).toLowerCase().startsWith("en") ? "en" : "fr";
    document.documentElement.lang = language === "en" ? "en-CA" : "fr-CA";
    labels.forEach(node => { node.textContent = node.dataset[language]; });
    languageButtons.forEach(button => {
      button.setAttribute("aria-pressed", String(button.dataset.lang === language));
    });
    passwordToggles.forEach(renderPasswordToggle);
  }

  for (const control of passwordToggles) {
    const { button, field } = control;
    button.addEventListener("click", () => {
      field.type = field.type === "password" ? "text" : "password";
      renderPasswordToggle(control);
    });
    const conceal = () => {
      field.type = "password";
      renderPasswordToggle(control);
    };
    field.form?.addEventListener("reset", conceal);
    window.addEventListener("pagehide", conceal);
  }

  let initial = new URLSearchParams(location.search).get("lang");
  try {
    initial ||= localStorage.getItem("madic_ui_language") || localStorage.getItem("madic-lang");
  } catch {}
  setLanguage(initial || "fr");
  languageButtons.forEach(button => button.addEventListener("click", () => {
    setLanguage(button.dataset.lang);
    try {
      localStorage.setItem("madic_ui_language", language);
      localStorage.setItem("madic-lang", language);
    } catch {}
  }));
  window.addEventListener("storage", event => {
    if (event.key === "madic-lang" && event.newValue) setLanguage(event.newValue);
  });
})();

(() => {
  "use strict";
  if (!isMadicGuestPage()) return;
  const byId = id => document.getElementById(id);
  const el = name => byId("guest" + name);
  byId("ordinaryInvitation").hidden = true;
  document.title = "MADIC | Accès invité / Guest access";
  el("Portal").hidden = false;
  const english = () => document.documentElement.lang.startsWith("en");
  const tr = (fr, en) => english() ? en : fr;
  const params = new URLSearchParams(location.search);
  let token = params.get("invite");
  let user = null;
  let notice = [], authBusy = false;
  function say(fr, en) {
    notice = fr ? [fr, en] : [];
    el("Notice").textContent = notice.length ? tr(...notice) : "";
  }
  function promptGuestSignIn() {
    if (token) {
      say("Utilisez l’adresse invitée et le mot de passe de votre compte MADIC. Si vous n’avez pas encore de compte, cliquez sur « Créer un compte ».",
        "Use the invited email address and your MADIC account password. If you do not have an account yet, select ‘Create an account’.");
    } else {
      say("Connectez-vous avec votre compte MADIC. Pour créer votre compte ou accepter une première invitation, ouvrez le lien reçu par courriel.",
        "Sign in with your MADIC account. To create an account or accept your first invitation, open the link you received by email.");
    }
  }
  function showAuthError(error, signup) {
    switch (error.code) {
      case "email_not_confirmed":
        return say("Confirmez votre adresse à l’aide du courriel de confirmation MADIC, puis revenez à votre invitation.",
          "Confirm your address using the MADIC confirmation email, then return to your invitation.");
      case "weak_password":
        return say("Le mot de passe ne respecte pas les exigences de sécurité. Choisissez un mot de passe plus robuste.",
          "This password does not meet the security requirements. Choose a stronger password.");
      case "email_address_invalid":
        return say("Vérifiez que l’adresse courriel est correctement saisie.",
          "Check that the email address is entered correctly.");
      case "over_email_send_rate_limit":
      case "over_request_rate_limit":
        return say("Trop de tentatives. Patientez quelques minutes avant de réessayer.",
          "Too many attempts. Wait a few minutes before trying again.");
      case "signup_disabled":
      case "email_provider_disabled":
        return say("La création de compte par courriel est présentement indisponible. Communiquez avec votre cabinet.",
          "Email sign-up is currently unavailable. Contact your firm.");
      case "user_already_exists":
      case "email_exists":
        return say("Si vous avez déjà un compte MADIC, cliquez sur « Se connecter ».",
          "If you already have a MADIC account, select ‘Sign in’.");
      case "invalid_credentials":
        if (!signup && token) {
          return say("Connexion refusée. Vérifiez l’adresse invitée et le mot de passe de votre compte MADIC. Si vous n’avez pas de compte, cliquez sur « Créer un compte ».",
            "Sign-in failed. Check the invited email address and your MADIC account password. If you do not have an account, select ‘Create an account’.");
        }
        if (!signup) {
          return say("Connexion refusée. Vérifiez votre adresse et votre mot de passe MADIC. Pour créer un compte, ouvrez le lien d’invitation reçu par courriel.",
            "Sign-in failed. Check your MADIC email address and password. To create an account, open the invitation link you received by email.");
        }
    }
    if (signup) {
      return say("La création du compte a échoué. Vérifiez l’adresse invitée et réessayez.",
        "Account creation failed. Check the invited email address and try again.");
    }
    say("La connexion est indisponible. Réessayez dans quelques instants.",
      "Sign-in is unavailable. Try again in a moment.");
  }
  function failed() {
    say("La consultation est indisponible. Vérifiez votre accès et réessayez.",
      "Unable to load this view. Check your access and try again.");
  }
  if (!window.supabase) { failed(); return; }
  const db = window.getMadicSupabase();
  function updateControls() {
    el("Auth").hidden = Boolean(user);
    el("Signup").hidden = !token;
    el("SignOut").hidden = !user;
    el("Accept").hidden = !user || !token;
    [el("Accept"), el("SignOut"), ...el("Auth").querySelectorAll("button")].forEach(button => {
      button.disabled = authBusy;
    });
    el("Notice").textContent = notice.length ? tr(...notice) : "";
  }
  async function authAction(run) {
    if (authBusy) return;
    authBusy = true;
    updateControls();
    try { await run(); } catch { failed(); }
    finally { authBusy = false; updateControls(); }
  }
  el("Auth").addEventListener("submit", event => {
    event.preventDefault();
    authAction(async () => {
      const email = el("Email").value.trim();
      const password = el("Password").value;
      const signup = Boolean(token) && event.submitter === el("Signup");
      const redirect = new URL(location.href);
      redirect.hash = "";
      const response = signup
        ? await db.auth.signUp({ email, password, options: { emailRedirectTo: redirect.href } })
        : await db.auth.signInWithPassword({ email, password });
      if (response.error) {
        showAuthError(response.error, signup);
        return;
      }
      el("Auth").reset();
      if (!response.data.session) {
        say("Confirmez votre courriel, puis ouvrez de nouveau le lien d’invitation.",
          "Confirm your email address, then reopen the invitation link.");
        return;
      }
      user = response.data.session.user;
      await openPortal(params.get("access"));
    });
  });
  el("Accept").addEventListener("click", () => authAction(async () => {
    const { data, error } = await db.rpc("madic_guest_accept", { p_token: token });
    if (error || !data) {
      say("Lien invalide, déjà utilisé ou expiré, ou compte différent du courriel invité.",
        "The link is invalid, already used or expired, or this account uses a different email address.");
      return;
    }
    token = null;
    openDashboard(data);
  }));
  el("SignOut").addEventListener("click", () => authAction(async () => {
    const { error } = await db.auth.signOut({ scope: "local" });
    if (error) throw error;
    user = null;
    promptGuestSignIn();
  }));
  new MutationObserver(updateControls).observe(document.documentElement, {attributes: true, attributeFilter: ["lang"]});

  function openDashboard(grant) {
    const destination = new URL("dashboard-client-cric.html", location.href);
    destination.searchParams.set("access", grant);
    destination.searchParams.set("guest", "1");
    location.replace(destination.href);
  }
  async function openPortal(preferred) {
    if (token) return say("Compte connecté : " + user.email + ". Vous pouvez accepter l’invitation.",
      "Signed in as " + user.email + ". You can accept the invitation.");
    const { data: grants, error } = await db.rpc("madic_guest_list");
    if (error) throw error;
    const access = preferred ? grants?.find(item => item.grant_id === preferred) : grants?.[0];
    if (!access) return say("Aucun accès invité actif pour ce compte ou ce dossier.", "There is no active guest access for this account or file.");
    openDashboard(access.grant_id);
  }
  authAction(async () => {
    const { data } = await db.auth.getUser();
    user = data?.user;
    if (user) await openPortal(params.get("access"));
    else promptGuestSignIn();
  });
})();
