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
