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
(()=>{"use strict";const nodes=document.querySelectorAll("[data-fr][data-en]");function setLanguage(lang){lang=lang==="en"?"en":"fr";document.documentElement.lang=lang==="en"?"en":"fr-CA";nodes.forEach(el=>{el.textContent=el.dataset[lang]});document.querySelectorAll(".madic-lang-controls button").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.lang===lang)));try{localStorage.setItem("madic-lang",lang)}catch(e){}}let initial="fr";try{initial=new URLSearchParams(location.search).get("lang")||localStorage.getItem("madic-lang")||"fr"}catch(e){}setLanguage(initial);document.querySelectorAll(".madic-lang-controls button").forEach(b=>b.addEventListener("click",()=>setLanguage(b.dataset.lang)));window.addEventListener("storage",e=>{if(e.key==="madic-lang")setLanguage(e.newValue)});})();

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
  let user = null, grants = [], grant = "", section = "profile", offset = 0;
  let result = null, version = 0, notice = [], authBusy = false;
  const sections = {
    profile: ["Profil du client", "Client profile"],
    dossiers: ["Dossiers", "Cases"],
    intake: ["Questionnaire d’immigration", "Immigration questionnaire"],
    requests: ["Demandes de documents", "Document requests"],
    documents: ["Documents déposés", "Uploaded documents"],
    appointments: ["Rendez-vous", "Appointments"],
    messages: ["Messages", "Messages"],
    attachments: ["Pièces jointes", "Attachments"],
    invoices: ["Factures émises", "Issued invoices"],
    contracts: ["Contrats initiaux", "Initial contracts"],
    legacy_contracts: ["Contrats de consultation", "Consultation contracts"],
    service: ["Suivi de la demande de service", "Service request progress"],
  };
  const labels = {
    name: ["Nom", "Name"], phone: ["Téléphone", "Phone"], email: ["Courriel", "Email"], country: ["Pays", "Country"],
    gender: ["Genre", "Gender"], date_of_birth: ["Date de naissance", "Date of birth"],
    address_number: ["Numéro civique", "Street number"], address_street: ["Rue", "Street"],
    address_apartment: ["Appartement", "Apartment"], address_city: ["Ville", "City"],
    address_region: ["Province ou région", "Province or region"], address_postal_code: ["Code postal", "Postal code"],
    reference: ["Référence", "Reference"], category: ["Catégorie", "Category"], status: ["Statut", "Status"],
    created_at: ["Date", "Date"], updated_at: ["Mise à jour", "Updated"], title: ["Titre", "Title"],
    instructions: ["Instructions", "Instructions"], due_on: ["Échéance", "Due date"], original_name: ["Fichier", "File"],
    starts_at: ["Début", "Starts"], ends_at: ["Fin", "Ends"], mode: ["Mode", "Format"], location_info: ["Lieu ou lien", "Location or link"],
    subject: ["Sujet", "Subject"], body: ["Message", "Message"], sender: ["Expéditeur", "Sender"], filename: ["Fichier", "File"],
    invoice_number: ["Facture", "Invoice"], description: ["Description", "Description"], issued_on: ["Émise le", "Issued on"],
    items: ["Détail", "Line items"], notes: ["Notes", "Notes"], total_cents: ["Total", "Total"], paid_cents: ["Payé", "Paid"],
    balance_cents: ["Solde", "Balance"], client_signed_at: ["Signature du client", "Client signature"],
    published_at: ["Publication", "Published"], signed_at: ["Signature", "Signed"], service_type: ["Service", "Service"],
  };
  const values = {
    en_attente: ["En attente", "Pending"], actif: ["Actif", "Active"], ferme: ["Fermé", "Closed"],
    requested: ["Demandé", "Requested"], completed: ["Terminé", "Completed"], cancelled: ["Annulé", "Cancelled"],
    confirmed: ["Confirmé", "Confirmed"], declined: ["Refusé", "Declined"], video: ["Vidéo", "Video"],
    phone: ["Téléphone", "Phone"], in_person: ["En personne", "In person"], client: ["Client", "Client"],
    cabinet: ["Cabinet", "Firm"], publie: ["Publié", "Published"], signe: ["Signé", "Signed"],
    client_signe: ["Signé par le client", "Signed by client"], deux_signatures: ["Signé par les deux parties", "Signed by both parties"],
    received: ["Reçue", "Received"], reviewing: ["En cours d’analyse", "Under review"], responded: ["Réponse envoyée", "Responded"],
    closed: ["Fermée", "Closed"], consultation: ["Consultation", "Consultation"], proposition: ["Proposition", "Proposal"],
    recu: ["Reçu", "Received"], a_verifier: ["À vérifier", "Needs review"], accepte: ["Accepté", "Accepted"],
    a_remplacer: ["À remplacer", "Replacement needed"],
  };
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
  function setUrl() {
    const url = new URL(location.href);
    url.hash = "";
    url.searchParams.delete("invite");
    url.searchParams.set("guest", "1");
    if (grant) url.searchParams.set("access", grant);
    else url.searchParams.delete("access");
    history.replaceState(null, "", url);
  }
  function addOptions(select, entries, current) {
    select.replaceChildren(...entries.map(([value, title]) => new Option(title, value)));
    select.value = current;
  }
  function updateControls() {
    el("Auth").hidden = Boolean(user);
    el("Signup").hidden = !token;
    el("SignOut").hidden = !user;
    el("Accept").hidden = !user || !token;
    el("Workspace").hidden = !user || !grant || Boolean(token);
    [el("Accept"), el("SignOut"), ...el("Auth").querySelectorAll("button")].forEach(button => {
      button.disabled = authBusy;
    });
    addOptions(el("Grant"), grants.map(access => [access.grant_id, access.client_name + " · " + access.cabinet]), grant);
    addOptions(el("Section"), Object.entries(sections).map(([key, title]) => [key, tr(...title)]), section);
    el("Notice").textContent = notice.length ? tr(...notice) : "";
  }
  function prettyKey(key) {
    return key.replace(/_/g, " ").replace(/^./, letter => letter.toUpperCase());
  }
  function formatValue(key, value, row) {
    const locale = english() ? "en-CA" : "fr-CA";
    if (value == null || value === "") return "—";
    if (key.endsWith("_cents")) {
      return new Intl.NumberFormat(locale, { style: "currency", currency: row.currency || "CAD" }).format(value / 100);
    }
    if (/^\d{4}-\d\d-\d\dT/.test(String(value)) && !Number.isNaN(Date.parse(value))) {
      return new Date(value).toLocaleString(locale);
    }
    if (["status", "mode", "sender", "service_type"].includes(key) && Object.hasOwn(values, value)) {
      return tr(...values[value]);
    }
    if (typeof value === "boolean") return value ? tr("Oui", "Yes") : tr("Non", "No");
    return String(value);
  }
  function detailList(row) {
    const fields = document.createElement("dl");
    for (const [key, value] of Object.entries(row)) {
      if (["file", "bucket", "contract_id", "currency"].includes(key) || key.startsWith("madic_")) continue;
      const title = document.createElement("dt");
      title.textContent = Object.hasOwn(labels, key) ? tr(...labels[key]) : prettyKey(key);
      const detail = document.createElement("dd");
      if (value && typeof value === "object") detail.append(detailList(value));
      else detail.textContent = formatValue(key, value, row);
      fields.append(title, detail);
    }
    return fields;
  }
  function action(fr, en, run) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = tr(fr, en);
    button.addEventListener("click", async () => {
      button.disabled = true;
      try { await run(); } catch { failed(); }
      finally { button.disabled = false; }
    });
    return button;
  }
  async function download(row) {
    const requestVersion = version;
    const { data, error, response } = await db.functions.invoke("madic-send-client-invitation", {
      body: { action: "guest_download", grant_id: grant, bucket: row.bucket, path: row.file },
    });
    if (error || !(data instanceof Blob)) throw error || Error("Missing file");
    if (requestVersion !== version) return;
    const url = URL.createObjectURL(data);
    const link = document.createElement("a");
    link.href = url;
    const imageExtension = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" }[
      response?.headers.get("X-Madic-File-Type")?.split(";")[0]
    ];
    link.download = row.original_name || row.filename || (imageExtension ? "MADIC." + imageExtension : "MADIC.pdf");
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function showContract(card, id) {
    const isLegacy = section === "legacy_contracts";
    const requestVersion = version;
    const { data, error } = await db.rpc(isLegacy ? "madic_guest_legacy_contract" : "madic_guest_contract",
      { p_grant: grant, p_contract: id });
    if (error || !data) throw error || Error("Missing contract");
    if (requestVersion !== version || !card.isConnected) return;
    card.querySelector(".guest-contract")?.remove();
    if (isLegacy) {
      const copy = document.createElement("p");
      copy.className = "guest-contract";
      copy.textContent = data;
      card.append(copy);
      return;
    }
    const frame = document.createElement("iframe");
    frame.className = "guest-contract";
    frame.title = tr("Contrat en lecture seule", "Read-only contract");
    frame.setAttribute("sandbox", "");
    frame.referrerPolicy = "no-referrer";
    const template = document.createElement("template");
    template.innerHTML = data;
    template.content.querySelectorAll("script, iframe, object, embed, form, button, input, textarea, select, link, meta, base, svg, math")
      .forEach(item => item.remove());
    template.content.querySelectorAll("a, area").forEach(item => item.removeAttribute("href"));
    frame.srcdoc = '<!doctype html><meta charset="utf-8">' +
      '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src data:; style-src \'unsafe-inline\'; form-action \'none\'; base-uri \'none\'">' +
      template.innerHTML;
    card.append(frame);
  }
  function renderContent() {
    const content = el("Content");
    content.replaceChildren();
    el("Pager").hidden = true;
    if (!grant || result == null) return;
    const rows = Array.isArray(result) ? result : [result];
    if (!rows.length) {
      content.textContent = tr("Aucun élément à afficher.", "There is nothing to show.");
    }
    for (const row of rows.slice(0, 25)) {
      const card = document.createElement("article");
      card.append(detailList(row));
      if (row.file) card.append(action("Télécharger", "Download", () => download(row)));
      if (row.contract_id) card.append(action("Voir le contrat", "View contract", () => showContract(card, row.contract_id)));
      content.append(card);
    }
    el("Pager").hidden = offset === 0 && rows.length < 26;
    el("Previous").disabled = offset === 0;
    el("Next").disabled = rows.length < 26;
  }
  async function loadSection() {
    const requestVersion = ++version;
    result = null;
    renderContent();
    if (!grant) return;
    say("Chargement…", "Loading…");
    try {
      const { data, error } = await db.rpc("madic_guest_read", { p_grant: grant, p_section: section, p_offset: offset });
      if (requestVersion !== version) return;
      if (error) throw error;
      result = data ?? [];
      say();
      renderContent();
    } catch {
      if (requestVersion === version) failed();
    }
  }
  async function loadGrants(preferred) {
    const signedInUser = user;
    if (!signedInUser) return;
    const { data, error } = await db.rpc("madic_guest_list");
    if (signedInUser !== user) return;
    if (error) throw error;
    grants = data || [];
    grant = grants.some(access => access.grant_id === preferred) ? preferred : (grants[0]?.grant_id || "");
    updateControls();
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
      await openPortal();
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
    grant = data;
    setUrl();
    await openPortal(data);
  }));
  el("SignOut").addEventListener("click", () => authAction(async () => {
    const { error } = await db.auth.signOut({ scope: "local" });
    if (error) throw error;
    user = null;
    version++;
    grants = [];
    grant = "";
    result = null;
    promptGuestSignIn();
    renderContent();
  }));
  el("Grant").addEventListener("change", () => {
    grant = el("Grant").value;
    if (!token) setUrl();
    section = "profile";
    offset = 0;
    updateControls();
    loadSection();
  });
  el("Section").addEventListener("change", () => {
    section = el("Section").value;
    offset = 0;
    loadSection();
  });
  el("Previous").addEventListener("click", () => { offset = Math.max(0, offset - 25); loadSection(); });
  el("Next").addEventListener("click", () => { offset += 25; loadSection(); });
  new MutationObserver(() => {
    updateControls();
    renderContent();
  }).observe(document.documentElement, { attributes: true, attributeFilter: ["lang"] });

  async function openPortal(preferred) {
    await loadGrants(preferred);
    if (token) return say("Compte connecté : " + user.email + ". Vous pouvez accepter l’invitation.",
      "Signed in as " + user.email + ". You can accept the invitation.");
    if (!grant) return say("Aucun accès invité actif pour ce compte.", "This account has no active guest access.");
    setUrl();
    await loadSection();
  }
  authAction(async () => {
    const { data } = await db.auth.getUser();
    user = data?.user;
    if (user) await openPortal(params.get("access"));
    else promptGuestSignIn();
  });
  async function recheck() {
    if (!user || token || !grant || authBusy) return;
    const previous = grant;
    try {
      await loadGrants(previous);
      if (previous !== grant) {
        offset = 0;
        result = null;
        version++;
        renderContent();
        setUrl();
        if (grant) await loadSection();
        else say("Cet accès a pris fin.", "This access has ended.");
      }
    } catch {
      version++;
      result = null;
      renderContent();
      failed();
    }
  }
  setInterval(recheck, 60000);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) recheck();
  });
})();
