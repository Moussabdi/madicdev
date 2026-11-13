/* SOURCE: inline script */

      for (const [buttonId, contentId, hintId, openText] of [
        ["toggleProfile", "profileContent", "profileHint", "Modifier"],
        ["toggleDossiers", "dossiersContent", "dossiersHint", "Consulter"],
      ]) {
        const button = document.getElementById(buttonId),
          content = document.getElementById(contentId),
          hint = document.getElementById(hintId);
        button.addEventListener("click", () => {
          const opening = content.hidden;
          content.hidden = !opening;
          hint.hidden = opening;
          button.setAttribute("aria-expanded", String(opening));
          button.textContent = opening ? "Fermer" : openText;
        });
      }
    
;

/* SOURCE: inline script */

      /* Personnalisation locale du menu, sans effet sur les données du portail. */
      (function () {
        const sidebar = document.querySelector(".madic-side-nav");
        const nav = sidebar && sidebar.querySelector(".madic-side-links");
        const toggle = document.getElementById("madicCustomizeNav");
        const reset = document.getElementById("madicResetNav");
        const help = document.getElementById("madicNavHelp");
        if (!sidebar || !nav || !toggle || !reset || !help) return;

        const storageKey = "madic-client-nav-order-v2";
        const items = () =>
          Array.from(nav.querySelectorAll(".madic-nav-entry"));
        const initialOrder = items().map((el) => el.dataset.navKey);
        const labels = {
          edit: { fr: "Personnaliser le menu", en: "Customize menu" },
          done: { fr: "Terminer", en: "Done" },
        };
        let editing = false;
        let dragged = null;
        const currentLanguage = () =>
          document.documentElement.lang.toLowerCase().startsWith("en")
            ? "en"
            : "fr";
        const updateLabel = () => {
          const lang = currentLanguage();
          toggle.textContent = labels[editing ? "done" : "edit"][lang];
        };
        const save = () => {
          try {
            localStorage.setItem(
              storageKey,
              JSON.stringify(items().map((el) => el.dataset.navKey)),
            );
          } catch (_) {
            /* Stockage local facultatif. */
          }
        };
        const applyOrder = (keys) => {
          const byKey = new Map(items().map((el) => [el.dataset.navKey, el]));
          keys.forEach((key) => {
            if (byKey.has(key)) nav.appendChild(byKey.get(key));
          });
          items().forEach((el) => nav.appendChild(el));
        };
        try {
          const saved = JSON.parse(localStorage.getItem(storageKey) || "null");
          if (Array.isArray(saved)) applyOrder(saved);
        } catch (_) {
          /* Revenir à l'ordre HTML si préférence invalide. */
        }

        const setEditing = (value) => {
          editing = Boolean(value);
          sidebar.classList.toggle("madic-editing", editing);
          toggle.setAttribute("aria-pressed", String(editing));
          toggle.setAttribute("aria-expanded", String(editing));
          reset.hidden = !editing;
          help.hidden = !editing;
          nav.querySelectorAll(".madic-drag-handle").forEach((handle) => {
            handle.draggable = editing;
          });
          updateLabel();
        };
        toggle.setAttribute("aria-controls", "madicNavHelp madicResetNav");
        toggle.addEventListener("click", () => setEditing(!editing));
        reset.addEventListener("click", () => {
          applyOrder(initialOrder);
          save();
        });

        nav.addEventListener("click", (event) => {
          const button = event.target.closest("button[data-move]");
          if (!button || !editing) return;
          const item = button.closest(".madic-nav-entry");
          if (!item) return;
          if (button.dataset.move === "up" && item.previousElementSibling) {
            nav.insertBefore(item, item.previousElementSibling);
          } else if (
            button.dataset.move === "down" &&
            item.nextElementSibling
          ) {
            nav.insertBefore(item.nextElementSibling, item);
          }
          save();
          button.focus();
        });
        nav.addEventListener("dragstart", (event) => {
          const handle = event.target.closest(".madic-drag-handle");
          if (!editing || !handle) {
            event.preventDefault();
            return;
          }
          dragged = handle.closest(".madic-nav-entry");
          if (!dragged || !event.dataTransfer) return;
          dragged.classList.add("madic-dragging");
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/plain", dragged.dataset.navKey);
        });
        nav.addEventListener("dragover", (event) => {
          const target = event.target.closest(".madic-nav-entry");
          if (!editing || !dragged || !target || target === dragged) return;
          event.preventDefault();
          if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
          items().forEach((el) =>
            el.classList.toggle("madic-drag-over", el === target),
          );
        });
        nav.addEventListener("drop", (event) => {
          const target = event.target.closest(".madic-nav-entry");
          if (!editing || !dragged || !target || target === dragged) return;
          event.preventDefault();
          const rect = target.getBoundingClientRect();
          const after = window.matchMedia("(max-width: 800px)").matches
            ? event.clientX > rect.left + rect.width / 2
            : event.clientY > rect.top + rect.height / 2;
          nav.insertBefore(dragged, after ? target.nextSibling : target);
          save();
        });
        nav.addEventListener("dragend", () => {
          items().forEach((el) =>
            el.classList.remove("madic-drag-over", "madic-dragging"),
          );
          dragged = null;
        });
        setEditing(false);
      })();
    
;

/* SOURCE: inline script */

      /* Navigation du tableau de bord client : cible, panneau et etat actif. */
      (function () {
        "use strict";
        const nav = document.querySelector(".madic-side-links");
        if (!nav) return;
        const links = Array.from(nav.querySelectorAll('a[href^="#"]'));
        const targets = new Map(
          links.map((link) => [link.getAttribute("href"), link]),
        );
        const panels = {
          "#profile-heading": [
            "profileContent",
            "profileHint",
            "toggleProfile",
          ],
          "#dossiers-heading": [
            "dossiersContent",
            "dossiersHint",
            "toggleDossiers",
          ],
        };
        function activate(link) {
          links.forEach((item) => {
            const active = item === link;
            item.classList.toggle("madic-nav-active", active);
            if (active) item.setAttribute("aria-current", "location");
            else item.removeAttribute("aria-current");
          });
        }
        function reveal(hash) {
          const ids = panels[hash];
          if (!ids) return;
          const content = document.getElementById(ids[0]);
          const hint = document.getElementById(ids[1]);
          const button = document.getElementById(ids[2]);
          if (!content || !button || !content.hidden) return;
          // Utiliser le gestionnaire existant, qui gere aussi aria-expanded.
          button.click();
          if (hint && !content.hidden) hint.hidden = true;
        }
        function navigate(hash, updateHistory) {
          const link = targets.get(hash);
          if (!link) return;
          const target = document.getElementById(hash.slice(1));
          if (!target) return;
          // Les cartes facultatives restent sous le controle des scripts metier.
          if (target.hidden || target.closest("[hidden]")) return;
          reveal(hash);
          activate(link);
          if (updateHistory && location.hash !== hash)
            history.pushState(null, "", hash);
          // Les ancres sur un titre doivent positionner la carte complete.
          const destination = target.closest("section.panel") || target;
          requestAnimationFrame(() => {
            const top =
              destination.getBoundingClientRect().top + window.scrollY - 16;
            window.scrollTo({ top: Math.max(0, top), behavior: "auto" });
          });
        }
        nav.addEventListener("click", (event) => {
          const link = event.target.closest('a[href^="#"]');
          if (!link || !nav.contains(link)) return;
          event.preventDefault();
          navigate(link.getAttribute("href"), true);
        });
        window.addEventListener("hashchange", () =>
          navigate(location.hash, false),
        );
        window.addEventListener("popstate", () =>
          navigate(location.hash, false),
        );
        // Laisser les scripts du portail terminer leur initialisation.
        window.addEventListener("load", () => {
          if (targets.has(location.hash)) navigate(location.hash, false);
          else activate(targets.get("#madic-top"));
        });
      })();
    
;

/* SOURCE: inline script */

      /* Suit le sélecteur FR/EN existant sans modifier le module i18n. */
      (function () {
        const root = document.getElementById("madicPublications");
        if (!root) return;
        const update = () => {
          const lang = (document.documentElement.lang || "fr")
            .toLowerCase()
            .startsWith("en")
            ? "en"
            : "fr";
          document
            .querySelectorAll(
              "[data-madic-publication-fr][data-madic-publication-en]",
            )
            .forEach((node) => {
              const desired = node.getAttribute(
                "data-madic-publication-" + lang,
              );
              if (node.textContent !== desired) node.textContent = desired;
            });
        };
        new MutationObserver(update).observe(document.documentElement, {
          attributes: true,
          attributeFilter: ["lang"],
        });
        document.addEventListener("click", (event) => {
          if (event.target.closest(".madic-language-switch"))
            queueMicrotask(update);
        });
        update();
      })();
    
;

/* SOURCE: assets/cric-client-dashboard.js */
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
        ["country", "country"],
      ]) {
        if (Object.prototype.hasOwnProperty.call(profile, key))
          payload[key] = ($(id)?.value || "").trim() || null;
      }
      if (!payload.first_name || !payload.last_name)
        return status("Prénom et nom obligatoires.", true);
      if (
        payload.country &&
        window.MADIC_COUNTRIES &&
        !window.MADIC_COUNTRIES.isValid(payload.country)
      )
        return status("Sélectionnez un pays valide dans la liste.", true);
      const { error } = await db
        .from("profiles")
        .update(payload)
        .eq("id", user.id);
      if (error)
        return status("Profil non enregistré : " + error.message, true);
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

;

/* SOURCE: assets/madic-messagerie-client-badge.js */
/* MADIC - compteur de messages non lus du client CRIC.
   Lecture uniquement : les RLS Supabase restent la source des autorisations. */
(async () => {
  "use strict";
  const badge = document.getElementById("madicClientMessagesUnread");
  const summary = document.getElementById("madicClientMessagesSummary");
  const card = document.getElementById("madicClientMessagingCard");
  const cabinet = document.getElementById("cabinet");
  if (!badge || !summary || !card || !cabinet) return;
  if (typeof window.getMadicSupabase !== "function") return;
  const db = window.getMadicSupabase();
  const { data: auth, error: authError } = await db.auth.getUser();
  if (authError || !auth?.user) return;
  const uid = auth.user.id;
  const { data: linked, error: linkedError } = await db.rpc(
    "madic_my_cric_client_spaces",
  );
  if (linkedError || !linked?.length) return;
  const authorized = new Set(linked.map((s) => s.space_id));
  card.hidden = false;
  let sequence = 0;
  async function refresh() {
    const current = ++sequence;
    const spaceId = cabinet.value || linked[0].space_id;
    if (!authorized.has(spaceId)) {
      badge.hidden = true;
      summary.textContent = "Sélectionnez un cabinet autorisé.";
      return;
    }
    try {
      const { data: conversations, error: conversationError } = await db
        .from("madic_cric_conversations")
        .select("id")
        .eq("space_id", spaceId)
        .eq("client_id", uid);
      if (conversationError) throw conversationError;
      const ids = (conversations || []).map((c) => c.id);
      if (!ids.length) {
        if (current !== sequence) return;
        badge.hidden = true;
        summary.textContent = "Aucun message non lu.";
        return;
      }
      const [messagesResponse, readsResponse] = await Promise.all([
        db
          .from("madic_cric_messages")
          .select("id,conversation_id,sender_id,created_at")
          .in("conversation_id", ids)
          .neq("sender_id", uid)
          .order("created_at", { ascending: false })
          .limit(1000),
        db
          .from("madic_cric_message_reads")
          .select("conversation_id,last_read_at")
          .eq("user_id", uid)
          .in("conversation_id", ids),
      ]);
      if (messagesResponse.error) throw messagesResponse.error;
      if (readsResponse.error) throw readsResponse.error;
      const lastRead = new Map(
        (readsResponse.data || []).map((r) => [
          r.conversation_id,
          r.last_read_at,
        ]),
      );
      const unread = (messagesResponse.data || []).filter((m) => {
        const readAt = lastRead.get(m.conversation_id);
        return (
          !readAt ||
          new Date(m.created_at).getTime() > new Date(readAt).getTime()
        );
      }).length;
      if (current !== sequence) return;
      badge.textContent = String(unread);
      badge.hidden = unread === 0;
      summary.textContent = unread
        ? `${unread} message${unread > 1 ? "s" : ""} non lu${unread > 1 ? "s" : ""}.`
        : "Aucun message non lu.";
      if ((messagesResponse.data || []).length === 1000)
        summary.textContent +=
          " (Vérification limitée aux 1 000 messages récents.)";
    } catch (error) {
      if (current !== sequence) return;
      badge.hidden = true;
      summary.textContent =
        "Compteur indisponible : " + (error.message || String(error));
    }
  }
  cabinet.addEventListener("change", refresh);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) refresh();
  });
  window.addEventListener("focus", refresh);
  await refresh();
})();

;

/* SOURCE: assets/madic-client-invoices.js */
/* MADIC 3.2 - Lecture des factures émises du client via RPC dédiée. */
(async () => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const notice = (text) => {
    if ($("clientInvoicesNotice")) $("clientInvoicesNotice").textContent = text;
  };
  if (!window.getMadicSupabase || !$("cabinet") || !$("clientInvoicesPanel"))
    return;
  const db = window.getMadicSupabase();
  const money = (cents) =>
    (Number(cents || 0) / 100).toLocaleString("fr-CA", {
      style: "currency",
      currency: "CAD",
    });
  const total = (i) =>
    Math.round(Number(i.amount_cents) * (1 + Number(i.tax_rate)));
  const date = (value) => value || "-";
  let invoices = [];
  const add = (tag, text, parent) => {
    const e = document.createElement(tag);
    e.textContent = text ?? "";
    parent.append(e);
    return e;
  };
  function pdf(i) {
    const w = window.open("", "_blank");
    if (!w)
      return notice(
        "Autorisez les fenêtres contextuelles pour afficher la facture.",
      );
    const doc = w.document;
    doc.open();
    doc.write(
      '<!doctype html><html lang="fr-CA"><head><meta charset="utf-8"><title>Facture</title><style>body{font:15px Arial,sans-serif;max-width:800px;margin:40px auto;color:#182331}table{width:100%;border-collapse:collapse}th,td{padding:9px;border-bottom:1px solid #ddd;text-align:left}.right{text-align:right}img{max-width:200px;max-height:90px;object-fit:contain}button{margin:24px 0;padding:10px}@media print{button{display:none}}</style></head><body><main id="invoice"></main><button onclick="window.print()">Imprimer / Enregistrer en PDF</button></body></html>',
    );
    doc.close();
    const root = doc.getElementById("invoice");
    if (
      /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(
        i.logo_data_url || "",
      )
    ) {
      const img = doc.createElement("img");
      img.src = i.logo_data_url;
      img.alt = "Logo du cabinet";
      root.append(img);
    }
    add("h1", "Facture " + i.invoice_number, root);
    add("h2", i.cabinet_name, root);
    if (i.cabinet_address) add("p", i.cabinet_address, root);
    if (i.cabinet_tax_numbers)
      add("p", "Numéros de taxes : " + i.cabinet_tax_numbers, root);
    add(
      "p",
      "Émise le " + date(i.issued_on) + " · Échéance : " + date(i.due_on),
      root,
    );
    const table = add("table", "", root);
    const head = add("tr", "", table);
    for (const h of ["Description", "Qté", "Prix unitaire", "Montant"])
      add("th", h, head);
    const items =
      Array.isArray(i.items) && i.items.length
        ? i.items
        : [
            {
              description: i.description,
              quantity: 1,
              unit_price_cents: i.amount_cents,
            },
          ];
    for (const item of items) {
      const tr = add("tr", "", table);
      for (const value of [
        item.description,
        String(item.quantity),
        money(item.unit_price_cents),
        money(Number(item.quantity) * Number(item.unit_price_cents)),
      ])
        add("td", value, tr);
    }
    for (const [label, value] of [
      ["Sous-total", money(i.amount_cents)],
      ["Taxes", money(total(i) - i.amount_cents)],
      ["Total", money(total(i))],
      ["Paiements reçus", money(i.paid_cents)],
      ["Solde", money(total(i) - i.paid_cents)],
    ]) {
      const tr = add("tr", "", table);
      add("td", label, tr).colSpan = 3;
      add("td", value, tr).className = "right";
    }
    if (i.notes) add("p", "Notes : " + i.notes, root);
    w.focus();
  }
  async function payInvoice(invoice, button) {
    if (!invoice.id) {
      notice(
        "Identifiant de facture manquant. Vérifiez la fonction madic_my_issued_invoices.",
      );
      return;
    }
    button.disabled = true;
    button.textContent = "Préparation…";
    notice("Préparation du paiement sécurisé Stripe…");
    try {
      const { data, error } = await db.functions.invoke(
        "madic-stripe-create-checkout",
        {
          body: { invoice_id: invoice.id },
        },
      );
      if (error) {
        let detail = error.message || "Erreur Stripe";
        try {
          const payload = await error.context?.json();
          if (payload?.error) detail = payload.error;
        } catch (_) {
          /* La réponse peut ne pas être JSON. */
        }
        throw new Error(detail);
      }
      if (
        typeof data?.url !== "string" ||
        !/^https:\/\/checkout\.stripe\.com\//.test(data.url)
      ) {
        throw new Error("Lien de paiement Stripe invalide.");
      }
      window.location.assign(data.url);
    } catch (err) {
      notice("Paiement indisponible : " + (err.message || String(err)));
      button.disabled = false;
      button.textContent = "Payer en ligne";
    }
  }
  async function load() {
    const spaceId = $("cabinet").value;
    const body = $("clientInvoicesRows");
    body.replaceChildren();
    if (!spaceId) return;
    notice("Chargement des factures…");
    const { data, error } = await db.rpc("madic_my_issued_invoices", {
      p_space_id: spaceId,
    });
    if (error) {
      notice("Factures indisponibles : " + error.message);
      return;
    }
    invoices = Array.isArray(data) ? data : [];
    $("clientInvoicesPanel").hidden = false;
    for (const i of invoices) {
      const r = body.insertRow();
      for (const v of [
        i.invoice_number,
        date(i.issued_on),
        date(i.due_on),
        money(total(i)),
        money(total(i) - Number(i.paid_cents || 0)),
      ])
        add("td", v, r);
      const td = r.insertCell();
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = "Voir / PDF";
      b.addEventListener("click", () => pdf(i));
      td.append(b);
      const balance = total(i) - Number(i.paid_cents || 0);
      if (balance > 0) {
        const pay = document.createElement("button");
        pay.type = "button";
        pay.textContent = "Payer en ligne";
        pay.style.marginLeft = "0.5rem";
        pay.addEventListener("click", () => payInvoice(i, pay));
        td.append(pay);
      }
    }
    if (!invoices.length) {
      const r = body.insertRow();
      add("td", "Aucune facture émise pour ce cabinet.", r).colSpan = 6;
    }
    notice(
      invoices.length + " facture(s) émise(s) pour le cabinet sélectionné.",
    );
  }
  const { data: auth, error } = await db.auth.getUser();
  if (error || !auth?.user) return;
  $("cabinet").addEventListener("change", () =>
    load().catch((e) => notice(e.message)),
  );
  const observer = new MutationObserver(() => {
    if ($("cabinet").value) load().catch((e) => notice(e.message));
  });
  observer.observe($("cabinet"), { childList: true });
  if ($("cabinet").value) await load().catch((e) => notice(e.message));
})();

;

/* SOURCE: assets/madic-document-requests-client.js */
(async () => {
  "use strict";
  const $ = (id) => document.getElementById(id),
    notice = (s) => ($("docreqClientNotice").textContent = s);
  if (!window.getMadicSupabase) return notice("Configuration manquante.");
  const db = window.getMadicSupabase();
  async function load() {
    const {
      data: { user },
      error: ue,
    } = await db.auth.getUser();
    if (ue || !user) return notice("Connexion requise.");
    const { data: spaces, error: se } = await db.rpc(
      "madic_my_cric_client_spaces",
    );
    if (se) return notice(se.message);
    const cabinet = $("cabinet");
    const selected = spaces?.some((s) => s.space_id === cabinet?.value)
      ? cabinet.value
      : spaces?.[0]?.space_id;
    if (!selected) return notice("Aucun cabinet associé.");
    if (!(spaces || []).some((s) => s.space_id === selected))
      return notice("Cabinet non autorisé.");
    const { data, error } = await db
      .from("madic_cric_document_requests")
      .select("title,instructions,due_on,status,created_at,dossier_id")
      .eq("client_id", user.id)
      .eq("space_id", selected)
      .neq("status", "cancelled")
      .order("created_at", { ascending: false });
    if (error) return notice("Lecture impossible : " + error.message);
    const body = $("docreqClientRows");
    body.replaceChildren();
    for (const d of data || []) {
      const r = body.insertRow();
      for (const v of [
        d.title,
        d.instructions || "-",
        d.due_on || "-",
        d.status === "completed" ? "Terminé" : "Demandé",
      ])
        r.insertCell().textContent = v;
    }
    if (!data?.length) {
      const r = body.insertRow();
      r.insertCell().colSpan = 4;
      r.cells[0].textContent = "Aucun document demandé.";
    }
    notice(
      (data || []).length +
        " demande(s). Transmettez les pièces demandées dans le formulaire ci-dessous.",
    );
  }
  $("docreqClientPanel").hidden = false;
  const cabinet = $("cabinet");
  if (cabinet)
    cabinet.addEventListener("change", () =>
      load().catch((e) => notice(e.message)),
    );
  await load();
})();

;

/* SOURCE: assets/madic-notifications.js */
/* MADIC 7.8 - Notifications de messagerie dans les tableaux de bord.
   Aucune cle privilegiee; requetes soumises aux politiques RLS Supabase. */
(async () => {
  "use strict";
  const page = location.pathname.split("/").pop().toLowerCase();
  const client = page === "dashboard-client-cric.html";
  const cric = page === "cric-dashboard.html";
  if ((!client && !cric) || typeof window.getMadicSupabase !== "function")
    return;
  const db = window.getMadicSupabase();
  const { data: auth, error: authError } = await db.auth.getUser();
  if (authError || !auth?.user) return;
  const uid = auth.user.id;
  const destination = client
    ? "messagerie-client-cric.html"
    : "messagerie-cric.html";
  let previousUnread = null;
  let busy = false;
  let stopped = false;
  let dismissedAtCount = null;

  const toast = document.createElement("aside");
  toast.setAttribute("role", "status");
  toast.setAttribute("aria-live", "polite");
  toast.setAttribute("aria-atomic", "true");
  toast.hidden = true;
  toast.style.cssText =
    "position:fixed;right:16px;bottom:16px;z-index:9999;width:min(360px,calc(100vw - 32px));box-sizing:border-box;background:#123047;color:white;padding:16px;border-radius:12px;box-shadow:0 8px 24px #0005;font:14px/1.5 system-ui,sans-serif";
  const heading = document.createElement("strong");
  heading.textContent = "Nouveau message MADIC";
  const count = document.createElement("p");
  count.style.cssText = "margin:8px 0 12px";
  const actions = document.createElement("div");
  actions.style.cssText =
    "display:flex;gap:12px;align-items:center;justify-content:space-between";
  const open = document.createElement("a");
  open.href = destination;
  open.textContent = "Consulter la messagerie";
  open.style.cssText = "color:#fff;text-decoration:underline;font-weight:600";
  const dismiss = document.createElement("button");
  dismiss.type = "button";
  dismiss.textContent = "Fermer";
  dismiss.setAttribute("aria-label", "Fermer la notification de messagerie");
  dismiss.style.cssText =
    "background:transparent;border:1px solid #ffffffa0;border-radius:6px;padding:6px 10px;color:white;cursor:pointer";
  dismiss.addEventListener("click", () => {
    dismissedAtCount = previousUnread;
    toast.hidden = true;
  });
  actions.append(open, dismiss);
  toast.append(heading, count, actions);
  document.body.append(toast);

  async function conversationIds() {
    if (client) {
      const { data: linked, error } = await db.rpc(
        "madic_my_cric_client_spaces",
      );
      if (error) throw error;
      const spaceIds = [
        ...new Set((linked || []).map((x) => x.space_id).filter(Boolean)),
      ];
      if (!spaceIds.length) return [];
      const result = await db
        .from("madic_cric_conversations")
        .select("id")
        .eq("client_id", uid)
        .in("space_id", spaceIds)
        .limit(200);
      if (result.error) throw result.error;
      return (result.data || []).map((x) => x.id);
    }
    const spaces = await db
      .from("madic_cric_spaces")
      .select("id")
      .eq("owner_user_id", uid)
      .eq("access_status", "active")
      .limit(1);
    if (spaces.error) throw spaces.error;
    if (!spaces.data?.length) return [];
    const spaceId = spaces.data[0].id;
    const allowed = await db.rpc("madic_can_manage_cric_space", {
      p_space_id: spaceId,
    });
    if (allowed.error) throw allowed.error;
    if (allowed.data !== true) return [];
    const result = await db
      .from("madic_cric_conversations")
      .select("id")
      .eq("space_id", spaceId)
      .limit(200);
    if (result.error) throw result.error;
    return (result.data || []).map((x) => x.id);
  }

  async function refresh() {
    if (busy || stopped || document.hidden) return;
    busy = true;
    try {
      const ids = await conversationIds();
      let unread = 0;
      if (ids.length) {
        const [messages, reads] = await Promise.all([
          db
            .from("madic_cric_messages")
            .select("conversation_id,sender_id,created_at")
            .in("conversation_id", ids)
            .order("created_at", { ascending: false })
            .limit(1000),
          db
            .from("madic_cric_message_reads")
            .select("conversation_id,last_read_at")
            .eq("user_id", uid)
            .in("conversation_id", ids),
        ]);
        if (messages.error) throw messages.error;
        if (reads.error) throw reads.error;
        const lastRead = new Map(
          (reads.data || []).map((r) => [r.conversation_id, r.last_read_at]),
        );
        unread = (messages.data || []).filter(
          (m) =>
            m.sender_id !== uid &&
            (!lastRead.has(m.conversation_id) ||
              new Date(m.created_at) >
                new Date(lastRead.get(m.conversation_id))),
        ).length;
      }
      if (
        previousUnread !== null &&
        unread > previousUnread &&
        unread !== dismissedAtCount
      ) {
        count.textContent = `${unread} message${unread > 1 ? "s" : ""} non lu${unread > 1 ? "s" : ""}.`;
        toast.hidden = false;
        dismissedAtCount = null;
      }
      if (unread === 0) {
        toast.hidden = true;
        dismissedAtCount = null;
      }
      if (unread < previousUnread && !toast.hidden) {
        count.textContent = `${unread} message${unread > 1 ? "s" : ""} non lu${unread > 1 ? "s" : ""}.`;
      }
      if (client) {
        const badge = document.getElementById("madicHeroUnread");
        if (badge) {
          badge.hidden = unread === 0;
          badge.textContent = unread > 99 ? "99+" : String(unread);
        }
      }
      previousUnread = unread;
    } catch (error) {
      console.warn(
        "MADIC notifications : verification indisponible :",
        error?.message || String(error),
      );
    } finally {
      busy = false;
    }
  }
  await refresh();
  const timer = window.setInterval(() => {
    void refresh();
  }, 15000);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) void refresh();
  });
  window.addEventListener("pageshow", () => {
    void refresh();
  });
  window.addEventListener(
    "pagehide",
    () => {
      stopped = true;
      window.clearInterval(timer);
    },
    { once: true },
  );
})();

;

/* SOURCE: assets/madic-service-journey.js */
/* MADIC - suivi de demandes isole par cabinet. Module independant des scripts historiques. */
(async () => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  if (
    !window.MADIC_CONFIG?.url ||
    !window.supabase ||
    typeof window.getMadicSupabase !== "function"
  )
    return;
  const db = window.getMadicSupabase();
  const { data: { user } = {}, error: authError } = await db.auth.getUser();
  if (authError || !user) return;
  const labels = {
    received: "Reçue",
    reviewing: "En analyse",
    responded: "Réponse transmise",
    closed: "Clôturée",
  };
  const services = {
    consultation: "Consultation initiale",
    proposition: "Proposition personnalisée",
  };
  const niceDate = (value) =>
    value
      ? new Date(value).toLocaleString("fr-CA", {
          dateStyle: "medium",
          timeStyle: "short",
        })
      : "";
  const cricPanel = $("madicServiceRequestsPanel");
  if (cricPanel) {
    const notice = $("madicServiceNotice"),
      list = $("madicServiceList"),
      badge = $("madicServicePendingBadge"),
      refresh = $("madicServiceRefresh");
    let busy = false,
      spaceId = null;
    const createToggle = $("madicServiceCreateToggle"),
      createForm = $("madicServiceCreateForm");
    const clientSelect = $("madicServiceClient"),
      intakeState = $("madicServiceIntakeState");
    const createSubmit = $("madicServiceCreateSubmit");
    let eligibleClients = [];
    // Filtrage local de la liste compacte, sans modifier les donnees Supabase.
    const requestFilter = $("madicServiceFilter");
    const requestSearch = $("madicServiceSearch");
    function applyRequestFilters() {
      const status = requestFilter?.value || "all";
      const query = (requestSearch?.value || "").trim().toLocaleLowerCase("fr-CA");
      for (const article of list.querySelectorAll(".madic-service-item")) {
        const matchesName = !query || (article.dataset.clientName || "").includes(query);
        const matchesStatus = status === "all" ||
          (status === "received" && article.dataset.requestStatus === "received") ||
          (status === "signed" && article.dataset.contractSigned === "true");
        article.hidden = !(matchesName && matchesStatus);
        // Les styles de cartes ne doivent pas annuler l'attribut hidden.
        article.style.display = article.hidden ? "none" : "";
      }
    }
    function updateSignedCount() {
      const count = Array.from(list.querySelectorAll(".madic-service-item"))
        .filter((article) => article.dataset.contractSigned === "true").length;
      const counter = $("madicServiceOtherCount");
      if (counter) counter.textContent = String(count);
    }
    requestFilter?.addEventListener("change", applyRequestFilters);
    requestSearch?.addEventListener("input", applyRequestFilters);
    function validateClient() {
      const selected = eligibleClients.find(
        (c) => c.client_id === clientSelect?.value,
      );
      const submitted = selected?.intake_status === "submitted";
      const available = submitted && !selected?.has_request;
      if (intakeState)
        intakeState.textContent = !selected
          ? "Sélectionnez un client."
          : !submitted
            ? "Formulaire non soumis : création impossible."
            : selected.has_request
              ? "Une demande existe déjà : création bloquée."
              : "Formulaire soumis : demande autorisée.";
      if (createSubmit) createSubmit.disabled = !available;
    }
    async function loadEligible() {
      if (!clientSelect || !spaceId) return;
      const { data, error } = await db.rpc("madic_service_eligible_clients", {
        p_space_id: spaceId,
      });
      if (error) throw error;
      eligibleClients = data || [];
      clientSelect.replaceChildren();
      const blank = document.createElement("option");
      blank.value = "";
      blank.textContent = "Choisir un client";
      clientSelect.append(blank);
      for (const c of eligibleClients) {
        const option = document.createElement("option");
        option.value = c.client_id;
        option.textContent =
          (c.client_name || "Client") +
          (c.intake_status === "submitted"
            ? " · formulaire soumis"
            : " · formulaire incomplet") +
          (c.has_request ? " · demande existante" : "");
        clientSelect.append(option);
      }
      validateClient();
    }
    clientSelect?.addEventListener("change", validateClient);
    createToggle?.addEventListener("click", async () => {
      const opening = createForm.hidden;
      createForm.hidden = !opening;
      createToggle.setAttribute("aria-expanded", String(opening));
      if (opening) {
        try {
          await loadEligible();
        } catch (e) {
          intakeState.textContent = "Chargement impossible : " + e.message;
        }
      }
    });
    createForm?.addEventListener("submit", async (e) => {
      e.preventDefault();
      validateClient();
      if (createSubmit.disabled) return;
      createSubmit.disabled = true;
      try {
        const { error } = await db.rpc("madic_service_create_by_cric", {
          p_space_id: spaceId,
          p_client_id: clientSelect.value,
          p_service_type: $("madicServiceType").value,
          p_payment_method: $("madicServicePayment").value,
          p_payment_note: $("madicServicePaymentNote").value || null,
        });
        if (error) throw error;
        notice.textContent =
          "Demande créée. Le parcours client sera actualisé automatiquement.";
        createForm.reset();
        await loadEligible();
        await load();
      } catch (err) {
        intakeState.textContent = "Création impossible : " + err.message;
        validateClient();
      }
    });
    const pill = (label, kind = "neutral") => {
      const el = document.createElement("span");
      el.className = "madic-service-state madic-service-state-" + kind;
      el.textContent = label;
      return el;
    };
    const stateLine = (label, value, kind = "neutral") => {
      const line = document.createElement("div");
      line.className = "madic-service-state-line";
      const title = document.createElement("span");
      title.textContent = label;
      const badge = pill(value, kind);
      line.append(title, badge);
      return { line, badge };
    };
    async function appointmentOverview() {
      const now = new Date().toISOString();
      const [slotsResult, appointmentsResult] = await Promise.all([
        db
          .from("madic_cric_appointment_slots")
          .select("id,starts_at,is_open")
          .eq("space_id", spaceId)
          .gte("starts_at", now),
        db
          .from("madic_cric_appointments")
          .select("client_id,slot_id,status")
          .eq("space_id", spaceId),
      ]);
      if (slotsResult.error) throw slotsResult.error;
      if (appointmentsResult.error) throw appointmentsResult.error;
      const appointments = appointmentsResult.data || [];
      const occupied = new Set(
        appointments
          .filter((a) => ["requested", "confirmed"].includes(a.status))
          .map((a) => a.slot_id),
      );
      const available = (slotsResult.data || []).filter(
        (s) => s.is_open && !occupied.has(s.id),
      ).length;
      const perClient = new Map();
      for (const a of appointments) {
        if (!perClient.has(a.client_id)) perClient.set(a.client_id, []);
        perClient.get(a.client_id).push(a.status);
      }
      return { available, perClient };
    }

    async function load() {
      if (busy || !spaceId || document.hidden) return;
      busy = true;
      refresh.disabled = true;
      try {
        const { data, error } = await db.rpc(
          "madic_service_requests_for_cric",
          { p_space_id: spaceId },
        );
        if (error) throw error;
        list.replaceChildren();
        const requests = data || [];
        let appointmentData = null,
          appointmentError = null;
        if (
          requests.some((r) =>
            ["consultation", "proposition"].includes(r.service_type),
          )
        ) {
          try {
            appointmentData = await appointmentOverview();
          } catch (e) {
            appointmentError = e;
          }
        }
        const pending = requests.filter(
          (r) => r.request_status === "received",
        ).length;
        $("madicServiceTotalCount") && ($("madicServiceTotalCount").textContent = String(requests.length));
        $("madicServiceReceivedCount") && ($("madicServiceReceivedCount").textContent = String(pending));
        // Ce compteur porte desormais sur les contrats effectivement signes.
        $("madicServiceOtherCount") && ($("madicServiceOtherCount").textContent = "0");
        badge.textContent = String(pending);
        badge.hidden = !pending;
        notice.textContent = requests.length
          ? `${requests.length} demande(s), dont ${pending} à traiter.`
          : "Aucune demande de service pour le moment.";
        for (const item of requests) {
          const article = document.createElement("article");
          article.className = "madic-service-item";
          article.dataset.clientName = (item.client_name || "Client").toLocaleLowerCase("fr-CA");
          article.dataset.requestStatus = item.request_status || "received";
          article.dataset.contractSigned = "false";
          const header = document.createElement("div");
          header.className = "madic-service-head";
          const title = document.createElement("strong");
          title.textContent = item.client_name || "Client";
          const tag = document.createElement("span");
          tag.className = "madic-service-badge";
          tag.textContent = labels[item.request_status] || "Reçue";
          header.append(title, tag);
          const detail = document.createElement("p");
          detail.textContent = `${services[item.service_type] || item.service_type} · ${niceDate(item.request_updated_at)}`;
          const expanded = document.createElement("details");
          expanded.className = "madic-service-expanded";
          const summary = document.createElement("summary");
          summary.className = "madic-service-row";
          const summaryMain = document.createElement("span");
          summaryMain.className = "madic-service-row-client";
          const summaryName = document.createElement("strong");
          summaryName.textContent = item.client_name || "Client";
          const summaryType = document.createElement("small");
          summaryType.textContent = `${services[item.service_type] || item.service_type} · ${niceDate(item.request_updated_at)}`;
          summaryMain.append(summaryName, summaryType);
          const summaryStatus = pill(labels[item.request_status] || "Reçue", "info");
          const summaryContract = pill("Vérification…");
          const summaryAppointment = pill("Vérification…");
          const summaryContractGroup = document.createElement("span");
          summaryContractGroup.className = "madic-service-row-indicator";
          summaryContractGroup.append(document.createTextNode("Contrat"), summaryContract);
          const summaryAppointmentGroup = document.createElement("span");
          summaryAppointmentGroup.className = "madic-service-row-indicator";
          summaryAppointmentGroup.append(document.createTextNode("Rendez-vous"), summaryAppointment);
          const summaryChevron = document.createElement("span");
          summaryChevron.className = "madic-service-chevron";
          summaryChevron.textContent = "Détails";
          summary.append(summaryMain, summaryStatus, summaryContractGroup, summaryAppointmentGroup, summaryChevron);
          const expandedBody = document.createElement("div");
          expandedBody.className = "madic-service-expanded-body";
          expanded.append(summary, expandedBody);
          function mirrorState(source, target, isContract = false) {
            const sync = () => {
              target.textContent = source.textContent;
              target.className = source.className;
              if (isContract) {
                // "À contresigner" est signe par le client, mais pas finalise.
                article.dataset.contractSigned = /^(Signé|Contresigné)$/.test(source.textContent.trim()) ? "true" : "false";
                updateSignedCount();
                applyRequestFilters();
              }
            };
            new MutationObserver(sync).observe(source, {childList:true, characterData:true, subtree:true, attributes:true, attributeFilter:["class"]});
            sync();
          }
          const actions = document.createElement("div");
          actions.className = "madic-service-actions";
          const select = document.createElement("select");
          select.setAttribute(
            "aria-label",
            "Statut de la demande de " + (item.client_name || "client"),
          );
          for (const [value, label] of Object.entries(labels)) {
            const option = document.createElement("option");
            option.value = value;
            option.textContent = label;
            select.append(option);
          }
          select.value = item.request_status || "received";
          // Le contrat et les disponibilites restent geres par leurs modules existants.
          const workflow = document.createElement("div");
          workflow.className = "madic-service-workflow";
          if (["consultation", "proposition"].includes(item.service_type)) {
            const contract = document.createElement("div");
            contract.className = "madic-service-workflow-block";
            const heading = document.createElement("strong");
            heading.textContent =
              item.service_type === "proposition"
                ? "Contrat professionnel et signature"
                : "Contrat initial et signature";
            const contractState = stateLine("Contrat", "Vérification…");
            const signatureState = stateLine(
              "Signature du client",
              "Vérification…",
            );
            const open = document.createElement("a");
            open.href =
              (item.service_type === "proposition"
                ? "contrat-professionnel-cric.html"
                : "contrat-initial-cric.html") +
              "?client=" +
              encodeURIComponent(item.client_id);
            open.textContent = "Préparer / consulter le contrat →";
            contract.append(
              heading,
              contractState.line,
              signatureState.line,
              open,
            );
            workflow.append(contract);
            if (item.service_type === "proposition") {
              contractState.badge.textContent = "Brouillon uniquement";
              signatureState.badge.textContent = "Non disponible";
              const note = document.createElement("p");
              note.className = "madic-service-workflow-note";
              note.textContent =
                "La publication et la signature électronique du contrat professionnel ne sont pas encore activées. Aucun contrat initial ne sera utilisé pour ce mandat.";
              contract.append(note);
            } else {
              // Le parcours Client -> CRIC utilise client_signe / deux_signatures.
              // Lire uniquement les contrats de ce client dans cet espace CRIC.
              (async () => {
                const { data: clientContracts, error: clientError } = await db
                  .from("madic_initial_contracts")
                  .select("id,status")
                  .eq("space_id", spaceId)
                  .eq("client_id", item.client_id)
                  .eq("signature_flow", "client_to_cric")
                  .in("status", ["client_signe", "deux_signatures"])
                  .order("created_at", { ascending: false })
                  .limit(1);
                if (clientError) console.warn("Contrat Client vers CRIC :", clientError.message);
                const signed = !clientError && clientContracts?.[0];
                if (signed) {
                  // Un contrat transmis par le client se consulte et se contresigne
                  // dans le parcours Client -> CRIC, sans ouvrir le formulaire de creation.
                  open.href = "contrats-client-vers-cric.html";
                  open.textContent = signed.status === "deux_signatures"
                    ? "Consulter le contrat contresigné →"
                    : "Consulter et contresigner le contrat →";
                  contractState.badge.textContent = signed.status === "deux_signatures"
                    ? "Contresigné" : "À contresigner";
                  contractState.badge.className =
                    "madic-service-state madic-service-state-success";
                  signatureState.badge.textContent = "Signée";
                  signatureState.badge.className =
                    "madic-service-state madic-service-state-success";
                  return;
                }
                // Conserver la logique historique des contrats CRIC -> Client.
                const { data, error } = await db.rpc("madic_service_contract_state", {
                  p_space_id: spaceId,
                  p_client_id: item.client_id,
                });
                if (error) throw error;
                const row = Array.isArray(data) ? data[0] : data;
                const state = row?.contract_status;
                if (state === "signe") {
                  contractState.badge.textContent = "Signé";
                  contractState.badge.className =
                    "madic-service-state madic-service-state-success";
                  signatureState.badge.textContent = "Signée";
                  signatureState.badge.className =
                    "madic-service-state madic-service-state-success";
                } else if (state === "publie") {
                  contractState.badge.textContent = "Publié";
                  contractState.badge.className =
                    "madic-service-state madic-service-state-info";
                  signatureState.badge.textContent = "En attente";
                  signatureState.badge.className =
                    "madic-service-state madic-service-state-pending";
                } else if (state === "client_signe" || state === "deux_signatures") {
                  contractState.badge.textContent = state === "deux_signatures"
                    ? "Contresigné" : "À contresigner";
                  contractState.badge.className =
                    "madic-service-state madic-service-state-success";
                  signatureState.badge.textContent = "Signée";
                  signatureState.badge.className =
                    "madic-service-state madic-service-state-success";
                } else if (clientError) {
                  contractState.badge.textContent = "À vérifier";
                  signatureState.badge.textContent = "À vérifier";
                } else {
                  contractState.badge.textContent = "Non publié";
                  signatureState.badge.textContent = "Non disponible";
                }
              })().catch((error) => {
                console.warn("État du contrat :", error.message);
                contractState.badge.textContent = "Indisponible";
                signatureState.badge.textContent = "Indisponible";
              });
            }
            const appointment = document.createElement("div");
            appointment.className = "madic-service-workflow-block";
            const apHead = document.createElement("strong");
            apHead.textContent = "Rendez-vous";
            const apState = stateLine("État du client", "Aucune demande");
            const slotState = stateLine(
              "Créneaux du cabinet",
              "Aucun disponible",
            );
            if (appointmentError) {
              apState.badge.textContent = "Indisponible";
              slotState.badge.textContent = "Indisponible";
            } else if (appointmentData) {
              const states =
                appointmentData.perClient.get(item.client_id) || [];
              if (states.includes("confirmed")) {
                apState.badge.textContent = "Confirmé";
                apState.badge.className =
                  "madic-service-state madic-service-state-success";
              } else if (states.includes("requested")) {
                apState.badge.textContent = "Demande reçue";
                apState.badge.className =
                  "madic-service-state madic-service-state-pending";
              } else if (states.includes("declined"))
                apState.badge.textContent = "Dernière demande refusée";
              else if (states.includes("cancelled"))
                apState.badge.textContent = "Demande annulée";
              if (appointmentData.available) {
                slotState.badge.textContent =
                  appointmentData.available + " disponible(s)";
                slotState.badge.className =
                  "madic-service-state madic-service-state-info";
              }
            }
            const apNote = document.createElement("p");
            apNote.className = "madic-service-workflow-note";
            apNote.textContent =
              "Les créneaux publiés sont accessibles aux clients du cabinet; ils ne constituent pas une proposition individuelle ni une réservation confirmée.";
            const apLink = document.createElement("a");
            apLink.href = "rendez-vous-cric.html";
            apLink.textContent = "Gérer les disponibilités →";
            appointment.append(
              apHead,
              apState.line,
              slotState.line,
              apNote,
              apLink,
            );
            workflow.append(appointment);
            // Reporter les statuts des blocs detailles dans la ligne compacte.
            mirrorState(contractState.badge, summaryContract, true);
            mirrorState(apState.badge, summaryAppointment);
          }
          const save = document.createElement("button");
          save.type = "button";
          save.className = "secondary";
          save.textContent = "Enregistrer le statut";
          save.addEventListener("click", async () => {
            save.disabled = true;
            select.disabled = true;
            try {
              const { error } = await db.rpc("madic_service_set_status", {
                p_space_id: spaceId,
                p_client_id: item.client_id,
                p_status: select.value,
              });
              if (error) throw error;
              await loadAfterSave();
            } catch (err) {
              notice.textContent = "Modification impossible : " + err.message;
            } finally {
              save.disabled = false;
              select.disabled = false;
            }
          });
          actions.append(select, save);
          expandedBody.append(actions, workflow);
          article.append(expanded);
          list.append(article);
          applyRequestFilters();
        }
      } catch (err) {
        notice.textContent = "Demandes indisponibles : " + err.message;
      } finally {
        busy = false;
        refresh.disabled = false;
      }
    }
    async function loadAfterSave() {
      busy = false;
      await load();
    }
    refresh.addEventListener("click", () => void load());
    // L'authentification et la permission CRIC restent controlees par la RPC SQL.
    try {
      const { data: spaces, error } = await db
        .from("madic_cric_spaces")
        .select("id,access_status")
        .eq("owner_user_id", user.id)
        .eq("access_status", "active")
        .limit(1);
      if (error) throw error;
      if (spaces?.length) {
        spaceId = spaces[0].id;
        cricPanel.hidden = false;
        await load();
      }
    } catch (err) {
      console.warn("MADIC services:", err.message);
    }
    window.setInterval(() => {
      if (!document.hidden) void load();
    }, 15000);
    window.addEventListener("focus", () => void load());
  }
  const journey = $("madicJourneyPanel");
  if (journey) {
    const notice = $("madicJourneyStatus"),
      steps = $("madicJourneySteps"),
      stage = $("madicJourneyStage"),
      link = $("madicJourneyLink");
    const phases = ["Formulaire", "Demande", "Analyse", "Réponse"];
    async function update() {
      const cabinet = $("cabinet");
      const spaceId = cabinet?.value;
      if (!spaceId) return;
      journey.hidden = false;
      try {
        const { data: intake, error: intakeError } = await db
          .from("madic_client_intake")
          .select("status")
          .eq("user_id", user.id)
          .maybeSingle();
        if (intakeError) throw intakeError;
        const { data, error } = await db.rpc("madic_service_my_progress", {
          p_space_id: spaceId,
        });
        if (error) throw error;
        const request = data?.[0];
        let active = 0;
        if (intake?.status === "submitted") active = 1;
        if (request)
          active =
            request.request_status === "received"
              ? 2
              : request.request_status === "reviewing"
                ? 3
                : 4;
        stage.textContent = `Étape ${active} sur 4`;
        steps.replaceChildren();
        phases.forEach((label, i) => {
          const el = document.createElement("div");
          el.className =
            "madic-journey-step" + (i < active ? " is-complete" : "");
          const bar = document.createElement("span");
          bar.className = "madic-journey-bar";
          const text = document.createElement("small");
          text.textContent = label;
          el.append(bar, text);
          steps.append(el);
        });
        notice.textContent = request
          ? `${services[request.service_type] || "Demande de service"} - ${labels[request.request_status] || "Reçue"}.`
          : intake?.status === "submitted"
            ? "Votre formulaire est soumis. Vous pouvez choisir votre prochaine étape."
            : "Complétez votre formulaire pour commencer votre parcours.";
        link.hidden = !!request || intake?.status !== "submitted";
        const workflow = $("madicJourneyWorkflow");
        if (workflow) {
          workflow.replaceChildren();
          if (
            ["consultation", "proposition"].includes(request?.service_type) &&
            ["reviewing", "responded", "closed"].includes(
              request.request_status,
            )
          ) {
            const contract = document.createElement("p");
            if (request.service_type === "proposition") {
              contract.textContent =
                "Contrat professionnel : en attente de transmission par votre consultant. La signature électronique n’est pas encore disponible.";
            } else {
              const { data: contracts, error: contractError } = await db
                .from("madic_initial_contracts")
                .select("id,status")
                .eq("client_id", user.id)
                .in("status", ["publie", "signe"])
                .order("created_at", { ascending: false })
                .limit(1);
              if (contractError) {
                contract.textContent =
                  "Contrat : état momentanément indisponible.";
              } else if (contracts?.length) {
                const c = contracts[0];
                contract.textContent =
                  c.status === "signe"
                    ? "Contrat initial signé. "
                    : "Votre contrat initial est disponible pour signature. ";
                const a = document.createElement("a");
                a.href =
                  "contrat-initial-client.html?id=" + encodeURIComponent(c.id);
                a.textContent = "Consulter mon contrat →";
                contract.append(a);
              } else {
                contract.textContent =
                  "Contrat initial : en attente de transmission par votre consultant.";
              }
            }
            workflow.append(contract);
            const ap = document.createElement("p");
            ap.textContent =
              "Vous pouvez consulter les créneaux publiés par votre consultant et demander un rendez-vous. ";
            const a = document.createElement("a");
            a.href = "mes-rendez-vous-cric.html";
            a.textContent = "Voir les disponibilités →";
            ap.append(a);
            workflow.append(ap);
          }
        }
      } catch (err) {
        notice.textContent =
          "Suivi momentanément indisponible : " + err.message;
      }
    }
    $("cabinet")?.addEventListener("change", () => void update());
    // Le script historique peuple la liste des cabinets apres authentification.
    const wait = setInterval(() => {
      if ($("cabinet")?.value) {
        clearInterval(wait);
        void update();
      }
    }, 300);
    setTimeout(() => clearInterval(wait), 12000);
    window.setInterval(() => {
      if (!document.hidden) void update();
    }, 30000);
    window.addEventListener("focus", () => void update());
  }
})();

;

/* SOURCE: assets/madic-i18n-dashboard.js */
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
    "ACTUALITÉS": "NEWS",
    "Actualités sur l’immigration canadienne": "Canadian immigration news",
    "Consultez les trois dernières nouvelles officielles d’Immigration, Réfugiés et Citoyenneté Canada (IRCC).": "View the three latest official updates from Immigration, Refugees and Citizenship Canada (IRCC).",
    "Chargement des actualités officielles…": "Loading official news…",
    "Sélectionnez dans la liste...": "Select from the list...",
    "Indiquez le type de demande que vous présentez. (obligatoire)": "Indicate the type of application you are submitting. (required)",
    "Quel type de demande présentez-vous ? (obligatoire)": "What type of application are you submitting? (required)",
    "À partir de quel endroit faites-vous votre demande ? (obligatoire)": "From where are you applying? (required)",
    "Résidence temporaire (visite, étude, travail)": "Temporary residence (visit, study, work)",
    "Catégorie de l’immigration économique": "Economic immigration category",
    "Réfugiés": "Refugees",
    "Citoyenneté": "Citizenship",
    "Cartes de résident permanent": "Permanent resident cards",
    "Remplacement ou modification de documents, vérification d’un statut": "Replacement or amendment of documents, status verification",
    "Visa de visiteur (de l’étranger)": "Visitor visa (outside Canada)",
    "Visa de visiteur (à partir du Canada)": "Visitor visa (from within Canada)",
    "Prolongation de séjour à titre de visiteur (Fiche du visiteur)": "Extension of stay as a visitor (visitor record)",
    "Permis d’études (de l’étranger)": "Study permit (outside Canada)",
    "Permis d’études du Canada": "Study permit (from within Canada)",
    "Prolongation d’un permis d’études au Canada": "Study permit extension in Canada",
    "Permis de travail (de l’étranger)": "Work permit (outside Canada)",
    "Expérience internationale Canada": "International Experience Canada",
    "Autorisation de voyage électronique (AVE)": "Electronic travel authorization (eTA)",
    "Entrée express": "Express Entry",
    "Travailleurs qualifiés (fédéral)": "Federal skilled workers",
    "Catégorie de l’expérience canadienne": "Canadian Experience Class",
    "Métiers spécialisés (fédéral)": "Federal skilled trades",
    "Travailleurs qualifiés sélectionnés par le Québec": "Quebec-selected skilled workers",
    "Gens d’affaires (immigration économique)": "Business immigration (economic)",
    "Autre demande d’immigration économique": "Other economic immigration application",
    "Époux, conjoint de fait ou partenaire conjugal": "Spouse, common-law partner or conjugal partner",
    "Enfant à charge": "Dependent child",
    "Demande d’asile présentée au Canada": "Refugee claim made in Canada",
    "Réinstallation des réfugiés depuis l’étranger": "Refugee resettlement from abroad",
    "Personne protégée – résidence permanente": "Protected person – permanent residence",
    "Autre demande concernant les réfugiés": "Other refugee application",
    "Demande pour considérations d’ordre humanitaire": "Application on humanitarian and compassionate grounds",
    "Attribution de la citoyenneté canadienne": "Grant of Canadian citizenship",
    "Certificat de citoyenneté": "Citizenship certificate",
    "Reprise de la citoyenneté canadienne": "Resumption of Canadian citizenship",
    "Renonciation à la citoyenneté canadienne": "Renunciation of Canadian citizenship",
    "Première carte de résident permanent": "First permanent resident card",
    "Renouvellement de la carte de résident permanent": "Permanent resident card renewal",
    "Remplacement de la carte de résident permanent": "Replacement permanent resident card",
    "Vérification du statut": "Verification of status",
    "Une plateforme numérique pour les professionnels de l’immigration canadienne et leurs clients.": "A digital platform for Canadian immigration professionals and their clients.",
    "Une plateforme numérique pour les professionnels de l'immigration canadienne et leurs clients.": "A digital platform for Canadian immigration professionals and their clients.",
    "Confidentialité": "Privacy",
    "Tous droits réservés.": "All rights reserved.",
    "Outils du compte": "Account tools",
    "Imprimer / Enregistrer en PDF": "Print / Save as PDF",
    "Dernière demande refusée": "Latest request refused",
    "Demande annulée": "Request cancelled",
    "Gérer les disponibilités →": "Manage availability →",
    "Demande": "Request",
    "Analyse": "Review",
    "Réponse": "Response",
    "Demande de service": "Service request",
    "Reçue": "Received",
    "Voir les disponibilités →": "View availability →",
    "Afrique du Sud": "South Africa",
    "Albanie": "Albania",
    "Algérie": "Algeria",
    "Allemagne": "Germany",
    "Andorre": "Andorra",
    "Antigua-et-Barbuda": "Antigua & Barbuda",
    "Arabie saoudite": "Saudi Arabia",
    "Argentine": "Argentina",
    "Arménie": "Armenia",
    "Australie": "Australia",
    "Autriche": "Austria",
    "Azerbaïdjan": "Azerbaijan",
    "Bahreïn": "Bahrain",
    "Barbade": "Barbados",
    "Belgique": "Belgium",
    "Bénin": "Benin",
    "Bermudes": "Bermuda",
    "Bhoutan": "Bhutan",
    "Bolivie": "Bolivia",
    "Bosnie-Herzégovine": "Bosnia & Herzegovina",
    "Brésil": "Brazil",
    "Bulgarie": "Bulgaria",
    "Cambodge": "Cambodia",
    "Cameroun": "Cameroon",
    "Cap-Vert": "Cape Verde",
    "Chili": "Chile",
    "Chine (République populaire de)": "China",
    "Chypre": "Cyprus",
    "Colombie": "Colombia",
    "Corée du Nord": "North Korea",
    "Croatie": "Croatia",
    "Danemark": "Denmark",
    "Dominique": "Dominica",
    "Égypte": "Egypt",
    "Émirats arabes unis": "United Arab Emirates",
    "Équateur": "Ecuador",
    "Érythrée": "Eritrea",
    "Espagne": "Spain",
    "Estonie": "Estonia",
    "États-Unis - îles Vierges": "U.S. Virgin Islands",
    "États-Unis d'Amérique": "United States",
    "Éthiopie": "Ethiopia",
    "Fidji": "Fiji",
    "Finlande": "Finland",
    "Gambie": "Gambia",
    "Géorgie": "Georgia",
    "Grèce": "Greece",
    "Grenade": "Grenada",
    "Guinée": "Guinea",
    "Guinée équatoriale": "Equatorial Guinea",
    "Guinée-Bissau": "Guinea-Bissau",
    "Haïti": "Haiti",
    "Hongrie": "Hungary",
    "îles Caïmans": "Cayman Islands",
    "Îles Marshall": "Marshall Islands",
    "Îles Salomon": "Solomon Islands",
    "Îles Vierges britanniques": "British Virgin Islands",
    "Inde": "India",
    "Indonésie": "Indonesia",
    "Irak": "Iraq",
    "Irlande": "Ireland",
    "Islande": "Iceland",
    "Israël": "Israel",
    "Italie": "Italy",
    "Jamaïque": "Jamaica",
    "Japon": "Japan",
    "Jordanie": "Jordan",
    "Koweït": "Kuwait",
    "Lettonie": "Latvia",
    "Liban": "Lebanon",
    "Libye": "Libya",
    "Lituanie": "Lithuania",
    "Macédoine": "North Macedonia",
    "Malaisie": "Malaysia",
    "Malte": "Malta",
    "Maroc": "Morocco",
    "Maurice": "Mauritius",
    "Mauritanie": "Mauritania",
    "Mexique": "Mexico",
    "Mongolie": "Mongolia",
    "Monténégro": "Montenegro",
    "Namibie": "Namibia",
    "Népal": "Nepal",
    "Norvège": "Norway",
    "Nouvelle-Calédonie": "New Caledonia",
    "Nouvelle-Zélande": "New Zealand",
    "Ouganda": "Uganda",
    "Ouzbékistan": "Uzbekistan",
    "Papouasie-Nouvelle-Guinée": "Papua New Guinea",
    "Pays-Bas": "Netherlands",
    "Pérou": "Peru",
    "Pologne": "Poland",
    "Porto Rico": "Puerto Rico",
    "République centrafricaine": "Central African Republic",
    "République de Corée": "South Korea",
    "République démocratique du Congo (Kinshasa)": "Democratic Republic of the Congo",
    "République dominicaine": "Dominican Republic",
    "République tchèque": "Czechia",
    "République du Congo (Brazzaville)": "Republic of the Congo",
    "Roumanie": "Romania",
    "Royaume-Uni": "United Kingdom",
    "Russie": "Russia",
    "Saint Siège": "Holy See",
    "Sainte-Lucie": "St. Lucia",
    "Saint-Marin": "San Marino",
    "Salvador": "El Salvador",
    "Sénégal": "Senegal",
    "Serbie": "Serbia",
    "Singapour": "Singapore",
    "Slovaquie": "Slovakia",
    "Slovénie": "Slovenia",
    "Somalie": "Somalia",
    "Soudan": "Sudan",
    "Soudan du Sud": "South Sudan",
    "Suède": "Sweden",
    "Suisse": "Switzerland",
    "Syrie": "Syria",
    "Tadjikistan": "Tajikistan",
    "Taïwan": "Taiwan",
    "Tanzanie": "Tanzania",
    "Tchad": "Chad",
    "Thaïlande": "Thailand",
    "Trinité-et-Tobago": "Trinidad & Tobago",
    "Tunisie": "Tunisia",
    "Turkménistan": "Turkmenistan",
    "Türkiye": "Türkiye",
    "Yémen": "Yemen",
    "Zambie": "Zambia",
    "Les créneaux publiés sont accessibles aux clients du cabinet; ils ne constituent pas une proposition individuelle ni une réservation confirmée.": "Published time slots are available to the firm’s clients; they are not an individual offer or a confirmed booking.",
    "Votre formulaire est soumis. Vous pouvez choisir votre prochaine étape.": "Your form has been submitted. You can choose your next step.",
    "Complétez votre formulaire pour commencer votre parcours.": "Complete your form to begin your journey.",
    "Contrat professionnel : en attente de transmission par votre consultant. La signature électronique n’est pas encore disponible.": "Professional contract: awaiting delivery by your consultant. Electronic signature is not yet available.",
    "Contrat : état momentanément indisponible.": "Contract: status temporarily unavailable.",
    "Contrat initial signé. ": "Initial contract signed. ",
    "Vous pouvez consulter les créneaux publiés par votre consultant et demander un rendez-vous. ": "You can view the time slots published by your consultant and request an appointment. ",
    "Suivi momentanément indisponible : ": "Tracking temporarily unavailable: ",
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
    const normalized = trimmed.replace(/\s+/g, " ");
    if (!normalized || !Object.prototype.hasOwnProperty.call(dict, normalized))
      return;
    const translated = dict[normalized];
    if (translated === normalized) return;
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

;

/* SOURCE: assets/madic-ircc-news.js */
/* MADIC - Actualites officielles IRCC. Aucun acces aux donnees du portail. */
(() => {
  'use strict';
  const target = document.getElementById('madicActualitesItems');
  if (!target) return;
  const sources = {
    fr: 'https://api.io.canada.ca/io-server/gc/news/fr/v2?dept=departmentofcitizenshipandimmigration&sort=publishedDate&orderBy=desc&pick=20&format=atom',
    en: 'https://api.io.canada.ca/io-server/gc/news/en/v2?dept=departmentofcitizenshipandimmigration&sort=publishedDate&orderBy=desc&pick=20&format=atom'
  };
  const fallback = {
    fr: 'https://www.canada.ca/fr/nouvelles/rechercher/recherche-avancee.html?sort=descending&allq=&dprtmnt=Immigration%2C+R%C3%A9fugi%C3%A9s+et+Citoyennet%C3%A9+Canada&declaredtype=communiqu%C3%A9s+de+presse&startdate=&enddate=',
    en: 'https://www.canada.ca/en/news/advanced-news-search/news-results.html?sort=descending&allq=&dprtmnt=Immigration%2C+Refugees+and+Citizenship+Canada'
  };
  const words = {
    fr: {loading:'Chargement des actualités officielles…', unavailable:'Le service d’actualités est temporairement inaccessible.', link:'Consulter les communiqués officiels', read:'Lire la suite', source:'Immigration, Réfugiés et Citoyenneté Canada'},
    en: {loading:'Loading official news…', unavailable:'The news service is temporarily unavailable.', link:'View official news releases', read:'Read more', source:'Immigration, Refugees and Citizenship Canada'}
  };
  let lastLang = '', requestId = 0;
  const lang = () => document.documentElement.lang.toLowerCase().startsWith('en') ? 'en' : 'fr';
  const clean = value => (value || '').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
  const child = (element, name) => Array.from(element.children).find(n => n.localName === name);
  const val = (element, name) => child(element,name)?.textContent?.trim() || '';
  function parse(xml) {
    const doc = new DOMParser().parseFromString(xml,'application/xml');
    if (doc.querySelector('parsererror')) throw new Error('Invalid XML');
    const entries = Array.from(doc.getElementsByTagName('*')).filter(n => n.localName === 'entry' || n.localName === 'item');
    return entries.map(e => {
      const links = Array.from(e.children).filter(n => n.localName === 'link');
      const href = links.find(n => n.getAttribute('rel') === 'alternate')?.getAttribute('href') || links.find(n => n.getAttribute('href'))?.getAttribute('href') || links[0]?.textContent?.trim() || '';
      const rawDate = val(e,'published') || val(e,'pubDate') || val(e,'updated');
      const timestamp = Date.parse(rawDate);
      return { title:val(e,'title'), summary:clean(val(e,'summary') || val(e,'description') || val(e,'content')).slice(0,310), href, date:Number.isFinite(timestamp)?timestamp:0 };
    }).filter(item => item.title && item.date && /^https:\/\//i.test(item.href)).sort((a,b) => b.date-a.date).slice(0,3);
  }
  function showFallback(language) {
    const p=document.createElement('p');p.className='madic-publication-empty';p.textContent=words[language].unavailable;
    const a=document.createElement('a');a.href=fallback[language];a.target='_blank';a.rel='noopener noreferrer';a.textContent=words[language].link;
    target.replaceChildren(p,a);
  }
  function render(items,language) {
    if (!items.length) return showFallback(language);
    const fragment=document.createDocumentFragment();
    for (const item of items) {
      const article=document.createElement('article');article.className='madic-ircc-article';
      const date=document.createElement('time');date.dateTime=new Date(item.date).toISOString();date.textContent=new Intl.DateTimeFormat(language==='fr'?'fr-CA':'en-CA',{year:'numeric',month:'long',day:'numeric'}).format(item.date);
      const title=document.createElement('h3');const a=document.createElement('a');a.href=item.href;a.target='_blank';a.rel='noopener noreferrer';a.textContent=item.title;title.append(a);
      const source=document.createElement('small');source.textContent=words[language].source;
      article.append(date,title,source);
      if(item.summary){const p=document.createElement('p');p.textContent=item.summary;article.append(p);}
      const read=document.createElement('a');read.href=item.href;read.target='_blank';read.rel='noopener noreferrer';read.textContent=words[language].read+' ↗';article.append(read);
      fragment.append(article);
    }
    target.replaceChildren(fragment);
  }
  async function load(force=false) {
    const language=lang();if (!force && lastLang===language) return;
    lastLang=language;const id=++requestId;target.textContent=words[language].loading;
    const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),12000);
    try {
      const response=await fetch(sources[language],{signal:controller.signal,headers:{Accept:'application/atom+xml,application/xml,text/xml'}});
      if(!response.ok)throw new Error('HTTP '+response.status);
      const entries=parse(await response.text());if(id!==requestId)return;
      render(entries,language);
    } catch(error) {if(id===requestId){console.warn('MADIC IRCC feed unavailable:',error);showFallback(language);}}
    finally {clearTimeout(timeout);}
  }
  new MutationObserver(()=>load()).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
  load();
  setInterval(()=>load(true),15*60*1000);
})();

;

/* SOURCE: assets/madic-footer.js */
/* Footer commun MADIC : traduction des libellés sur les pages sans gestionnaire FR/EN. */
(function(){"use strict";function apply(lang){lang=lang==="en"?"en":"fr";document.querySelectorAll(".madic-footer [data-fr][data-en]").forEach(function(el){el.textContent=el.getAttribute("data-"+lang);});}var lang="fr";try{lang=new URLSearchParams(location.search).get("lang")||localStorage.getItem("madic-lang")||"fr";}catch(e){}apply(lang);window.addEventListener("storage",function(e){if(e.key==="madic-lang")apply(e.newValue);});})();

;

/* SOURCE: inline script */

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
    
;