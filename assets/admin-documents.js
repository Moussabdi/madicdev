/* Gestion des documents MADIC. Les autorisations sont appliquées côté Supabase. */
(() => {
  if (document.body.dataset.page !== "admin") return;
  const conf = window.MADIC_CONFIG;
  if (!conf || !window.supabase) return;
  const db = window.getMadicSupabase();
  const $ = (id) => document.getElementById(id);
  const safe = (v) =>
    String(v ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const notice = (message, error = false) => {
    const e = $("message");
    if (e) {
      e.textContent = message;
      e.className = error ? "notice danger" : "notice ok";
    }
  };
  let dossierId = null;
  let authorized = false;
  const fmt = (v) =>
    v
      ? new Intl.DateTimeFormat("fr-CA", {
          timeZone: "America/Toronto",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }).format(new Date(v))
      : "-";
  async function authorize() {
    const {
      data: { user },
      error,
    } = await db.auth.getUser();
    if (error || !user) return false;
    const { data, error: pe } = await db
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    return !pe && data?.role === "admin";
  }
  async function showDocuments() {
    if (!authorized || !dossierId) return;
    const body = $("madic-review-documents");
    body.innerHTML = '<tr><td colspan="5">Chargement…</td></tr>';
    const { data, error } = await db
      .from("documents")
      .select(
        "id,original_name,created_at,storage_path,review_status,review_reason",
      )
      .eq("dossier_id", dossierId)
      .order("created_at", { ascending: false });
    if (error) {
      body.innerHTML =
        '<tr><td colspan="5">Impossible de charger les documents.</td></tr>';
      return notice(error.message, true);
    }
    body.innerHTML = data?.length
      ? data
          .map(
            (d) => `<tr>
      <td>${safe(d.original_name)}</td><td>${safe(fmt(d.created_at))}</td>
      <td>${safe(d.review_status === "refuse" ? "Refusé" : d.review_status === "accepte" ? "Accepté" : "À vérifier")}</td>
      <td>${safe(d.review_reason || "-")}</td>
      <td><button type="button" class="secondary" data-open-doc="${safe(d.storage_path)}">Consulter</button>
      <button type="button" class="secondary" data-accept-doc="${safe(d.id)}">Accepter</button>
      <button type="button" class="secondary" data-reject-doc="${safe(d.id)}">Refuser</button></td>
      </tr>`,
          )
          .join("")
      : '<tr><td colspan="5">Aucun document reçu pour ce dossier.</td></tr>';
  }
  document.addEventListener("click", async (e) => {
    const view = e.target.closest("[data-view-documents]");
    if (view) {
      if (!authorized) return notice("Accès administrateur requis.", true);
      dossierId = view.dataset.viewDocuments;
      $("madic-review-panel").hidden = false;
      $("madic-review-context").textContent =
        "Dossier : " + (view.dataset.dossierReference || "");
      $("madic-review-client").textContent =
        "Client : " + (view.dataset.clientName || "Client non répertorié");
      await showDocuments();
      $("madic-review-panel").scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      return;
    }
    const open = e.target.closest("[data-open-doc]");
    if (open) {
      const { data, error } = await db.storage
        .from("madic-documents")
        .createSignedUrl(open.dataset.openDoc, 60);
      if (error) return notice("Ouverture impossible : " + error.message, true);
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
      return;
    }
    const accept = e.target.closest("[data-accept-doc]");
    const reject = e.target.closest("[data-reject-doc]");
    const button = accept || reject;
    if (!button || !authorized || !dossierId) return;
    let reason = null;
    if (reject) {
      reason = window.prompt(
        "Motif obligatoire du refus (visible par le client) :",
      );
      if (reason === null) return;
      reason = reason.trim();
      if (!reason || reason.length > 1000)
        return notice("Saisissez un motif entre 1 et 1 000 caractères.", true);
    } else if (!window.confirm("Confirmer que ce document est conforme ?"))
      return;
    button.disabled = true;
    const id = accept ? accept.dataset.acceptDoc : reject.dataset.rejectDoc;
    const { data, error } = await db.rpc("madic_review_document", {
      p_id: id,
      p_dossier_id: dossierId,
      p_status: accept ? "accepte" : "refuse",
      p_reason: reason,
    });
    button.disabled = false;
    if (error || data !== true)
      return notice(
        "Évaluation impossible : " + (error?.message || "accès refusé"),
        true,
      );
    notice(
      accept
        ? "Document accepté."
        : "Document refusé. Le motif est maintenant visible dans l’espace client.",
    );
    await showDocuments();
  });
  authorize()
    .then((ok) => {
      authorized = ok;
    })
    .catch(() => {
      authorized = false;
    });
})();
