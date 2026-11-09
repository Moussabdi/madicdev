const conf = window.MADIC_CONFIG;
const $ = (s) => document.querySelector(s);
const status = (text, error = false) => {
  const e = $("#message");
  if (e) {
    e.textContent = text;
    e.className = error ? "notice danger" : "notice ok";
  }
};
const safe = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const ready =
  conf &&
  /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(conf.url) &&
  !conf.anonKey.includes("YOUR_") &&
  window.supabase;
if (!ready)
  status(
    "Configuration Supabase manquante. Consultez le fichier README.md.",
    true,
  );
const db = ready ? window.getMadicSupabase() : null;
async function user() {
  if (!db) return null;
  const { data, error } = await db.auth.getUser();
  if (error) return null;
  return data.user;
}
async function protect() {
  const u = await user();
  if (!u) {
    location.replace("connexion.html");
    return null;
  }
  return u;
}
async function signOut() {
  if (db) await db.auth.signOut();
  location.href = "connexion.html";
}
$("#logout")?.addEventListener("click", signOut);
const page = document.body.dataset.page;
// Les clients ne peuvent pas creer de compte depuis la page publique.
// L'activation sur invitation doit etre geree par un parcours securise cote serveur.
if (page === "signup") {
  $("#signup")?.addEventListener("submit", (e) => {
    e.preventDefault();
    status(
      "L'inscription libre est desactivee. Contactez votre consultant CRIC pour recevoir une invitation.",
      true,
    );
  });
}
// Routage selon les droits confirmés par Supabase (jamais selon le formulaire local).
async function cricDestination(uid) {
  const { data: application, error: appError } = await db
    .from("madic_cric_applications")
    .select("status")
    .eq("user_id", uid)
    .maybeSingle();
  if (appError) throw appError;
  const { data: isOwner, error: ownerError } = await db.rpc(
    "madic_is_super_admin",
  );
  if (ownerError) throw ownerError;
  return isOwner
    ? "administration.html"
    : application
      ? "cric-dashboard.html"
      : "dashboard.html";
}
if (page === "login") {
  $("#login")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!db) return;
    const f = e.currentTarget;
    const { data, error } = await db.auth.signInWithPassword({
      email: f.elements.namedItem("email").value.trim(),
      password: f.elements.namedItem("password").value,
    });
    if (error) return status(error.message, true);
    try {
      location.replace(await cricDestination(data.user.id));
    } catch (err) {
      status(
        "Connexion réussie, mais vérification des droits impossible : " +
          err.message,
        true,
      );
    }
  });
  $("#forgot")?.addEventListener("click", async () => {
    if (!db) return;
    const email = $("#email").value.trim();
    if (!email) return status("Saisissez votre courriel.", true);
    const { error } = await db.auth.resetPasswordForEmail(email, {
      redirectTo: new URL("reset.html", location.href).href,
    });
    status(
      error
        ? error.message
        : "Si le compte existe, un courriel de réinitialisation sera envoyé.",
      !!error,
    );
  });
}
if (page === "reset") {
  $("#reset")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!db) return;
    const { error } = await db.auth.updateUser({
      password: e.currentTarget.password.value,
    });
    status(
      error
        ? error.message
        : "Mot de passe mis à jour. Vous pouvez vous connecter.",
      !!error,
    );
  });
}
if (page === "dashboard") {
  (async () => {
    const u = await protect();
    if (!u) return;
    try {
      const destination = await cricDestination(u.id);
      if (destination !== "dashboard.html") {
        location.replace(destination);
        return;
      }
    } catch (err) {
      status("Vérification des droits impossible : " + err.message, true);
      return;
    }
    const { data: p, error: pe } = await db
      .from("profiles")
      .select("first_name,last_name,email,phone,country,role")
      .eq("id", u.id)
      .single();
    if (pe) return status(pe.message, true);
    $("#welcome").textContent = "Bienvenue, " + (p.first_name || "client");
    $("#first").value = p.first_name;
    $("#last").value = p.last_name;
    $("#email").value = p.email;
    $("#phone").value = p.phone;
    $("#country").value = p.country;
    if (p.role === "admin") $("#adminLink").classList.remove("hidden");
    $("#profile")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = e.currentTarget;
      const { error } = await db
        .from("profiles")
        .update({
          first_name: f.elements.namedItem("first").value.trim(),
          last_name: f.elements.namedItem("last").value.trim(),
          phone: f.elements.namedItem("phone").value.trim(),
          country: f.elements.namedItem("country").value.trim(),
        })
        .eq("id", u.id);
      status(error ? error.message : "Profil enregistré.", !!error);
    });
    const { data: dossiers, error: de } = await db
      .from("dossiers")
      .select("id,reference,category,status,created_at")
      .eq("client_id", u.id)
      .is("space_id", null)
      .order("created_at", { ascending: false });
    if (de) return status(de.message, true);
    $("#dossiers").innerHTML = dossiers.length
      ? dossiers
          .map(
            (d) =>
              `<tr><td>${safe(d.reference)}</td><td>${safe(d.category)}</td><td>${safe(d.status)}</td></tr>`,
          )
          .join("")
      : '<tr><td colspan="3">Aucun dossier accessible. Veuillez communiquer avec votre consultant CRIC.</td></tr>';
    const active = dossiers.filter((d) => d.status === "actif");
    $("#dossier").innerHTML = active.length
      ? active
          .map(
            (d) =>
              `<option value="${safe(d.id)}">${safe(d.reference)} - ${safe(d.category)}</option>`,
          )
          .join("")
      : '<option value="">Aucun dossier actif</option>';
    $("#uploadButton").disabled = !active.length;
    await loadDocs();
    async function loadDocs() {
      const ids = dossiers.map((d) => d.id);
      if (!ids.length) {
        $("#documents").innerHTML =
          '<tr><td colspan="3">Aucun document MADIC.</td></tr>';
        return;
      }
      const { data: docs, error } = await db
        .from("documents")
        .select("id,original_name,status,created_at,storage_path")
        .eq("client_id", u.id)
        .in("dossier_id", ids)
        .order("created_at", { ascending: false });
      if (error) return status(error.message, true);
      $("#documents").innerHTML = docs.length
        ? docs
            .map(
              (d) =>
                `<tr><td>${safe(d.original_name)}</td><td>${safe(d.status)}</td><td><button class="secondary" type="button" data-path="${safe(d.storage_path)}">Télécharger</button></td></tr>`,
            )
            .join("")
        : '<tr><td colspan="3">Aucun document transmis.</td></tr>';
    }
    $("#documents").addEventListener("click", async (e) => {
      const b = e.target.closest("button[data-path]");
      if (!b) return;
      const { data, error } = await db.storage
        .from("madic-documents")
        .createSignedUrl(b.dataset.path, 60);
      if (error) return status(error.message, true);
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    });
    $("#upload")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!active.length) return;
      const f = e.currentTarget,
        file = f.elements.namedItem("file").files[0],
        dossierId = f.elements.namedItem("dossier").value;
      if (!file) return status("Sélectionnez un fichier.", true);
      if (
        !["application/pdf", "image/jpeg", "image/png"].includes(file.type) ||
        file.size > 10 * 1024 * 1024 ||
        file.size === 0
      )
        return status("PDF, JPG ou PNG uniquement, 10 Mo maximum.", true);
      if (!active.some((d) => d.id === dossierId))
        return status("Dossier invalide.", true);
      const path = `${u.id}/${dossierId}/${crypto.randomUUID()}`;
      $("#uploadButton").disabled = true;
      const { error: upErr } = await db.storage
        .from("madic-documents")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) {
        $("#uploadButton").disabled = false;
        return status(upErr.message, true);
      }
      const { error: dbErr } = await db.from("documents").insert({
        dossier_id: dossierId,
        client_id: u.id,
        original_name: file.name.slice(0, 240),
        storage_path: path,
        mime_type: file.type,
        size_bytes: file.size,
      });
      $("#uploadButton").disabled = false;
      if (dbErr)
        return status(
          "Fichier transféré, mais enregistrement incomplet. Contactez votre consultant CRIC. Référence: " +
            path,
          true,
        );
      f.reset();
      status("Document transmis.");
      await loadDocs();
    });
  })();
}
if (page === "admin") {
  (async () => {
    const u = await protect();
    if (!u) return;
    const { data: p } = await db
      .from("profiles")
      .select("role")
      .eq("id", u.id)
      .single();
    if (p?.role !== "admin") {
      location.replace("dashboard.html");
      return;
    }
    const { data: clients, error } = await db
      .from("profiles")
      .select("id,first_name,last_name,email,created_at")
      .eq("role", "client")
      .order("created_at", { ascending: false });
    if (error) return status(error.message, true);
    $("#clients").innerHTML = clients
      .map(
        (c) =>
          `<tr><td>${safe(c.first_name)} ${safe(c.last_name)}</td><td>${safe(c.email)}</td><td>${safe(new Date(c.created_at).toLocaleDateString("fr-CA"))}</td></tr>`,
      )
      .join("");
    $("#client").innerHTML = clients
      .map(
        (c) =>
          `<option value="${safe(c.id)}">${safe(c.first_name)} ${safe(c.last_name)} - ${safe(c.email)}</option>`,
      )
      .join("");
    $("#createDossier")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = e.currentTarget;
      const { error } = await db.from("dossiers").insert({
        client_id: f.elements.namedItem("client").value,
        reference: f.elements.namedItem("reference").value.trim(),
        category: f.elements.namedItem("category").value.trim(),
        status: f.elements.namedItem("status").value,
      });
      status(
        error
          ? error.message
          : "Dossier créé. Le client peut maintenant le consulter.",
        !!error,
      );
      if (!error) f.reset();
    });
  })();
}
