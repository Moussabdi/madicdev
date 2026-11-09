(async () => {
  "use strict";
  const box = document.getElementById("madic-client-prefill");
  if (!box) return;
  const status = document.getElementById("madic-client-prefill-status");
  try {
    const db =
      window.getMadicSupabase?.() ||
      (window.MADIC_CONFIG?.url &&
        window.MADIC_CONFIG?.anonKey &&
        window.supabase?.createClient(
          window.MADIC_CONFIG.url,
          window.MADIC_CONFIG.anonKey,
        ));
    if (!db) throw Error("Configuration Supabase indisponible");
    const {
      data: { user },
      error: authError,
    } = await db.auth.getUser();
    if (authError || !user)
      throw Error("Veuillez vous connecter à votre espace client");
    const { data: profile, error: profileError } = await db
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();
    if (profileError) throw profileError;
    const result = await window.MADIC_CONTRAT_PREFILL.load(
      db,
      user.id,
      profile || { email: user.email },
    );
    if (result.error)
      status.textContent =
        "Formulaire préliminaire indisponible : données du profil affichées.";
    else
      status.textContent = result.intake
        ? "Renseignements récupérés depuis votre formulaire préliminaire."
        : "Aucun formulaire préliminaire trouvé : données du profil affichées.";
    const names = {
      prenom: "Prénom",
      nom: "Nom",
      courriel: "Courriel",
      telephone: "Téléphone",
      naissance: "Date de naissance",
      adresse: "Adresse",
      lieu: "Ville",
      objet: "Projet d’immigration",
    };
    for (const [key, label] of Object.entries(names)) {
      const p = document.createElement("p"),
        b = document.createElement("strong");
      b.textContent = label + " : ";
      p.append(b, document.createTextNode(result.values[key] || "À compléter"));
      box.append(p);
    }
  } catch (e) {
    status.textContent =
      "Impossible de charger vos renseignements : " + e.message;
  }
})();
