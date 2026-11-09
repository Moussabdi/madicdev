(function () {
  "use strict";
  const dictionary = {
    "MADIC PORTAIL": "MADIC PORTAL",
    "Accès rapides": "Quick access",
    "Raccourcis vers les modules": "Module shortcuts",
    "Demandes de services": "Service requests",
    "Demandes reçues": "Requests received",
    "Professional profile": "Professional profile",
    "Gestion des clients": "Client management",
    "Suivi des dossiers": "Case tracking",
    "Rendez-vous": "Appointments",
    "Notifications": "Notifications",
    "NAVIGATION": "NAVIGATION",
    "Numéro CRIC": "RCIC licence number",
    "Espace professionnel non configuré": "Professional workspace not configured",
    "Espace CRIC actif : gestion des clients et dossiers disponible.": "Active RCIC workspace: client and case management available.",
    "Votre espace CRIC doit etre configure.": "Your RCIC workspace needs to be configured.",
    "Votre espace CRIC est suspendu ou inactif.": "Your RCIC workspace is suspended or inactive.",
    "Acces a cet espace non autorise. Contactez MADIC.": "Access to this workspace is not authorized. Contact MADIC.",
    PORTAIL: "PORTAL",
    "Espace professionnel": "Professional workspace",
    "Vue d’ensemble": "Overview",
    "Outils CRIC": "RCIC tools",
    Messagerie: "Messaging",
    Échéances: "Deadlines",
    Facturation: "Billing",
    "Mon profil professionnel": "My professional profile",
    "Espace sécurisé MADIC": "Secure MADIC workspace",
    "Mon espace": "My space",
    "ESPACE PROFESSIONNEL CRIC": "RCIC PROFESSIONAL WORKSPACE",
    Bienvenue: "Welcome",
    Déconnexion: "Sign out",
    "Demandes de services": "Service requests",
    Actualiser: "Refresh",
    "+ Nouvelle demande de service": "+ New service request",
    "Client existant": "Existing client",
    "Type de service": "Service type",
    "Consultation initiale": "Initial consultation",
    "Proposition personnalisée": "Customized proposal",
    "Mode de paiement déclaré": "Declared payment method",
    "Virement Interac": "Interac e-Transfer",
    Espèces: "Cash",
    "Référence ou note (facultatif)": "Reference or note (optional)",
    "Le mode choisi est déclaré par le CRIC. Il ne confirme pas automatiquement la réception des fonds.":
      "The selected method is declared by the RCIC. It does not automatically confirm receipt of funds.",
    "Créer la demande": "Create request",
    "Total des demandes": "Total requests",
    "Demandes reçues": "Requests received",
    "Autres statuts": "Other statuses",
    Afficher: "Show",
    "Toutes les demandes": "All requests",
    "Contrats signés": "Signed contracts",
    Rechercher: "Search",
    "Chargement des demandes…": "Loading requests…",
    "Notifications des clients": "Client notifications",
    "Chargement des notifications…": "Loading notifications…",
    "Afficher / masquer l’historique des notifications":
      "Show / hide notification history",
    "🔔 Mes rappels prioritaires": "🔔 My priority reminders",
    "Voir toutes les échéances →": "View all deadlines →",
    "Chargement des rappels…": "Loading reminders…",
    "Personnalisez les invitations de votre cabinet avec vos coordonnées et votre logo.":
      "Customize your firm invitations with your contact details and logo.",
    "Compléter mon profil →": "Complete my profile →",
    "Gestion des clients": "Client management",
    "Clients associés à votre espace professionnel et invitations.":
      "Clients and invitations associated with your professional workspace.",
    "Gérer mes clients →": "Manage my clients →",
    "Accès en préparation : isolation des clients par CRIC à finaliser.":
      "Access in preparation: client isolation by RCIC is being finalized.",
    "Suivi visuel des dossiers": "Visual case tracking",
    "Tableau Kanban de votre cabinet, avec changement de statut par glisser-déposer ou sélection.":
      "Your firm’s Kanban board, with status changes by drag and drop or selection.",
    "Ouvrir le Kanban →": "Open Kanban →",
    "Accessible uniquement aux cabinets CRIC autorisés.":
      "Available only to authorized RCIC firms.",
    "Rendez-vous et consultations": "Appointments and consultations",
    "Disponibilités, réservations et consultations de votre cabinet.":
      "Your firm’s availability, bookings and consultations.",
    "Gérer les rendez-vous →": "Manage appointments →",
    "Facturation CRIC": "RCIC billing",
    "Créer, émettre et suivre les factures de votre cabinet.":
      "Create, issue and track your firm’s invoices.",
    "Gérer mes factures →": "Manage my invoices →",
    "Accessible aux CRIC autorisés.": "Available to authorized RCICs.",
    "Gestion financière": "Financial management",
    "Temps et honoraires, facturation, paiements, fidéicommis, comptabilité et rapports.":
      "Time and fees, billing, payments, trust accounts, accounting and reports.",
    "Accéder à la gestion financière →": "Open financial management →",
    "Échéances et rappels": "Deadlines and reminders",
    "Suivez les dates limites des dossiers de votre cabinet.":
      "Track your firm’s case deadlines.",
    "Consulter les échéances →": "View deadlines →",
    "Messagerie sécurisée": "Secure messaging",
    "Échangez des messages confidentiels avec les clients de votre cabinet.":
      "Exchange confidential messages with your firm’s clients.",
    "Vérification des messages…": "Checking messages…",
    "Actualiser les messages": "Refresh messages",
    "Ouvrir la messagerie →": "Open messaging →",
    "Gestion des dossiers CRIC": "RCIC case management",
    "Création et suivi des dossiers, documents et décisions.":
      "Create and track cases, documents and decisions.",
    "Gérer mes dossiers →": "Manage my cases →",
    "Accès en préparation : isolation des dossiers par CRIC à finaliser.":
      "Access in preparation: case isolation by RCIC is being finalized.",
    "Outils d’évaluation en immigration": "Immigration assessment tools",
    "Accédez aux évaluations Entrée express, Québec et Saskatchewan.":
      "Access Express Entry, Québec and Saskatchewan assessments.",
    "Évaluation Entrée express →": "Express Entry assessment →",
    "Évaluation Québec →": "Québec assessment →",
    "Évaluation Saskatchewan →": "Saskatchewan assessment →",
    "Administration générale MADIC →": "MADIC general administration →",
    "Vérification de votre compte CRIC…": "Verifying your RCIC account…",
    "© MAD Immigration Canadienne · Portail sécurisé":
      "© MAD Immigration Canadienne · Secure portal",
    "Numéro CRIC : -": "RCIC licence number: -",
    "Référence ou date du paiement": "Payment reference or date",
    "Nom du client": "Client name",
    "Messages non lus": "Unread messages",
    "Navigation du portail": "Portal navigation",
  };
  const storageKey = "madic_ui_language";
  const originals = new WeakMap();
  const rendered = new WeakMap();
  let lang = "fr";
  let observer;
  let pending = false;
  function translateText(node) {
    if (
      !node.parentElement ||
      node.parentElement.closest(
        'script,style,textarea,[contenteditable="true"],.madic-lang-controls',
      )
    )
      return;
    const raw = node.nodeValue;
    if (!raw || !raw.trim()) return;
    // Respecter les textes actualisés par les scripts métier (nom, statut, compteurs).
    if (!originals.has(node) || (rendered.has(node) && rendered.get(node) !== raw)) originals.set(node, raw);
    const source = originals.get(node);
    const trimmed = source.trim();
    let result = source;
    if (lang === "en") {
      let target = dictionary[trimmed];
      if (!target && /^Bienvenue,\s*/.test(trimmed)) target = trimmed.replace(/^Bienvenue/, "Welcome");
      if (!target && /^Espace professionnel\s*:/.test(trimmed)) target = trimmed.replace(/^Espace professionnel/, "Professional workspace");
      if (!target && /^Numéro CRIC\s*:/.test(trimmed))
        target = trimmed.replace(/^Numéro CRIC/, "RCIC licence number");
      if (target) result = source.replace(trimmed, target);
    }
    if (node.nodeValue !== result) node.nodeValue = result;
    rendered.set(node, result);
  }
  function translateAttributes(el) {
    for (const name of ["placeholder", "title", "aria-label"]) {
      if (!el.hasAttribute(name)) continue;
      const key =
        "madicOriginal" +
        name
          .replace(/-([a-z])/g, (_, c) => c.toUpperCase())
          .replace(/^./, (c) => c.toUpperCase());
      if (!el.dataset[key]) el.dataset[key] = el.getAttribute(name);
      const source = el.dataset[key];
      const result = lang === "en" ? dictionary[source] || source : source;
      if (el.getAttribute(name) !== result) el.setAttribute(name, result);
    }
  }
  function render() {
    if (observer) observer.disconnect();
    const root = document.body;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) translateText(node);
    root
      .querySelectorAll("[placeholder],[title],[aria-label]")
      .forEach(translateAttributes);
    document.documentElement.lang = lang === "en" ? "en-CA" : "fr-CA";
    document.title =
      lang === "en" ? "My RCIC workspace | MADIC" : "Mon espace CRIC | MADIC";
    document.querySelectorAll(".madic-lang-controls button").forEach((btn) => {
      btn.setAttribute("aria-pressed", String(btn.dataset.lang === lang));
    });
    if (observer)
      observer.observe(root, {
        childList: true,
        subtree: true,
        characterData: true,
      });
  }
  function schedule() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      render();
    });
  }
  try {
    lang = localStorage.getItem(storageKey) === "en" ? "en" : "fr";
  } catch (_) {}
  document.querySelectorAll(".madic-lang-controls button").forEach((btn) =>
    btn.addEventListener("click", () => {
      lang = btn.dataset.lang;
      try {
        localStorage.setItem(storageKey, lang);
      } catch (_) {}
      render();
    }),
  );
  observer = new MutationObserver(schedule);
  render();
})();
