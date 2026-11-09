/* SOURCE: assets/madic-formulaire-supabase.js */
/* MADIC - Formulaire client. Enregistrement direct dans Supabase avec RLS. */
(async () => {
  "use strict";
  const form = document.getElementById("madic-intake-form");
  const status = document.getElementById("madic-form-status");
  if (!form || !status) return;
  const message = (s, error = false) => {
    status.textContent = s;
    status.style.color = error ? "#ffa3a3" : "#a5b7cc";
    status.classList.toggle("madic-status-hidden", !error);
  };
  if (
    !window.MADIC_CONFIG?.url ||
    !window.MADIC_CONFIG?.anonKey ||
    !window.supabase
  ) {
    message("Configuration Supabase manquante.", true);
    form.querySelector('[type="submit"]').disabled = true;
    return;
  }
  const db =
    typeof window.getMadicSupabase === "function"
      ? window.getMadicSupabase()
      : window.supabase.createClient(
          window.MADIC_CONFIG.url,
          window.MADIC_CONFIG.anonKey,
        );
  const {
    data: { user },
    error: authError,
  } = await db.auth.getUser();
  if (authError || !user) {
    location.replace("connexion-client-cric.html");
    return;
  }
  // Champs communs avec le profil du portail CRIC (mêmes colonnes que cric-client-dashboard.js).
  const profileMap = {
    prenom: "first_name",
    nom: "last_name",
    telephone: "phone",
    date_naissance: "date_of_birth",
    no_appart: "address_apartment",
    no_rue: "address_number",
    ville: "address_city",
    code_postale: "address_postal_code",
    province: "address_region",
    pays: "country",
  };
  const normalize = (v) =>
    String(v ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[_\s-]+/g, "")
      .toLowerCase();
  const setField = (name, value, overwrite = false) => {
    const e = [...form.elements].find((el) => el.name === name);
    if (!e || value == null || value === "" || (!overwrite && e.value)) return;
    if (e.tagName === "SELECT") {
      const option = [...e.options].find(
        (o) =>
          normalize(o.value) === normalize(value) ||
          normalize(o.textContent) === normalize(value),
      );
      if (option) e.value = option.value;
    } else e.value = value;
  };
  let profile = null;
  try {
    const result = await db
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();
    if (result.error) throw result.error;
    profile = result.data;
  } catch (e) {
    message("Profil indisponible : " + e.message, true);
  }
  function fillFromProfile(overwrite = false) {
    if (!profile) return;
    for (const [field, column] of Object.entries(profileMap))
      setField(field, profile[column], overwrite);
    if (profile.gender) {
      const gender = normalize(profile.gender);
      setField(
        "sex",
        /^(male|masculin|homme|m)$/.test(gender)
          ? "salle"
          : /^(female|feminin|femme|f)$/.test(gender)
            ? "terrasse"
            : "",
        overwrite,
      );
    }
    setField("courriel", profile.email || user.email, overwrite);
  }
  async function updateProfileFromForm() {
    if (!profile) return;
    const changes = {};
    for (const [field, column] of Object.entries(profileMap)) {
      if (!(column in profile)) continue;
      const e = [...form.elements].find((el) => el.name === field);
      if (e?.value?.trim()) changes[column] = e.value.trim();
    }
    if ("gender" in profile) {
      const gender = form.elements.namedItem("sex")?.value;
      if (gender === "salle") changes.gender = "male";
      if (gender === "terrasse") changes.gender = "female";
    }
    // Ne pas modifier l'adresse de connexion du compte Auth depuis ce formulaire.
    if (!Object.keys(changes).length) return;
    const { error } = await db
      .from("profiles")
      .update(changes)
      .eq("id", user.id);
    if (error)
      throw new Error(
        "Formulaire enregistré, mais synchronisation du profil impossible : " +
          error.message,
      );
    Object.assign(profile, changes);
  }
  const fields = [...form.elements].filter(
    (e) => e.name && !["submit", "button", "reset", "file"].includes(e.type),
  );
  const capture = () => {
    const values = {};
    for (const e of fields) {
      if (e.type === "radio") {
        if (e.checked) values[e.name] = e.value;
      } else if (e.type === "checkbox") {
        if (e.name.endsWith("[]")) {
          if (!values[e.name]) values[e.name] = [];
          if (e.checked) values[e.name].push(e.value);
        } else values[e.name] = e.checked;
      } else if (e.tagName === "SELECT" && e.multiple)
        values[e.name] = [...e.selectedOptions].map((o) => o.value);
      else values[e.name] = e.value;
    }
    values._madic_current_step = Number(form.dataset.madicCurrentStep || 0);
    return values;
  };
  const restore = (values) => {
    for (const e of fields) {
      if (!(e.name in values)) continue;
      const v = values[e.name];
      if (e.type === "radio") e.checked = e.value === v;
      else if (e.type === "checkbox")
        e.checked = Array.isArray(v) ? v.includes(e.value) : Boolean(v);
      else if (e.tagName === "SELECT" && e.multiple)
        [...e.options].forEach((o) => {
          o.selected = Array.isArray(v) && v.includes(o.value);
        });
      else e.value = v ?? "";
      e.dispatchEvent(new Event("change", { bubbles: true }));
    }
  };
  let saveInProgress = Promise.resolve();
  let autosaveTimer;
  let loadingComplete = false;
  let lastSavedSnapshot = "";
  const queueSave = (state) => {
    const task = saveInProgress.catch(() => {}).then(() => save(state));
    saveInProgress = task;
    return task;
  };
  function scheduleAutosave() {
    if (!loadingComplete) return;
    clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(async () => {
      const snapshot = JSON.stringify(capture());
      if (snapshot === lastSavedSnapshot) return;
      try {
        await queueSave("draft");
        lastSavedSnapshot = snapshot;
      } catch (err) {
        message("Enregistrement automatique impossible : " + err.message, true);
      }
    }, 900);
  }
  form.addEventListener("input", scheduleAutosave);
  form.addEventListener("change", scheduleAutosave);
  form.addEventListener("madic:step-change", scheduleAutosave);
  async function save(state) {
    const { error } = await db.from("madic_client_intake").upsert(
      {
        user_id: user.id,
        answers: capture(),
        status: state,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
    if (error) throw error;
    await updateProfileFromForm();
    message(
      state === "submitted"
        ? "Formulaire soumis et enregistré dans votre espace sécurisé."
        : "Brouillon enregistré dans Supabase.",
    );
  }
  let restoredStep = 0;
  try {
    const { data, error } = await db
      .from("madic_client_intake")
      .select("answers,status")
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) throw error;
    if (data?.answers) {
      restore(data.answers);
      restoredStep = Number(data.answers._madic_current_step) || 0;
      message(
        data.status === "submitted"
          ? "Vos réponses précédentes ont été chargées (formulaire déjà soumis)."
          : "Votre brouillon précédent a été chargé.",
      );
    }
    // Le profil actuel fait foi pour les données communes : synchronisation dans les deux sens.
    fillFromProfile(true);
    form.elements
      .namedItem("date_naissance")
      ?.dispatchEvent(new Event("change", { bubbles: true }));
  } catch (e) {
    message("Impossible de charger les réponses : " + e.message, true);
  }
  // Restaurer l'etape apres le chargement du brouillon et du profil.
  // L'evenement est emis apres l'initialisation synchrone du script de navigation.
  if (typeof restoredStep !== "undefined") {
    form.dispatchEvent(
      new CustomEvent("madic:restore-step", { detail: { step: restoredStep } }),
    );
  }
  loadingComplete = true;
  lastSavedSnapshot = JSON.stringify(capture());
  // La confirmation n'est jamais affichée avant le succès de la sauvegarde distante.
  const confirmation = document.getElementById("madic-submit-modal");
  const showConfirmation = () => {
    if (!confirmation) return;
    confirmation.hidden = false;
    document.body.style.overflow = "hidden";
    document.getElementById("madic-next-step")?.focus();
  };
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!form.reportValidity()) return;
    const submit = form.querySelector('[type="submit"]');
    submit.disabled = true;
    try {
      clearTimeout(autosaveTimer);
      await queueSave("submitted");
      lastSavedSnapshot = JSON.stringify(capture());
      showConfirmation();
    } catch (err) {
      message("Envoi impossible : " + err.message, true);
    } finally {
      submit.disabled = false;
    }
  });
})();

;
/* SOURCE: assets/madic-navigation-ciblee.js */
/* Navigation uniquement : ne modifie ni les champs ni la logique Supabase */
(() => {
  "use strict";
  const form = document.getElementById("madic-intake-form");
  if (!form) return;
  const steps = [...form.querySelectorAll("fieldset")];
  if (!steps.length) return;
  const prev = document.getElementById("madic-step-prev"),
    next = document.getElementById("madic-step-next");
  const label = document.getElementById("madic-step-label"),
    count = document.getElementById("madic-step-count"),
    fill = document.getElementById("madic-progress-fill");
  const last = steps[steps.length - 1];
  /* Le consentement, la ville et le bouton Soumettre restent visibles à la dernière étape. */
  const extras = [
    ...form.querySelectorAll(".madic-signature-place,.txt-right"),
  ];
  let current = 0;
  /* L'etape courante est partagee avec la sauvegarde Supabase. */
  form.addEventListener("madic:restore-step", (e) =>
    show(Number(e.detail?.step) || 0),
  );
  function show(i) {
    current = Math.max(0, Math.min(i, steps.length - 1));
    steps.forEach((s, k) => {
      s.classList.toggle("madic-step-inactive", k !== current);
    });
    extras.forEach((el) =>
      el.classList.toggle("madic-step-inactive", current !== steps.length - 1),
    );
    prev.hidden = current === 0;
    next.hidden = current === steps.length - 1;
    label.textContent =
      steps[current]
        .querySelector("legend")
        ?.textContent.trim()
        .replace(/\s+/g, " ") || `Section ${current + 1}`;
    count.textContent = `${current + 1} / ${steps.length}`;
    fill.style.width = `${(100 * (current + 1)) / steps.length}%`;
    form.dataset.madicCurrentStep = String(current);
    form.dispatchEvent(
      new CustomEvent("madic:step-change", { detail: { step: current } }),
    );
    document
      .querySelector(".madic-steps")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function validate(i) {
    for (const field of steps[i].querySelectorAll("input,select,textarea")) {
      if (field.disabled || field.type === "hidden") continue;
      if (!field.checkValidity()) {
        field.reportValidity();
        field.focus();
        return false;
      }
    }
    return true;
  }
  next?.addEventListener("click", () => {
    if (validate(current)) show(current + 1);
  });
  prev?.addEventListener("click", () => show(current - 1));
  /* Pour les champs invalides d'autres étapes, les rendre visibles avant soumission. */
  form.addEventListener(
    "click",
    (e) => {
      if (!e.target.closest('[type="submit"]')) return;
      for (let i = 0; i < steps.length; i++) {
        if (!validate(i)) {
          e.preventDefault();
          e.stopImmediatePropagation();
          show(i);
          const invalid = steps[i].querySelector(":invalid");
          invalid?.focus();
          return;
        }
      }
    },
    true,
  );
  show(0);
})();

;
/* SOURCE: inline HTML */

      (() => {
        const form = document.getElementById("madic-intake-form");
        if (!form) return;
        const groups = [
          {
            question: "question_lang_fr",
            fields: [
              "expression_orale",
              "comprehension_orale",
              "comprehension_ecrite",
              "expression_ecrite",
            ],
          },
          {
            question: "question_lang_en",
            fields: ["speaking", "listening", "reading", "writing"],
          },
        ];
        function refresh(group) {
          const question = document.getElementById(group.question);
          if (!question) return;
          const enabled = Boolean(question.value && question.value !== "aucun");
          group.fields.forEach((id) => {
            const field = document.getElementById(id);
            if (!field) return;
            field.disabled = !enabled;
            field.required = enabled;
            field.setAttribute("aria-disabled", String(!enabled));
          });
        }
        groups.forEach((group) => {
          const question = document.getElementById(group.question);
          if (!question) return;
          question.addEventListener("change", () => refresh(group));
          refresh(group);
        });
        // Le chargement du brouillon Supabase restaure les questions par des evenements change.
      })();
    
;
/* SOURCE: inline HTML */

      (() => {
        const dob = document.getElementById("date_naissance");
        const age = document.getElementById("madic_age_calcule");
        const count = document.getElementById("nbr_enfant");
        const children = [1, 2, 3, 4].map((n) =>
          document.getElementById("age_enfant_" + n),
        );
        if (!dob || !age || !count || children.some((el) => !el)) return;

        function updateAge() {
          age.value = "";
          if (!/^\d{4}-\d{2}-\d{2}$/.test(dob.value)) return;
          const [year, month, day] = dob.value.split("-").map(Number);
          const birth = new Date(year, month - 1, day);
          if (
            birth.getFullYear() !== year ||
            birth.getMonth() !== month - 1 ||
            birth.getDate() !== day
          )
            return;
          const today = new Date();
          if (birth > today) return;
          let years = today.getFullYear() - year;
          if (
            today.getMonth() + 1 < month ||
            (today.getMonth() + 1 === month && today.getDate() < day)
          )
            years--;
          age.value = String(years);
        }

        function updateChildren() {
          const raw = count.value.trim();
          const number = raw === "" ? 0 : Number(raw);
          const active = Number.isInteger(number)
            ? Math.max(0, Math.min(4, number))
            : 0;
          children.forEach((el, index) => {
            const enabled = index < active;
            if (!enabled && !el.disabled) el.value = "";
            el.disabled = !enabled;
            el.required = enabled;
          });
        }

        dob.addEventListener("input", updateAge);
        dob.addEventListener("change", updateAge);
        count.addEventListener("input", updateChildren);
        count.addEventListener("change", updateChildren);
        updateAge();
        updateChildren();
      })();
    
;
/* SOURCE: inline HTML */

      (() => {
        const temporary = document.getElementById("residence_temporaire");
        const permanent = document.getElementById("residence_permanente");
        if (!temporary || !permanent) return;

        const isSelected = (element) =>
          element.value !== "" && element.value !== "aucun";
        const setAvailability = (element, disabled) => {
          element.disabled = disabled;
          element.required = !disabled;
          element.setAttribute("aria-disabled", String(disabled));
        };
        const update = (changed) => {
          const tempChosen = isSelected(temporary);
          const permChosen = isSelected(permanent);
          // Si un brouillon contient deux choix, le dernier champ modifié prévaut.
          if (tempChosen && permChosen) {
            if (changed === permanent) temporary.value = "";
            else permanent.value = "";
          }
          setAvailability(permanent, isSelected(temporary));
          setAvailability(temporary, isSelected(permanent));
        };
        temporary.addEventListener("change", () => update(temporary));
        permanent.addEventListener("change", () => update(permanent));
        update(temporary);
      })();
    
;
/* SOURCE: inline HTML */

      (() => {
        const dialog = document.getElementById("madic-residence-help-dialog");
        const panel = dialog?.querySelector(".madic-residence-help-panel");
        const closeButton = document.getElementById(
          "madic-residence-help-close",
        );
        if (!dialog || !panel || !closeButton) return;
        let opener = null;
        const translations = {
          fr: {
            title: "Information importante – Choix du type de résidence",
            text: "Vous devez choisir un seul type de résidence par dossier : résidence temporaire ou résidence permanente. Si vous souhaitez entreprendre des démarches pour les deux types de résidence, vous devez ouvrir un dossier distinct pour chaque demande auprès de votre consultant en immigration.",
            close: "Fermer",
            label: "Information sur le choix de résidence",
          },
          en: {
            title: "Important information – Choosing a residence type",
            text: "You must select only one type of residence per file: temporary residence or permanent residence. If you wish to apply for both types of residence, you must open a separate file for each application with your immigration consultant.",
            close: "Close",
            label: "Information about residence types",
          },
        };
        const language = () =>
          document.documentElement.lang.toLowerCase().startsWith("en")
            ? "en"
            : "fr";
        const updateLanguage = () => {
          const t = translations[language()];
          document.getElementById("madic-residence-help-title").textContent =
            t.title;
          document.getElementById("madic-residence-help-text").textContent =
            t.text;
          closeButton.textContent = t.close;
          document
            .querySelectorAll(".madic-residence-help")
            .forEach((b) => b.setAttribute("aria-label", t.label));
        };
        const close = () => {
          dialog.hidden = true;
          opener?.focus();
        };
        document.querySelectorAll(".madic-residence-help").forEach((button) =>
          button.addEventListener("click", () => {
            opener = button;
            updateLanguage();
            dialog.hidden = false;
            closeButton.focus();
          }),
        );
        closeButton.addEventListener("click", close);
        dialog.addEventListener("click", (e) => {
          if (e.target === dialog) close();
        });
        document.addEventListener("keydown", (e) => {
          if (dialog.hidden) return;
          if (e.key === "Escape") {
            e.preventDefault();
            close();
          }
          if (e.key === "Tab") {
            e.preventDefault();
            closeButton.focus();
          }
        });
        new MutationObserver(updateLanguage).observe(document.documentElement, {
          attributes: true,
          attributeFilter: ["lang"],
        });
        updateLanguage();
      })();
    
;
/* SOURCE: assets/madic-client-sidebar.js */
/* Préférences locales de navigation : aucun changement des données Supabase. */
(function () {
  const sidebar = document.querySelector(".madic-side-nav");
  const nav = sidebar?.querySelector(".madic-side-links");
  const toggle = document.getElementById("madicCustomizeNav");
  const reset = document.getElementById("madicResetNav");
  const help = document.getElementById("madicNavHelp");
  if (!nav || !toggle || !reset) return;
  const storageKey = "madic-client-nav-order-v2";
  const entries = () => Array.from(nav.querySelectorAll(".madic-nav-entry"));
  const save = () => {
    try {
      localStorage.setItem(
        storageKey,
        JSON.stringify(entries().map((el) => el.dataset.navKey)),
      );
    } catch (_) {}
  };
  try {
    const order = JSON.parse(localStorage.getItem(storageKey) || "null");
    if (Array.isArray(order)) {
      const byKey = new Map(entries().map((el) => [el.dataset.navKey, el]));
      order.forEach((key) => {
        if (byKey.has(key)) nav.appendChild(byKey.get(key));
      });
    }
  } catch (_) {}
  toggle.addEventListener("click", () => {
    const editing = sidebar.classList.toggle("madic-editing");
    toggle.setAttribute("aria-pressed", String(editing));
    toggle.textContent = editing ? "Terminer" : "Personnaliser le menu";
    reset.hidden = !editing;
    help.hidden = !editing;
  });
  reset.addEventListener("click", () => {
    entries()
      .sort(
        (a, b) =>
          [
            "nav-0",
            "nav-7",
            "nav-1",
            "nav-2",
            "nav-3",
            "nav-4",
            "nav-5",
            "nav-6",
          ].indexOf(a.dataset.navKey) -
          [
            "nav-0",
            "nav-7",
            "nav-1",
            "nav-2",
            "nav-3",
            "nav-4",
            "nav-5",
            "nav-6",
          ].indexOf(b.dataset.navKey),
      )
      .forEach((el) => nav.appendChild(el));
    save();
  });
  nav.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-move]");
    if (!button) return;
    const item = button.closest(".madic-nav-entry");
    if (button.dataset.move === "up" && item.previousElementSibling)
      nav.insertBefore(item, item.previousElementSibling);
    if (button.dataset.move === "down" && item.nextElementSibling)
      nav.insertBefore(item.nextElementSibling, item);
    save();
    button.focus();
  });
  let dragged = null;
  nav.addEventListener("dragstart", (event) => {
    const handle = event.target.closest(".madic-drag-handle");
    if (!sidebar.classList.contains("madic-editing") || !handle) {
      event.preventDefault();
      return;
    }
    dragged = handle.closest(".madic-nav-entry");
    dragged.classList.add("madic-dragging");
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", dragged.dataset.navKey);
  });
  nav.addEventListener("dragover", (event) => {
    const target = event.target.closest(".madic-nav-entry");
    if (!dragged || !target || target === dragged) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    entries().forEach((el) => el.classList.remove("madic-drag-over"));
    target.classList.add("madic-drag-over");
  });
  nav.addEventListener("drop", (event) => {
    const target = event.target.closest(".madic-nav-entry");
    if (!dragged || !target || target === dragged) return;
    event.preventDefault();
    const rect = target.getBoundingClientRect();
    const after = window.matchMedia("(max-width: 800px)").matches
      ? event.clientX > rect.left + rect.width / 2
      : event.clientY > rect.top + rect.height / 2;
    nav.insertBefore(dragged, after ? target.nextSibling : target);
    save();
  });
  nav.addEventListener("dragend", () => {
    entries().forEach((el) =>
      el.classList.remove("madic-drag-over", "madic-dragging"),
    );
    dragged = null;
  });
})();

;
/* SOURCE: inline HTML */

      /* Explicit click-only interface translation. No observer, no form value changes. */
      (function () {
        "use strict";
        const dict = {
          Déconnexion: "Sign out",
          Connexion: "Sign in",
          "Mon espace": "My space",
          "MON ESPACE": "MY SPACE",
          "Personnaliser le menu": "Customize menu",
          "Vue d’ensemble": "Overview",
          Actualités: "News",
          "Mon profil": "My profile",
          "Mes contrats": "My contracts",
          Formulaire: "Form",
          Messagerie: "Messaging",
          "Rendez-vous": "Appointments",
          "Mes dossiers": "My cases",
          Documents: "Documents",
          Factures: "Invoices",
          "Espace client sécurisé": "Secure client space",
          "Votre projet, à votre rythme.": "Your project, at your pace.",
          "Consultant hors ligne": "Consultant offline",
          "Consultant en ligne": "Consultant online",
          "Échanges confidentiels avec votre consultant.":
            "Confidential exchanges with your consultant.",
          "Messagerie du client chargée.": "Client messaging loaded.",
          "Cabinet CRIC": "RCIC firm",
          Conversations: "Conversations",
          Actualiser: "Refresh",
          "Choisissez une conversation": "Choose a conversation",
          "Les conversations sont ouvertes par votre consultant.":
            "Conversations are opened by your consultant.",
          "Votre réponse": "Your reply",
          "Envoyer ma réponse": "Send my reply",
          "Écrivez votre message…": "Write your message…",
          "Mes rendez-vous et consultations":
            "My appointments and consultations",
          "Notifications de rendez-vous": "Appointment notifications",
          "Marquer comme lue": "Mark as read",
          "Cabinet de consultation": "Consulting firm",
          "Mon consultant": "My consultant",
          "Créneaux disponibles": "Available time slots",
          "Sélectionnez une plage horaire qui vous convient.":
            "Select a suitable time slot.",
          "Semaine suivante →": "Next week →",
          "← Semaine précédente": "← Previous week",
          "Durée du rendez-vous :": "Appointment duration:",
          "Mes réservations": "My bookings",
          "Retrouvez le statut et les détails de vos rendez-vous.":
            "Find the status and details of your appointments.",
          Début: "Start",
          Fin: "End",
          Type: "Type",
          Action: "Action",
          Statut: "Status",
          "Lieu / lien de consultation": "Consultation location / link",
          Annuler: "Cancel",
          "Voir le lien": "View link",
          Confirmé: "Confirmed",
          "En attente de confirmation": "Pending confirmation",
          "Aucun créneau disponible pour le moment.":
            "No time slots available at this time.",
          "Aucun créneau": "No time slots",
          "ÉVALUATION PRÉLIMINAIRE": "PRELIMINARY ASSESSMENT",
          "Parlez-nous de votre projet d’immigration":
            "Tell us about your immigration plans",
          "Déclaration importante": "Important declaration",
          "Informations importante": "Important information",
          "Informations importantes": "Important information",
          Précédent: "Previous",
          Suivant: "Next",
          Soumettre: "Submit",
          "Pays :": "Country:",
          "Connaissance des langues": "Language proficiency",
          "Niveau de Français :": "French proficiency:",
          "Niveau d’anglais :": "English proficiency:",
          "Choix votre niveau!": "Choose your level!",
          "Choix de votre pays!": "Choose your country!",
          "Choix votre test de compétence!": "Choose your language test!",
          "Expression orale :": "Speaking:",
          "Expression écrite :": "Writing:",
          "Compréhension orale :": "Listening:",
          "Compréhension écrite :": "Reading:",
        };
        const reverse = Object.fromEntries(
          Object.entries(dict).map(([a, b]) => [b, a]),
        );
        const key = "madic_ui_language";
        let lang = "fr";
        try {
          lang = localStorage.getItem(key) === "en" ? "en" : "fr";
        } catch (_) {}
        const slot =
          document.getElementById("madicHeroLanguage") ||
          document.querySelector("header .toplinks");
        if (!slot) return;
        const wrap = document.createElement("div");
        wrap.className = "madic-three-lang";
        wrap.setAttribute("aria-label", "Langue / Language");
        const buttons = {};
        for (const code of ["fr", "en"]) {
          const b = document.createElement("button");
          b.type = "button";
          b.textContent = code.toUpperCase();
          b.addEventListener("click", () => {
            lang = code;
            try {
              localStorage.setItem(key, code);
            } catch (_) {}
            apply();
          });
          wrap.appendChild(b);
          buttons[code] = b;
        }
        slot.appendChild(wrap);
        function translate() {
          const map = lang === "en" ? dict : reverse;
          const walker = document.createTreeWalker(
            document.body,
            NodeFilter.SHOW_TEXT,
            {
              acceptNode(n) {
                return n.parentElement &&
                  n.parentElement.closest(
                    'script,style,textarea,option,[contenteditable="true"]',
                  )
                  ? NodeFilter.FILTER_REJECT
                  : NodeFilter.FILTER_ACCEPT;
              },
            },
          );
          let node;
          while ((node = walker.nextNode())) {
            const raw = node.nodeValue,
              word = raw.trim();
            if (Object.prototype.hasOwnProperty.call(map, word))
              node.nodeValue = raw.replace(word, map[word]);
          }
          for (const el of document.querySelectorAll(
            "[placeholder],[aria-label],[title]",
          )) {
            for (const a of ["placeholder", "aria-label", "title"]) {
              const v = el.getAttribute(a);
              if (v && Object.prototype.hasOwnProperty.call(map, v))
                el.setAttribute(a, map[v]);
            }
          }
        }
        function apply() {
          document.documentElement.lang = lang === "en" ? "en-CA" : "fr-CA";
          translate();
          for (const code of ["fr", "en"])
            buttons[code].setAttribute("aria-pressed", String(code === lang));
        }
        apply();
      })();
    
;
/* SOURCE: inline HTML */

      /* Navigation and logout only; no observers, no changes to page applications. */
      (function () {
        "use strict";
        var nav = document.querySelector(".madic-side-links");
        var desired = [
          "nav-0",
          "nav-news",
          "nav-7",
          "nav-1",
          "nav-contracts",
          "nav-3",
          "nav-4",
          "nav-5",
          "nav-2",
          "nav-6",
        ];
        if (nav) {
          var nodes = Array.from(
            nav.querySelectorAll(":scope > .madic-nav-entry"),
          );
          var map = new Map(
            nodes.map(function (node) {
              return [node.getAttribute("data-nav-key"), node];
            }),
          );
          desired.forEach(function (key) {
            if (map.has(key)) nav.appendChild(map.get(key));
          });
          try {
            localStorage.setItem(
              "madic-client-nav-order-v2",
              JSON.stringify(desired),
            );
          } catch (_) {}
        }
        var signout = document.getElementById("madicHeaderSignout");
        if (signout)
          signout.addEventListener("click", async function (event) {
            event.preventDefault();
            if (typeof window.getMadicSupabase !== "function") return;
            try {
              await window.getMadicSupabase().auth.signOut();
              window.location.replace("connexion-client-cric.html");
            } catch (error) {
              console.error("MADIC sign out:", error);
            }
          });
      })();
    
