(async () => {
  "use strict";
  const el = (id) => document.getElementById(id);
  const status = (s, bad = false) => {
    el("profileStatus").textContent = s;
    el("profileStatus").style.color = bad ? "#b42318" : "";
  };
  const db = window.getMadicSupabase?.();
  if (!db) return status("Configuration Supabase absente.", true);
  const { data: auth, error: ae } = await db.auth.getUser();
  if (ae || !auth?.user) return location.replace("connexion-cric.html");
  const { data: spaces, error: se } = await db
    .from("madic_cric_spaces")
    .select("id,name,access_status")
    .eq("owner_user_id", auth.user.id)
    .limit(1);
  const space = spaces?.[0];
  if (se || !space || space.access_status !== "active")
    return status("Cabinet indisponible.", true);
  const { data: allowed, error: pe } = await db.rpc(
    "madic_can_manage_cric_space",
    { p_space_id: space.id },
  );
  if (pe || allowed !== true) return status("Accès refusé.", true);
  const { data: application, error: appError } = await db
    .from("madic_cric_applications")
    .select("full_name,license_number,professional_email,status")
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (appError || !application || application.status !== "approved")
    return status(
      "Inscription CRIC approuvée introuvable ou inaccessible : " +
        (appError?.message || "vérifiez votre inscription."),
      true,
    );
  el("profileForm").hidden = false;
  el("registered_full_name").value = application.full_name || "";
  el("professional_email").value = application.professional_email || "";
  const fields = [
    "first_name",
    "last_name",
    "business_name",
    "professional_title",
    "license_number",
    "website_url",
    "phone",
    "business_address",
    "business_values",
    "payment_details",
  ];
  const addressFields = [
    "address_number",
    "address_street",
    "address_unit",
    "address_city",
    "address_region",
    "address_postal_code",
    "address_country",
  ];
  const buildAddress = () => {
    const v = (id) => el(id).value.trim();
    return [
      [v("address_number"), v("address_street")].filter(Boolean).join(" "),
      v("address_unit") ? "Bureau/local " + v("address_unit") : "",
      v("address_city"),
      v("address_region"),
      v("address_postal_code"),
      v("address_country"),
    ]
      .filter(Boolean)
      .join(", ");
  };
  const syncAddress = () => {
    const full = buildAddress();
    if (full) el("business_address").value = full;
  };
  addressFields.forEach((id) => el(id).addEventListener("input", syncAddress));
  const successModal = el("madicProfileSuccess");
  const successClose = el("madicProfileClose");
  let focusBeforeSuccess = null;
  const closeSuccess = () => {
    successModal.hidden = true;
    document.body.classList.remove("madic-profile-modal-open");
    (focusBeforeSuccess || el("profileSave")).focus();
  };
  const openSuccess = () => {
    focusBeforeSuccess = document.activeElement;
    successModal.hidden = false;
    document.body.classList.add("madic-profile-modal-open");
    successClose.focus();
  };
  successClose.addEventListener("click", closeSuccess);
  successModal.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      closeSuccess();
    }
    if (e.key === "Tab") {
      const items = [
        successClose,
        successModal.querySelector(".madic-profile-dashboard"),
      ];
      const index = items.indexOf(document.activeElement);
      if (e.shiftKey && index <= 0) {
        e.preventDefault();
        items[items.length - 1].focus();
      } else if (!e.shiftKey && index === items.length - 1) {
        e.preventDefault();
        items[0].focus();
      }
    }
  });
  const countrySelect = el("address_country");
  const ensureSavedCountry = (value) => {
    if (!value) return;
    if (!Array.from(countrySelect.options).some((o) => o.value === value)) {
      const option = new Option(value + " (valeur enregistrée)", value);
      countrySelect.add(option);
    }
  };
  const paymentIds = ["payment_interac", "payment_cash", "payment_portal"];
  const paymentToggle = () => {
    el("payment_interac_details_wrap").hidden = !el("payment_interac").checked;
  };
  el("payment_interac").addEventListener("change", paymentToggle);
  function readPayment(value) {
    const v = String(value || "").trim();
    paymentIds.forEach((id) => {
      el(id).checked = false;
    });
    el("payment_interac_details").value = "";
    if (!v) {
      paymentToggle();
      return;
    }
    // Les anciennes coordonnées libres restent utilisables sans perte de données.
    const parts = v.split(/\s*;\s*/).filter(Boolean);
    for (const part of parts) {
      if (/^interac\s*:/i.test(part)) {
        el("payment_interac").checked = true;
        el("payment_interac_details").value = part
          .replace(/^interac\s*:\s*/i, "")
          .trim();
      } else if (/^esp[eè]ces$/i.test(part)) el("payment_cash").checked = true;
      else if (/^portail madic$/i.test(part))
        el("payment_portal").checked = true;
      else if (!el("payment_interac").checked) {
        el("payment_interac").checked = true;
        el("payment_interac_details").value = part;
      }
    }
    paymentToggle();
  }
  function serializePayment() {
    const modes = [];
    if (el("payment_interac").checked) {
      const contact = el("payment_interac_details").value.trim();
      if (!contact)
        throw Error(
          "Veuillez indiquer le courriel ou le numéro de téléphone pour Interac.",
        );
      if (/[;\r\n]/.test(contact))
        throw Error(
          "Les coordonnées Interac ne peuvent pas contenir de point-virgule ou de saut de ligne.",
        );
      modes.push("Interac : " + contact);
    }
    if (el("payment_cash").checked) modes.push("Espèces");
    if (el("payment_portal").checked) modes.push("Portail MADIC");
    if (!modes.length)
      throw Error("Sélectionnez au moins un mode de paiement.");
    return modes.join("; ");
  }

  let previous = null;
  const bucket = db.storage.from("madic-cric-branding");
  const revokeUrls = { logo: null, photo: null };
  const setPreview = async (kind, path) => {
    const img = el(kind + "Preview"),
      info = el(kind + "PreviewStatus");
    if (revokeUrls[kind]) {
      URL.revokeObjectURL(revokeUrls[kind]);
      revokeUrls[kind] = null;
    }
    img.hidden = true;
    img.removeAttribute("src");
    if (!path) {
      info.textContent = "Aucune image enregistrée.";
      return;
    }
    info.textContent = "Chargement de l’image enregistrée…";
    const { data, error } = await bucket.createSignedUrl(path, 300);
    if (error || !data?.signedUrl) {
      info.textContent =
        "Image indisponible : " + (error?.message || "lien signé introuvable");
      return;
    }
    img.onload = () => {
      info.textContent = "Image enregistrée.";
    };
    img.onerror = () => {
      img.hidden = true;
      info.textContent =
        "Impossible d’afficher l’image enregistrée. Vérifiez le fichier dans le stockage.";
    };
    img.src = data.signedUrl;
    img.hidden = false;
  };
  const showSelected = (kind) => {
    const file = el(kind).files?.[0];
    if (!file) {
      setPreview(kind, previous?.[kind + "_path"]);
      return;
    }
    if (revokeUrls[kind]) URL.revokeObjectURL(revokeUrls[kind]);
    const url = URL.createObjectURL(file);
    revokeUrls[kind] = url;
    const img = el(kind + "Preview");
    img.src = url;
    img.hidden = false;
    el(kind + "PreviewStatus").textContent =
      "Aperçu local - image non encore enregistrée.";
  };
  el("logo").addEventListener("change", () => showSelected("logo"));
  el("photo").addEventListener("change", () => showSelected("photo"));
  const load = async () => {
    const { data, error } = await db
      .from("madic_cric_professional_profiles")
      .select("*")
      .eq("space_id", space.id)
      .maybeSingle();
    if (error) throw error;
    previous = data;
    fields.forEach((f) => {
      el(f).value = data?.[f] || "";
    });
    addressFields.forEach((f) => {
      if (f === "address_country") ensureSavedCountry(data?.[f]);
      el(f).value = data?.[f] || "";
    });
    if (addressFields.some((f) => el(f).value.trim())) syncAddress();
    else if (data?.business_address)
      status(
        "Ancienne adresse conservée : renseignez les nouveaux champs détaillés avant le prochain enregistrement.",
      );
    readPayment(data?.payment_details);
    if (!data?.first_name && !data?.last_name && application.full_name) {
      const parts = application.full_name.trim().split(/\s+/);
      el("first_name").value = parts.shift() || "";
      el("last_name").value = parts.join(" ");
    }
    // Le numéro approuvé dans l'inscription fait autorité et ne doit pas être écrasé par une ancienne valeur vide.
    if (application.license_number)
      el("license_number").value = application.license_number;
    el("license_number").readOnly = Boolean(application.license_number);
    if (!data?.professional_title)
      el("professional_title").value = "Consultant en immigration";
    await Promise.all([
      setPreview("logo", data?.logo_path),
      setPreview("photo", data?.photo_path),
    ]);
    status(
      data
        ? "Profil enregistré. Vous pouvez le modifier."
        : "Complétez votre profil pour pouvoir inviter des clients.",
    );
  };
  const upload = async (file, kind) => {
    if (!file) return null;
    const types = {
      "image/png": "png",
      "image/jpeg": "jpg",
      "image/webp": "webp",
    };
    if (!types[file.type] || file.size > 5 * 1024 * 1024)
      throw Error("Image invalide : PNG, JPG ou WebP, maximum 5 Mo.");
    const path = `${space.id}/${kind}-${crypto.randomUUID()}.${types[file.type]}`;
    const { error } = await bucket.upload(path, file, {
      contentType: file.type,
      upsert: false,
    });
    if (error) throw Error("Téléversement " + kind + " : " + error.message);
    return path;
  };
  el("profileForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = el("profileSave");
    btn.disabled = true;
    status("Enregistrement en cours…");
    const newFiles = [];
    try {
      if (!el("profileForm").reportValidity()) return;
      const website = el("website_url").value.trim();
      if (website) {
        let parsed;
        try {
          parsed = new URL(website);
        } catch {
          throw Error("Adresse du site Web invalide.");
        }
        if (
          parsed.protocol !== "https:" ||
          !parsed.hostname ||
          parsed.username ||
          parsed.password
        )
          throw Error("Le site Web doit utiliser une adresse HTTPS valide.");
      }
      const logo = el("logo").files[0],
        photo = el("photo").files[0];
      if (!logo && !previous?.logo_path)
        throw Error("Le logo est obligatoire.");
      const logoPath = logo ? await upload(logo, "logo") : previous.logo_path;
      if (logo) newFiles.push(logoPath);
      const photoPath = photo
        ? await upload(photo, "photo")
        : previous?.photo_path || null;
      if (photo) newFiles.push(photoPath);
      const record = {
        space_id: space.id,
        logo_path: logoPath,
        photo_path: photoPath,
        updated_at: new Date().toISOString(),
      };
      syncAddress();
      fields.forEach((f) => (record[f] = el(f).value.trim() || null));
      addressFields.forEach((f) => (record[f] = el(f).value.trim() || null));
      // Ne pas effacer une adresse historique lorsque les nouveaux champs sont vides.
      record.business_address = buildAddress() || previous?.business_address || "";
      if (record.business_address.length > 500)
        throw Error("Adresse complète trop longue (maximum 500 caractères).");
      record.payment_details = serializePayment();
      if (application.license_number)
        record.license_number = application.license_number;
      const { error } = await db
        .from("madic_cric_professional_profiles")
        .upsert(record, { onConflict: "space_id" });
      if (error) throw error;
      el("logo").value = "";
      el("photo").value = "";
      try { await load(); } catch (reloadError) {
        status("Profil enregistré, mais le rafraîchissement a échoué : " + reloadError.message, true);
        openSuccess();
        return;
      }
      status(
        "Profil professionnel enregistré. Vérifiez les aperçus du logo et de la photo ci-dessous.",
      );
      openSuccess();
    } catch (err) {
      for (const p of newFiles) { try { await bucket.remove([p]); } catch (_) { /* Nettoyage non bloquant */ } }
      status("Enregistrement impossible : " + (err.message || err), true);
    } finally {
      btn.disabled = false;
    }
  });
  try {
    await load();
  } catch (err) {
    status("Impossible de charger le profil : " + err.message, true);
  }
})();
