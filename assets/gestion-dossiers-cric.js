(async () => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const status = (text, bad = false) => {
    const node = $("message");
    node.textContent = text;
    node.style.color = bad ? "#b42318" : "";
  };
  const selectionStatus = (text) => {
    $("toolSelectionStatus").textContent = text;
  };
  const db =
    typeof window.getMadicSupabase === "function" && window.supabase
      ? window.getMadicSupabase()
      : null;
  if (!db) return status("Configuration Supabase manquante.", true);
  const state = { clients: [], dossiers: [], space: null };
  const fullName = (c) =>
    [c?.first_name, c?.last_name].filter(Boolean).join(" ").trim() ||
    c?.email ||
    "Client";
  const option = (value, label) => {
    const o = document.createElement("option");
    o.value = value;
    o.textContent = label;
    return o;
  };
  const selectedClient = () =>
    state.clients.find((c) => c.id === $("toolClient").value);
  const selectedDossier = () =>
    state.dossiers.find(
      (d) =>
        d.id === $("toolDossier").value &&
        d.client_id === $("toolClient").value,
    );
  const appendLine = (parent, label, value) => {
    const p = document.createElement("p");
    const b = document.createElement("strong");
    b.textContent = label + " : ";
    p.append(b, document.createTextNode(value || "À compléter"));
    parent.append(p);
  };
  const report = (id, heading, fields, warning) => {
    const target = $(id);
    target.replaceChildren();
    const h = document.createElement("h3");
    h.textContent = heading;
    target.append(h);
    for (const [key, value] of fields) appendLine(target, key, value);
    const note = document.createElement("p");
    note.textContent = warning;
    target.append(note);
    const copy = document.createElement("button");
    copy.type = "button";
    copy.textContent = "Copier la fiche";
    copy.className = "secondary";
    copy.addEventListener("click", async () => {
      const text = target.innerText.replace("Copier la fiche", "").trim();
      try {
        await navigator.clipboard.writeText(text);
        selectionStatus("Fiche copiée.");
      } catch (_) {
        selectionStatus(
          "Copie impossible : sélectionnez le texte manuellement.",
        );
      }
    });
    target.append(copy);
    target.hidden = false;
  };
  const requireSelection = () => {
    const c = selectedClient(),
      d = selectedDossier();
    if (!c || !d) {
      selectionStatus(
        "Sélectionnez d’abord un client et un dossier autorisés.",
      );
      return null;
    }
    return { c, d };
  };
  $("toolClient").addEventListener("change", () => {
    const select = $("toolDossier");
    select.replaceChildren(option("", "Sélectionner un dossier"));
    const list = state.dossiers.filter(
      (d) => d.client_id === $("toolClient").value,
    );
    for (const d of list)
      select.append(
        option(
          d.id,
          `${d.reference || "Dossier"}-${d.category || "Sans catégorie"}`,
        ),
      );
    select.disabled = !list.length;
    $("toolCurrentDossier").textContent = "Aucun";
    selectionStatus(
      list.length
        ? `${list.length} dossier(s) disponible(s).`
        : "Aucun dossier pour ce client.",
    );
    for (const id of ["toolIrccResult", "toolAnalysisResult"])
      $(id).hidden = true;
  });
  $("toolDossier").addEventListener("change", () => {
    const current = selectedDossier();
    const indicator = $("toolCurrentDossier");
    if (indicator) indicator.textContent = current?.reference || "Aucun";
    for (const id of ["toolIrccResult", "toolAnalysisResult"])
      $(id).hidden = true;
  });
  $("toolIrccPrepare").addEventListener("click", () => {
    const selected = requireSelection();
    if (!selected) return;
    const { c, d } = selected;
    report(
      "toolIrccResult",
      "Fiche préparatoire-" + $("toolIrccForm").value,
      [
        ["Client", fullName(c)],
        ["Courriel", c.email],
        ["Téléphone", c.phone],
        ["Dossier", d.reference],
        ["Catégorie", d.category],
      ],
      "Document préparatoire uniquement : compléter les champs propres au formulaire, vérifier la version officielle IRCC et valider avant toute soumission.",
    );
  });
  for (const [id, page] of [
    ["toolInitialContractLink", "contrat-initial-cric.html"],
    ["toolProfessionalContractLink", "contrat-professionnel-cric.html"],
  ]) {
    $(id).addEventListener("click", () => {
      // Ne pas bloquer la navigation : la page de contrat possède son propre sélecteur.
      // Les identifiants ne sont transmis que si la sélection est valide.
      const c = selectedClient();
      const d = selectedDossier();
      const url = new URL(page, location.href);
      if (c && d) {
        url.searchParams.set("client", c.id);
        url.searchParams.set("dossier", d.id);
      }
      $(id).href = url.href;
    });
  }
  $("toolAnalysisPrepare").addEventListener("click", () => {
    const selected = requireSelection();
    if (!selected) return;
    const { c, d } = selected;
    report(
      "toolAnalysisResult",
      "Compte rendu d’analyse préliminaire-brouillon",
      [
        ["Client", fullName(c)],
        ["Dossier", d.reference],
        ["Programme", $("toolAnalysisProgram").value.trim() || d.category],
        ["Appréciation", $("toolAnalysisStatus").value],
        ["Constats", $("toolAnalysisFindings").value.trim()],
        ["Pièces et prochaines étapes", $("toolAnalysisNext").value.trim()],
      ],
      "Analyse provisoire rédigée par le consultant. Aucun résultat ne garantit l’admissibilité ou une décision favorable d’IRCC. Ce brouillon n’est pas enregistré dans Supabase.",
    );
  });
  $("logout")?.addEventListener("click", async () => {
    await db.auth.signOut();
    location.replace("connexion-cric.html");
  });
  try {
    const { data: auth, error: authError } = await db.auth.getUser();
    if (authError || !auth?.user) {
      location.replace("connexion-cric.html");
      return;
    }
    const uid = auth.user.id;
    const { data: app, error: appError } = await db
      .from("madic_cric_applications")
      .select("status")
      .eq("user_id", uid)
      .maybeSingle();
    if (appError) throw appError;
    const { data: superAdmin, error: adminError } = await db.rpc(
      "madic_is_super_admin",
    );
    if (adminError) throw adminError;
    if (!superAdmin && app?.status !== "approved")
      throw Error("Compte CRIC non approuvé.");
    const { data: spaces, error: spaceError } = await db
      .from("madic_cric_spaces")
      .select("id,name,access_status")
      .eq("owner_user_id", uid)
      .limit(1);
    if (spaceError) throw spaceError;
    const space = spaces?.[0];
    if (!space || space.access_status !== "active")
      throw Error("Espace CRIC absent ou suspendu.");
    const { data: allowed, error: permissionError } = await db.rpc(
      "madic_can_manage_cric_space",
      { p_space_id: space.id },
    );
    if (permissionError || allowed !== true)
      throw Error("Accès à cet espace non autorisé.");
    state.space = space;
    const { data: associations, error: associationsError } = await db
      .from("madic_cric_clients")
      .select("client_id")
      .eq("space_id", space.id);
    if (associationsError) throw associationsError;
    const ids = [...new Set((associations || []).map((row) => row.client_id))];
    if (ids.length) {
      const { data: profiles, error: profilesError } = await db
        .from("profiles")
        .select("id,first_name,last_name,email,phone")
        .in("id", ids);
      if (profilesError) throw profilesError;
      state.clients = profiles || [];
    }
    const { data: dossiers, error: dossiersError } = await db
      .from("dossiers")
      .select("id,client_id,space_id,reference,category,status")
      .eq("space_id", space.id);
    if (dossiersError) throw dossiersError;
    state.dossiers = (dossiers || []).filter((d) => ids.includes(d.client_id));
    $("toolClientCount").textContent = String(state.clients.length);
    $("toolDossierCount").textContent = String(state.dossiers.length);
    for (const c of state.clients)
      $("toolClient").append(option(c.id, `${fullName(c)}-${c.email || ""}`));
    $("spaceName").textContent = "Espace professionnel : " + space.name;
    $("workspace").hidden = false;
    status(
      "Outils de préparation disponibles. Aucun document n’est automatiquement enregistré.",
    );
    selectionStatus(
      state.clients.length
        ? "Sélectionnez un client pour commencer."
        : "Aucun client associé à cet espace CRIC.",
    );
    const requested = new URLSearchParams(location.search).get("client");
    if (requested && state.clients.some((c) => c.id === requested)) {
      $("toolClient").value = requested;
      $("toolClient").dispatchEvent(new Event("change"));
    }
  } catch (error) {
    status(
      "Impossible de charger les outils : " + (error.message || String(error)),
      true,
    );
  }
})();

/* Source: madic-datahubz-unified(20261110-221517).js */

/* Source: madic-i18n-cric(5).js */
/* MADIC bilingual RCIC workspace. UI-only: no Supabase calls, no mutation of business data. */
(() => {
  "use strict";
  const dictionary = {
    "Espace professionnel": "Professional workspace",
    NAVIGATION: "NAVIGATION",
    "Vue d’ensemble": "Overview",
    Clients: "Clients",
    "Outils CRIC": "RCIC tools",
    Messagerie: "Messages",
    "Rendez-vous": "Appointments",
    Documents: "Documents",
    Échéances: "Deadlines",
    Facturation: "Invoicing",
    Finances: "Finances",
    "Mon profil professionnel": "My professional profile",
    "Espace sécurisé MADIC": "Secure MADIC workspace",
    "Mon espace": "My space",
    "Aller au contenu principal": "Skip to main content",
    "Gestion des clients CRIC": "RCIC client management",
    "Demandes de documents →": "Document requests →",
    "Vérification de votre espace…": "Checking your workspace…",
    "← Retour à mon espace CRIC": "← Back to my RCIC workspace",
    Déconnexion: "Sign out",
    "Clients associés": "Associated clients",
    "Dans votre espace professionnel": "In your professional workspace",
    "Dossiers associés": "Associated cases",
    "Pour les clients autorisés": "For authorized clients",
    "Résultats de recherche": "Search results",
    "Clients affichés ci-dessous": "Clients shown below",
    "Répertoire des clients": "Client directory",
    "Inviter un client": "Invite a client",
    "Importer une liste": "Import a list",
    "Dossiers CRIC": "RCIC cases",
    "RÉPERTOIRE CLIENTS": "CLIENT DIRECTORY",
    "Uniquement les clients autorisés dans votre espace CRIC.":
      "Only clients authorized in your RCIC workspace.",
    Nom: "Name",
    Courriel: "Email",
    Téléphone: "Phone",
    Dossiers: "Cases",
    Factures: "Invoices",
    Action: "Action",
    Actions: "Actions",
    "INVITATIONS INDIVIDUELLES": "INDIVIDUAL INVITATIONS",
    "Inviter un client dans votre cabinet": "Invite a client to your practice",
    "Une invitation privée lie le client exclusivement à votre espace CRIC.":
      "A private invitation links the client exclusively to your RCIC workspace.",
    "Vérification du profil professionnel…": "Checking professional profile…",
    "Courriel du client": "Client email",
    "Envoyer l’invitation par courriel": "Send invitation by email",
    "Lien personnel (copie de secours)": "Personal link (backup copy)",
    "Copier le lien": "Copy link",
    "Le courriel est envoyé automatiquement par MADIC PORTAIL. L’invitation est personnelle et valable pendant 7 jours.":
      "The email is sent automatically by MADIC PORTAIL. The personal invitation is valid for 7 days.",
    "IMPORTATION GROUPÉE": "BULK IMPORT",
    "Importer des invitations clients (CSV / Excel)":
      "Import client invitations (CSV / Excel)",
    "Modèle Excel MADIC :": "MADIC Excel template:",
    "Télécharger le modèle Excel à remplir (.xlsx)":
      "Download the Excel template (.xlsx)",
    "Fichier de clients (colonne courriel ou email obligatoire)":
      "Client file (email column required)",
    "Seuls les courriels sont utilisés pour les invitations. Les autres colonnes ne sont pas transmises.":
      "Only email addresses are used for invitations. Other columns are not transmitted.",
    "Vérification du profil professionnel avant les invitations…":
      "Checking professional profile before invitations…",
    Vérification: "Verification",
    Résultat: "Result",
    "Confirmer et envoyer les invitations": "Confirm and send invitations",
    "Annuler / effacer": "Cancel / clear",
    "Outils professionnels CRIC": "Professional RCIC tools",
    "ESPACE PROFESSIONNEL CRIC": "RCIC PROFESSIONAL WORKSPACE",
    "Préparez vos formulaires, contrats et analyses à partir des dossiers autorisés de votre cabinet.":
      "Prepare forms, contracts and analyses using authorized cases in your practice.",
    "CENTRE DE TRAVAIL · CRIC": "RCIC WORKSPACE",
    "Vos dossiers. Vos outils. Un seul espace.":
      "Your cases. Your tools. One workspace.",
    "Sélectionnez un client, puis son dossier pour préparer les documents et les analyses professionnelles.":
      "Select a client and their case to prepare professional documents and analyses.",
    "Clients autorisés": "Authorized clients",
    "Associés à votre cabinet": "Associated with your practice",
    "Dossiers accessibles": "Accessible cases",
    "Dans votre espace CRIC": "In your RCIC workspace",
    "Dossier sélectionné": "Selected case",
    Aucun: "None",
    "Pour préparer les outils": "To prepare tools",
    "Formulaires IRCC": "IRCC forms",
    Contrats: "Contracts",
    "Analyse préliminaire": "Preliminary analysis",
    "Suivi Kanban des dossiers": "Kanban case tracking",
    "Centre des outils professionnels": "Professional tools center",
    "Sélectionnez un client et son dossier pour préparer vos documents de travail. Les résultats doivent être vérifiés et approuvés par le consultant avant toute utilisation.":
      "Select a client and case to prepare working documents. The consultant must review and approve results before use.",
    "Client associé au cabinet": "Client associated with the practice",
    "Sélectionner un client": "Select a client",
    Dossier: "Case",
    "Sélectionner un dossier": "Select a case",
    "1. Formulaires IRCC automatisés": "1. Automated IRCC forms",
    "Préparation des renseignements à partir du profil du client. Les PDF officiels ne sont pas générés à ce stade.":
      "Prepare information from the client profile. Official PDFs are not generated at this stage.",
    "Formulaire IRCC": "IRCC form",
    "Autre formulaire-à définir": "Other form—to be determined",
    "Préparer la fiche de renseignements": "Prepare information sheet",
    "OUTILS CRIC · GESTION CONTRACTUELLE": "RCIC TOOLS · CONTRACT MANAGEMENT",
    "2. Contrats": "2. Contracts",
    "Choisissez le contrat adapté à votre mandat. Les informations du client et du dossier sélectionnés seront transmises à la page de préparation.":
      "Choose the contract for your mandate. The selected client and case information will be passed to the preparation page.",
    "PREMIÈRE CONSULTATION": "INITIAL CONSULTATION",
    "Contrat de consultation initiale": "Initial consultation agreement",
    "Encadrez la première consultation, son objet, les honoraires et les conditions de prestation.":
      "Set out the initial consultation, its purpose, fees and terms of service.",
    "Préparer le contrat": "Prepare contract",
    "MANDAT DE REPRÉSENTATION": "REPRESENTATION MANDATE",
    "Contrat de services professionnels": "Professional services agreement",
    "Définissez les services convenus, les responsabilités, les honoraires et les modalités du mandat.":
      "Define agreed services, responsibilities, fees and mandate terms.",
    "Sélectionnez un client et un dossier ci-dessus avant d’ouvrir un contrat.":
      "Select a client and case above before opening a contract.",
    "Les clauses, les honoraires et les signatures doivent être vérifiés et validés avant transmission au client.":
      "Clauses, fees and signatures must be checked and approved before sending to the client.",
    "3. Résultat de l’analyse préliminaire": "3. Preliminary analysis results",
    "Rédigez une évaluation professionnelle provisoire, sans décision automatique d’admissibilité.":
      "Draft a provisional professional assessment, without an automatic eligibility decision.",
    "Programme ou voie d’immigration": "Immigration program or pathway",
    "Appréciation préliminaire": "Preliminary assessment",
    "Analyse à compléter": "Analysis pending",
    "Éléments favorables à vérifier": "Favorable factors to verify",
    "Renseignements supplémentaires requis": "Additional information required",
    "Critères potentiellement non satisfaits": "Potentially unmet criteria",
    "Constats et critères examinés": "Findings and criteria reviewed",
    "Documents manquants et prochaines étapes":
      "Missing documents and next steps",
    "Préparer le compte rendu": "Prepare report",
    "Messagerie sécurisée": "Secure messaging",
    "Échangez avec vos clients et retrouvez vos conversations et pièces jointes dans un espace sécurisé.":
      "Communicate with clients and access conversations and attachments in a secure workspace.",
    "Vérification des autorisations…": "Checking permissions…",
    Conversations: "Conversations",
    "Client du cabinet": "Practice client",
    "Choisir un client…": "Choose a client…",
    Objet: "Subject",
    "Nouvelle conversation": "New conversation",
    Actualiser: "Refresh",
    "Sélectionnez une conversation": "Select a conversation",
    "Votre message": "Your message",
    Envoyer: "Send",
    "Rendez-vous et consultations": "Appointments and consultations",
    "Gérez vos créneaux et les demandes de vos clients.":
      "Manage your availability and client requests.",
    "Gestion des clients →": "Client management →",
    "Vérification des accès…": "Checking access…",
    "Publier une disponibilité": "Publish availability",
    "Date de début (heure de Montréal)": "Start date (Montreal time)",
    "Heure de début (heure de Montréal)": "Start time (Montreal time)",
    "Choisir une heure": "Choose a time",
    "Durée de consultation": "Consultation duration",
    "1 heure": "1 hour",
    "2 heures": "2 hours",
    "3 heures": "3 hours",
    "4 heures": "4 hours",
    "5 heures": "5 hours",
    "6 heures": "6 hours",
    "7 heures": "7 hours",
    "8 heures": "8 hours",
    "Fin calculée automatiquement (heure de Montréal)":
      "Automatically calculated end (Montreal time)",
    "Type de consultation": "Consultation type",
    Visioconférence: "Video call",
    "En personne": "In person",
    "Lieu ou lien (facultatif)": "Location or link (optional)",
    "Publier le créneau": "Publish time slot",
    "AGENDA PROFESSIONNEL": "PROFESSIONAL CALENDAR",
    "Calendrier des consultations": "Consultation calendar",
    "Visualisez les créneaux et les réservations, puis sélectionnez une journée pour publier une disponibilité.":
      "View time slots and bookings, then select a day to publish availability.",
    "Aujourd'hui": "Today",
    Disponible: "Available",
    Demandé: "Requested",
    Confirmé: "Confirmed",
    Fermé: "Closed",
    Lun: "Mon",
    Mar: "Tue",
    Mer: "Wed",
    Jeu: "Thu",
    Ven: "Fri",
    Sam: "Sat",
    Dim: "Sun",
    "Mes disponibilités": "My availability",
    "Les nouveaux créneaux commencent à l’heure juste. Les anciens rendez-vous conservent leurs horaires.":
      "New slots start on the hour. Existing appointments retain their scheduled times.",
    Début: "Start",
    Fin: "End",
    Type: "Type",
    État: "State",
    "Réservations et demandes": "Bookings and requests",
    Client: "Client",
    Statut: "Status",
    "Gestion documentaire du client": "Client document management",
    "← Retour à la gestion des clients": "← Back to client management",
    "Choisissez un dossier, examinez les pièces reçues et suivez les documents demandés.":
      "Choose a case, review received files and track requested documents.",
    "Chargement…": "Loading…",
    "Étape 1 · Dossier": "Step 1 · Case",
    "Choisir le client et le dossier": "Choose client and case",
    "+ Demander une nouvelle pièce au client":
      "+ Request a new document from the client",
    "Cette demande apparaîtra dans l'espace du client.":
      "This request will appear in the client's workspace.",
    "Document demandé": "Requested document",
    Instructions: "Instructions",
    "Date limite (facultatif)": "Due date (optional)",
    "Envoyer la demande": "Send request",
    "+ Envoyer un document au client": "+ Send a document to the client",
    "Fichier à transmettre (PDF, JPG ou PNG, 10 Mo maximum)":
      "File to send (PDF, JPG or PNG, 10 MB maximum)",
    "Nom du document (facultatif)": "Document name (optional)",
    "Envoyer le document": "Send document",
    "Étape 2 · Vérification": "Step 2 · Review",
    "Documents reçus": "Received documents",
    "Téléchargez et évaluez chaque document. En cas de refus, précisez le motif qui sera visible par le client.":
      "Download and review each document. If rejected, provide a reason visible to the client.",
    Fichier: "File",
    "Reçu le": "Received on",
    Évaluation: "Assessment",
    "Motif du refus": "Reason for rejection",
    "Étape 3 · Suivi": "Step 3 · Tracking",
    "Demandes envoyées": "Sent requests",
    "Demandes concernant uniquement le dossier sélectionné. Le statut d'une demande est distinct de l'évaluation d'un fichier.":
      "Requests for the selected case only. Request status is separate from file assessment.",
    "Pièce demandée": "Requested item",
    "Date limite": "Due date",
    "Mettre à jour": "Update",
    "Échéances de mon cabinet": "Practice deadlines",
    "← Mon espace CRIC": "← My RCIC workspace",
    "Échéances et rappels": "Deadlines and reminders",
    "Suivez les dates importantes de vos dossiers et les actions à réaliser.":
      "Track important case dates and required actions.",
    "Vérification de votre cabinet…": "Checking your practice…",
    "Ajouter une échéance": "Add a deadline",
    "Dossier *": "Case *",
    "Description de l’échéance *": "Deadline description *",
    "Date limite *": "Due date *",
    "Enregistrer l'échéance": "Save deadline",
    "Mes échéances": "My deadlines",
    Description: "Description",
    Date: "Date",
    Situation: "Status",
    "Les échéances sont affichées dans votre espace CRIC. Vérifiez régulièrement vos dates limites et les notifications applicables.":
      "Deadlines are shown in your RCIC workspace. Regularly check due dates and relevant notifications.",
    "Facturation de mon cabinet": "Practice invoicing",
    "Vérification de votre accès…": "Checking your access…",
    "Paiements Stripe Connect": "Stripe Connect payments",
    "Connectez le compte Stripe de votre cabinet pour recevoir directement les paiements de vos clients.":
      "Connect your practice's Stripe account to receive client payments directly.",
    "Vérification de la connexion Stripe…": "Checking Stripe connection…",
    "Connecter mon compte Stripe": "Connect my Stripe account",
    "Créer une facture": "Create an invoice",
    "Client *": "Client *",
    "Dossier (facultatif)": "Case (optional)",
    "Aucun dossier": "No cases",
    "Nom du cabinet *": "Practice name *",
    "Adresse du cabinet": "Practice address",
    "Numéros de taxes (si applicables)": "Tax numbers (if applicable)",
    "Logo du cabinet (PNG ou JPG, max. 100 Ko)":
      "Practice logo (PNG or JPG, max. 100 KB)",
    "Lignes de facturation": "Invoice line items",
    Quantité: "Quantity",
    "Prix unitaire (CAD)": "Unit price (CAD)",
    Montant: "Amount",
    "+ Ajouter une ligne": "+ Add a line",
    "Sous-total : 0,00 $": "Subtotal: $0.00",
    "Taux total de taxes applicable (%)": "Total applicable tax rate (%)",
    "Date d'échéance": "Due date",
    Notes: "Notes",
    "Créer la facture": "Create invoice",
    "Mes factures": "My invoices",
    Numéro: "Number",
    Émission: "Issued",
    Total: "Total",
    Payé: "Paid",
    "Gestion financière CRIC": "RCIC financial management",
    "Gestion financière du cabinet CRIC": "RCIC practice financial management",
    "Temps et honoraires · Facturation · Paiements · Fidéicommis · Comptabilité · Rapports":
      "Time and fees · Invoicing · Payments · Trust accounts · Accounting · Reports",
    "Cabinet :": "Practice:",
    "Non sélectionné": "Not selected",
    "Initialisation…": "Initializing…",
    "Retour à mon espace professionnel CRIC":
      "Back to my RCIC professional workspace",
    "Temps et honoraires": "Time and fees",
    "Ces renseignements identifient votre cabinet dans les invitations à vos clients.":
      "This information identifies your practice in client invitations.",
    "Renseignements du cabinet": "Practice information",
    "Les champs marqués d’un astérisque sont obligatoires. Vos informations sont enregistrées dans votre espace professionnel.":
      "Fields marked with an asterisk are required. Your information is saved in your professional workspace.",
    "Nom déclaré à l’inscription CRIC":
      "Name provided during RCIC registration",
    "Courriel professionnel déclaré à l’inscription":
      "Professional email provided during registration",
    "Prénom *": "First name *",
    "Nom *": "Last name *",
    "Titre professionnel *": "Professional title *",
    "Numéro de permis CRIC *": "RCIC licence number *",
    "Nom de l’entreprise *": "Business name *",
    "Site Web de l’entreprise (facultatif)": "Business website (optional)",
    "Téléphone professionnel *": "Business phone *",
    "Adresse professionnelle du cabinet": "Professional practice address",
    "Numéro civique *": "Street number *",
    "Rue *": "Street *",
    "Bureau, suite ou local (facultatif)": "Office, suite or unit (optional)",
    "Ville *": "City *",
    "Province, État ou district *": "Province, state or district *",
    "Code postal (facultatif)": "Postal code (optional)",
    "Pays *": "Country *",
    "Sélectionner un pays": "Select a country",
    Enregistrer: "Save",
    Annuler: "Cancel",
    Fermer: "Close",
    Continuer: "Continue",
    Confirmer: "Confirm",
    Refuser: "Decline",
    Supprimer: "Delete",
    Modifier: "Edit",
    Voir: "View",
    Télécharger: "Download",
    "En attente": "Pending",
    Annulé: "Cancelled",
    Annulée: "Cancelled",
    Accepté: "Accepted",
    Acceptée: "Accepted",
    Rejeté: "Rejected",
    Rejetée: "Rejected",
    Validé: "Approved",
    Validée: "Approved",
    Approuvé: "Approved",
    Approuvée: "Approved",
    Oui: "Yes",
    Non: "No",
    "Aucun résultat": "No results",
    "Aucune donnée": "No data",
    "Aucun client": "No clients",
    "Aucun rendez-vous": "No appointments",
    "En cours": "In progress",
    Terminé: "Completed",
    Terminée: "Completed",
    Envoyé: "Sent",
    Envoyée: "Sent",
    Brouillon: "Draft",
    "Enregistrer les modifications": "Save changes",
    "Profil mis à jour": "Profile updated",
    "© MAD Immigration Canadienne · Portail sécurisé":
      "© MAD Immigration Canadienne · Secure portal",
    "© MADIC · Plateforme professionnelle": "© MADIC · Professional platform",
    "Île de l’Ascension": "Ascension Island",
    Andorre: "Andorra",
    "Émirats arabes unis": "United Arab Emirates",
    Afghanistan: "Afghanistan",
    "Antigua-et-Barbuda": "Antigua & Barbuda",
    Anguilla: "Anguilla",
    Albanie: "Albania",
    Arménie: "Armenia",
    Angola: "Angola",
    Antarctique: "Antarctica",
    Argentine: "Argentina",
    "Samoa américaines": "American Samoa",
    Autriche: "Austria",
    Australie: "Australia",
    Aruba: "Aruba",
    "Îles Åland": "Åland Islands",
    Azerbaïdjan: "Azerbaijan",
    "Bosnie-Herzégovine": "Bosnia & Herzegovina",
    Barbade: "Barbados",
    Bangladesh: "Bangladesh",
    Belgique: "Belgium",
    "Burkina Faso": "Burkina Faso",
    Bulgarie: "Bulgaria",
    Bahreïn: "Bahrain",
    Burundi: "Burundi",
    Bénin: "Benin",
    "Saint-Barthélemy": "St. Barthélemy",
    Bermudes: "Bermuda",
    Brunei: "Brunei",
    Bolivie: "Bolivia",
    "Pays-Bas caribéens": "Caribbean Netherlands",
    Brésil: "Brazil",
    Bahamas: "Bahamas",
    Bhoutan: "Bhutan",
    "Île Bouvet": "Bouvet Island",
    Botswana: "Botswana",
    Biélorussie: "Belarus",
    Belize: "Belize",
    Canada: "Canada",
    "Îles Cocos": "Cocos (Keeling) Islands",
    "Congo-Kinshasa": "Congo - Kinshasa",
    "République centrafricaine": "Central African Republic",
    "Congo-Brazzaville": "Congo - Brazzaville",
    Suisse: "Switzerland",
    "Côte d’Ivoire": "Côte d’Ivoire",
    "Îles Cook": "Cook Islands",
    Chili: "Chile",
    Cameroun: "Cameroon",
    Chine: "China",
    Colombie: "Colombia",
    "Île Clipperton": "Clipperton Island",
    "Costa Rica": "Costa Rica",
    Cuba: "Cuba",
    "Cap-Vert": "Cape Verde",
    Curaçao: "Curaçao",
    "Île Christmas": "Christmas Island",
    Chypre: "Cyprus",
    Tchéquie: "Czechia",
    Allemagne: "Germany",
    "Diego Garcia": "Diego Garcia",
    Djibouti: "Djibouti",
    Danemark: "Denmark",
    Dominique: "Dominica",
    "République dominicaine": "Dominican Republic",
    Algérie: "Algeria",
    "Ceuta et Melilla": "Ceuta & Melilla",
    Équateur: "Ecuador",
    Estonie: "Estonia",
    Égypte: "Egypt",
    "Sahara occidental": "Western Sahara",
    Érythrée: "Eritrea",
    Espagne: "Spain",
    Éthiopie: "Ethiopia",
    "Union européenne": "European Union",
    "zone euro": "Eurozone",
    Finlande: "Finland",
    Fidji: "Fiji",
    "Îles Malouines": "Falkland Islands",
    Micronésie: "Micronesia",
    "Îles Féroé": "Faroe Islands",
    France: "France",
    Gabon: "Gabon",
    "Royaume-Uni": "United Kingdom",
    Grenade: "Grenada",
    Géorgie: "Georgia",
    "Guyane française": "French Guiana",
    Guernesey: "Guernsey",
    Ghana: "Ghana",
    Gibraltar: "Gibraltar",
    Groenland: "Greenland",
    Gambie: "Gambia",
    Guinée: "Guinea",
    Guadeloupe: "Guadeloupe",
    "Guinée équatoriale": "Equatorial Guinea",
    Grèce: "Greece",
    "Géorgie du Sud-et-les Îles Sandwich du Sud":
      "South Georgia & South Sandwich Islands",
    Guatemala: "Guatemala",
    Guam: "Guam",
    "Guinée-Bissau": "Guinea-Bissau",
    Guyana: "Guyana",
    "R.A.S. chinoise de Hong Kong": "Hong Kong SAR China",
    "Îles Heard-et-MacDonald": "Heard & McDonald Islands",
    Honduras: "Honduras",
    Croatie: "Croatia",
    Haïti: "Haiti",
    Hongrie: "Hungary",
    "Îles Canaries": "Canary Islands",
    Indonésie: "Indonesia",
    Irlande: "Ireland",
    Israël: "Israel",
    "Île de Man": "Isle of Man",
    Inde: "India",
    "Territoire britannique de l’océan Indien":
      "British Indian Ocean Territory",
    Irak: "Iraq",
    Iran: "Iran",
    Islande: "Iceland",
    Italie: "Italy",
    Jersey: "Jersey",
    Jamaïque: "Jamaica",
    Jordanie: "Jordan",
    Japon: "Japan",
    Kenya: "Kenya",
    Kirghizstan: "Kyrgyzstan",
    Cambodge: "Cambodia",
    Kiribati: "Kiribati",
    Comores: "Comoros",
    "Saint-Christophe-et-Niévès": "St. Kitts & Nevis",
    "Corée du Nord": "North Korea",
    "Corée du Sud": "South Korea",
    Koweït: "Kuwait",
    "Îles Caïmans": "Cayman Islands",
    Kazakhstan: "Kazakhstan",
    Laos: "Laos",
    Liban: "Lebanon",
    "Sainte-Lucie": "St. Lucia",
    Liechtenstein: "Liechtenstein",
    "Sri Lanka": "Sri Lanka",
    Liberia: "Liberia",
    Lesotho: "Lesotho",
    Lituanie: "Lithuania",
    Luxembourg: "Luxembourg",
    Lettonie: "Latvia",
    Libye: "Libya",
    Maroc: "Morocco",
    Monaco: "Monaco",
    Moldavie: "Moldova",
    Monténégro: "Montenegro",
    "Saint-Martin": "St. Martin",
    Madagascar: "Madagascar",
    "Îles Marshall": "Marshall Islands",
    "Macédoine du Nord": "North Macedonia",
    Mali: "Mali",
    "Myanmar (Birmanie)": "Myanmar (Burma)",
    Mongolie: "Mongolia",
    "R.A.S. chinoise de Macao": "Macao SAR China",
    "Îles Mariannes du Nord": "Northern Mariana Islands",
    Martinique: "Martinique",
    Mauritanie: "Mauritania",
    Montserrat: "Montserrat",
    Malte: "Malta",
    Maurice: "Mauritius",
    Maldives: "Maldives",
    Malawi: "Malawi",
    Mexique: "Mexico",
    Malaisie: "Malaysia",
    Mozambique: "Mozambique",
    Namibie: "Namibia",
    "Nouvelle-Calédonie": "New Caledonia",
    Niger: "Niger",
    "Île Norfolk": "Norfolk Island",
    Nigeria: "Nigeria",
    Nicaragua: "Nicaragua",
    "Pays-Bas": "Netherlands",
    Norvège: "Norway",
    Népal: "Nepal",
    Nauru: "Nauru",
    Niue: "Niue",
    "Nouvelle-Zélande": "New Zealand",
    Oman: "Oman",
    Panama: "Panama",
    Pérou: "Peru",
    "Polynésie française": "French Polynesia",
    "Papouasie-Nouvelle-Guinée": "Papua New Guinea",
    Philippines: "Philippines",
    Pakistan: "Pakistan",
    Pologne: "Poland",
    "Saint-Pierre-et-Miquelon": "St. Pierre & Miquelon",
    "Îles Pitcairn": "Pitcairn Islands",
    "Porto Rico": "Puerto Rico",
    "Territoires palestiniens": "Palestinian Territories",
    Portugal: "Portugal",
    Palaos: "Palau",
    Paraguay: "Paraguay",
    Qatar: "Qatar",
    "régions éloignées de l’Océanie": "Outlying Oceania",
    "La Réunion": "Réunion",
    Roumanie: "Romania",
    Serbie: "Serbia",
    Russie: "Russia",
    Rwanda: "Rwanda",
    "Arabie saoudite": "Saudi Arabia",
    "Îles Salomon": "Solomon Islands",
    Seychelles: "Seychelles",
    Soudan: "Sudan",
    Suède: "Sweden",
    Singapour: "Singapore",
    "Sainte-Hélène": "St. Helena",
    Slovénie: "Slovenia",
    "Svalbard et Jan Mayen": "Svalbard & Jan Mayen",
    Slovaquie: "Slovakia",
    "Sierra Leone": "Sierra Leone",
    "Saint-Marin": "San Marino",
    Sénégal: "Senegal",
    Somalie: "Somalia",
    Suriname: "Suriname",
    "Soudan du Sud": "South Sudan",
    "Sao Tomé-et-Principe": "São Tomé & Príncipe",
    Salvador: "El Salvador",
    "Saint-Martin (partie néerlandaise)": "Sint Maarten",
    Syrie: "Syria",
    Eswatini: "Eswatini",
    "Tristan da Cunha": "Tristan da Cunha",
    "Îles Turques-et-Caïques": "Turks & Caicos Islands",
    Tchad: "Chad",
    "Terres australes françaises": "French Southern Territories",
    Togo: "Togo",
    Thaïlande: "Thailand",
    Tadjikistan: "Tajikistan",
    Tokelau: "Tokelau",
    "Timor oriental": "Timor-Leste",
    Turkménistan: "Turkmenistan",
    Tunisie: "Tunisia",
    Tonga: "Tonga",
    Turquie: "Türkiye",
    "Trinité-et-Tobago": "Trinidad & Tobago",
    Tuvalu: "Tuvalu",
    Taïwan: "Taiwan",
    Tanzanie: "Tanzania",
    Ukraine: "Ukraine",
    Ouganda: "Uganda",
    "Îles mineures éloignées des États-Unis": "U.S. Outlying Islands",
    "Nations Unies": "United Nations",
    "États-Unis": "United States",
    Uruguay: "Uruguay",
    Ouzbékistan: "Uzbekistan",
    "État de la Cité du Vatican": "Vatican City",
    "Saint-Vincent-et-les Grenadines": "St. Vincent & Grenadines",
    Venezuela: "Venezuela",
    "Îles Vierges britanniques": "British Virgin Islands",
    "Îles Vierges des États-Unis": "U.S. Virgin Islands",
    "Viêt Nam": "Vietnam",
    Vanuatu: "Vanuatu",
    "Wallis-et-Futuna": "Wallis & Futuna",
    Samoa: "Samoa",
    "pseudo-accents": "Pseudo-Accents",
    "pseudo-bidi": "Pseudo-Bidi",
    Kosovo: "Kosovo",
    Yémen: "Yemen",
    Mayotte: "Mayotte",
    "Afrique du Sud": "South Africa",
    Zambie: "Zambia",
    Zimbabwe: "Zimbabwe",
    "région indéterminée": "Unknown Region",
    "Le fichier sera accessible dans l’espace du client, sous « Historique et évaluations de mes documents », pour le dossier sélectionné ci-dessus.":
      "The file will be available in the client workspace under “History and assessments of my documents” for the selected case.",
    "La fin est calculée automatiquement à partir du début et de la durée choisie. Le lien ou lieu est communiqué au client après confirmation. Aucun lien Teams n'est créé automatiquement.":
      "The end time is calculated automatically from the start and selected duration. The link or location is shared with the client after confirmation. No Teams link is created automatically.",
    "Le logo est enregistré dans chaque nouvelle facture. Sélectionnez-le de nouveau pour les factures suivantes.":
      "The logo is saved in each new invoice. Select it again for subsequent invoices.",
    "Saisissez le taux applicable à votre situation. MADIC ne détermine pas les obligations fiscales de votre cabinet.":
      "Enter the rate applicable to your situation. MADIC does not determine your practice’s tax obligations.",
    "Modèles 1 et 2 disponibles dans Fidéicommis. Les paramètres du modèle et les comptes peuvent être enregistrés. Les écritures financières restent en lecture seule. Les rapports et paiements affichent des données de consultation, sans rapprochement bancaire.":
      "Models 1 and 2 are available under Trust accounts. Model settings and accounts can be saved. Financial entries remain read-only. Reports and payments display information for review, without bank reconciliation.",
    "Le nom complet et le courriel proviennent de votre inscription CRIC. Vérifiez la répartition prénom/nom lors du premier remplissage.":
      "Your full name and email come from your RCIC registration. Check the first and last name fields when completing this form for the first time.",
    "Renseignez les champs ci-dessous. L’ancienne adresse est conservée jusqu’à votre premier enregistrement.":
      "Complete the fields below. The previous address is retained until you save for the first time.",
    "Préparez des invitations à partir d'un fichier CSV, XLSX ou XLS. Aucun client n'est créé automatiquement : chaque personne doit accepter son invitation personnelle.":
      "Prepare invitations from a CSV, XLSX or XLS file. No client is created automatically: each person must accept their personal invitation.",
    ". Remplissez l’onglet « Clients » avec les courriels des personnes à inviter, puis importez le fichier ci-dessous. Seuls les courriels servent à envoyer les invitations.":
      ". Fill in the “Clients” sheet with the email addresses of people to invite, then import the file below. Only email addresses are used to send invitations.",
    "IMM 5476-Recours aux services d’un représentant":
      "IMM 5476 - Use of a Representative",
    "IMM 0008-Demande générique pour le Canada":
      "IMM 0008 - Generic Application Form for Canada",
    "IMM 5406-Renseignements additionnels sur la famille":
      "IMM 5406 - Additional Family Information",
    "IMM 5669-Antécédents / Déclaration":
      "IMM 5669 - Schedule A: Background / Declaration",
    "Gestion financière CRIC | MADIC": "RCIC financial management | MADIC",
    "Échéances de mon cabinet | MADIC": "My practice deadlines | MADIC",
    "Les modifications de votre profil professionnel ont été enregistrées avec succès.":
      "Changes to your professional profile have been saved successfully.",
    "Le paiement par Portail MADIC n'est pas encore activé : cette option ne déclenche aucun encaissement.":
      "Payments through MADIC Portail are not yet enabled: this option does not collect payments.",
    "Recevez un virement par courriel ou téléphone":
      "Receive an e-transfer by email or phone",
    "Choisissez les moyens de paiement acceptés par votre cabinet. Ils seront repris automatiquement dans vos contrats.":
      "Choose the payment methods accepted by your practice. They will automatically appear in your contracts.",
    "Courriel ou numéro pour recevoir les virements":
      "Email address or phone number for e-transfers",
    "Lors d’une modification, le logo déjà enregistré est conservé si vous ne sélectionnez pas de nouveau fichier.":
      "When editing, the saved logo is retained unless you select a new file.",
    "Adresse complète (générée automatiquement)":
      "Full address (generated automatically)",
    "Vos modifications ne sont enregistrées qu’après confirmation.":
      "Your changes are only saved after confirmation.",
  };
  Object.assign(dictionary, {
    "Espace chargé. Les données sont soumises aux autorisations Supabase.":
      "Workspace loaded. Data is subject to Supabase permissions.",
    "Outils de préparation disponibles. Aucun document n’est automatiquement enregistré.":
      "Preparation tools available. No document is saved automatically.",
    "Messagerie du cabinet chargée.": "Practice messaging loaded.",
    "Dernière vérification automatique": "Last automatic check",
    "Rechercher une conversation": "Search conversations",
    "Nom du client ou objet...": "Client name or subject...",
    "Conversation générale": "General conversation",
    "Disponibilités et réservations actualisées.":
      "Availability and bookings updated.",
    "Notifications de rendez-vous": "Appointment notifications",
    "Aucune notification non lue.": "No unread notifications.",
    "Nouvelle demande de rendez-vous": "New appointment request",
    "Demandes chargées.": "Requests loaded.",
    "Choisissez un dossier, examinez les pièces reçues et suivez les documents demandés.":
      "Choose a case, review received files and track requested documents.",
    "Téléchargez et évaluez chaque document. En cas de refus, précisez le motif qui sera visible par le client.":
      "Download and review each document. If rejected, provide a reason visible to the client.",
    "Documents du dossier": "Case documents",
    "document(s) reçu(s).": "document(s) received.",
    "Ex. Date limite de transmission": "E.g. submission deadline",
    "Compte Stripe créé. Configuration ou vérification en attente.":
      "Stripe account created. Setup or verification pending.",
    "Continuer la configuration Stripe": "Continue Stripe setup",
    "Aucune donnée enregistrée pour ce cabinet.":
      "No data recorded for this practice.",
    "Profil enregistré. Vous pouvez le modifier.":
      "Profile saved. You can edit it.",
    "Ces renseignements identifient votre cabinet dans les invitations à vos clients.":
      "This information identifies your practice in invitations to clients.",
    "Le nom complet et le courriel proviennent de votre inscription CRIC. Vérifiez la répartition prénom/nom lors du premier remplissage.":
      "Your full name and email come from your RCIC registration. Check the first and last name fields when filling out the form for the first time.",
    "Choisir un fichier": "Choose a file",
    "Aucun fichier choisi": "No file selected",
    Fidéicommis: "Trust accounting",
    Comptabilité: "Accounting",
    Rapports: "Reports",
    Paiements: "Payments",
    Cabinet: "Practice",
    "Temps et honoraires": "Time and fees",
    "Aucune donnée enregistrée pour ce cabinet.":
      "No data recorded for this practice.",
  });
  // Traductions des messages dynamiques de sélection (interface seulement).
  Object.assign(dictionary, {
    "Sélectionnez un client pour commencer.": "Select a client to get started.",
    "Aucun client associé à cet espace CRIC.":
      "No clients are associated with this RCIC workspace.",
    "Aucun dossier pour ce client.": "No case is available for this client.",
    "Sélectionnez d’abord un client et un dossier autorisés.":
      "First select an authorized client and case.",
    "Outils de préparation disponibles. Aucun document n’est automatiquement enregistré.":
      "Preparation tools are available. No documents are saved automatically.",
    "Sélectionner un dossier": "Select a case",
    "Fiche copiée.": "Information sheet copied.",
    "Copier la fiche": "Copy information sheet",
    "Copie impossible : sélectionnez le texte manuellement.":
      "Unable to copy: select the text manually.",
  });
  // Placeholders in the preliminary assessment form (UI only).
  Object.assign(dictionary, {
    "Ex. : Entrée express, parrainage familial":
      "E.g. Express Entry, family sponsorship",
    "Indiquez les faits vérifiés et les critères applicables.":
      "Enter the verified facts and applicable criteria.",
  });
  const key = "madic_ui_language";
  let lang = "fr";
  try {
    lang = localStorage.getItem(key) === "en" ? "en" : "fr";
  } catch (_) {}
  const normalized = (value) =>
    String(value ?? "")
      .replace(/\s+/g, " ")
      .trim();
  const reverse = new Map();
  Object.entries(dictionary).forEach(([fr, en]) => {
    if (fr !== en && !reverse.has(normalized(en)))
      reverse.set(normalized(en), fr);
  });
  const originals = new WeakMap();
  const rendered = new WeakMap();
  const originalAttrs = new WeakMap();
  const renderedAttrs = new WeakMap();
  const attrs = ["placeholder", "title", "aria-label"];
  const ignored = (node) =>
    !!node.parentElement?.closest(
      'script,style,code,pre,textarea,[contenteditable="true"],.madic-lang-controls',
    );
  const patterns = [
    [/^Nouvelle demande de rendez-vous\s*-\s*/i, "New appointment request - "],
    [/^Dernière vérification automatique\s*:/i, "Last automatic check:"],
    [/^Documents du dossier\s*:/i, "Case documents:"],
    [/^Espace professionnel\s*:/i, "Professional workspace:"],
    [/^Espace de facturation du cabinet\s*:/i, "Practice invoicing workspace:"],
    [/^Cabinet\s*:/i, "Practice:"],
    [
      /^\d+\s+document\(s\) reçu\(s\)\./i,
      (s) => s.replace("document(s) reçu(s)", "document(s) received"),
    ],
    [
      /^\d+\s+échéances?\s*·/i,
      (s) =>
        s
          .replace(/échéances?/, "deadlines")
          .replace(/dépassée?s?/, "overdue")
          .replace(/à traiter dans les/, "due within the")
          .replace(/prochains jours/, "next days"),
    ],
    [
      /^\d+\s+ligne\(s\) affichée\(s\)\./i,
      (s) => s.replace("ligne(s) affichée(s)", "row(s) displayed"),
    ],
    [
      /^Consultation\s*-\s*\d+\s+ligne\(s\) affichée\(s\)/i,
      (s) => s.replace("ligne(s) affichée(s)", "row(s) displayed"),
    ],
  ];
  function toFrench(value) {
    const text = normalized(value);
    return reverse.get(text) || value;
  }
  function toEnglish(value) {
    const text = normalized(value);
    if (Object.prototype.hasOwnProperty.call(dictionary, text))
      return dictionary[text];
    for (const [pattern, replacement] of patterns) {
      if (pattern.test(text)) return text.replace(pattern, replacement);
    }
    return value;
  }
  function localized(original) {
    const trimmed = normalized(original);
    const output = lang === "en" ? toEnglish(trimmed) : toFrench(trimmed);
    if (output === trimmed) return original;
    const start = original.indexOf(trimmed);
    return start < 0
      ? output
      : original.slice(0, start) +
          output +
          original.slice(start + trimmed.length);
  }
  function translateText(node) {
    if (
      node.parentElement?.closest(
        ".madic-cric-standard-header,.madic-unified-sidebar",
      )
    )
      return;
    if (!node?.parentElement || ignored(node)) return;
    const current = node.nodeValue;
    if (!normalized(current)) return;
    if (!originals.has(node) || rendered.get(node) !== current)
      originals.set(node, current);
    const next = localized(originals.get(node));
    if (next !== current) node.nodeValue = next;
    rendered.set(node, next);
  }
  function translateElement(el) {
    if (
      el?.closest(".madic-cric-standard-header,.madic-unified-sidebar") &&
      !el.matches(".madic-lang-controls button[data-lang]")
    ) {
      const value = el.getAttribute("data-madic-" + lang);
      if (value !== null && !el.children.length && el.textContent !== value)
        el.textContent = value;
      for (const attr of ["placeholder", "title", "aria-label"]) {
        const text = el.getAttribute("data-madic-" + lang + "-" + attr);
        if (text !== null && el.getAttribute(attr) !== text)
          el.setAttribute(attr, text);
      }
      return;
    }

    if (!el || el.nodeType !== 1) return;
    if (el.matches(".madic-lang-controls button[data-lang]")) {
      el.disabled = false;
      el.removeAttribute("aria-disabled");
      el.setAttribute("aria-pressed", String(el.dataset.lang === lang));
      el.classList.toggle("madic-lang-active", el.dataset.lang === lang);
      el.setAttribute(
        "aria-label",
        el.dataset.lang === "fr" ? "Français" : "English",
      );
      el.title = el.dataset.lang === "fr" ? "Français" : "English";
      return;
    }
    if (
      el.closest(
        'script,style,code,pre,[contenteditable="true"],.madic-lang-controls',
      )
    )
      return;
    let source = originalAttrs.get(el);
    let previous = renderedAttrs.get(el);
    if (!source) {
      source = {};
      originalAttrs.set(el, source);
    }
    if (!previous) {
      previous = {};
      renderedAttrs.set(el, previous);
    }
    for (const attr of attrs) {
      if (!el.hasAttribute(attr)) continue;
      const explicit = el.getAttribute(
        lang === "en" ? "data-en-" + attr : "data-fr-" + attr,
      );
      if (explicit !== null) {
        if (el.getAttribute(attr) !== explicit) el.setAttribute(attr, explicit);
        previous[attr] = explicit;
        continue;
      }
      const current = el.getAttribute(attr);
      if (!(attr in source) || previous[attr] !== current)
        source[attr] = current;
      const next = localized(source[attr]);
      if (next !== current) el.setAttribute(attr, next);
      previous[attr] = next;
    }
  }
  let observer;
  let scheduled = false;
  function render() {
    if (observer) observer.disconnect();
    document.documentElement.lang = lang === "en" ? "en-CA" : "fr-CA";
    const pageTitle = document.querySelector("title[data-fr][data-en]");
    if (pageTitle)
      document.title = pageTitle.getAttribute(
        lang === "en" ? "data-en" : "data-fr",
      );
    const root = document.body;
    if (!root) return;
    const walker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
    );
    let node;
    while ((node = walker.nextNode())) {
      if (node.nodeType === 3) translateText(node);
      else translateElement(node);
    }
    document
      .querySelectorAll(".madic-lang-controls button[data-lang]")
      .forEach(translateElement);
    if (observer)
      observer.observe(root, {
        subtree: true,
        childList: true,
        characterData: true,
        attributes: true,
        attributeFilter: attrs,
      });
  }
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      render();
    });
  }
  function selectLanguage(next) {
    if (next !== "fr" && next !== "en") return;
    lang = next;
    try {
      localStorage.setItem(key, lang);
    } catch (_) {}
    render();
    document.dispatchEvent(
      new CustomEvent("madic:languagechange", { detail: { lang } }),
    );
  }
  function init() {
    document.addEventListener(
      "click",
      (event) => {
        const button = event.target.closest?.(
          ".madic-lang-controls button[data-lang]",
        );
        if (!button) return;
        event.preventDefault();
        selectLanguage(button.dataset.lang);
      },
      true,
    );
    observer = new MutationObserver(schedule);
    render();
    window.MadicCricLanguage = {
      set: selectLanguage,
      get: () => lang,
      refresh: render,
    };
  }
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();

(() => {
  const apply = () => {
    let lang = "fr";
    try {
      lang = localStorage.getItem("madic_ui_language") === "en" ? "en" : "fr";
    } catch (_) {}
    document
      .querySelectorAll(".madic-footer [data-fr][data-en]")
      .forEach((el) => {
        el.textContent = el.getAttribute("data-" + lang);
      });
  };
  document
    .querySelectorAll(".madic-lang-controls [data-lang]")
    .forEach((b) => b.addEventListener("click", () => queueMicrotask(apply)));
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", apply);
  else apply();
})();

/* Exact header wording in both languages; no business data changes. */
(() => {
  const update = () => {
    const link = document.querySelector(
      'body[data-page="gestion-dossiers-cric"] header .toplinks a[href="cric-dashboard.html"]',
    );
    if (!link) return;
    let en = false;
    try {
      en = localStorage.getItem("madic_ui_language") === "en";
    } catch (_) {}
    link.textContent = en ? "My space" : "Mon espace";
  };
  document.addEventListener("madic:languagechange", () =>
    queueMicrotask(update),
  );
  document.addEventListener("click", (e) => {
    if (e.target.closest?.(".madic-lang-controls button[data-lang]"))
      setTimeout(update, 0);
  });
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", update);
  else update();
})();

/* MADIC - provincial/federal intake pre-screening. Read-only, RLS enforced. */
(() => {
  "use strict";
  const $ = (id) => document.getElementById(id),
    run = $("madicProvRun");
  if (!run) return;
  const regions = [
    [
      "Québec",
      "Programme de sélection des travailleurs qualifiés (PSTQ)",
      "https://www.quebec.ca/immigration",
    ],
    [
      "Ontario",
      "Ontario Immigrant Nominee Program (OINP)",
      "https://www.ontario.ca/page/ontario-immigrant-nominee-program-oinp",
    ],
    [
      "Alberta",
      "Alberta Advantage Immigration Program (AAIP)",
      "https://www.alberta.ca/immigration",
    ],
    [
      "Colombie-Britannique",
      "BC Provincial Nominee Program (BC PNP)",
      "https://www.welcomebc.ca/immigrate-to-b-c",
    ],
    [
      "Manitoba",
      "Manitoba Provincial Nominee Program (MPNP)",
      "https://immigratemanitoba.com/",
    ],
    [
      "Saskatchewan",
      "Saskatchewan Immigrant Nominee Program (SINP)",
      "https://www.saskatchewan.ca/residents/moving-to-saskatchewan/immigrating-to-saskatchewan",
    ],
    [
      "Nouveau-Brunswick",
      "New Brunswick Provincial Nominee Program (NBPNP)",
      "https://www.gnb.ca/en/topic/family-home-community/immigration.html",
    ],
    [
      "Nouvelle-Écosse",
      "Nova Scotia Nominee Program (NSNP)",
      "https://liveinnovascotia.com/fr/Programme-des-candidats-Nouvelle-Ecosse",
    ],
    [
      "Terre-Neuve-et-Labrador",
      "Newfoundland and Labrador Provincial Nominee Program (NLPNP)",
      "https://www.gov.nl.ca/immigration/fr/bienvenue-au-portail-dimmigration-de-terre-neuve-et-labrador/",
    ],
    [
      "Île-du-Prince-Édouard",
      "Prince Edward Island Provincial Nominee Program (PEI PNP)",
      "https://www.princeedwardisland.ca/en/topic/immigrate-to-pei",
    ],
    ["Yukon", "Yukon Nominee Program", "https://yukon.ca/en/immigration"],
    [
      "Territoires du Nord-Ouest",
      "Northwest Territories Nominee Program",
      "https://www.immigratenwt.ca/",
    ],
  ];
  const federal = [
    [
      "Entrée express - catégorie de l’expérience canadienne / travailleurs qualifiés / métiers spécialisés",
      "https://www.canada.ca/fr/immigration-refugies-citoyennete/services/immigrer-canada/entree-express.html",
    ],
    [
      "Programme d’immigration au Canada atlantique",
      "https://www.canada.ca/fr/immigration-refugies-citoyennete/services/immigrer-canada/programme-immigration-atlantique.html",
    ],
  ];
  const clean = (v) => String(v ?? "").trim(),
    lower = (v) => clean(v).toLocaleLowerCase("fr");
  const yes = (v) => /^(oui|yes|true|1)$/i.test(clean(v));
  const numeric = (v) => {
    const n = Number(clean(v).replace(",", "."));
    return Number.isFinite(n) && clean(v) !== "" ? n : null;
  };
  const el = (tag, text, cls) => {
    const n = document.createElement(tag);
    if (text !== undefined) n.textContent = text;
    if (cls) n.className = cls;
    return n;
  };
  const language = () => {
    try {
      return localStorage.getItem("madic_ui_language") === "en" ? "en" : "fr";
    } catch (_) {
      return "fr";
    }
  };
  const tr = (fr, en) => (language() === "en" ? en : fr);
  let reportText = "";
  function item(parent, label, value) {
    const p = el("p");
    p.append(
      el("strong", label + ": "),
      document.createTextNode(clean(value) || tr("Non fourni", "Not provided")),
    );
    parent.append(p);
  }
  function renderCard(parent, name, program, url, answers, kind) {
    const card = el("article", undefined, "madic-prov-card");
    card.append(el("h3", name), el("p", program));
    const destination = lower(answers.province_destination || answers.province);
    const relevant =
      destination &&
      lower(name)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") ===
        destination.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const signals = [];
    const missing = [];
    const exp = numeric(answers.nbr_annee_exp);
    if (exp !== null)
      signals.push(
        tr("Expérience déclarée : ", "Declared experience: ") +
          exp +
          tr(" année(s)", " year(s)"),
      );
    else
      missing.push(
        tr(
          "Durée de l’expérience professionnelle",
          "Length of work experience",
        ),
      );
    if (clean(answers.niveau_scolarite))
      signals.push(
        tr("Scolarité déclarée : ", "Declared education: ") +
          answers.niveau_scolarite,
      );
    else missing.push(tr("Niveau de scolarité", "Education level"));
    if (clean(answers.niveau_francais) || clean(answers.niveau_anglais))
      signals.push(
        tr(
          "Niveaux linguistiques autodéclarés (non vérifiés)",
          "Self-reported language levels (unverified)",
        ),
      );
    else
      missing.push(
        tr(
          "Résultats de tests linguistiques officiels",
          "Official language test results",
        ),
      );
    if (clean(answers.offre_emploi))
      signals.push(
        tr(
          "Réponse à la question sur l’offre d’emploi : ",
          "Job-offer response: ",
        ) + answers.offre_emploi,
      );
    else
      missing.push(
        tr(
          "Offre d’emploi et admissibilité de l’employeur",
          "Job offer and employer eligibility",
        ),
      );
    if (clean(answers.titre_emploi) || clean(answers.emploi_actuel))
      signals.push(
        tr("Emploi déclaré : ", "Declared occupation: ") +
          (answers.titre_emploi || answers.emploi_actuel),
      );
    else missing.push(tr("Profession et code CNP", "Occupation and NOC code"));
    if (kind === "province" && !destination)
      missing.push(tr("Province de destination", "Intended province"));
    if (kind === "province" && relevant)
      signals.unshift(
        tr("Province de destination déclarée", "Declared intended province"),
      );
    missing.push(
      tr(
        "Volet ouvert, critères détaillés, documents et liens provinciaux",
        "Open stream, detailed requirements, documents and provincial ties",
      ),
    );
    const label = relevant
      ? tr(
          "Province privilégiée - examen requis",
          "Preferred province - review required",
        )
      : tr(
          "À vérifier - admissibilité non déterminée",
          "To review - eligibility undetermined",
        );
    card.append(el("p", label, "madic-prov-tag"));
    const good = el("ul");
    signals.forEach((s) => good.append(el("li", s)));
    card.append(
      el("h4", tr("Renseignements disponibles", "Available information")),
      good,
    );
    const need = el("ul");
    missing.forEach((s) => need.append(el("li", s)));
    card.append(
      el("h4", tr("Vérifications indispensables", "Required checks")),
      need,
    );
    const link = el("a", tr("Source officielle", "Official source"));
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    card.append(link);
    parent.append(card);
    reportText +=
      "\n" +
      name +
      " - " +
      program +
      "\n" +
      label +
      "\n" +
      signals.join("\n") +
      "\n" +
      missing.join("\n") +
      "\n" +
      url +
      "\n";
  }
  function render(answers, client, dossier, status) {
    const output = $("madicProvResults");
    output.replaceChildren();
    output.hidden = false;
    reportText = "";
    output.append(
      el(
        "h3",
        tr("Analyse comparative - Canada", "Comparative assessment - Canada"),
      ),
    );
    item(
      output,
      tr("Client", "Client"),
      client.options[client.selectedIndex]?.textContent,
    );
    item(
      output,
      tr("Dossier", "Case"),
      dossier.options[dossier.selectedIndex]?.textContent,
    );
    item(output, tr("Statut du formulaire", "Intake status"), status);
    const dob = clean(answers.date_naissance);
    if (dob)
      item(
        output,
        tr("Date de naissance déclarée", "Declared date of birth"),
        dob,
      );
    output.append(
      el(
        "p",
        tr(
          "Aucun programme n’est confirmé admissible automatiquement. Les résultats ci-dessous sont des pistes de vérification pour le CRIC.",
          "No program is automatically confirmed eligible. The results below are review leads for the RCIC.",
        ),
      ),
    );
    reportText =
      tr(
        "MADIC - Présélection professionnelle, non décision d’admissibilité",
        "MADIC - Professional pre-screening, not an eligibility decision",
      ) +
      "\n" +
      client.options[client.selectedIndex]?.textContent +
      "\n" +
      dossier.options[dossier.selectedIndex]?.textContent +
      "\n";
    output.append(el("h3", tr("Programmes fédéraux", "Federal programs")));
    for (const [program, url] of federal)
      renderCard(
        output,
        tr("Fédéral", "Federal"),
        program,
        url,
        answers,
        "federal",
      );
    output.append(
      el(
        "h3",
        tr(
          "Programmes provinciaux et territoriaux",
          "Provincial and territorial programs",
        ),
      ),
    );
    for (const [name, program, url] of regions)
      renderCard(output, name, program, url, answers, "province");
    output.append(
      el(
        "p",
        tr(
          "Les réponses du formulaire ne suffisent pas à vérifier les critères de tous les volets, les rondes d’invitations, la recevabilité, les seuils linguistiques, les professions et les exigences des employeurs.",
          "The intake responses do not establish all stream requirements, invitation rounds, admissibility, language thresholds, occupations or employer requirements.",
        ),
      ),
    );
    $("madicProvCopy").disabled = false;
  }
  run.addEventListener("click", async () => {
    const client = $("toolClient"),
      dossier = $("toolDossier"),
      status = $("madicProvStatus");
    $("madicProvCopy").disabled = true;
    $("madicProvResults").hidden = true;
    if (!client?.value || !dossier?.value) {
      status.textContent = tr(
        "Sélectionnez un client et son dossier.",
        "Select a client and case.",
      );
      return;
    }
    status.textContent = tr(
      "Lecture sécurisée du formulaire…",
      "Securely loading intake…",
    );
    run.disabled = true;
    try {
      const db =
        typeof window.getMadicSupabase === "function"
          ? window.getMadicSupabase()
          : null;
      if (!db) throw Error("Supabase unavailable");
      // Never bypass RLS: selected client is already restricted by the existing CRIC workspace selector.
      const { data, error } = await db
        .from("madic_client_intake")
        .select("answers,status")
        .eq("user_id", client.value)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        status.textContent = tr(
          "Formulaire inaccessible ou absent. Vérifiez que le client a enregistré ses réponses et que la politique RLS autorise ce CRIC.",
          "Intake unavailable or absent. Check that the client saved responses and that RLS authorizes this RCIC.",
        );
        return;
      }
      if (!data.answers || typeof data.answers !== "object")
        throw Error(
          tr("Réponses absentes ou invalides.", "Missing or invalid answers."),
        );
      render(data.answers, client, dossier, data.status || "-");
      status.textContent = tr(
        "Analyse préparatoire affichée. Vérification professionnelle obligatoire.",
        "Preliminary assessment displayed. Professional review required.",
      );
    } catch (error) {
      status.textContent =
        tr("Accès aux réponses impossible : ", "Unable to access responses: ") +
        (error.message || String(error));
    } finally {
      run.disabled = false;
    }
  });
  $("madicProvCopy").addEventListener("click", async () => {
    if (!reportText) return;
    try {
      await navigator.clipboard.writeText(reportText);
      $("madicProvStatus").textContent = tr("Rapport copié.", "Report copied.");
    } catch (_) {
      $("madicProvStatus").textContent = tr(
        "Copie impossible.",
        "Copy failed.",
      );
    }
  });
  for (const id of ["toolClient", "toolDossier"])
    $(id)?.addEventListener("change", () => {
      $("madicProvResults").hidden = true;
      $("madicProvCopy").disabled = true;
      reportText = "";
      $("madicProvStatus").textContent = "";
    });
})();

/* Afficher l’onglet courant sur téléphone sans déplacer le contenu verticalement. */
(() => {
  const init = () => {
    const nav = document.querySelector(".madic-unified-sidebar > nav");
    const current = nav?.querySelector('a[aria-current="page"]');
    if (!current) return;

    const mobile = window.matchMedia("(max-width: 850px)");
    const labels = document.querySelectorAll(
      ".madic-unified-sidebar .madic-cric-menu-label, header.madic-cric-standard-header .brand small",
    );
    let scheduled = false;
    const reveal = () => {
      if (!mobile.matches || scheduled) return;
      scheduled = true;
      window.requestAnimationFrame(() => {
        scheduled = false;
        if (!mobile.matches || nav.scrollWidth <= nav.clientWidth) return;

        const left = nav.getBoundingClientRect().left + nav.clientLeft;
        const right = left + nav.clientWidth;
        const item = current.getBoundingClientRect();
        if (item.left >= left && item.right <= right) return;
        nav.scrollLeft += (item.left + item.right - left - right) / 2;
      });
    };

    const applyLanguage = () => {
      const lang = document.documentElement.lang.startsWith("en") ? "en" : "fr";
      for (const label of labels) {
        const text = label.dataset[lang];
        if (text && label.textContent !== text) label.textContent = text;
      }
      reveal();
    };

    applyLanguage();
    window.addEventListener("pageshow", reveal);
    window.addEventListener("resize", reveal);
    new MutationObserver(applyLanguage).observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["lang"],
    });
    document.fonts?.ready.then(reveal);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();

/* MADIC : interactions de l'entete harmonise, sans changement des traitements métier. */
(function () {
  function init() {
    var logout = document.getElementById("cricLogout");
    if (logout) {
      logout.addEventListener("click", function () {
        var original =
          document.getElementById("logout") ||
          document.getElementById("madicMsgLogout");
        if (original) original.click();
      });
    }
    var form = document.getElementById("madicHeaderSearchForm");
    if (form)
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var q = document.getElementById("madicHeaderSearch");
        var value = q ? q.value.trim() : "";
        window.location.href =
          "cric-dashboard.html" +
          (value ? "?search=" + encodeURIComponent(value) : "");
      });
    var name = document.getElementById("madicHeaderProfileName");
    var license = document.getElementById("madicHeaderProfileLicense");
    if (name && window.getMadicSupabase) {
      try {
        window
          .getMadicSupabase()
          .auth.getUser()
          .then(async function (r) {
            var u = r && r.data && r.data.user;
            if (!u) return;
            var m = u.user_metadata || {};
            var db = window.getMadicSupabase();
            var result = await db
              .from("madic_cric_applications")
              .select("full_name,license_number")
              .eq("user_id", u.id)
              .maybeSingle();
            var a = result.data || {};
            name.textContent =
              a.full_name ||
              m.full_name ||
              m.name ||
              u.email ||
              name.textContent;
            if (license)
              license.textContent =
                "CRIC " + (a.license_number || m.license_number || "");
          })
          .catch(function () {});
      } catch (e) {}
    }
  }
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", init);
  else init();
})();

/* Phone navigation only; existing authentication and business logic unchanged. */
(() => {
  const init = () => {
    const drawer = document.getElementById("madicPhoneDrawer");
    const trigger = document.querySelector(".madic-phone-trigger");
    const close = drawer?.querySelector(".madic-phone-close");
    const shade = document.querySelector(".madic-phone-shade");
    if (!drawer || !trigger || !close || !shade) return;
    const mobile = matchMedia("(max-width:900px)");
    const set = (open, restore = false) => {
      open = open && mobile.matches;
      document.body.classList.toggle("madic-phone-open", open);
      trigger.setAttribute("aria-expanded", String(open));
      shade.hidden = !open;
      drawer.inert = mobile.matches && !open;
      if (open) close.focus();
      else if (restore && mobile.matches) trigger.focus();
    };
    trigger.addEventListener("click", () => set(true));
    close.addEventListener("click", () => set(false, true));
    shade.addEventListener("click", () => set(false, true));
    drawer.addEventListener("click", (e) => {
      if (e.target.closest("a[href]")) set(false);
    });
    document.addEventListener("keydown", (e) => {
      if (
        e.key === "Escape" &&
        document.body.classList.contains("madic-phone-open")
      )
        set(false, true);
    });
    mobile.addEventListener("change", () => set(false));
    const lang = () => {
      const en = document.documentElement.lang.startsWith("en");
      trigger.setAttribute("aria-label", en ? "Open menu" : "Ouvrir le menu");
      close.setAttribute("aria-label", en ? "Close menu" : "Fermer le menu");
    };
    new MutationObserver(lang).observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["lang"],
    });
    lang();
    set(false);
  };
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();

/* MADIC display preferences - UI only */
(() => {
  const init = () => {
    const root = document.documentElement,
      body = document.body,
      tools = document.querySelector(".madic-display-tools");
    if (!tools) return;
    const collapse = tools.querySelector(".madic-collapse"),
      trigger = tools.querySelector(".madic-theme-trigger"),
      menu = tools.querySelector("#madicThemeOptions"),
      choices = [...menu.querySelectorAll("button")],
      media = matchMedia("(prefers-color-scheme: dark)");
    const read = (k, d) => {
      try {
        return localStorage.getItem(k) || d;
      } catch {
        return d;
      }
    };
    const save = (k, v) => {
      try {
        localStorage.setItem(k, v);
      } catch {}
    };
    let compact = read("madic-cric-sidebar", "expanded") === "collapsed",
      theme = read("madic-admin-theme", "light");
    if (!["system", "light", "dark"].includes(theme)) theme = "light";
    let renderedLanguage;
    let renderedTheme;
    const render = () => {
      renderedLanguage = root.lang;
      const en = root.lang.startsWith("en");
      body.classList.toggle("madic-sidebar-compact", compact);
      root.dataset.madicAppearance =
        theme === "system" ? (media.matches ? "dark" : "light") : theme;
      root.dataset.madicTheme = root.dataset.madicAppearance;
      const label = compact
        ? en
          ? "Expand"
          : "Développer"
        : en
          ? "Collapse"
          : "Réduire";
      collapse.querySelector("span").textContent = label;
      collapse.title = label;
      collapse.setAttribute("aria-label", label);
      collapse.setAttribute("aria-expanded", String(!compact));
      trigger.title = en ? "Appearance" : "Apparence";
      trigger.setAttribute("aria-label", trigger.title);
      choices.forEach((b, i) => {
        b.querySelector("span").textContent = (
          en ? ["System", "Light", "Dark"] : ["Système", "Clair", "Sombre"]
        )[i];
        b.setAttribute("aria-pressed", String(b.dataset.themeChoice === theme));
      });
      if (renderedTheme !== theme)
        trigger.querySelector("svg").replaceWith(
          choices
            .find((b) => b.dataset.themeChoice === theme)
            .querySelector("svg")
            .cloneNode(true),
        );
      renderedTheme = theme;
      document
        .querySelectorAll(
          "#madicPhoneDrawer nav a, #madicPhoneDrawer nav summary",
        )
        .forEach((a) => {
          a.title = a.textContent.trim();
          a.setAttribute("aria-label", a.title);
        });
    };
    const open = (v) => {
      menu.hidden = !v;
      trigger.setAttribute("aria-expanded", String(v));
    };
    collapse.addEventListener("click", () => {
      compact = !compact;
      save("madic-cric-sidebar", compact ? "collapsed" : "expanded");
      render();
    });
    trigger.addEventListener("click", () => open(menu.hidden));
    choices.forEach((b) =>
      b.addEventListener("click", () => {
        theme = b.dataset.themeChoice;
        save("madic-admin-theme", theme);
        render();
        open(false);
        trigger.focus();
      }),
    );
    document.addEventListener("click", (e) => {
      if (!e.composedPath().includes(tools)) open(false);
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !menu.hidden) {
        open(false);
        trigger.focus();
      }
    });
    media.addEventListener("change", render);
    new MutationObserver(() => {
      if (root.lang !== renderedLanguage) render();
    }).observe(root, {
      attributes: true,
      attributeFilter: ["lang"],
    });
    window.addEventListener("storage", (e) => {
      if (["madic-cric-sidebar", "madic-admin-theme"].includes(e.key)) {
        compact = read("madic-cric-sidebar", "expanded") === "collapsed";
        theme = read("madic-admin-theme", "light");
        if (!["system", "light", "dark"].includes(theme)) theme = "light";
        render();
      }
    });
    render();
  };
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
