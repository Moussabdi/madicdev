(async () => {
  "use strict";
  const $ = (id) => document.getElementById(id),
    notice = (s) => ($("docreqNotice").textContent = s);
  if (!window.getMadicSupabase)
    return notice("Configuration Supabase manquante.");
  const db = window.getMadicSupabase();
  let spaceId,
    clients = [],
    dossiers = [];
  const params = new URLSearchParams(location.search);
  const targetClient = params.get("client"),
    targetDossier = params.get("dossier");
  const opt = (sel, v, t) => {
    const o = document.createElement("option");
    o.value = v;
    o.textContent = t;
    sel.append(o);
  };
  function updateDossiers() {
    const sel = $("docreqDossier");
    sel.replaceChildren();
    for (const d of dossiers.filter(
      (d) => d.client_id === $("docreqClient").value,
    ))
      opt(sel, d.id, d.reference || d.id);
  }
  async function loadReceived() {
    const clientId = $("docreqClient").value,
      dossierId = $("docreqDossier").value;
    const body = $("receivedRows");
    body.replaceChildren();
    $("receivedContext").textContent =
      "Documents du dossier : " +
      (dossiers.find((d) => d.id === dossierId)?.reference ||
        "Aucun dossier sélectionné");
    $("receivedNotice").textContent = "Chargement…";
    if (
      !clientId ||
      !dossierId ||
      !dossiers.some((d) => d.id === dossierId && d.client_id === clientId)
    ) {
      $("receivedNotice").textContent = "Aucun dossier sélectionné.";
      return;
    }
    const { data, error } = await db
      .from("documents")
      .select(
        "id,original_name,created_at,review_status,review_reason,storage_path",
      )
      .eq("client_id", clientId)
      .eq("dossier_id", dossierId)
      .order("created_at", { ascending: false });
    if (error) {
      $("receivedNotice").textContent = "Lecture impossible : " + error.message;
      return;
    }
    $("receivedNotice").textContent =
      (data || []).length + " document(s) reçu(s).";
    for (const doc of data || []) {
      const row = body.insertRow();
      const received = doc.created_at
        ? new Date(doc.created_at).toLocaleDateString("fr-CA")
        : "-";
      const review =
        { accepte: "Accepté", refuse: "Refusé", en_attente: "En attente" }[
          doc.review_status
        ] ||
        doc.review_status ||
        "-";
      for (const value of [
        doc.original_name,
        received,
        review,
        doc.review_reason || "-",
      ])
        row.insertCell().textContent = value;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "secondary";
      btn.textContent = "Télécharger";
      const actionCell = row.insertCell();
      actionCell.className = "madic-doc-actions";
      actionCell.append(btn);
      const reviewAction = (label, status) => {
        const action = document.createElement("button");
        action.type = "button";
        action.className = "secondary";
        action.textContent = label;
        actionCell.append(action);
        action.onclick = async () => {
          if (
            $("docreqClient").value !== clientId ||
            $("docreqDossier").value !== dossierId
          ) {
            $("receivedNotice").textContent =
              "La sélection a changé : actualisez les documents.";
            return;
          }
          let reason = null;
          if (status === "refuse") {
            reason = window.prompt(
              "Motif du refus (obligatoire, visible par le client) :",
              doc.review_reason || "",
            );
            if (reason === null) return;
            reason = reason.trim();
            if (!reason || reason.length > 1000) {
              $("receivedNotice").textContent =
                "Motif requis : 1 à 1000 caractères.";
              return;
            }
          } else if (
            !window.confirm("Confirmer l’acceptation de ce document ?")
          )
            return;
          action.disabled = true;
          try {
            const { data, error } = await db.rpc("madic_cric_review_document", {
              p_document_id: doc.id,
              p_status: status,
              p_reason: reason,
            });
            if (error) throw error;
            if (data !== true)
              throw Error(
                "Document non autorisé pour ce cabinet ou ce dossier.",
              );
            await loadReceived();
            $("receivedNotice").textContent =
              status === "accepte"
                ? "Document accepté."
                : "Document refusé. Motif enregistré.";
          } catch (e) {
            $("receivedNotice").textContent =
              "Évaluation impossible : " + e.message;
          } finally {
            action.disabled = false;
          }
        };
      };
      reviewAction(
        doc.review_status === "accepte" ? "Accepter à nouveau" : "Accepter",
        "accepte",
      );
      reviewAction(
        doc.review_status === "refuse" ? "Modifier le refus" : "Refuser",
        "refuse",
      );
      btn.onclick = async () => {
        btn.disabled = true;
        try {
          const { data: signed, error: se } = await db.storage
            .from("madic-documents")
            .createSignedUrl(doc.storage_path, 60);
          if (se || !signed?.signedUrl)
            throw Error(se?.message || "Lien indisponible");
          const a = document.createElement("a");
          a.href = signed.signedUrl;
          a.target = "_blank";
          a.rel = "noopener noreferrer";
          a.click();
        } catch (e) {
          $("receivedNotice").textContent =
            "Téléchargement impossible : " + e.message;
        } finally {
          btn.disabled = false;
        }
      };
    }
  }
  async function refresh() {
    const { data, error } = await db
      .from("madic_cric_document_requests")
      .select("id,client_id,dossier_id,title,due_on,status,created_at")
      .eq("space_id", spaceId)
      .eq("client_id", $("docreqClient").value)
      .eq("dossier_id", $("docreqDossier").value)
      .order("created_at", { ascending: false });
    if (error) throw error;
    const body = $("docreqRows");
    body.replaceChildren();
    for (const r of data || []) {
      const tr = body.insertRow();
      for (const v of [
        r.title,
        r.due_on || "-",
        { requested: "Demandé", completed: "Terminé", cancelled: "Annulé" }[
          r.status
        ] || r.status,
      ])
        tr.insertCell().textContent = v;
      const td = tr.insertCell();
      td.className = "madic-doc-request-action";
      const sel = document.createElement("select");
      for (const [v, t] of [
        ["requested", "Demandé"],
        ["completed", "Terminé"],
        ["cancelled", "Annulé"],
      ])
        opt(sel, v, t);
      sel.value = r.status;
      td.append(sel);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = "Enregistrer";
      td.append(btn);
      btn.onclick = async () => {
        btn.disabled = true;
        const { error } = await db
          .from("madic_cric_document_requests")
          .update({ status: sel.value })
          .eq("id", r.id)
          .eq("space_id", spaceId);
        btn.disabled = false;
        if (error) return notice(error.message);
        await refresh();
        notice("Statut enregistré.");
      };
    }
    if (!data?.length) {
      const tr = body.insertRow();
      tr.insertCell().colSpan = 4;
      tr.cells[0].textContent = "Aucune demande documentaire.";
    }
  }
  try {
    const {
      data: { user },
      error: ue,
    } = await db.auth.getUser();
    if (ue || !user) throw Error("Connexion CRIC requise.");
    const { data: apps, error: ae } = await db
      .from("madic_cric_applications")
      .select("status")
      .eq("user_id", user.id)
      .maybeSingle();
    if (ae || apps?.status !== "approved")
      throw Error("Compte CRIC non approuvé.");
    const { data: spaces, error: se } = await db
      .from("madic_cric_spaces")
      .select("id,access_status")
      .eq("owner_user_id", user.id)
      .limit(1);
    if (se || !spaces?.[0] || spaces[0].access_status !== "active")
      throw Error("Cabinet inactif.");
    spaceId = spaces[0].id;
    const { data: allowed, error: pe } = await db.rpc(
      "madic_can_manage_cric_space",
      { p_space_id: spaceId },
    );
    if (pe || allowed !== true) throw Error("Accès refusé.");
    const { data: links, error: le } = await db
      .from("madic_cric_clients")
      .select("client_id")
      .eq("space_id", spaceId);
    if (le) throw le;
    const ids = [...new Set((links || []).map((x) => x.client_id))];
    if (ids.length) {
      const { data, error } = await db
        .from("profiles")
        .select("id,first_name,last_name,email")
        .in("id", ids);
      if (error) throw error;
      clients = (data || []).map((c) => ({
        id: c.id,
        name:
          [c.first_name, c.last_name].filter(Boolean).join(" ") ||
          c.email ||
          "Client",
      }));
    }
    const { data: ds, error: de } = await db
      .from("dossiers")
      .select("id,client_id,reference")
      .eq("space_id", spaceId);
    if (de) throw de;
    dossiers = (ds || []).filter((d) => ids.includes(d.client_id));
    for (const c of clients) opt($("docreqClient"), c.id, c.name);
    if (targetClient && clients.some((c) => c.id === targetClient))
      $("docreqClient").value = targetClient;
    $("docreqClient").onchange = () => {
      updateDossiers();
      loadReceived().catch((e) => notice(e.message));
      refresh().catch((e) => notice(e.message));
    };
    updateDossiers();
    if (
      targetDossier &&
      dossiers.some(
        (d) =>
          d.id === targetDossier && d.client_id === $("docreqClient").value,
      )
    )
      $("docreqDossier").value = targetDossier;
    $("docreqDossier").onchange = () => {
      loadReceived().catch((e) => notice(e.message));
      refresh().catch((e) => notice(e.message));
    };
    $("docreqApp").hidden = false;
    await loadReceived();
    await refresh();
    notice("Demandes chargées.");
    // Transmission d'un document par le CRIC au client du dossier sélectionné.
    $("docsendForm").addEventListener("submit", async (event) => {
      event.preventDefault();
      const clientId = $("docreqClient").value;
      const dossierId = $("docreqDossier").value;
      const file = $("docsendFile").files?.[0];
      const label = $("docsendTitle").value.trim();
      const result = $("docsendNotice");
      const button = $("docsendButton");
      if (
        !clients.some((c) => c.id === clientId) ||
        !dossiers.some((d) => d.id === dossierId && d.client_id === clientId)
      ) {
        result.textContent = "Sélectionnez un client et son dossier.";
        return;
      }
      if (
        !file ||
        !["application/pdf", "image/jpeg", "image/png"].includes(file.type) ||
        file.size === 0 ||
        file.size > 10 * 1024 * 1024
      ) {
        result.textContent = "Choisissez un PDF, JPG ou PNG de 10 Mo maximum.";
        return;
      }
      const fileName = (label || file.name).slice(0, 200);
      button.disabled = true;
      result.textContent = "Transmission en cours…";
      try {
        const payload = new FormData();
        payload.append("client_id", clientId);
        payload.append("dossier_id", dossierId);
        payload.append("title", fileName);
        payload.append("file", file);
        const { data, error } = await db.functions.invoke(
          "madic-cric-send-document",
          {
            body: payload,
          },
        );
        if (error) {
          let detail = error.message;
          if (error.context && typeof error.context.json === "function") {
            try {
              const response = await error.context.json();
              detail = response.error || response.message || detail;
            } catch (_) {
              /* Keep original error. */
            }
          }
          throw Error(detail);
        }
        if (!data?.ok)
          throw Error(data?.error || "Transmission non confirmée.");
        $("docsendForm").reset();
        result.textContent =
          "Document transmis. Il est maintenant disponible dans l’espace client.";
        await loadReceived();
      } catch (error) {
        result.textContent = "Transmission impossible : " + error.message;
      } finally {
        button.disabled = false;
      }
    });
    $("docreqForm").onsubmit = async (e) => {
      e.preventDefault();
      const client_id = $("docreqClient").value,
        dossier_id = $("docreqDossier").value,
        title = $("docreqTitle").value.trim();
      if (
        !clients.some((c) => c.id === client_id) ||
        !dossiers.some(
          (d) => d.id === dossier_id && d.client_id === client_id,
        ) ||
        !title
      )
        return notice("Client, dossier et document obligatoires.");
      const { error } = await db.from("madic_cric_document_requests").insert({
        space_id: spaceId,
        client_id,
        dossier_id,
        title,
        instructions: $("docreqInstructions").value.trim() || null,
        due_on: $("docreqDue").value || null,
      });
      if (error) return notice("Création impossible : " + error.message);
      $("docreqTitle").value = "";
      $("docreqInstructions").value = "";
      $("docreqDue").value = "";
      await refresh();
      notice("Demande créée.");
    };
  } catch (e) {
    notice("Chargement impossible : " + e.message);
  }
})();
