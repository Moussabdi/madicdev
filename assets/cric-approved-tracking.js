/* Suivi administratif des prévalidations approuvées. Aucune création de compte. */
(async () => {
  "use strict";
  const body = document.getElementById("cricApprovedPrevalidations");
  const notice = document.getElementById("cricApprovedNotice");
  if (!body) return;
  const show = (message) => {
    if (notice) notice.textContent = message;
  };
  const cell = (row, value) => {
    const td = row.insertCell();
    td.textContent = String(value ?? "-");
    return td;
  };
  try {
    const db = window.getMadicSupabase?.();
    if (!db) throw new Error("Configuration Supabase indisponible.");
    const { data: auth, error: authError } = await db.auth.getUser();
    if (authError || !auth?.user)
      throw new Error("Connexion administrateur requise.");
    const { data: isOwner, error: roleError } = await db.rpc(
      "madic_is_super_admin",
    );
    if (roleError || isOwner !== true)
      throw new Error("Accès réservé au super administrateur.");
    const [pre, apps] = await Promise.all([
      db.rpc("madic_admin_list_cric_prevalidations"),
      db
        .from("madic_cric_applications")
        .select("user_id,license_number,status"),
    ]);
    if (pre.error) throw pre.error;
    if (apps.error) throw apps.error;
    const approved = (pre.data || []).filter(
      (item) => item.status === "approved",
    );
    const accounts = new Map(
      (apps.data || []).map((item) => [
        String(item.license_number).toUpperCase(),
        item,
      ]),
    );
    body.replaceChildren();
    if (!approved.length) {
      const row = body.insertRow();
      cell(row, "Aucune prévalidation approuvée.").colSpan = 6;
      return;
    }
    for (const item of approved) {
      const row = body.insertRow();
      const account = accounts.get(String(item.license_number).toUpperCase());
      cell(row, item.full_name);
      cell(row, item.license_number);
      cell(row, item.registry_verified ? "Confirmée" : "Non confirmée");
      cell(row, "Approuvée par MADIC");
      cell(
        row,
        !account
          ? "Aucun compte associé"
          : account.status === "approved"
            ? "Compte autorisé"
            : `Compte : ${account.status}`,
      );
      cell(
        row,
        !account
          ? "Invitation / association sécurisée à effectuer"
          : "Voir le tableau des comptes ci-dessus",
      );
    }
  } catch (e) {
    show("Impossible de charger le suivi CRIC : " + (e?.message || String(e)));
    body.replaceChildren();
    const row = body.insertRow();
    cell(row, "Données indisponibles.").colSpan = 6;
  }
})();
