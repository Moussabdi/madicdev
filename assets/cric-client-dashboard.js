/* MADIC - tableau de bord client CRIC. RLS Supabase obligatoire. */
(async () => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const status = (message, bad = false) => {
    const n = $("message");
    if (n) {
      n.textContent = message;
      n.className = bad ? "notice danger" : "notice ok";
    }
  };
  if (
    !window.MADIC_CONFIG?.url ||
    !window.MADIC_CONFIG?.anonKey ||
    !window.supabase ||
    typeof window.getMadicSupabase !== "function"
  )
    return status("Configuration Supabase manquante.", true);
  const db = window.getMadicSupabase();
  const date = (value) =>
    value ? new Date(value).toLocaleDateString("fr-CA") : "-";
  const td = (row, value) => {
    const cell = row.insertCell();
    cell.textContent = value ?? "-";
    return cell;
  };
  let user,
    spaces = [],
    dossiers = [];
  $("logout").addEventListener("click", async () => {
    await db.auth.signOut();
    location.replace("connexion-client-cric.html");
  });
  const fields = [
    "first_name",
    "last_name",
    "phone",
    "gender",
    "date_of_birth",
    "address_number",
    "address_street",
    "address_apartment",
    "address_city",
    "address_region",
    "address_postal_code",
    "country",
  ];
  try {
    const { data: auth, error: authError } = await db.auth.getUser();
    if (authError || !auth?.user) {
      location.replace("connexion-client-cric.html");
      return;
    }
    user = auth.user;
    const { data: linked, error: linkError } = await db.rpc(
      "madic_my_cric_client_spaces",
    );
    if (linkError) throw linkError;
    spaces = linked || [];
    if (spaces.length && $("madicImmigrationFormCard"))
      $("madicImmigrationFormCard").hidden = false;
    if (!spaces.length) {
      status(
        "Aucun cabinet CRIC associé à votre compte. Contactez votre consultant.",
        true,
      );
      return;
    }
    const { data: profile, error: profileError } = await db
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();
    if (profileError) throw profileError;
    // Avatars locaux selon le genre declare dans le profil. Aucune donnee envoyee a Gravatar.
    const updateClientAvatar = (gender) => {
      const avatar = $("madicClientAvatarImage");
      const profileAvatar = $("madicProfileAvatarImage");
      const normalized = String(gender || "")
        .trim()
        .toLocaleLowerCase("fr");
      const type =
        normalized === "homme"
          ? "homme"
          : normalized === "femme"
            ? "femme"
            : "neutre";
      const fallback = "img/madic-avatar-" + type + ".svg";
      for (const image of [avatar, profileAvatar]) {
        if (!image) continue;
        image.src = fallback;
        image.alt = type === "neutre" ? "Avatar neutre" : "Avatar " + type;
      }
    };
    // Photos privées : bucket dédié, chemin unique par utilisateur, URL signée temporaire.
    const avatarBucket = "madic-profile-avatars";
    let photoPath = String(user.user_metadata?.madic_avatar_path || "");
    let photoPreviewUrl = null;
    const photoNotice = (message, bad = false) => {
      const el = $("madicProfilePhotoStatus");
      if (el) { el.textContent = message; el.style.color = bad ? "#ffb4b4" : "#b3f2e4"; }
    };
    const setBothAvatars = (src, alt) => {
      for (const id of ["madicClientAvatarImage", "madicProfileAvatarImage"]) {
        const image = $(id);
        if (image) { image.src = src; image.alt = alt; }
      }
    };
    const refreshPhoto = async () => {
      updateClientAvatar(profile.gender);
      if (!photoPath) return;
      const { data, error } = await db.storage.from(avatarBucket).createSignedUrl(photoPath, 3600);
      if (error || !data?.signedUrl) { photoNotice("Photo non accessible : " + (error?.message || "lien indisponible"), true); return; }
      setBothAvatars(data.signedUrl, "Photo personnelle du client");
    };
    updateClientAvatar(profile.gender);
    await refreshPhoto();
    $("madicProfilePhotoFile")?.addEventListener("change", (event) => {
      if (photoPreviewUrl) URL.revokeObjectURL(photoPreviewUrl);
      const file = event.target.files?.[0];
      if (!file) { refreshPhoto(); return; }
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 2 * 1024 * 1024 || !file.size) {
        event.target.value = "";
        photoNotice("Choisissez une image JPG, PNG ou WebP de 2 Mo maximum.", true);
        return;
      }
      photoPreviewUrl = URL.createObjectURL(file);
      setBothAvatars(photoPreviewUrl, "Aperçu de la nouvelle photo");
      photoNotice("Aperçu uniquement : cliquez sur Enregistrer la photo pour la conserver.");
    });
    $("madicUploadProfilePhoto")?.addEventListener("click", async () => {
      const file = $("madicProfilePhotoFile")?.files?.[0];
      if (!file) return photoNotice("Sélectionnez d'abord une photo.", true);
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 2 * 1024 * 1024 || !file.size)
        return photoNotice("Format ou taille non autorisé.", true);
      const button = $("madicUploadProfilePhoto"); button.disabled = true;
      try {
        const extension = {"image/jpeg":"jpg","image/png":"png","image/webp":"webp"}[file.type];
        const nextPath = `${user.id}/${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await db.storage.from(avatarBucket).upload(nextPath, file, { contentType:file.type, upsert:false });
        if (uploadError) throw uploadError;
        const { error: metadataError } = await db.auth.updateUser({ data: { madic_avatar_path: nextPath } });
        if (metadataError) { await db.storage.from(avatarBucket).remove([nextPath]); throw metadataError; }
        const previousPath = photoPath;
        photoPath = nextPath;
        if (previousPath && previousPath !== nextPath && previousPath.startsWith(user.id + "/"))
          await db.storage.from(avatarBucket).remove([previousPath]);
        $("madicProfilePhotoFile").value = "";
        await refreshPhoto();
        if (photoPreviewUrl) { URL.revokeObjectURL(photoPreviewUrl); photoPreviewUrl = null; }
        photoNotice("Photo enregistrée.");
      } catch (error) { photoNotice("Enregistrement impossible : " + error.message, true); }
      finally { button.disabled = false; }
    });
    $("madicRemoveProfilePhoto")?.addEventListener("click", async () => {
      const button = $("madicRemoveProfilePhoto"); button.disabled = true;
      try {
        const previousPath = photoPath;
        const { error } = await db.auth.updateUser({ data: { madic_avatar_path: null } });
        if (error) throw error;
        photoPath = "";
        if (previousPath && previousPath.startsWith(user.id + "/")) await db.storage.from(avatarBucket).remove([previousPath]);
        $("madicProfilePhotoFile").value = "";
        if (photoPreviewUrl) { URL.revokeObjectURL(photoPreviewUrl); photoPreviewUrl = null; }
        updateClientAvatar(profile.gender);
        photoNotice("Photo supprimée. Avatar par défaut rétabli.");
      } catch (error) { photoNotice("Suppression impossible : " + error.message, true); }
      finally { button.disabled = false; }
    });
    $("gender")?.addEventListener("change", () => { if (!photoPath && !$("madicProfilePhotoFile")?.files?.length) updateClientAvatar($("gender").value); });
    $("welcome").textContent =
      "Bienvenue, " +
      (profile.first_name || user.email?.split("@")[0] || "client");
    for (const [id, key] of [
      ["first", "first_name"],
      ["last", "last_name"],
      ["phone", "phone"],
      ["gender", "gender"],
      ["date_of_birth", "date_of_birth"],
      ["address_number", "address_number"],
      ["address_street", "address_street"],
      ["address_apartment", "address_apartment"],
      ["address_city", "address_city"],
      ["address_region", "address_region"],
      ["address_postal_code", "address_postal_code"],
      ["country", "country"],
    ]) {
      if ($(id)) $(id).value = profile[key] ?? "";
    }
    // Préserver les pays déjà enregistrés, même si leur libellé diffère de la liste IRCC.
    const countrySelect = $("country");
    if (countrySelect && profile.country && !Array.from(countrySelect.options).some(option => option.value === profile.country)) {
      const previousCountry = document.createElement("option");
      previousCountry.value = profile.country;
      previousCountry.textContent = profile.country;
      countrySelect.append(previousCountry);
      countrySelect.value = profile.country;
    }
    // Parcours conditionnel IRCC. Aucune dépendance ou colonne SQL ajoutée.
    const irccCategory = $("ircc_application_category");
    const irccType = $("ircc_application_type");
    const irccTypeContainer = $("ircc_application_type_container");
    const countryContainer = $("ircc_country_container");
    const countryLabel = countryContainer.querySelector("label");
    const questionContainer = $("ircc_question_container");
    const questionLabel = $("ircc_question_label");
    const question = $("ircc_question_answer");
    const followupContainer = $("ircc_followup_container");
    const followupLabel = $("ircc_followup_label");
    const followup = $("ircc_followup_answer");
    const automaticNote = $("ircc_automatic_note");
    const irccSaved = user.user_metadata?.madic_ircc_questions || {};
    const yesNo = ["Oui", "Non"];
    const makeSelect = (element, values, selected) => {
      element.replaceChildren(new Option("Sélectionnez dans la liste...", ""));
      values.forEach(value => element.add(new Option(value, value)));
      element.value = values.includes(selected) ? selected : "";
    };
    const applyQuestion = (container, label, select, prompt, values, selected) => {
      container.hidden = !prompt;
      select.disabled = !prompt;
      select.required = Boolean(prompt);
      if (prompt) { label.textContent = prompt + " (obligatoire)"; makeSelect(select, values, selected); }
      else { select.required = false; select.value = ""; }
    };
    const syncIrccType = () => {
      const category = irccCategory.value;
      const previousValue = irccType.value;
      const groups = Array.from(irccType.querySelectorAll("optgroup"));
      groups.forEach(group => {
        const active = group.label === category;
        group.hidden = !active;
        Array.from(group.querySelectorAll("option")).forEach(option => { option.disabled = !active; });
      });
      const showType = groups.some(group => group.label === category);
      irccTypeContainer.hidden = !showType;
      irccType.required = showType;
      irccType.disabled = !showType;
      if (!showType || !Array.from(irccType.options).some(option => !option.disabled && option.value === previousValue)) irccType.value = "";
    };
    const rules = {
      "Programme des candidats des provinces": ["Présentez-vous votre demande dans le cadre d’Entrée express ?", yesNo, "Avez-vous déjà présenté votre demande ?", yesNo],
      "Époux, conjoint de fait ou partenaire conjugal": ["Où réside la personne parrainée ?", ["Au Canada", "À l’extérieur du Canada"], "La personne parrainée compte-t-elle s’établir au Québec ?", yesNo],
      "Enfant à charge": ["Où réside l’enfant parrainé ?", ["Au Canada", "À l’extérieur du Canada"], "L’enfant compte-t-il s’établir au Québec ?", yesNo],
      "Parents ou grands-parents": ["Les personnes parrainées comptent-elles s’établir au Québec ?", yesNo],
      "Autre membre de la famille": ["La personne parrainée compte-t-elle s’établir au Québec ?", yesNo],
      "Demande pour considérations d’ordre humanitaire": ["Comptez-vous vous établir au Québec ?", yesNo, "Avez-vous déjà présenté votre demande ?", yesNo],
      "Attribution de la citoyenneté canadienne": ["Avez-vous déjà présenté votre demande ?", yesNo],
      "Certificat de citoyenneté": ["Avez-vous déjà présenté votre demande ?", yesNo],
      "Première carte de résident permanent": ["Avez-vous déjà présenté votre demande ?", yesNo],
      "Renouvellement de la carte de résident permanent": ["Avez-vous déjà présenté votre demande ?", yesNo],
      "Remplacement de la carte de résident permanent": ["Avez-vous déjà présenté votre demande ?", yesNo]
    };
    const countryTypes = new Set(["Visa de visiteur (de l’étranger)", "Super visa (parents et grands-parents)", "Permis d’études (de l’étranger)", "Permis de travail (de l’étranger)"]);
    const automatic = {
      "Prolongation d’un permis d’études au Canada": ["Avez-vous déjà présenté votre demande ?", "Non"],
      "Prolongation du permis de travail du Canada": ["Avez-vous déjà présenté votre demande ?", "Non"],
      "Expérience internationale Canada": ["Pour quelle saison avez-vous présenté votre demande ?", "Cette saison"]
    };
    let restoreQuestions = true;
    const syncIrccQuestions = () => {
      const type = irccType.value;
      const rule = rules[type];
      const stored = restoreQuestions && irccSaved.type === type ? irccSaved : {};
      const showCountry = countryTypes.has(type);
      countryContainer.hidden = !showCountry;
      countrySelect.disabled = !showCountry;
      countrySelect.required = showCountry;
      countryLabel.textContent = type === "Super visa (parents et grands-parents)"
        ? "Dans quel pays résident les parents ou grands-parents ? (obligatoire)"
        : "À partir de quel endroit faites-vous votre demande ? (obligatoire)";
      applyQuestion(questionContainer, questionLabel, question, rule?.[0], rule?.[1] || [], stored.answer || question.value);
      applyQuestion(followupContainer, followupLabel, followup, rule?.[2], rule?.[3] || [], stored.followup || followup.value);
      automaticNote.hidden = !automatic[type];
      automaticNote.textContent = automatic[type] ? automatic[type][0] + " Réponse automatique : " + automatic[type][1] + "." : "";
    };
    irccCategory.value = profile.ircc_application_category || "";
    irccType.value = profile.ircc_application_type || "";
    irccCategory.addEventListener("change", () => { irccType.value = ""; restoreQuestions = false; syncIrccType(); syncIrccQuestions(); });
    irccType.addEventListener("change", () => { restoreQuestions = false; question.value = ""; followup.value = ""; syncIrccQuestions(); });
    syncIrccType();
    syncIrccQuestions();
    $("email").value = profile.email || user.email || "";
    $("profile").addEventListener("submit", async (event) => {
      event.preventDefault();
      const payload = {};
      for (const [id, key] of [
        ["first", "first_name"],
        ["last", "last_name"],
        ["phone", "phone"],
        ["gender", "gender"],
        ["date_of_birth", "date_of_birth"],
        ["address_number", "address_number"],
        ["address_street", "address_street"],
        ["address_apartment", "address_apartment"],
        ["address_city", "address_city"],
        ["address_region", "address_region"],
        ["address_postal_code", "address_postal_code"],
      ]) {
        if (Object.prototype.hasOwnProperty.call(profile, key))
          payload[key] = ($(id)?.value || "").trim() || null;
      }
      // Ajout isolé : mêmes règles de sauvegarde que les autres champs du profil.
      if (Object.prototype.hasOwnProperty.call(profile, "ircc_application_category")) {
        payload.ircc_application_category = irccCategory.value || null;
        payload.ircc_application_type = irccType.disabled ? null : (irccType.value || null);
      } else {
        return status("Colonnes IRCC absentes de profiles : appliquez d'abord la migration SQL fournie.", true);
      }
      // Le pays est lié au parcours IRCC : ne pas effacer une valeur masquée.
      if (countrySelect.required && Object.prototype.hasOwnProperty.call(profile, "country"))
        payload.country = countrySelect.value || null;
      if (!payload.first_name || !payload.last_name)
        return status("Prénom et nom obligatoires.", true);
      if (
        payload.country &&
        !Array.from($("country").options).some(option => option.value === payload.country)
      )
        return status("Sélectionnez un pays valide dans la liste.", true);
      const { error } = await db
        .from("profiles")
        .update(payload)
        .eq("id", user.id);
      if (error)
        return status("Profil non enregistré : " + error.message, true);
      // Les réponses complémentaires sont stockées dans les métadonnées du compte,
      // sans nouvelle colonne ni modification des politiques RLS existantes.
      const selectedType = irccType.value;
      const auto = automatic[selectedType];
      const answers = {
        type: selectedType,
        answer: question.disabled ? null : (question.value || null),
        followup: followup.disabled ? null : (followup.value || null),
        automatic_question: auto?.[0] || null,
        automatic_answer: auto?.[1] || null
      };
      const { error: answersError } = await db.auth.updateUser({
        data: { madic_ircc_questions: answers }
      });
      if (answersError) return status("Profil enregistré, mais réponses IRCC non enregistrées : " + answersError.message, true);
      Object.assign(profile, payload);
      if (!photoPath) updateClientAvatar(profile.gender);
      $("welcome").textContent = "Bienvenue, " + profile.first_name;
      status("Profil enregistré.");
    });
    const cabinet = $("cabinet");
    for (const space of spaces) {
      const option = document.createElement("option");
      option.value = space.space_id;
      option.textContent = space.space_name;
      cabinet.append(option);
    }
    if (spaces.length > 1) $("cricCabinetPanel").hidden = false;
    cabinet.addEventListener("change", () =>
      load().catch((err) =>
        status("Chargement impossible : " + err.message, true),
      ),
    );
    $("upload").addEventListener("submit", upload);
    $("documents").addEventListener("click", async (event) => {
      const btn = event.target.closest("button[data-doc-id]");
      if (!btn) return;
      const docId = btn.dataset.docId;
      const doc = (window._madicCricDocuments || []).find(
        (d) => d.id === docId,
      );
      if (!doc) return status("Document introuvable.", true);
      const { data, error } = await db.storage
        .from("madic-documents")
        .createSignedUrl(doc.storage_path, 60);
      if (error || !data?.signedUrl)
        return status(
          "Téléchargement impossible : " +
            (error?.message || "Lien indisponible"),
          true,
        );
      const a = document.createElement("a");
      a.href = data.signedUrl;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.click();
    });
    await load();
  } catch (error) {
    status(
      "Impossible de charger votre espace CRIC : " +
        (error.message || String(error)),
      true,
    );
  }

  async function load() {
    const spaceId = $("cabinet").value;
    if (!spaces.some((s) => s.space_id === spaceId))
      throw Error("Cabinet non autorisé.");
    const { data: ds, error: de } = await db
      .from("dossiers")
      .select("id,reference,category,status,created_at")
      .eq("client_id", user.id)
      .eq("space_id", spaceId)
      .order("created_at", { ascending: false });
    if (de) throw de;
    dossiers = ds || [];
    const body = $("dossiers");
    body.replaceChildren();
    for (const d of dossiers) {
      const r = body.insertRow();
      td(r, d.reference);
      td(r, d.category);
      td(r, d.status);
    }
    if (!dossiers.length) {
      const r = body.insertRow();
      const c = r.insertCell();
      c.colSpan = 3;
      c.textContent = "Aucun dossier attribué par ce consultant.";
    }
    const active = dossiers.filter((d) => d.status === "actif");
    const select = $("dossier");
    select.replaceChildren();
    const empty = document.createElement("option");
    empty.value = "";
    empty.textContent = "Aucun dossier actif";
    select.append(empty);
    for (const d of active) {
      const opt = document.createElement("option");
      opt.value = d.id;
      opt.textContent = d.reference + " - " + d.category;
      select.append(opt);
    }
    $("uploadButton").disabled = !active.length;
    await loadDocuments();
    status(
      "Espace client associé au cabinet : " +
        spaces.find((s) => s.space_id === spaceId).space_name,
    );
  }
  async function loadDocuments() {
    const body = $("documents");
    body.replaceChildren();
    const ids = dossiers.map((d) => d.id);
    window._madicCricDocuments = [];
    if (!ids.length) {
      const r = body.insertRow();
      const c = r.insertCell();
      c.colSpan = 5;
      c.textContent = "Aucun document transmis.";
      return;
    }
    const { data, error } = await db
      .from("documents")
      .select("*")
      .eq("client_id", user.id)
      .in("dossier_id", ids)
      .order("created_at", { ascending: false });
    if (error) throw error;
    window._madicCricDocuments = data || [];
    for (const d of data || []) {
      const r = body.insertRow();
      td(r, d.original_name);
      td(r, date(d.created_at));
      td(
        r,
        d.review_status === "accepte"
          ? "Accepté"
          : d.review_status === "refuse"
            ? "Refusé"
            : d.review_status === "en_attente"
              ? "En attente"
              : d.status || "En attente",
      );
      td(r, d.review_reason || "-");
      const cell = r.insertCell();
      const b = document.createElement("button");
      b.type = "button";
      b.className = "secondary";
      b.textContent = "Télécharger";
      b.dataset.docId = d.id;
      cell.append(b);
    }
    if (!data?.length) {
      const r = body.insertRow();
      const c = r.insertCell();
      c.colSpan = 5;
      c.textContent = "Aucun document transmis.";
    }
  }
  async function upload(event) {
    event.preventDefault();
    const dossierId = $("dossier").value;
    if (!dossiers.some((d) => d.id === dossierId && d.status === "actif"))
      return status("Sélectionnez un dossier actif de ce consultant.", true);
    const file = $("file").files[0];
    if (!file) return status("Sélectionnez un document.", true);
    const types = ["application/pdf", "image/jpeg", "image/png"];
    if (
      !types.includes(file.type) ||
      file.size === 0 ||
      file.size > 10 * 1024 * 1024
    )
      return status("PDF, JPG ou PNG uniquement, 10 Mo maximum.", true);
    const path = `${user.id}/${dossierId}/${crypto.randomUUID()}`;
    $("uploadButton").disabled = true;
    try {
      const { error: uploadError } = await db.storage
        .from("madic-documents")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (uploadError) throw uploadError;
      const { error: insertError } = await db.from("documents").insert({
        dossier_id: dossierId,
        client_id: user.id,
        original_name: file.name.slice(0, 240),
        storage_path: path,
        mime_type: file.type,
        size_bytes: file.size,
      });
      if (insertError)
        throw Error(
          "Fichier transféré, mais enregistrement incomplet. Contactez le consultant. Référence : " +
            path +
            " - " +
            insertError.message,
        );
      $("upload").reset();
      status("Document transmis.");
      await loadDocuments();
    } catch (err) {
      status("Transmission impossible : " + err.message, true);
    } finally {
      $("uploadButton").disabled = !dossiers.some((d) => d.status === "actif");
    }
  }
})();
