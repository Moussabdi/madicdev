/* MADIC - Administration des cabinets. Mutations uniquement via RPC super-admin. */
(async () => {
  "use strict";
  const rows = document.getElementById("cricSpaceRows");
  const notice = document.getElementById("cricSpaceNotice");
  if (!rows || !notice) return;
  const db = window.getMadicSupabase();
  const label = (v) =>
    ({
      free: "Gratuit",
      paid: "Payant",
      active: "Actif",
      suspended: "Suspendu",
      not_applicable: "Sans objet",
      pending: "En attente",
      paid_up: "À jour",
    })[v] ||
    v ||
    "-";
  function button(title, handler) {
    const el = document.createElement("button");
    el.type = "button";
    el.className = "secondary";
    el.textContent = title;
    el.addEventListener("click", async () => {
      if (!confirm(`Confirmer : ${title} ?`)) return;
      el.disabled = true;
      notice.textContent = "Traitement en cours…";
      try {
        await handler();
        await load();
        notice.textContent = "Opération enregistrée.";
      } catch (e) {
        notice.textContent = "Erreur : " + (e.message || String(e));
        el.disabled = false;
      }
    });
    return el;
  }
  async function rpc(action, userId, extra = {}) {
    const { error } = await db.rpc("madic_admin_manage_cabinet", {
      p_user_id: userId,
      p_action: action,
      p_plan: null,
      p_reason: null,
      ...extra,
    });
    if (error) throw error;
  }
  async function load() {
    const { data: apps, error: ae } = await db
      .from("madic_cric_applications")
      .select("user_id,full_name,license_number,status")
      .order("full_name");
    if (ae) throw ae;
    const { data: spaces, error: se } = await db
      .from("madic_cric_spaces")
      .select(
        "id,owner_user_id,name,subscription_plan,payment_status,access_status,next_payment_due",
      );
    if (se) throw se;
    const byOwner = new Map((spaces || []).map((s) => [s.owner_user_id, s]));
    rows.replaceChildren();
    const paymentRows = document.getElementById("cricPaymentRows");
    const paymentNotice = document.getElementById("cricPaymentNotice");
    if (paymentRows) paymentRows.replaceChildren();
    for (const app of apps || []) {
      if (paymentRows && app.status === "approved") {
        const ps = byOwner.get(app.user_id);
        const pr = paymentRows.insertRow();
        [
          app.full_name,
          ps?.name || "Non créé",
          label(ps?.subscription_plan),
          label(ps?.payment_status),
          ps?.next_payment_due || "-",
        ].forEach((value) => {
          pr.insertCell().textContent = value;
        });
      }
      const s = byOwner.get(app.user_id),
        tr = rows.insertRow();
      [
        app.full_name + " (" + app.license_number + ")",
        s?.name || "Non créé",
        label(s?.subscription_plan),
        label(s?.payment_status),
        label(s?.access_status),
      ].forEach((v) => (tr.insertCell().textContent = v));
      const actions = tr.insertCell();
      if (app.status !== "approved") {
        actions.textContent = "Demande non approuvée";
        continue;
      }
      if (!s) {
        actions.append(
          button("Créer le cabinet", () => rpc("create", app.user_id)),
        );
        continue;
      }
      const plan = document.createElement("select");
      plan.setAttribute("aria-label", "Formule de " + app.full_name);
      for (const [value, text] of [
        ["free", "Gratuit"],
        ["paid", "Payant"],
      ]) {
        const opt = document.createElement("option");
        opt.value = value;
        opt.textContent = text;
        plan.append(opt);
      }
      plan.value = s.subscription_plan;
      actions.append(
        plan,
        document.createTextNode(" "),
        button("Modifier la formule", () =>
          rpc("plan", app.user_id, { p_plan: plan.value }),
        ),
      );
      actions.append(document.createTextNode(" "));
      if (s.access_status === "active")
        actions.append(
          button("Suspendre", async () => {
            const reason = prompt("Motif de suspension (obligatoire) :");
            if (!reason?.trim()) throw new Error("Motif obligatoire.");
            await rpc("suspend", app.user_id, { p_reason: reason.trim() });
          }),
        );
      else
        actions.append(button("Activer", () => rpc("activate", app.user_id)));
    }
    if (!apps?.length) {
      const td = rows.insertRow().insertCell();
      td.colSpan = 6;
      td.textContent = "Aucun consultant enregistré.";
    }
    if (paymentRows && !paymentRows.rows.length) {
      const td = paymentRows.insertRow().insertCell();
      td.colSpan = 5;
      td.textContent = "Aucun abonnement CRIC approuvé à afficher.";
    }
    if (paymentNotice)
      paymentNotice.textContent =
        "Statuts administratifs des abonnements chargés. Aucun paiement n’est confirmé depuis cette page.";
  }
  try {
    const { data: auth, error: authError } = await db.auth.getUser();
    if (authError || !auth?.user) throw Error("Session non authentifiée.");
    const { data: isAdmin, error: adminError } = await db.rpc(
      "madic_is_super_admin",
    );
    if (adminError) throw adminError;
    if (isAdmin !== true) throw Error("Accès réservé au super administrateur.");
    await load();
    notice.textContent = "Gestion des cabinets disponible.";
  } catch (e) {
    notice.textContent = "Chargement impossible : " + (e.message || String(e));
  }
})();
