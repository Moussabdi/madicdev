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
