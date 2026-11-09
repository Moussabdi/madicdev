/* MADIC - compteur de messages non lus du client CRIC.
   Lecture uniquement : les RLS Supabase restent la source des autorisations. */
(async () => {
  "use strict";
  const badge = document.getElementById("madicClientMessagesUnread");
  const summary = document.getElementById("madicClientMessagesSummary");
  const card = document.getElementById("madicClientMessagingCard");
  const cabinet = document.getElementById("cabinet");
  if (!badge || !summary || !card || !cabinet) return;
  if (typeof window.getMadicSupabase !== "function") return;
  const db = window.getMadicSupabase();
  const { data: auth, error: authError } = await db.auth.getUser();
  if (authError || !auth?.user) return;
  const uid = auth.user.id;
  const { data: linked, error: linkedError } = await db.rpc(
    "madic_my_cric_client_spaces",
  );
  if (linkedError || !linked?.length) return;
  const authorized = new Set(linked.map((s) => s.space_id));
  card.hidden = false;
  let sequence = 0;
  async function refresh() {
    const current = ++sequence;
    const spaceId = cabinet.value || linked[0].space_id;
    if (!authorized.has(spaceId)) {
      badge.hidden = true;
      summary.textContent = "Sélectionnez un cabinet autorisé.";
      return;
    }
    try {
      const { data: conversations, error: conversationError } = await db
        .from("madic_cric_conversations")
        .select("id")
        .eq("space_id", spaceId)
        .eq("client_id", uid);
      if (conversationError) throw conversationError;
      const ids = (conversations || []).map((c) => c.id);
      if (!ids.length) {
        if (current !== sequence) return;
        badge.hidden = true;
        summary.textContent = "Aucun message non lu.";
        return;
      }
      const [messagesResponse, readsResponse] = await Promise.all([
        db
          .from("madic_cric_messages")
          .select("id,conversation_id,sender_id,created_at")
          .in("conversation_id", ids)
          .neq("sender_id", uid)
          .order("created_at", { ascending: false })
          .limit(1000),
        db
          .from("madic_cric_message_reads")
          .select("conversation_id,last_read_at")
          .eq("user_id", uid)
          .in("conversation_id", ids),
      ]);
      if (messagesResponse.error) throw messagesResponse.error;
      if (readsResponse.error) throw readsResponse.error;
      const lastRead = new Map(
        (readsResponse.data || []).map((r) => [
          r.conversation_id,
          r.last_read_at,
        ]),
      );
      const unread = (messagesResponse.data || []).filter((m) => {
        const readAt = lastRead.get(m.conversation_id);
        return (
          !readAt ||
          new Date(m.created_at).getTime() > new Date(readAt).getTime()
        );
      }).length;
      if (current !== sequence) return;
      badge.textContent = String(unread);
      badge.hidden = unread === 0;
      summary.textContent = unread
        ? `${unread} message${unread > 1 ? "s" : ""} non lu${unread > 1 ? "s" : ""}.`
        : "Aucun message non lu.";
      if ((messagesResponse.data || []).length === 1000)
        summary.textContent +=
          " (Vérification limitée aux 1 000 messages récents.)";
    } catch (error) {
      if (current !== sequence) return;
      badge.hidden = true;
      summary.textContent =
        "Compteur indisponible : " + (error.message || String(error));
    }
  }
  cabinet.addEventListener("change", refresh);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) refresh();
  });
  window.addEventListener("focus", refresh);
  await refresh();
})();
