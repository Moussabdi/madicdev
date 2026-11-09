(() => {
  "use strict";
  const tbody = document.getElementById("cricPrevalidations");
  const message = document.getElementById("cricPrevalidationMessage");
  if (!tbody) return;
  const setMessage = (text) => {
    message.textContent = text;
  };
  const db = window.getMadicSupabase?.();
  if (!db) {
    setMessage("Configuration Supabase absente.");
    return;
  }
  const cell = (row, value) => {
    const td = row.insertCell();
    td.textContent = String(value ?? "-");
    return td;
  };
  const formatDate = (s) => (s ? new Date(s).toLocaleString("fr-CA") : "-");
  async function refresh() {
    const { data: auth, error: authError } = await db.auth.getUser();
    if (authError || !auth?.user) {
      setMessage("Connexion administrateur requise.");
      return;
    }
    const { data: allowed, error: permissionError } = await db.rpc(
      "madic_is_super_admin",
    );
    if (permissionError || allowed !== true) {
      setMessage("Accès réservé au super administrateur.");
      return;
    }
    const { data, error } = await db.rpc(
      "madic_admin_list_cric_prevalidations",
    );
    if (error) {
      setMessage("Erreur de lecture : " + error.message);
      return;
    }
    tbody.replaceChildren();
    if (!data?.length) {
      const tr = tbody.insertRow();
      cell(tr, "Aucune prévalidation confirmée.").colSpan = 6;
      return;
    }
    for (const item of data) {
      const tr = tbody.insertRow();
      cell(tr, item.full_name);
      cell(tr, item.license_number);
      cell(tr, item.registry_verified ? "Confirmé" : "Non confirmé");
      cell(tr, formatDate(item.created_at));
      const expired =
        item.expires_at && new Date(item.expires_at).getTime() <= Date.now();
      cell(
        tr,
        item.status === "pending" && expired
          ? "pending (expirée)"
          : item.status,
      );
      const actions = tr.insertCell();
      if (item.status !== "pending") {
        actions.textContent = "Traitée";
        continue;
      }
      for (const [label, approve] of [
        ["Approuver", true],
        ["Refuser", false],
      ]) {
        if (approve && expired) continue;
        const button = document.createElement("button");
        button.type = "button";
        button.className = "secondary";
        button.textContent = label;
        button.style.marginRight = "0.5rem";
        button.addEventListener("click", async () => {
          const confirmation = approve
            ? `Vous confirmez avoir vérifié l'identité du titulaire du permis ${item.license_number}, indépendamment du registre CCIC. Cette action n'ouvre aucun accès professionnel. Continuer ?`
            : `Refuser la prévalidation de ${item.full_name} (${item.license_number}) ?`;
          if (!window.confirm(confirmation)) return;
          const note = window.prompt(
            "Motif et preuve de vérification (obligatoire, minimum 5 caractères) :",
          );
          if (note === null) return;
          if (note.trim().length < 5) {
            setMessage("Veuillez documenter votre décision.");
            return;
          }
          button.disabled = true;
          const { error } = await db.rpc(
            "madic_admin_review_cric_prevalidation",
            {
              p_id: item.id,
              p_approve: approve,
              p_note: note.trim(),
            },
          );
          if (error) {
            setMessage("Décision non enregistrée : " + error.message);
            button.disabled = false;
            return;
          }
          setMessage(
            "Décision enregistrée. Aucun compte professionnel n’a été créé.",
          );
          await refresh();
        });
        actions.append(button);
      }
    }
  }
  refresh().catch((e) => setMessage("Erreur : " + e.message));
})();
