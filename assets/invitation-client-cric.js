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

(()=>{"use strict";const cfg=window.MADIC_CONFIG,$=id=>document.getElementById(id),page=document.body.dataset.page;const msg=s=>{if($("message"))$("message").textContent=s;};if(!cfg?.url||!cfg?.anonKey||!window.supabase){msg("Configuration Supabase manquante.");return;}const db=window.getMadicSupabase();async function recordClientLogin(){const {error}=await db.rpc("madic_record_client_portal_login");if(error)console.warn("MADIC : connexion client non journalisee :",error.message);}
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
(()=>{"use strict";const nodes=document.querySelectorAll("[data-fr][data-en]");function setLanguage(lang){lang=lang==="en"?"en":"fr";document.documentElement.lang=lang==="en"?"en":"fr-CA";nodes.forEach(el=>{el.textContent=el.dataset[lang]});document.querySelectorAll(".madic-lang-controls button").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.lang===lang)));try{localStorage.setItem("madic-lang",lang)}catch(e){}}let initial="fr";try{initial=new URLSearchParams(location.search).get("lang")||localStorage.getItem("madic-lang")||"fr"}catch(e){}setLanguage(initial);document.querySelectorAll(".madic-lang-controls button").forEach(b=>b.addEventListener("click",()=>setLanguage(b.dataset.lang)));window.addEventListener("storage",e=>{if(e.key==="madic-lang")setLanguage(e.newValue)});})();
