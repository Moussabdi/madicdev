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
      console.warn("MADIC : connexion client non journalisee :", error.message);
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
        const { data: admin, error: ae } = await db.rpc("madic_is_super_admin");
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
        location.replace(admin ? "administration.html" : "cric-dashboard.html");
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
        error ? error.message : "Si ce compte existe, un courriel sera envoyé.",
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
