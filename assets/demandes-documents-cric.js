/* Source: config(20261111-022549).js */
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


/* Source: madic-datahubz-unified(20261111-022518).js */
/* MADIC : navigation CRIC uniforme. Icones Heroicons identiques au tableau de bord. */
(() => {
  "use strict";
  const init = () => {
    const sidebar = document.querySelector(".madic-unified-sidebar");
    if (!sidebar || !sidebar.querySelector(".madic-unified-brand small")?.textContent.includes("Espace professionnel")) return;
    const nav = sidebar.querySelector("nav");
    if (!nav) return;
    const iconBase = "https://raw.githubusercontent.com/tailwindlabs/heroicons/v2.2.0/optimized/24/outline/";
    const items = [
      ["cric-dashboard.html", "Vue d’ensemble", "squares-2x2", ""],
      ["gestion-clients-cric.html", "Clients", "users", "madic-v2-group-start"],
      ["gestion-dossiers-cric.html", "Outils CRIC", "folder-open", ""],
      ["messagerie-cric.html", "Messagerie", "chat-bubble-left-right", "madic-v2-group-start"],
      ["rendez-vous-cric.html", "Rendez-vous", "calendar-days", ""],
      ["demandes-documents-cric.html", "Documents", "document-text", ""],
      ["echeances-cric.html", "Échéances", "calendar-days", ""],
      ["facturation-cric.html", "Facturation", "receipt-percent", "madic-v2-group-start"],
      ["finances-cric.html", "Finances", "banknotes", ""],
      ["profil-professionnel-cric.html", "Mon profil professionnel", "identification", ""]
    ];
    const current = (location.pathname.split("/").pop() || "cric-dashboard").replace(/\.html$/, "") + ".html";
    const fragment = document.createDocumentFragment();
    for (const [href, label, iconName, group] of items) {
      const link = document.createElement("a");
      link.href = href;
      link.dataset.madicPage = href;
      if (group) link.className = group;
      if (current === href) link.setAttribute("aria-current", "page");
      const holder = document.createElement("span");
      holder.setAttribute("aria-hidden", "true");
      const img = document.createElement("img");
      img.className = "madic-heroicon";
      img.alt = "";
      img.setAttribute("aria-hidden", "true");
      img.loading = "eager";
      img.decoding = "async";
      img.src = iconBase + iconName + ".svg";
      holder.appendChild(img);
      link.append(holder, document.createTextNode(label));
      fragment.appendChild(link);
    }
    nav.replaceChildren(fragment);
    const brand = sidebar.querySelector(".madic-unified-monogram");
    if (brand) {
      const logo = document.createElement("img");
      logo.src = "img/logo-madic.svg";
      logo.alt = "Logo MADIC";
      brand.replaceChildren(logo);
    }
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, {once:true});
  else init();
})();


/* Source: madic-document-requests-cric(2).js */
(async () => {
  "use strict";
  const $ = (id) => document.getElementById(id),
    notice = (s) => ($("docreqNotice").textContent = s);
  if (!window.getMadicSupabase)
    return notice("Configuration Supabase manquante.");
  const db = window.getMadicSupabase();
  let spaceId,
    clients = [],
    dossiers = [];
  const params = new URLSearchParams(location.search);
  const targetClient = params.get("client"),
    targetDossier = params.get("dossier");
  const opt = (sel, v, t) => {
    const o = document.createElement("option");
    o.value = v;
    o.textContent = t;
    sel.append(o);
  };
  function updateDossiers() {
    const sel = $("docreqDossier");
    sel.replaceChildren();
    for (const d of dossiers.filter(
      (d) => d.client_id === $("docreqClient").value,
    ))
      opt(sel, d.id, d.reference || d.id);
  }
  async function loadReceived() {
    const clientId = $("docreqClient").value,
      dossierId = $("docreqDossier").value;
    const body = $("receivedRows");
    body.replaceChildren();
    $("receivedContext").textContent =
      "Documents du dossier : " +
      (dossiers.find((d) => d.id === dossierId)?.reference ||
        "Aucun dossier sélectionné");
    $("receivedNotice").textContent = "Chargement…";
    if (
      !clientId ||
      !dossierId ||
      !dossiers.some((d) => d.id === dossierId && d.client_id === clientId)
    ) {
      $("receivedNotice").textContent = "Aucun dossier sélectionné.";
      return;
    }
    const { data, error } = await db
      .from("documents")
      .select(
        "id,original_name,created_at,review_status,review_reason,storage_path",
      )
      .eq("client_id", clientId)
      .eq("dossier_id", dossierId)
      .order("created_at", { ascending: false });
    if (error) {
      $("receivedNotice").textContent = "Lecture impossible : " + error.message;
      return;
    }
    $("receivedNotice").textContent =
      (data || []).length + " document(s) reçu(s).";
    for (const doc of data || []) {
      const row = body.insertRow();
      const received = doc.created_at
        ? new Date(doc.created_at).toLocaleDateString("fr-CA")
        : "-";
      const review =
        { accepte: "Accepté", refuse: "Refusé", en_attente: "En attente" }[
          doc.review_status
        ] ||
        doc.review_status ||
        "-";
      for (const value of [
        doc.original_name,
        received,
        review,
        doc.review_reason || "-",
      ])
        {
        const cell = row.insertCell();
        cell.textContent = value;
        if (value === doc.original_name) cell.setAttribute("data-madic-user-content", "true");
        // Keep the original reason in Supabase and translate only known display text.
        // Free-form client/professional content is otherwise preserved verbatim.
        if (value === doc.review_reason) {
          cell.setAttribute("data-madic-review-reason", "true");
          if (value !== "Manque de signature") cell.setAttribute("data-madic-user-content", "true");
        }
      }
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "secondary";
      btn.textContent = "Télécharger";
      const actionCell = row.insertCell();
      actionCell.className = "madic-doc-actions";
      actionCell.append(btn);
      const reviewAction = (label, status) => {
        const action = document.createElement("button");
        action.type = "button";
        action.className = "secondary";
        action.textContent = label;
        actionCell.append(action);
        action.onclick = async () => {
          if (
            $("docreqClient").value !== clientId ||
            $("docreqDossier").value !== dossierId
          ) {
            $("receivedNotice").textContent =
              "La sélection a changé : actualisez les documents.";
            return;
          }
          let reason = null;
          if (status === "refuse") {
            reason = window.prompt(
              window.MadicDocreqT?.("Motif du refus (obligatoire, visible par le client) :") || "Motif du refus (obligatoire, visible par le client) :",
              doc.review_reason || "",
            );
            if (reason === null) return;
            reason = reason.trim();
            if (!reason || reason.length > 1000) {
              $("receivedNotice").textContent =
                "Motif requis : 1 à 1000 caractères.";
              return;
            }
          } else if (
            !window.confirm(window.MadicDocreqT?.("Confirmer l’acceptation de ce document ?") || "Confirmer l’acceptation de ce document ?")
          )
            return;
          action.disabled = true;
          try {
            const { data, error } = await db.rpc("madic_cric_review_document", {
              p_document_id: doc.id,
              p_status: status,
              p_reason: reason,
            });
            if (error) throw error;
            if (data !== true)
              throw Error(
                "Document non autorisé pour ce cabinet ou ce dossier.",
              );
            await loadReceived();
            $("receivedNotice").textContent =
              status === "accepte"
                ? "Document accepté."
                : "Document refusé. Motif enregistré.";
          } catch (e) {
            $("receivedNotice").textContent =
              "Évaluation impossible : " + e.message;
          } finally {
            action.disabled = false;
          }
        };
      };
      reviewAction(
        doc.review_status === "accepte" ? "Accepter à nouveau" : "Accepter",
        "accepte",
      );
      reviewAction(
        doc.review_status === "refuse" ? "Modifier le refus" : "Refuser",
        "refuse",
      );
      btn.onclick = async () => {
        btn.disabled = true;
        try {
          const { data: signed, error: se } = await db.storage
            .from("madic-documents")
            .createSignedUrl(doc.storage_path, 60);
          if (se || !signed?.signedUrl)
            throw Error(se?.message || "Lien indisponible");
          const a = document.createElement("a");
          a.href = signed.signedUrl;
          a.target = "_blank";
          a.rel = "noopener noreferrer";
          a.click();
        } catch (e) {
          $("receivedNotice").textContent =
            "Téléchargement impossible : " + e.message;
        } finally {
          btn.disabled = false;
        }
      };
    }
  }
  async function refresh() {
    const { data, error } = await db
      .from("madic_cric_document_requests")
      .select("id,client_id,dossier_id,title,due_on,status,created_at")
      .eq("space_id", spaceId)
      .eq("client_id", $("docreqClient").value)
      .eq("dossier_id", $("docreqDossier").value)
      .order("created_at", { ascending: false });
    if (error) throw error;
    const body = $("docreqRows");
    body.replaceChildren();
    for (const r of data || []) {
      const tr = body.insertRow();
      for (const v of [
        r.title,
        r.due_on || "-",
        { requested: "Demandé", completed: "Terminé", cancelled: "Annulé" }[
          r.status
        ] || r.status,
      ])
        {
        const cell = tr.insertCell();
        cell.textContent = v;
        if (v === r.title) cell.setAttribute("data-madic-user-content", "true");
      }
      const td = tr.insertCell();
      td.className = "madic-doc-request-action";
      const sel = document.createElement("select");
      for (const [v, t] of [
        ["requested", "Demandé"],
        ["completed", "Terminé"],
        ["cancelled", "Annulé"],
      ])
        opt(sel, v, t);
      sel.value = r.status;
      td.append(sel);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = "Enregistrer";
      td.append(btn);
      btn.onclick = async () => {
        btn.disabled = true;
        const { error } = await db
          .from("madic_cric_document_requests")
          .update({ status: sel.value })
          .eq("id", r.id)
          .eq("space_id", spaceId);
        btn.disabled = false;
        if (error) return notice(error.message);
        await refresh();
        notice("Statut enregistré.");
      };
    }
    if (!data?.length) {
      const tr = body.insertRow();
      tr.insertCell().colSpan = 4;
      tr.cells[0].textContent = "Aucune demande documentaire.";
    }
  }
  try {
    const {
      data: { user },
      error: ue,
    } = await db.auth.getUser();
    if (ue || !user) throw Error("Connexion CRIC requise.");
    const { data: apps, error: ae } = await db
      .from("madic_cric_applications")
      .select("status")
      .eq("user_id", user.id)
      .maybeSingle();
    if (ae || apps?.status !== "approved")
      throw Error("Compte CRIC non approuvé.");
    const { data: spaces, error: se } = await db
      .from("madic_cric_spaces")
      .select("id,access_status")
      .eq("owner_user_id", user.id)
      .limit(1);
    if (se || !spaces?.[0] || spaces[0].access_status !== "active")
      throw Error("Cabinet inactif.");
    spaceId = spaces[0].id;
    const { data: allowed, error: pe } = await db.rpc(
      "madic_can_manage_cric_space",
      { p_space_id: spaceId },
    );
    if (pe || allowed !== true) throw Error("Accès refusé.");
    const { data: links, error: le } = await db
      .from("madic_cric_clients")
      .select("client_id")
      .eq("space_id", spaceId);
    if (le) throw le;
    const ids = [...new Set((links || []).map((x) => x.client_id))];
    if (ids.length) {
      const { data, error } = await db
        .from("profiles")
        .select("id,first_name,last_name,email")
        .in("id", ids);
      if (error) throw error;
      clients = (data || []).map((c) => ({
        id: c.id,
        name:
          [c.first_name, c.last_name].filter(Boolean).join(" ") ||
          c.email ||
          "Client",
      }));
    }
    const { data: ds, error: de } = await db
      .from("dossiers")
      .select("id,client_id,reference")
      .eq("space_id", spaceId);
    if (de) throw de;
    dossiers = (ds || []).filter((d) => ids.includes(d.client_id));
    for (const c of clients) opt($("docreqClient"), c.id, c.name);
    if (targetClient && clients.some((c) => c.id === targetClient))
      $("docreqClient").value = targetClient;
    $("docreqClient").onchange = () => {
      updateDossiers();
      loadReceived().catch((e) => notice(e.message));
      refresh().catch((e) => notice(e.message));
    };
    updateDossiers();
    if (
      targetDossier &&
      dossiers.some(
        (d) =>
          d.id === targetDossier && d.client_id === $("docreqClient").value,
      )
    )
      $("docreqDossier").value = targetDossier;
    $("docreqDossier").onchange = () => {
      loadReceived().catch((e) => notice(e.message));
      refresh().catch((e) => notice(e.message));
    };
    $("docreqApp").hidden = false;
    await loadReceived();
    await refresh();
    notice("Demandes chargées.");
    // Transmission d'un document par le CRIC au client du dossier sélectionné.
    $("docsendForm").addEventListener("submit", async (event) => {
      event.preventDefault();
      const clientId = $("docreqClient").value;
      const dossierId = $("docreqDossier").value;
      const file = $("docsendFile").files?.[0];
      const label = $("docsendTitle").value.trim();
      const result = $("docsendNotice");
      const button = $("docsendButton");
      if (
        !clients.some((c) => c.id === clientId) ||
        !dossiers.some((d) => d.id === dossierId && d.client_id === clientId)
      ) {
        result.textContent = "Sélectionnez un client et son dossier.";
        return;
      }
      if (
        !file ||
        !["application/pdf", "image/jpeg", "image/png"].includes(file.type) ||
        file.size === 0 ||
        file.size > 10 * 1024 * 1024
      ) {
        result.textContent = "Choisissez un PDF, JPG ou PNG de 10 Mo maximum.";
        return;
      }
      const fileName = (label || file.name).slice(0, 200);
      button.disabled = true;
      result.textContent = "Transmission en cours…";
      try {
        const payload = new FormData();
        payload.append("client_id", clientId);
        payload.append("dossier_id", dossierId);
        payload.append("title", fileName);
        payload.append("file", file);
        const { data, error } = await db.functions.invoke(
          "madic-cric-send-document",
          {
            body: payload,
          },
        );
        if (error) {
          let detail = error.message;
          if (error.context && typeof error.context.json === "function") {
            try {
              const response = await error.context.json();
              detail = response.error || response.message || detail;
            } catch (_) {
              /* Keep original error. */
            }
          }
          throw Error(detail);
        }
        if (!data?.ok)
          throw Error(data?.error || "Transmission non confirmée.");
        $("docsendForm").reset();
        result.textContent =
          "Document transmis. Il est maintenant disponible dans l’espace client.";
        await loadReceived();
      } catch (error) {
        result.textContent = "Transmission impossible : " + error.message;
      } finally {
        button.disabled = false;
      }
    });
    $("docreqForm").onsubmit = async (e) => {
      e.preventDefault();
      const client_id = $("docreqClient").value,
        dossier_id = $("docreqDossier").value,
        title = $("docreqTitle").value.trim();
      if (
        !clients.some((c) => c.id === client_id) ||
        !dossiers.some(
          (d) => d.id === dossier_id && d.client_id === client_id,
        ) ||
        !title
      )
        return notice("Client, dossier et document obligatoires.");
      const { error } = await db.from("madic_cric_document_requests").insert({
        space_id: spaceId,
        client_id,
        dossier_id,
        title,
        instructions: $("docreqInstructions").value.trim() || null,
        due_on: $("docreqDue").value || null,
      });
      if (error) return notice("Création impossible : " + error.message);
      $("docreqTitle").value = "";
      $("docreqInstructions").value = "";
      $("docreqDue").value = "";
      await refresh();
      notice("Demande créée.");
    };
  } catch (e) {
    notice("Chargement impossible : " + e.message);
  }
})();


/* Source: madic-i18n-cric(7).js */
/* MADIC bilingual RCIC workspace. UI-only: no Supabase calls, no mutation of business data. */
(() => {
  'use strict';
  const dictionary = {"Espace professionnel":"Professional workspace","NAVIGATION":"NAVIGATION","Vue d’ensemble":"Overview","Clients":"Clients","Outils CRIC":"RCIC tools","Messagerie":"Messages","Rendez-vous":"Appointments","Documents":"Documents","Échéances":"Deadlines","Facturation":"Invoicing","Finances":"Finances","Mon profil professionnel":"My professional profile","Espace sécurisé MADIC":"Secure MADIC workspace","Mon espace":"My space","Aller au contenu principal":"Skip to main content","Gestion des clients CRIC":"RCIC client management","Demandes de documents →":"Document requests →","Vérification de votre espace…":"Checking your workspace…","← Retour à mon espace CRIC":"← Back to my RCIC workspace","Déconnexion":"Sign out","Clients associés":"Associated clients","Dans votre espace professionnel":"In your professional workspace","Dossiers associés":"Associated cases","Pour les clients autorisés":"For authorized clients","Résultats de recherche":"Search results","Clients affichés ci-dessous":"Clients shown below","Répertoire des clients":"Client directory","Inviter un client":"Invite a client","Importer une liste":"Import a list","Dossiers CRIC":"RCIC cases","RÉPERTOIRE CLIENTS":"CLIENT DIRECTORY","Uniquement les clients autorisés dans votre espace CRIC.":"Only clients authorized in your RCIC workspace.","Nom":"Name","Courriel":"Email","Téléphone":"Phone","Dossiers":"Cases","Factures":"Invoices","Action":"Action","Actions":"Actions","INVITATIONS INDIVIDUELLES":"INDIVIDUAL INVITATIONS","Inviter un client dans votre cabinet":"Invite a client to your practice","Une invitation privée lie le client exclusivement à votre espace CRIC.":"A private invitation links the client exclusively to your RCIC workspace.","Vérification du profil professionnel…":"Checking professional profile…","Courriel du client":"Client email","Envoyer l’invitation par courriel":"Send invitation by email","Lien personnel (copie de secours)":"Personal link (backup copy)","Copier le lien":"Copy link","Le courriel est envoyé automatiquement par MADIC PORTAIL. L’invitation est personnelle et valable pendant 7 jours.":"The email is sent automatically by MADIC PORTAIL. The personal invitation is valid for 7 days.","IMPORTATION GROUPÉE":"BULK IMPORT","Importer des invitations clients (CSV / Excel)":"Import client invitations (CSV / Excel)","Modèle Excel MADIC :":"MADIC Excel template:","Télécharger le modèle Excel à remplir (.xlsx)":"Download the Excel template (.xlsx)","Fichier de clients (colonne courriel ou email obligatoire)":"Client file (email column required)","Seuls les courriels sont utilisés pour les invitations. Les autres colonnes ne sont pas transmises.":"Only email addresses are used for invitations. Other columns are not transmitted.","Vérification du profil professionnel avant les invitations…":"Checking professional profile before invitations…","Vérification":"Verification","Résultat":"Result","Confirmer et envoyer les invitations":"Confirm and send invitations","Annuler / effacer":"Cancel / clear","Outils professionnels CRIC":"Professional RCIC tools","ESPACE PROFESSIONNEL CRIC":"RCIC PROFESSIONAL WORKSPACE","Préparez vos formulaires, contrats et analyses à partir des dossiers autorisés de votre cabinet.":"Prepare forms, contracts and analyses using authorized cases in your practice.","CENTRE DE TRAVAIL · CRIC":"RCIC WORKSPACE","Vos dossiers. Vos outils. Un seul espace.":"Your cases. Your tools. One workspace.","Sélectionnez un client, puis son dossier pour préparer les documents et les analyses professionnelles.":"Select a client and their case to prepare professional documents and analyses.","Clients autorisés":"Authorized clients","Associés à votre cabinet":"Associated with your practice","Dossiers accessibles":"Accessible cases","Dans votre espace CRIC":"In your RCIC workspace","Dossier sélectionné":"Selected case","Aucun":"None","Pour préparer les outils":"To prepare tools","Formulaires IRCC":"IRCC forms","Contrats":"Contracts","Analyse préliminaire":"Preliminary analysis","Suivi Kanban des dossiers":"Kanban case tracking","Centre des outils professionnels":"Professional tools center","Sélectionnez un client et son dossier pour préparer vos documents de travail. Les résultats doivent être vérifiés et approuvés par le consultant avant toute utilisation.":"Select a client and case to prepare working documents. The consultant must review and approve results before use.","Client associé au cabinet":"Client associated with the practice","Sélectionner un client":"Select a client","Dossier":"Case","Sélectionner un dossier":"Select a case","1. Formulaires IRCC automatisés":"1. Automated IRCC forms","Préparation des renseignements à partir du profil du client. Les PDF officiels ne sont pas générés à ce stade.":"Prepare information from the client profile. Official PDFs are not generated at this stage.","Formulaire IRCC":"IRCC form","Autre formulaire-à définir":"Other form—to be determined","Préparer la fiche de renseignements":"Prepare information sheet","OUTILS CRIC · GESTION CONTRACTUELLE":"RCIC TOOLS · CONTRACT MANAGEMENT","2. Contrats":"2. Contracts","Choisissez le contrat adapté à votre mandat. Les informations du client et du dossier sélectionnés seront transmises à la page de préparation.":"Choose the contract for your mandate. The selected client and case information will be passed to the preparation page.","PREMIÈRE CONSULTATION":"INITIAL CONSULTATION","Contrat de consultation initiale":"Initial consultation agreement","Encadrez la première consultation, son objet, les honoraires et les conditions de prestation.":"Set out the initial consultation, its purpose, fees and terms of service.","Préparer le contrat":"Prepare contract","MANDAT DE REPRÉSENTATION":"REPRESENTATION MANDATE","Contrat de services professionnels":"Professional services agreement","Définissez les services convenus, les responsabilités, les honoraires et les modalités du mandat.":"Define agreed services, responsibilities, fees and mandate terms.","Sélectionnez un client et un dossier ci-dessus avant d’ouvrir un contrat.":"Select a client and case above before opening a contract.","Les clauses, les honoraires et les signatures doivent être vérifiés et validés avant transmission au client.":"Clauses, fees and signatures must be checked and approved before sending to the client.","3. Résultat de l’analyse préliminaire":"3. Preliminary analysis results","Rédigez une évaluation professionnelle provisoire, sans décision automatique d’admissibilité.":"Draft a provisional professional assessment, without an automatic eligibility decision.","Programme ou voie d’immigration":"Immigration program or pathway","Appréciation préliminaire":"Preliminary assessment","Analyse à compléter":"Analysis pending","Éléments favorables à vérifier":"Favorable factors to verify","Renseignements supplémentaires requis":"Additional information required","Critères potentiellement non satisfaits":"Potentially unmet criteria","Constats et critères examinés":"Findings and criteria reviewed","Documents manquants et prochaines étapes":"Missing documents and next steps","Préparer le compte rendu":"Prepare report","Messagerie sécurisée":"Secure messaging","Échangez avec vos clients et retrouvez vos conversations et pièces jointes dans un espace sécurisé.":"Communicate with clients and access conversations and attachments in a secure workspace.","Vérification des autorisations…":"Checking permissions…","Conversations":"Conversations","Client du cabinet":"Practice client","Choisir un client…":"Choose a client…","Objet":"Subject","Nouvelle conversation":"New conversation","Actualiser":"Refresh","Sélectionnez une conversation":"Select a conversation","Votre message":"Your message","Envoyer":"Send","Rendez-vous et consultations":"Appointments and consultations","Gérez vos créneaux et les demandes de vos clients.":"Manage your availability and client requests.","Gestion des clients →":"Client management →","Vérification des accès…":"Checking access…","Publier une disponibilité":"Publish availability","Date de début (heure de Montréal)":"Start date (Montreal time)","Heure de début (heure de Montréal)":"Start time (Montreal time)","Choisir une heure":"Choose a time","Durée de consultation":"Consultation duration","1 heure":"1 hour","2 heures":"2 hours","3 heures":"3 hours","4 heures":"4 hours","5 heures":"5 hours","6 heures":"6 hours","7 heures":"7 hours","8 heures":"8 hours","Fin calculée automatiquement (heure de Montréal)":"Automatically calculated end (Montreal time)","Type de consultation":"Consultation type","Visioconférence":"Video call","En personne":"In person","Lieu ou lien (facultatif)":"Location or link (optional)","Publier le créneau":"Publish time slot","AGENDA PROFESSIONNEL":"PROFESSIONAL CALENDAR","Calendrier des consultations":"Consultation calendar","Visualisez les créneaux et les réservations, puis sélectionnez une journée pour publier une disponibilité.":"View time slots and bookings, then select a day to publish availability.","Aujourd'hui":"Today","Disponible":"Available","Demandé":"Requested","Confirmé":"Confirmed","Fermé":"Closed","Lun":"Mon","Mar":"Tue","Mer":"Wed","Jeu":"Thu","Ven":"Fri","Sam":"Sat","Dim":"Sun","Mes disponibilités":"My availability","Les nouveaux créneaux commencent à l’heure juste. Les anciens rendez-vous conservent leurs horaires.":"New slots start on the hour. Existing appointments retain their scheduled times.","Début":"Start","Fin":"End","Type":"Type","État":"State","Réservations et demandes":"Bookings and requests","Client":"Client","Statut":"Status","Gestion documentaire du client":"Client document management","← Retour à la gestion des clients":"← Back to client management","Choisissez un dossier, examinez les pièces reçues et suivez les documents demandés.":"Choose a case, review received files and track requested documents.","Chargement…":"Loading…","Étape 1 · Dossier":"Step 1 · Case","Choisir le client et le dossier":"Choose client and case","+ Demander une nouvelle pièce au client":"+ Request a new document from the client","Cette demande apparaîtra dans l'espace du client.":"This request will appear in the client's workspace.","Document demandé":"Requested document","Instructions":"Instructions","Date limite (facultatif)":"Due date (optional)","Envoyer la demande":"Send request","+ Envoyer un document au client":"+ Send a document to the client","Fichier à transmettre (PDF, JPG ou PNG, 10 Mo maximum)":"File to send (PDF, JPG or PNG, 10 MB maximum)","Nom du document (facultatif)":"Document name (optional)","Envoyer le document":"Send document","Étape 2 · Vérification":"Step 2 · Review","Documents reçus":"Received documents","Téléchargez et évaluez chaque document. En cas de refus, précisez le motif qui sera visible par le client.":"Download and review each document. If rejected, provide a reason visible to the client.","Fichier":"File","Reçu le":"Received on","Évaluation":"Assessment","Motif du refus":"Reason for rejection","Étape 3 · Suivi":"Step 3 · Tracking","Demandes envoyées":"Sent requests","Demandes concernant uniquement le dossier sélectionné. Le statut d'une demande est distinct de l'évaluation d'un fichier.":"Requests for the selected case only. Request status is separate from file assessment.","Pièce demandée":"Requested item","Date limite":"Due date","Mettre à jour":"Update","Échéances de mon cabinet":"Practice deadlines","← Mon espace CRIC":"← My RCIC workspace","Échéances et rappels":"Deadlines and reminders","Suivez les dates importantes de vos dossiers et les actions à réaliser.":"Track important case dates and required actions.","Vérification de votre cabinet…":"Checking your practice…","Ajouter une échéance":"Add a deadline","Dossier *":"Case *","Description de l’échéance *":"Deadline description *","Date limite *":"Due date *","Enregistrer l'échéance":"Save deadline","Mes échéances":"My deadlines","Description":"Description","Date":"Date","Situation":"Status","Les échéances sont affichées dans votre espace CRIC. Vérifiez régulièrement vos dates limites et les notifications applicables.":"Deadlines are shown in your RCIC workspace. Regularly check due dates and relevant notifications.","Facturation de mon cabinet":"Practice invoicing","Vérification de votre accès…":"Checking your access…","Paiements Stripe Connect":"Stripe Connect payments","Connectez le compte Stripe de votre cabinet pour recevoir directement les paiements de vos clients.":"Connect your practice's Stripe account to receive client payments directly.","Vérification de la connexion Stripe…":"Checking Stripe connection…","Connecter mon compte Stripe":"Connect my Stripe account","Créer une facture":"Create an invoice","Client *":"Client *","Dossier (facultatif)":"Case (optional)","Aucun dossier":"No cases","Nom du cabinet *":"Practice name *","Adresse du cabinet":"Practice address","Numéros de taxes (si applicables)":"Tax numbers (if applicable)","Logo du cabinet (PNG ou JPG, max. 100 Ko)":"Practice logo (PNG or JPG, max. 100 KB)","Lignes de facturation":"Invoice line items","Quantité":"Quantity","Prix unitaire (CAD)":"Unit price (CAD)","Montant":"Amount","+ Ajouter une ligne":"+ Add a line","Sous-total : 0,00 $":"Subtotal: $0.00","Taux total de taxes applicable (%)":"Total applicable tax rate (%)","Date d'échéance":"Due date","Notes":"Notes","Créer la facture":"Create invoice","Mes factures":"My invoices","Numéro":"Number","Émission":"Issued","Total":"Total","Payé":"Paid","Gestion financière CRIC":"RCIC financial management","Gestion financière du cabinet CRIC":"RCIC practice financial management","Temps et honoraires · Facturation · Paiements · Fidéicommis · Comptabilité · Rapports":"Time and fees · Invoicing · Payments · Trust accounts · Accounting · Reports","Cabinet :":"Practice:","Non sélectionné":"Not selected","Initialisation…":"Initializing…","Retour à mon espace professionnel CRIC":"Back to my RCIC professional workspace","Temps et honoraires":"Time and fees","Ces renseignements identifient votre cabinet dans les invitations à vos clients.":"This information identifies your practice in client invitations.","Renseignements du cabinet":"Practice information","Les champs marqués d’un astérisque sont obligatoires. Vos informations sont enregistrées dans votre espace professionnel.":"Fields marked with an asterisk are required. Your information is saved in your professional workspace.","Nom déclaré à l’inscription CRIC":"Name provided during RCIC registration","Courriel professionnel déclaré à l’inscription":"Professional email provided during registration","Prénom *":"First name *","Nom *":"Last name *","Titre professionnel *":"Professional title *","Numéro de permis CRIC *":"RCIC licence number *","Nom de l’entreprise *":"Business name *","Site Web de l’entreprise (facultatif)":"Business website (optional)","Téléphone professionnel *":"Business phone *","Adresse professionnelle du cabinet":"Professional practice address","Numéro civique *":"Street number *","Rue *":"Street *","Bureau, suite ou local (facultatif)":"Office, suite or unit (optional)","Ville *":"City *","Province, État ou district *":"Province, state or district *","Code postal (facultatif)":"Postal code (optional)","Pays *":"Country *","Sélectionner un pays":"Select a country","Enregistrer":"Save","Annuler":"Cancel","Fermer":"Close","Continuer":"Continue","Confirmer":"Confirm","Refuser":"Decline","Supprimer":"Delete","Modifier":"Edit","Voir":"View","Télécharger":"Download","En attente":"Pending","Annulé":"Cancelled","Annulée":"Cancelled","Accepté":"Accepted","Acceptée":"Accepted","Rejeté":"Rejected","Rejetée":"Rejected","Validé":"Approved","Validée":"Approved","Approuvé":"Approved","Approuvée":"Approved","Oui":"Yes","Non":"No","Aucun résultat":"No results","Aucune donnée":"No data","Aucun client":"No clients","Aucun rendez-vous":"No appointments","En cours":"In progress","Terminé":"Completed","Terminée":"Completed","Envoyé":"Sent","Envoyée":"Sent","Brouillon":"Draft","Enregistrer les modifications":"Save changes","Profil mis à jour":"Profile updated","© MAD Immigration Canadienne · Portail sécurisé":"© MAD Immigration Canadienne · Secure portal","© MADIC · Plateforme professionnelle":"© MADIC · Professional platform","Île de l’Ascension":"Ascension Island","Andorre":"Andorra","Émirats arabes unis":"United Arab Emirates","Afghanistan":"Afghanistan","Antigua-et-Barbuda":"Antigua & Barbuda","Anguilla":"Anguilla","Albanie":"Albania","Arménie":"Armenia","Angola":"Angola","Antarctique":"Antarctica","Argentine":"Argentina","Samoa américaines":"American Samoa","Autriche":"Austria","Australie":"Australia","Aruba":"Aruba","Îles Åland":"Åland Islands","Azerbaïdjan":"Azerbaijan","Bosnie-Herzégovine":"Bosnia & Herzegovina","Barbade":"Barbados","Bangladesh":"Bangladesh","Belgique":"Belgium","Burkina Faso":"Burkina Faso","Bulgarie":"Bulgaria","Bahreïn":"Bahrain","Burundi":"Burundi","Bénin":"Benin","Saint-Barthélemy":"St. Barthélemy","Bermudes":"Bermuda","Brunei":"Brunei","Bolivie":"Bolivia","Pays-Bas caribéens":"Caribbean Netherlands","Brésil":"Brazil","Bahamas":"Bahamas","Bhoutan":"Bhutan","Île Bouvet":"Bouvet Island","Botswana":"Botswana","Biélorussie":"Belarus","Belize":"Belize","Canada":"Canada","Îles Cocos":"Cocos (Keeling) Islands","Congo-Kinshasa":"Congo - Kinshasa","République centrafricaine":"Central African Republic","Congo-Brazzaville":"Congo - Brazzaville","Suisse":"Switzerland","Côte d’Ivoire":"Côte d’Ivoire","Îles Cook":"Cook Islands","Chili":"Chile","Cameroun":"Cameroon","Chine":"China","Colombie":"Colombia","Île Clipperton":"Clipperton Island","Costa Rica":"Costa Rica","Cuba":"Cuba","Cap-Vert":"Cape Verde","Curaçao":"Curaçao","Île Christmas":"Christmas Island","Chypre":"Cyprus","Tchéquie":"Czechia","Allemagne":"Germany","Diego Garcia":"Diego Garcia","Djibouti":"Djibouti","Danemark":"Denmark","Dominique":"Dominica","République dominicaine":"Dominican Republic","Algérie":"Algeria","Ceuta et Melilla":"Ceuta & Melilla","Équateur":"Ecuador","Estonie":"Estonia","Égypte":"Egypt","Sahara occidental":"Western Sahara","Érythrée":"Eritrea","Espagne":"Spain","Éthiopie":"Ethiopia","Union européenne":"European Union","zone euro":"Eurozone","Finlande":"Finland","Fidji":"Fiji","Îles Malouines":"Falkland Islands","Micronésie":"Micronesia","Îles Féroé":"Faroe Islands","France":"France","Gabon":"Gabon","Royaume-Uni":"United Kingdom","Grenade":"Grenada","Géorgie":"Georgia","Guyane française":"French Guiana","Guernesey":"Guernsey","Ghana":"Ghana","Gibraltar":"Gibraltar","Groenland":"Greenland","Gambie":"Gambia","Guinée":"Guinea","Guadeloupe":"Guadeloupe","Guinée équatoriale":"Equatorial Guinea","Grèce":"Greece","Géorgie du Sud-et-les Îles Sandwich du Sud":"South Georgia & South Sandwich Islands","Guatemala":"Guatemala","Guam":"Guam","Guinée-Bissau":"Guinea-Bissau","Guyana":"Guyana","R.A.S. chinoise de Hong Kong":"Hong Kong SAR China","Îles Heard-et-MacDonald":"Heard & McDonald Islands","Honduras":"Honduras","Croatie":"Croatia","Haïti":"Haiti","Hongrie":"Hungary","Îles Canaries":"Canary Islands","Indonésie":"Indonesia","Irlande":"Ireland","Israël":"Israel","Île de Man":"Isle of Man","Inde":"India","Territoire britannique de l’océan Indien":"British Indian Ocean Territory","Irak":"Iraq","Iran":"Iran","Islande":"Iceland","Italie":"Italy","Jersey":"Jersey","Jamaïque":"Jamaica","Jordanie":"Jordan","Japon":"Japan","Kenya":"Kenya","Kirghizstan":"Kyrgyzstan","Cambodge":"Cambodia","Kiribati":"Kiribati","Comores":"Comoros","Saint-Christophe-et-Niévès":"St. Kitts & Nevis","Corée du Nord":"North Korea","Corée du Sud":"South Korea","Koweït":"Kuwait","Îles Caïmans":"Cayman Islands","Kazakhstan":"Kazakhstan","Laos":"Laos","Liban":"Lebanon","Sainte-Lucie":"St. Lucia","Liechtenstein":"Liechtenstein","Sri Lanka":"Sri Lanka","Liberia":"Liberia","Lesotho":"Lesotho","Lituanie":"Lithuania","Luxembourg":"Luxembourg","Lettonie":"Latvia","Libye":"Libya","Maroc":"Morocco","Monaco":"Monaco","Moldavie":"Moldova","Monténégro":"Montenegro","Saint-Martin":"St. Martin","Madagascar":"Madagascar","Îles Marshall":"Marshall Islands","Macédoine du Nord":"North Macedonia","Mali":"Mali","Myanmar (Birmanie)":"Myanmar (Burma)","Mongolie":"Mongolia","R.A.S. chinoise de Macao":"Macao SAR China","Îles Mariannes du Nord":"Northern Mariana Islands","Martinique":"Martinique","Mauritanie":"Mauritania","Montserrat":"Montserrat","Malte":"Malta","Maurice":"Mauritius","Maldives":"Maldives","Malawi":"Malawi","Mexique":"Mexico","Malaisie":"Malaysia","Mozambique":"Mozambique","Namibie":"Namibia","Nouvelle-Calédonie":"New Caledonia","Niger":"Niger","Île Norfolk":"Norfolk Island","Nigeria":"Nigeria","Nicaragua":"Nicaragua","Pays-Bas":"Netherlands","Norvège":"Norway","Népal":"Nepal","Nauru":"Nauru","Niue":"Niue","Nouvelle-Zélande":"New Zealand","Oman":"Oman","Panama":"Panama","Pérou":"Peru","Polynésie française":"French Polynesia","Papouasie-Nouvelle-Guinée":"Papua New Guinea","Philippines":"Philippines","Pakistan":"Pakistan","Pologne":"Poland","Saint-Pierre-et-Miquelon":"St. Pierre & Miquelon","Îles Pitcairn":"Pitcairn Islands","Porto Rico":"Puerto Rico","Territoires palestiniens":"Palestinian Territories","Portugal":"Portugal","Palaos":"Palau","Paraguay":"Paraguay","Qatar":"Qatar","régions éloignées de l’Océanie":"Outlying Oceania","La Réunion":"Réunion","Roumanie":"Romania","Serbie":"Serbia","Russie":"Russia","Rwanda":"Rwanda","Arabie saoudite":"Saudi Arabia","Îles Salomon":"Solomon Islands","Seychelles":"Seychelles","Soudan":"Sudan","Suède":"Sweden","Singapour":"Singapore","Sainte-Hélène":"St. Helena","Slovénie":"Slovenia","Svalbard et Jan Mayen":"Svalbard & Jan Mayen","Slovaquie":"Slovakia","Sierra Leone":"Sierra Leone","Saint-Marin":"San Marino","Sénégal":"Senegal","Somalie":"Somalia","Suriname":"Suriname","Soudan du Sud":"South Sudan","Sao Tomé-et-Principe":"São Tomé & Príncipe","Salvador":"El Salvador","Saint-Martin (partie néerlandaise)":"Sint Maarten","Syrie":"Syria","Eswatini":"Eswatini","Tristan da Cunha":"Tristan da Cunha","Îles Turques-et-Caïques":"Turks & Caicos Islands","Tchad":"Chad","Terres australes françaises":"French Southern Territories","Togo":"Togo","Thaïlande":"Thailand","Tadjikistan":"Tajikistan","Tokelau":"Tokelau","Timor oriental":"Timor-Leste","Turkménistan":"Turkmenistan","Tunisie":"Tunisia","Tonga":"Tonga","Turquie":"Türkiye","Trinité-et-Tobago":"Trinidad & Tobago","Tuvalu":"Tuvalu","Taïwan":"Taiwan","Tanzanie":"Tanzania","Ukraine":"Ukraine","Ouganda":"Uganda","Îles mineures éloignées des États-Unis":"U.S. Outlying Islands","Nations Unies":"United Nations","États-Unis":"United States","Uruguay":"Uruguay","Ouzbékistan":"Uzbekistan","État de la Cité du Vatican":"Vatican City","Saint-Vincent-et-les Grenadines":"St. Vincent & Grenadines","Venezuela":"Venezuela","Îles Vierges britanniques":"British Virgin Islands","Îles Vierges des États-Unis":"U.S. Virgin Islands","Viêt Nam":"Vietnam","Vanuatu":"Vanuatu","Wallis-et-Futuna":"Wallis & Futuna","Samoa":"Samoa","pseudo-accents":"Pseudo-Accents","pseudo-bidi":"Pseudo-Bidi","Kosovo":"Kosovo","Yémen":"Yemen","Mayotte":"Mayotte","Afrique du Sud":"South Africa","Zambie":"Zambia","Zimbabwe":"Zimbabwe","région indéterminée":"Unknown Region","Le fichier sera accessible dans l’espace du client, sous « Historique et évaluations de mes documents », pour le dossier sélectionné ci-dessus.":"The file will be available in the client workspace under “History and assessments of my documents” for the selected case.","La fin est calculée automatiquement à partir du début et de la durée choisie. Le lien ou lieu est communiqué au client après confirmation. Aucun lien Teams n'est créé automatiquement.":"The end time is calculated automatically from the start and selected duration. The link or location is shared with the client after confirmation. No Teams link is created automatically.","Le logo est enregistré dans chaque nouvelle facture. Sélectionnez-le de nouveau pour les factures suivantes.":"The logo is saved in each new invoice. Select it again for subsequent invoices.","Saisissez le taux applicable à votre situation. MADIC ne détermine pas les obligations fiscales de votre cabinet.":"Enter the rate applicable to your situation. MADIC does not determine your practice’s tax obligations.","Modèles 1 et 2 disponibles dans Fidéicommis. Les paramètres du modèle et les comptes peuvent être enregistrés. Les écritures financières restent en lecture seule. Les rapports et paiements affichent des données de consultation, sans rapprochement bancaire.":"Models 1 and 2 are available under Trust accounts. Model settings and accounts can be saved. Financial entries remain read-only. Reports and payments display information for review, without bank reconciliation.","Le nom complet et le courriel proviennent de votre inscription CRIC. Vérifiez la répartition prénom/nom lors du premier remplissage.":"Your full name and email come from your RCIC registration. Check the first and last name fields when completing this form for the first time.","Renseignez les champs ci-dessous. L’ancienne adresse est conservée jusqu’à votre premier enregistrement.":"Complete the fields below. The previous address is retained until you save for the first time.","Préparez des invitations à partir d'un fichier CSV, XLSX ou XLS. Aucun client n'est créé automatiquement : chaque personne doit accepter son invitation personnelle.":"Prepare invitations from a CSV, XLSX or XLS file. No client is created automatically: each person must accept their personal invitation.",". Remplissez l’onglet « Clients » avec les courriels des personnes à inviter, puis importez le fichier ci-dessous. Seuls les courriels servent à envoyer les invitations.":". Fill in the “Clients” sheet with the email addresses of people to invite, then import the file below. Only email addresses are used to send invitations.","IMM 5476-Recours aux services d’un représentant":"IMM 5476 – Use of a Representative","IMM 0008-Demande générique pour le Canada":"IMM 0008 – Generic Application Form for Canada","IMM 5406-Renseignements additionnels sur la famille":"IMM 5406 – Additional Family Information","IMM 5669-Antécédents / Déclaration":"IMM 5669 – Schedule A: Background / Declaration","Gestion financière CRIC | MADIC":"RCIC financial management | MADIC","Échéances de mon cabinet | MADIC":"My practice deadlines | MADIC","Les modifications de votre profil professionnel ont été enregistrées avec succès.":"Changes to your professional profile have been saved successfully.","Le paiement par Portail MADIC n'est pas encore activé : cette option ne déclenche aucun encaissement.":"Payments through MADIC Portail are not yet enabled: this option does not collect payments.","Recevez un virement par courriel ou téléphone":"Receive an e-transfer by email or phone","Choisissez les moyens de paiement acceptés par votre cabinet. Ils seront repris automatiquement dans vos contrats.":"Choose the payment methods accepted by your practice. They will automatically appear in your contracts.","Courriel ou numéro pour recevoir les virements":"Email address or phone number for e-transfers","Lors d’une modification, le logo déjà enregistré est conservé si vous ne sélectionnez pas de nouveau fichier.":"When editing, the saved logo is retained unless you select a new file.","Adresse complète (générée automatiquement)":"Full address (generated automatically)","Vos modifications ne sont enregistrées qu’après confirmation.":"Your changes are only saved after confirmation."};
  Object.assign(dictionary, {
    "Espace chargé. Les données sont soumises aux autorisations Supabase.": "Workspace loaded. Data is subject to Supabase permissions.",
    "Outils de préparation disponibles. Aucun document n’est automatiquement enregistré.": "Preparation tools available. No document is saved automatically.",
    "Messagerie du cabinet chargée.": "Practice messaging loaded.",
    "Dernière vérification automatique": "Last automatic check",
    "Rechercher une conversation": "Search conversations",
    "Nom du client ou objet...": "Client name or subject...",
    "Conversation générale": "General conversation",
    "Disponibilités et réservations actualisées.": "Availability and bookings updated.",
    "Notifications de rendez-vous": "Appointment notifications",
    "Aucune notification non lue.": "No unread notifications.",
    "Nouvelle demande de rendez-vous": "New appointment request",
    "Demandes chargées.": "Requests loaded.",
    "Choisissez un dossier, examinez les pièces reçues et suivez les documents demandés.": "Choose a case, review received files and track requested documents.",
    "Téléchargez et évaluez chaque document. En cas de refus, précisez le motif qui sera visible par le client.": "Download and review each document. If rejected, provide a reason visible to the client.",
    "Documents du dossier": "Case documents",
    "document(s) reçu(s).": "document(s) received.",
    "Ex. Date limite de transmission": "E.g. submission deadline",
    "Compte Stripe créé. Configuration ou vérification en attente.": "Stripe account created. Setup or verification pending.",
    "Continuer la configuration Stripe": "Continue Stripe setup",
    "Aucune donnée enregistrée pour ce cabinet.": "No data recorded for this practice.",
    "Profil enregistré. Vous pouvez le modifier.": "Profile saved. You can edit it.",
    "Ces renseignements identifient votre cabinet dans les invitations à vos clients.": "This information identifies your practice in invitations to clients.",
    "Le nom complet et le courriel proviennent de votre inscription CRIC. Vérifiez la répartition prénom/nom lors du premier remplissage.": "Your full name and email come from your RCIC registration. Check the first and last name fields when filling out the form for the first time.",
    "Choisir un fichier": "Choose a file",
    "Aucun fichier choisi": "No file selected",
    "Fidéicommis": "Trust accounting",
    "Comptabilité": "Accounting",
    "Rapports": "Reports",
    "Paiements": "Payments",
    "Cabinet": "Practice",
    "Temps et honoraires": "Time and fees",
    "Aucune donnée enregistrée pour ce cabinet.": "No data recorded for this practice."
  });

  /* Document request form: translate placeholders, including dynamically rendered fields. */
  Object.assign(dictionary, {
    "Ex. Copie du passeport": "e.g. Passport copy",
    "Précisions facultatives": "Optional details",
    "Ex. Lettre de confirmation": "e.g. Confirmation letter",
    "Choisir un fichier": "Choose file",
    "Aucun fichier choisi": "No file selected",
    "Fichier sélectionné": "Selected file",
    "jj/mm/aaaa": "mm/dd/yyyy"
  });

  /* Document management: missing dynamic FR/EN strings (UI only). */
  Object.assign(dictionary, {
    "Accepté": "Accepted",
    "Refusé": "Rejected",
    "En attente": "Pending",
    "Télécharger": "Download",
    "Accepter": "Accept",
    "Accepter à nouveau": "Accept again",
    "Modifier le refus": "Edit rejection",
    "Refuser": "Reject",
    "Aucune demande documentaire.": "No document requests.",
    "Manque de signature": "Missing signature",
    "Demandé": "Requested",
    "Terminé": "Completed",
    "Annulé": "Cancelled",
    "Enregistrer": "Save",
    "Statut enregistré.": "Status saved.",
    "Document accepté.": "Document accepted.",
    "Document refusé. Motif enregistré.": "Document rejected. Reason saved.",
    "Demandes chargées.": "Requests loaded.",
    "Chargement…": "Loading…",
    "Aucun dossier sélectionné": "No case selected",
    "Aucun dossier sélectionné.": "No case selected.",
    "Lecture impossible": "Unable to load",
    "La sélection a changé : actualisez les documents.": "The selection has changed: refresh the documents.",
    "Motif du refus (obligatoire, visible par le client) :": "Reason for rejection (required, visible to the client):",
    "Motif requis : 1 à 1000 caractères.": "Reason required: 1 to 1000 characters.",
    "Confirmer l’acceptation de ce document ?": "Confirm acceptance of this document?",
    "Document non autorisé pour ce cabinet ou ce dossier.": "Document not authorized for this practice or case.",
    "Évaluation impossible": "Unable to review",
    "Lien indisponible": "Link unavailable",
    "Téléchargement impossible": "Download failed",
    "Connexion CRIC requise.": "RCIC sign-in required.",
    "Compte CRIC non approuvé.": "RCIC account not approved.",
    "Cabinet inactif.": "Inactive practice.",
    "Accès refusé.": "Access denied.",
    "Configuration Supabase manquante.": "Supabase configuration missing.",
    "Sélectionnez un client et son dossier.": "Select a client and its case.",
    "Choisissez un PDF, JPG ou PNG de 10 Mo maximum.": "Choose a PDF, JPG or PNG file, maximum 10 MB.",
    "Transmission en cours…": "Sending…",
    "Transmission non confirmée.": "Transmission not confirmed.",
    "Document transmis. Il est maintenant disponible dans l’espace client.": "Document sent. It is now available in the client workspace.",
    "Transmission impossible": "Unable to send",
    "Client, dossier et document obligatoires.": "Client, case and document are required.",
    "Création impossible": "Unable to create",
    "Demande créée.": "Request created.",
    "Chargement impossible": "Unable to load",
    "Déconnexion impossible": "Unable to sign out",
    "document(s) reçu(s).": "document(s) received.",
    "Documents du dossier": "Case documents",
    "Aucun document reçu.": "No documents received."
});
  const key = 'madic_ui_language';
  let lang = 'fr';
  try { lang = localStorage.getItem(key) === 'en' ? 'en' : 'fr'; } catch (_) {}
  const normalized = value => String(value ?? '').replace(/\s+/g, ' ').trim();
  const reverse = new Map();
  Object.entries(dictionary).forEach(([fr, en]) => {
    if (fr !== en && !reverse.has(normalized(en))) reverse.set(normalized(en), fr);
  });
  const originals = new WeakMap();
  const rendered = new WeakMap();
  const originalAttrs = new WeakMap();
  const renderedAttrs = new WeakMap();
  const attrs = ['placeholder', 'title', 'aria-label'];
  const ignored = node => !!node.parentElement?.closest('script,style,code,pre,textarea,[contenteditable="true"],.madic-lang-controls,[data-madic-user-content="true"]');
  const patterns = [
    [/^Nouvelle demande de rendez-vous\s*-\s*/i, 'New appointment request - '],
    [/^Dernière vérification automatique\s*:/i, 'Last automatic check:'],
    [/^Documents du dossier\s*:/i, 'Case documents:'],
    [/^Espace professionnel\s*:/i, 'Professional workspace:'],
    [/^Espace de facturation du cabinet\s*:/i, 'Practice invoicing workspace:'],
    [/^Cabinet\s*:/i, 'Practice:'],
    [/^\d+\s+document\(s\) reçu\(s\)\./i, s => s.replace('document(s) reçu(s)', 'document(s) received')],
    [/^\d+\s+échéances?\s*·/i, s => s.replace(/échéances?/, 'deadlines').replace(/dépassée?s?/, 'overdue').replace(/à traiter dans les/, 'due within the').replace(/prochains jours/, 'next days')],
    [/^\d+\s+ligne\(s\) affichée\(s\)\./i, s => s.replace('ligne(s) affichée(s)', 'row(s) displayed')],
    [/^Consultation\s*-\s*\d+\s+ligne\(s\) affichée\(s\)/i, s => s.replace('ligne(s) affichée(s)', 'row(s) displayed')]
  ];
  function toFrench(value) {
    const text = normalized(value);
    return reverse.get(text) || value;
  }
  function toEnglish(value) {
    const text = normalized(value);
    if (Object.prototype.hasOwnProperty.call(dictionary, text)) return dictionary[text];
    for (const [pattern, replacement] of patterns) {
      if (pattern.test(text)) return text.replace(pattern, replacement);
    }
    return value;
  }
  function localized(original) {
    const trimmed = normalized(original);
    const output = lang === 'en' ? toEnglish(trimmed) : toFrench(trimmed);
    if (output === trimmed) return original;
    const start = original.indexOf(trimmed);
    return start < 0 ? output : original.slice(0, start) + output + original.slice(start + trimmed.length);
  }
  function translateText(node) {
    if (!node?.parentElement || ignored(node)) return;
    const current = node.nodeValue;
    if (!normalized(current)) return;
    if (!originals.has(node) || rendered.get(node) !== current) originals.set(node, current);
    const next = localized(originals.get(node));
    if (next !== current) node.nodeValue = next;
    rendered.set(node, next);
  }
  function translateElement(el) {
    if (!el || el.nodeType !== 1) return;
    if (el.matches('.madic-lang-controls button[data-lang]')) {
      el.disabled = false;
      el.removeAttribute('aria-disabled');
      el.setAttribute('aria-pressed', String(el.dataset.lang === lang));
      el.classList.toggle('madic-lang-active', el.dataset.lang === lang);
      el.setAttribute('aria-label', el.dataset.lang === 'fr' ? 'Français' : 'English');
      el.title = el.dataset.lang === 'fr' ? 'Français' : 'English';
      return;
    }
    if (ignored({parentElement:el})) return;
    let source = originalAttrs.get(el);
    let previous = renderedAttrs.get(el);
    if (!source) { source = {}; originalAttrs.set(el, source); }
    if (!previous) { previous = {}; renderedAttrs.set(el, previous); }
    for (const attr of attrs) {
      if (!el.hasAttribute(attr)) continue;
      const current = el.getAttribute(attr);
      if (!(attr in source) || previous[attr] !== current) source[attr] = current;
      const next = localized(source[attr]);
      if (next !== current) el.setAttribute(attr, next);
      previous[attr] = next;
    }
  }
  let observer;
  let scheduled = false;
  function render() {
    if (observer) observer.disconnect();
    document.documentElement.lang = lang === 'en' ? 'en-CA' : 'fr-CA';
    const dateField = document.getElementById('docreqDue');
    if (dateField) dateField.lang = lang === 'en' ? 'en-CA' : 'fr-CA';
    const root = document.body;
    if (!root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    let node;
    while ((node = walker.nextNode())) {
      if (node.nodeType === 3) translateText(node);
      else translateElement(node);
    }
    document.querySelectorAll('.madic-lang-controls button[data-lang]').forEach(translateElement);
    if (observer) observer.observe(root, {subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:attrs});
  }
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => { scheduled = false; render(); });
  }
  function selectLanguage(next) {
    if (next !== 'fr' && next !== 'en') return;
    lang = next;
    try { localStorage.setItem(key, lang); } catch (_) {}
    render();
    document.dispatchEvent(new CustomEvent('madic:languagechange', {detail:{lang}}));
  }
  function updateFileLabel() {
    const fileInput = document.getElementById('docsendFile');
    const label = document.querySelector('.madic-local-file-name');
    if (!fileInput || !label) return;
    label.textContent = fileInput.files?.length ? fileInput.files[0].name : (lang === 'en' ? 'No file selected' : 'Aucun fichier choisi');
  }
  function init() {
    document.getElementById('docsendFile')?.addEventListener('change', updateFileLabel);
    document.addEventListener('reset', event => { if (event.target?.id === 'docsendForm') requestAnimationFrame(updateFileLabel); });
    document.addEventListener('madic:languagechange', updateFileLabel);
    document.addEventListener('click', event => {
      const button = event.target.closest?.('.madic-lang-controls button[data-lang]');
      if (!button) return;
      event.preventDefault();
      selectLanguage(button.dataset.lang);
    }, true);
    observer = new MutationObserver(schedule);
    render();
    window.MadicDocreqT = (source) => lang === 'en' ? toEnglish(source) : toFrench(source);
    window.MadicCricLanguage = {set:selectLanguage, get:()=>lang, refresh:render};
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true});
  else init();
})();

/* MADIC sign-out */
(()=>{const init=()=>{const b=document.getElementById('logout');if(!b)return;b.addEventListener('click',async()=>{b.disabled=true;try{const db=window.getMadicSupabase();const {error}=await db.auth.signOut();if(error)throw error;location.href='connexion-cric.html';}catch(e){b.disabled=false;const n=document.getElementById('docreqNotice');if(n)n.textContent='Déconnexion impossible : '+e.message;}})};if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();})();
