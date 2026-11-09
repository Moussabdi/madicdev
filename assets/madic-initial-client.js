(() => {
  "use strict";
  const root = document.getElementById("madic-contracts");
  if (!root || root.dataset.mode !== "client") return;
  const db = window.getMadicSupabase?.();
  const esc = (s) =>
    String(s ?? "").replace(
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
  async function load() {
    if (!db) return;
    const {
      data: { user },
      error: authError,
    } = await db.auth.getUser();
    if (authError || !user) return;
    const { data, error } = await db
      .from("madic_initial_contracts")
      .select("id,status,created_at")
      .eq("client_id", user.id)
      .in("status", ["publie", "signe"])
      .order("created_at", { ascending: false });
    let host = document.getElementById("madic-initial-contracts");
    if (!host) {
      host = document.createElement("section");
      host.id = "madic-initial-contracts";
      host.className = "madic-initial-contracts";
      root.prepend(host);
    }
    if (error) {
      host.innerHTML =
        "<p>Les contrats initiaux ne peuvent pas être chargés : " +
        esc(error.message) +
        "</p>";
      return;
    }
    const items = data || [];
    host.innerHTML =
      "<h2>Contrats de consultation initiale</h2>" +
      (items.length
        ? items
            .map(
              (x) =>
                '<div class="madic-initial-item"><strong>Contrat initial · ' +
                esc(new Date(x.created_at).toLocaleDateString("fr-CA")) +
                "</strong> - " +
                esc(x.status) +
                ' <a class="madic-initial-open" href="contrat-initial-client.html?id=' +
                encodeURIComponent(x.id) +
                '">Consulter' +
                (x.status === "publie" ? " et signer" : "") +
                "</a></div>",
            )
            .join("")
        : "<p>Aucun contrat initial activé.</p>");
  }
  load().catch((e) => {
    const el = document.getElementById("contract-message");
    if (el) el.textContent = e.message;
  });
})();
