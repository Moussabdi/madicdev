(async () => {
  "use strict";
  const $ = (id) => document.getElementById(id),
    statuses = ["en_attente", "actif", "ferme"],
    labels = { en_attente: "En attente", actif: "Actif", ferme: "Fermé" };
  const notice = (t) => {
    $("kbMessage").textContent = t;
  };
  const cfg = window.MADIC_CONFIG;
  if (
    !cfg?.url ||
    !cfg?.anonKey ||
    !window.supabase ||
    typeof window.getMadicSupabase !== "function"
  )
    return notice("Configuration Supabase manquante.");
  const db = window.getMadicSupabase();
  let space = null,
    records = [],
    saving = false;
  $("kbLogout").addEventListener("click", async () => {
    await db.auth.signOut();
    location.replace("connexion-cric.html");
  });
  function render() {
    const counts = { en_attente: 0, actif: 0, ferme: 0 };
    for (const item of records) if (Object.prototype.hasOwnProperty.call(counts, item.status)) counts[item.status]++;
    for (const [id, value] of [["kbTotal", records.length], ["kbSummaryWaiting", counts.en_attente], ["kbSummaryActive", counts.actif], ["kbSummaryClosed", counts.ferme]]) {
      $(id).textContent = String(value);
    }
    const q = $("kbSearch").value.trim().toLocaleLowerCase("fr");
    for (const s of statuses) {
      const list = $("kbList-" + s);
      list.replaceChildren();
      const matches = records.filter(
        (d) =>
          d.status === s &&
          [d.reference, d.category]
            .join(" ")
            .toLocaleLowerCase("fr")
            .includes(q),
      );
      $("kbCount-" + s).textContent = "(" + matches.length + ")";
      for (const d of matches) {
        const card = document.createElement("article");
        card.className = "kb-card";
        card.draggable = true;
        card.dataset.id = d.id;
        const title = document.createElement("strong");
        title.textContent = d.reference || "Dossier";
        const cat = document.createElement("p");
        cat.textContent = d.category || "Sans catégorie";
        const label = document.createElement("label");
        label.textContent = "Statut";
        const select = document.createElement("select");
        for (const value of statuses) {
          const opt = document.createElement("option");
          opt.value = value;
          opt.textContent = labels[value];
          select.append(opt);
        }
        select.value = d.status;
        select.addEventListener("change", () => changeStatus(d, select.value));
        label.append(select);
        card.append(title, cat, label);
        card.addEventListener("dragstart", (event) => {
          event.dataTransfer.setData("text/plain", d.id);
          event.dataTransfer.effectAllowed = "move";
        });
        list.append(card);
      }
      if (!matches.length) {
        const empty = document.createElement("p");
        empty.className = "kb-empty";
        empty.textContent = "Aucun dossier";
        list.append(empty);
      }
    }
  }
  async function load() {
    const { data, error } = await db
      .from("dossiers")
      .select("id,reference,category,status")
      .eq("space_id", space.id)
      .order("created_at", { ascending: false });
    if (error) throw error;
    records = data || [];
    render();
    notice(records.length + " dossier(s) visibles dans votre espace CRIC.");
  }
  async function changeStatus(d, next) {
    if (saving || !statuses.includes(next)) return render();
    if (next === d.status) return;
    saving = true;
    notice("Enregistrement du statut…");
    try {
      const { data, error } = await db
        .from("dossiers")
        .update({ status: next })
        .eq("id", d.id)
        .eq("space_id", space.id)
        .select("id,status");
      if (error) throw error;
      if (!data || data.length !== 1 || data[0].status !== next)
        throw Error(
          "Modification non confirmée. Vérifiez les autorisations RLS.",
        );
      d.status = next;
      render();
      notice(
        "Statut enregistré : " +
          (d.reference || "Dossier") +
          " - " +
          labels[next] +
          ".",
      );
    } catch (e) {
      render();
      notice("Statut non modifié : " + (e.message || String(e)));
    } finally {
      saving = false;
    }
  }
  for (const column of document.querySelectorAll(".kb-column")) {
    column.addEventListener("dragover", (e) => {
      e.preventDefault();
      column.classList.add("kb-over");
    });
    column.addEventListener("dragleave", () =>
      column.classList.remove("kb-over"),
    );
    column.addEventListener("drop", async (e) => {
      e.preventDefault();
      column.classList.remove("kb-over");
      const id = e.dataTransfer.getData("text/plain"),
        d = records.find((x) => x.id === id);
      if (d) await changeStatus(d, column.dataset.status);
    });
  }
  $("kbSearch").addEventListener("input", render);
  $("kbRefresh").addEventListener("click", () =>
    load().catch((e) => notice("Actualisation impossible : " + e.message)),
  );
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
    if (app?.status !== "approved") throw Error("Compte CRIC non approuvé.");
    const { data: spaces, error: spaceError } = await db
      .from("madic_cric_spaces")
      .select("id,name,access_status")
      .eq("owner_user_id", uid)
      .limit(1);
    if (spaceError) throw spaceError;
    space = spaces?.[0];
    if (!space || space.access_status !== "active")
      throw Error("Espace CRIC absent ou suspendu.");
    const { data: allowed, error: permissionError } = await db.rpc(
      "madic_can_manage_cric_space",
      { p_space_id: space.id },
    );
    if (permissionError || allowed !== true)
      throw Error("Accès à cet espace refusé.");
    $("kbSpace").textContent = "Cabinet : " + space.name;
    $("kbWorkspace").hidden = false;
    await load();
  } catch (e) {
    notice("Accès impossible : " + (e.message || String(e)));
  }
})();
