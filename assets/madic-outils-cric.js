/* MADIC : interfaces de preparation professionnelle. Aucune ecriture en base. */
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
