(async () => {
  "use strict";
  const $ = (id) => document.getElementById(id),
    say = (t) => {
      $("deadlineMessage").textContent = t;
    };
  const cfg = window.MADIC_CONFIG;
  if (
    !cfg?.url ||
    !cfg?.anonKey ||
    !window.supabase ||
    typeof window.getMadicSupabase !== "function"
  )
    return say("Configuration Supabase indisponible.");
  const db = window.getMadicSupabase();
  let space,
    dossiers = [],
    deadlines = [];
  const today = () => {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Toronto",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());
    const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
    return `${p.year}-${p.month}-${p.day}`;
  };
  const dayDiff = (date) =>
    Math.round(
      (Date.parse(date + "T12:00:00Z") - Date.parse(today() + "T12:00:00Z")) /
        86400000,
    );
  function render() {
    const tbody = $("deadlineRows");
    tbody.replaceChildren();
    let late = 0,
      soon = 0;
    for (const d of deadlines) {
      const diff = dayDiff(d.due_date),
        state = d.completed
          ? "Terminée"
          : diff < 0
            ? "Dépassée"
            : diff <= 7
              ? diff === 0 ? "Aujourd’hui" : diff === 1 ? "Demain" : "Dans " + diff + " jours"
              : "À venir";
      if (!d.completed && diff < 0) late++;
      else if (!d.completed && diff <= 7) soon++;
      const tr = document.createElement("tr");
      for (const value of [
        dossiers.find((x) => x.id === d.dossier_id)?.reference || "Dossier",
        d.title,
        d.due_date,
      ]) {
        const td = document.createElement("td");
        td.textContent = value;
        tr.append(td);
      }
      const status = document.createElement("td"),
        span = document.createElement("span");
      span.className =
        "deadline-tag " +
        (d.completed ? "done" : diff < 0 ? "late" : diff <= 7 ? "soon" : "");
      span.textContent = state;
      status.append(span);
      tr.append(status);
      const action = document.createElement("td"),
        btn = document.createElement("button");
      btn.type = "button";
      btn.className = "secondary";
      btn.textContent = d.completed ? "Réouvrir" : "Marquer terminée";
      btn.addEventListener("click", async () => {
        btn.disabled = true;
        try { await setDone(d, !d.completed); }
        finally { btn.disabled = false; }
      });
      action.append(btn);
      tr.append(action);
      tbody.append(tr);
    }
    if (!deadlines.length) {
      const tr = document.createElement("tr"),
        td = document.createElement("td");
      td.colSpan = 5;
      td.textContent = "Aucune échéance enregistrée.";
      tr.append(td);
      tbody.append(tr);
    }
    $("deadlineSummary").textContent =
      `${deadlines.length} échéance${deadlines.length > 1 ? "s" : ""} · ${late} dépassée${late > 1 ? "s" : ""} · ${soon} à traiter dans les 7 prochains jours.`;
  }
  async function load() {
    const result = await db
      .from("madic_cric_deadlines")
      .select("id,space_id,dossier_id,title,due_date,completed")
      .eq("space_id", space.id)
      .order("due_date", { ascending: true });
    if (result.error) throw result.error;
    deadlines = result.data || [];
    render();
  }
  async function setDone(d, completed) {
    try {
      const { data, error } = await db
        .from("madic_cric_deadlines")
        .update({ completed })
        .eq("id", d.id)
        .eq("space_id", space.id)
        .select("id,completed");
      if (error) throw error;
      if (data?.length !== 1)
        throw Error("Modification refusée par les autorisations.");
      await load();
      say("Échéance mise à jour.");
    } catch (e) {
      say("Erreur : " + e.message);
    }
  }
  $("deadlineRefresh").addEventListener("click", () =>
    load()
      .then(() => say("Échéances actualisées."))
      .catch((e) => say(e.message)),
  );
  $("deadlineForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const dossier_id = $("deadlineDossier").value,
      title = $("deadlineTitle").value.trim(),
      due_date = $("deadlineDate").value;
    if (
      !dossiers.some((x) => x.id === dossier_id) ||
      !title ||
      !/^\d{4}-\d{2}-\d{2}$/.test(due_date)
    )
      return say("Vérifiez le dossier, la description et la date.");
    const submitButton = e.submitter || $("deadlineForm").querySelector("button[type=submit]");
    if (submitButton.disabled) return;
    submitButton.disabled = true;
    try {
      const { data, error } = await db
        .from("madic_cric_deadlines")
        .insert({ space_id: space.id, dossier_id, title, due_date })
        .select("id");
      if (error) throw error;
      if (!data?.length) throw Error("Enregistrement non confirmé.");
      e.target.reset();
      await load();
      say("Échéance enregistrée.");
    } catch (err) {
      say("Création impossible : " + err.message);
    } finally {
      submitButton.disabled = !dossiers.length;
    }
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
    if (app?.status !== "approved") throw Error("Compte CRIC non approuvé.");
    const { data: spaces, error: spaceError } = await db
      .from("madic_cric_spaces")
      .select("id,name,access_status")
      .eq("owner_user_id", uid)
      .limit(1);
    if (spaceError) throw spaceError;
    space = spaces?.[0];
    if (!space || space.access_status !== "active")
      throw Error("Espace CRIC absent ou suspendu.");
    const { data: allowed, error: permissionError } = await db.rpc(
      "madic_can_manage_cric_space",
      { p_space_id: space.id },
    );
    if (permissionError || allowed !== true)
      throw Error("Accès au cabinet refusé.");
    $("deadlineSpace").textContent = "Cabinet : " + space.name;
    const { data: ds, error: de } = await db
      .from("dossiers")
      .select("id,reference")
      .eq("space_id", space.id)
      .order("created_at", { ascending: false });
    if (de) throw de;
    dossiers = ds || [];
    const sel = $("deadlineDossier");
    for (const d of dossiers) {
      const option = document.createElement("option");
      option.value = d.id;
      option.textContent = d.reference || d.id;
      sel.append(option);
    }
    if (!dossiers.length) {
      $("deadlineForm").querySelector("button").disabled = true;
      say("Créez d’abord un dossier dans votre espace CRIC.");
    }
    $("deadlineWorkspace").hidden = false;
    await load();
  } catch (e) {
    say("Accès impossible : " + (e.message || String(e)));
  }
})();
