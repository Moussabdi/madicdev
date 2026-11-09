/* Accès administrateur pour les pages d'accueil et CRIC. La RLS Supabase reste obligatoire. */
(async () => {
  const msg = document.getElementById("adminHomeMessage");
  const home = document.getElementById("adminHome");
  const conf = window.MADIC_CONFIG;
  if (!conf?.url || !conf?.anonKey || !window.supabase) {
    msg.textContent = "Configuration Supabase indisponible.";
    return;
  }
  const db = window.getMadicSupabase();
  try {
    const { data: authData, error: authError } = await db.auth.getUser();
    if (authError || !authData?.user) {
      location.replace("connexion.html");
      return;
    }
    const { data: isSuperAdmin, error: roleError } = await db.rpc("madic_is_super_admin");
    if (roleError || isSuperAdmin !== true) {
      location.replace("cric-dashboard.html");
      return;
    }
    home.hidden = false;
    msg.hidden = true;
    document.getElementById("logout")?.addEventListener("click", async () => {
      await db.auth.signOut();
      location.href = "connexion.html";
    });
  } catch (error) {
    msg.textContent = "Impossible de vérifier votre accès : " + (error.message || String(error));
  }
})();
