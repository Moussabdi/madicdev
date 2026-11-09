/* MADIC Phase 3 - interface translation only; no Supabase or business data changes. */
(function () {
  "use strict";
  const translations = {
    Connexion: "Sign in",
    "Mon espace": "My space",
    "Mon espace MADIC": "My MADIC space",
    "Votre parcours au Canada": "Your journey in Canada",
    "MON ESPACE": "MY SPACE",
    "Personnaliser le menu": "Customize menu",
    Réinitialiser: "Reset",
    "Glissez les éléments ou utilisez les flèches pour choisir votre ordre.":
      "Drag items or use the arrows to choose their order.",
    "Vue d’ensemble": "Overview",
    "Mon profil": "My profile",
    Formulaire: "Form",
    Messagerie: "Messaging",
    "Rendez-vous": "Appointments",
    "Mes dossiers": "My cases",
    Documents: "Documents",
    Factures: "Invoices",
    Monter: "Move up",
    Descendre: "Move down",
    "Espace client sécurisé": "Secure client space",
    "Votre projet, à votre rythme.": "Your project, at your pace.",
    Déconnexion: "Sign out",
    "MADIC · VOTRE PARCOURS AU CANADA": "MADIC · YOUR JOURNEY IN CANADA",
    "Chargement...": "Loading...",
    "Chargement…": "Loading…",
    "Chaque projet a son histoire. Retrouvez ici les informations, les échanges et les étapes de votre parcours avec MADIC.":
      "Every journey has its own story. Find information, messages and the stages of your journey with MADIC here.",
    "Mon formulaire d’immigration": "My immigration form",
    "Mes contrats": "My contracts",
    "Mon parcours d'immigration": "My immigration journey",
    "Progression de ma demande": "Application progress",
    "Consulter ma demande de service →": "View my service request →",
    "Cabinet de votre consultant": "Your consultant’s firm",
    "Messagerie sécurisée": "Secure messaging",
    "Consulter mes messages →": "View my messages →",
    "Chargement des messages…": "Loading messages…",
    "Remplissez votre questionnaire et reprenez vos réponses enregistrées dans votre espace sécurisé.":
      "Complete your questionnaire or resume your saved answers in your secure space.",
    "Remplir ou reprendre mon formulaire →": "Complete or resume my form →",
    "Mes rendez-vous et consultations": "My appointments and consultations",
    "Réservez un créneau auprès de votre consultant et consultez vos rendez-vous.":
      "Book a time with your consultant and view your appointments.",
    "Consulter mes rendez-vous →": "View my appointments →",
    Modifier: "Edit",
    "Consultez et modifiez vos renseignements personnels.":
      "View and edit your personal information.",
    "Photo de profil": "Profile photo",
    "Choisir une photo": "Choose a photo",
    "Enregistrer la photo": "Save photo",
    "Supprimer ma photo": "Remove my photo",
    "JPG, PNG ou WebP, maximum 2 Mo. Votre photo est privée.":
      "JPG, PNG or WebP, maximum 2 MB. Your photo is private.",
    "Prénom *": "First name *",
    "Nom *": "Last name *",
    "Courriel (non modifiable ici)": "Email (cannot be changed here)",
    Téléphone: "Phone",
    Genre: "Gender",
    Sélectionner: "Select",
    Homme: "Male",
    Femme: "Female",
    "Date de naissance": "Date of birth",
    Numéro: "Number",
    Rue: "Street",
    "Appartement (facultatif)": "Apartment (optional)",
    Ville: "City",
    "Province ou district": "Province or district",
    "Code postal": "Postal code",
    "Pays de résidence (recherchez dans la liste)":
      "Country of residence (search the list)",
    "Rechercher un pays...": "Search for a country...",
    Enregistrer: "Save",
    Consulter: "View",
    "Consultez vos dossiers et leur état d'avancement.":
      "View your cases and their progress.",
    Référence: "Reference",
    Catégorie: "Category",
    Statut: "Status",
    "Seul votre consultant CRIC peut créer ou activer un dossier.":
      "Only your RCIC consultant can create or activate a case.",
    "Mes documents et demandes": "My documents and requests",
    "Retrouvez les pièces demandées par votre consultant, transmettez vos fichiers et suivez leur évaluation.":
      "Find the documents requested by your consultant, upload files and track their review.",
    "1. Documents à fournir": "1. Documents to provide",
    Document: "Document",
    Instructions: "Instructions",
    "Date limite": "Deadline",
    "2. Transmettre un document": "2. Upload a document",
    "PDF, JPG, PNG - 10 Mo maximum. N'envoyez aucun document réel avant la mise en production officielle du portail.":
      "PDF, JPG, PNG – maximum 10 MB. Do not send real documents before the portal officially goes live.",
    "Dossier actif": "Active case",
    "Aucun dossier actif": "No active case",
    Transmettre: "Upload",
    "3. Historique et évaluations de mes documents":
      "3. My document history and reviews",
    Fichier: "File",
    "Date de création": "Creation date",
    "Motif / commentaire": "Reason / comment",
    Action: "Action",
    "Aucun document transmis.": "No documents uploaded.",
    "Mes factures": "My invoices",
    "Factures émises par le cabinet CRIC sélectionné. Les brouillons ne sont pas affichés.":
      "Invoices issued by the selected RCIC firm. Drafts are not displayed.",
    Date: "Date",
    Échéance: "Due date",
    Total: "Total",
    Solde: "Balance",
    Fermer: "Close",
    Terminer: "Done",
    "MAD Immigration Canadienne · Portail client sécurisé":
      "MAD Immigration Canadienne · Secure client portal",
    PORTAIL: "PORTAL",
    "Logo MADIC Portail": "MADIC Portal logo",
    "Navigation de mon espace client": "My client-space navigation",
    "Menu personnalisable": "Customizable menu",
    "Avatar du client": "Client avatar",
    "Avatar neutre": "Default avatar",
    "Notifications de messagerie": "Message notifications",
    "Aller au contenu principal": "Skip to main content",
    "Actualités et événements MADIC": "MADIC news and events",
    "Glisser pour déplacer": "Drag to move",
  };
  const reverse = Object.fromEntries(
    Object.entries(translations).map(([fr, en]) => [en, fr]),
  );
  const key = "madic_ui_language";
  let language = "fr";
  let updating = false;
  function setText(node, dict) {
    const raw = node.nodeValue;
    const trimmed = raw.trim();
    if (!trimmed || !Object.prototype.hasOwnProperty.call(dict, trimmed))
      return;
    const translated = dict[trimmed];
    if (translated === trimmed) return;
    const next = raw.replace(trimmed, translated);
    if (next !== raw) node.nodeValue = next;
  }
  function apply(root) {
    if (updating) return;
    updating = true;
    try {
      const dict = language === "en" ? translations : reverse;
      const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          return node.parentElement?.closest(
            "script,style,textarea,option[data-user-value]",
          )
            ? NodeFilter.FILTER_REJECT
            : NodeFilter.FILTER_ACCEPT;
        },
      });
      if (root.nodeType === Node.TEXT_NODE) setText(root, dict);
      while (walk.nextNode()) setText(walk.currentNode, dict);
      const elements =
        root.nodeType === Node.ELEMENT_NODE
          ? [
              root,
              ...root.querySelectorAll(
                "[aria-label],[title],[placeholder],[alt]",
              ),
            ]
          : [];
      for (const el of elements)
        for (const attr of ["aria-label", "title", "placeholder", "alt"]) {
          const v = el.getAttribute(attr);
          if (
            v &&
            Object.prototype.hasOwnProperty.call(dict, v) &&
            dict[v] !== v
          )
            el.setAttribute(attr, dict[v]);
        }
      document.documentElement.lang = language === "en" ? "en-CA" : "fr-CA";
      document.title =
        language === "en"
          ? "My RCIC client space | MADIC"
          : "Mon espace client CRIC | MADIC";
    } finally {
      updating = false;
    }
  }
  function choose(lang) {
    language = lang === "en" ? "en" : "fr";
    try {
      localStorage.setItem(key, language);
    } catch (e) {}
    apply(document.body);
    refreshButtons();
  }
  let fr, en;
  function refreshButtons() {
    if (fr && en) {
      fr.setAttribute("aria-pressed", String(language === "fr"));
      en.setAttribute("aria-pressed", String(language === "en"));
    }
  }
  function start() {
    try {
      language = localStorage.getItem(key) === "en" ? "en" : "fr";
    } catch (e) {}
    const switcher = document.createElement("div");
    switcher.className = "madic-language-switch";
    switcher.setAttribute("aria-label", "Language / Langue");
    fr = document.createElement("button");
    en = document.createElement("button");
    for (const [btn, lang, label] of [
      [fr, "fr", "FR"],
      [en, "en", "EN"],
    ]) {
      btn.type = "button";
      btn.textContent = label;
      btn.addEventListener("click", () => choose(lang));
      switcher.appendChild(btn);
    }
    const header =
      document.getElementById("madicHeroLanguage") ||
      document.querySelector("header .toplinks") ||
      document.querySelector("header");
    if (header) header.appendChild(switcher);
    apply(document.body);
    refreshButtons();
    const observer = new MutationObserver((records) => {
      if (updating) return;
      for (const record of records) {
        if (record.type === "characterData") apply(record.target);
        else
          for (const node of record.addedNodes)
            if (
              node.nodeType === Node.ELEMENT_NODE ||
              node.nodeType === Node.TEXT_NODE
            )
              apply(node);
      }
    });
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
    });
    window.addEventListener("storage", (event) => {
      if (event.key === key) choose(event.newValue);
    });
  }
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();
