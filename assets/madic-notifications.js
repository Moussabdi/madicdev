/* MADIC 7.8 - Notifications de messagerie dans les tableaux de bord.
   Aucune cle privilegiee; requetes soumises aux politiques RLS Supabase. */
(async () => {
  "use strict";
  const page = location.pathname.split("/").pop().toLowerCase();
  const client = page === "dashboard-client-cric.html";
  const cric = page === "cric-dashboard.html";
  if ((!client && !cric) || typeof window.getMadicSupabase !== "function")
    return;
  const db = window.getMadicSupabase();
  const { data: auth, error: authError } = await db.auth.getUser();
  if (authError || !auth?.user) return;
  const uid = auth.user.id;
  const destination = client
    ? "messagerie-client-cric.html"
    : "messagerie-cric.html";
  let previousUnread = null;
  let busy = false;
  let stopped = false;
  let dismissedAtCount = null;

  const toast = document.createElement("aside");
  toast.setAttribute("role", "status");
  toast.setAttribute("aria-live", "polite");
  toast.setAttribute("aria-atomic", "true");
  toast.hidden = true;
  toast.style.cssText =
    "position:fixed;right:16px;bottom:16px;z-index:9999;width:min(360px,calc(100vw - 32px));box-sizing:border-box;background:#123047;color:white;padding:16px;border-radius:12px;box-shadow:0 8px 24px #0005;font:14px/1.5 system-ui,sans-serif";
  const heading = document.createElement("strong");
  heading.textContent = "Nouveau message MADIC";
  const count = document.createElement("p");
  count.style.cssText = "margin:8px 0 12px";
  const actions = document.createElement("div");
  actions.style.cssText =
    "display:flex;gap:12px;align-items:center;justify-content:space-between";
  const open = document.createElement("a");
  open.href = destination;
  open.textContent = "Consulter la messagerie";
  open.style.cssText = "color:#fff;text-decoration:underline;font-weight:600";
  const dismiss = document.createElement("button");
  dismiss.type = "button";
  dismiss.textContent = "Fermer";
  dismiss.setAttribute("aria-label", "Fermer la notification de messagerie");
  dismiss.style.cssText =
    "background:transparent;border:1px solid #ffffffa0;border-radius:6px;padding:6px 10px;color:white;cursor:pointer";
  dismiss.addEventListener("click", () => {
    dismissedAtCount = previousUnread;
    toast.hidden = true;
  });
  actions.append(open, dismiss);
  toast.append(heading, count, actions);
  document.body.append(toast);

  async function conversationIds() {
    if (client) {
      const { data: linked, error } = await db.rpc(
        "madic_my_cric_client_spaces",
      );
      if (error) throw error;
      const spaceIds = [
        ...new Set((linked || []).map((x) => x.space_id).filter(Boolean)),
      ];
      if (!spaceIds.length) return [];
      const result = await db
        .from("madic_cric_conversations")
        .select("id")
        .eq("client_id", uid)
        .in("space_id", spaceIds)
        .limit(200);
      if (result.error) throw result.error;
      return (result.data || []).map((x) => x.id);
    }
    const spaces = await db
      .from("madic_cric_spaces")
      .select("id")
      .eq("owner_user_id", uid)
      .eq("access_status", "active")
      .limit(1);
    if (spaces.error) throw spaces.error;
    if (!spaces.data?.length) return [];
    const spaceId = spaces.data[0].id;
    const allowed = await db.rpc("madic_can_manage_cric_space", {
      p_space_id: spaceId,
    });
    if (allowed.error) throw allowed.error;
    if (allowed.data !== true) return [];
    const result = await db
      .from("madic_cric_conversations")
      .select("id")
      .eq("space_id", spaceId)
      .limit(200);
    if (result.error) throw result.error;
    return (result.data || []).map((x) => x.id);
  }

  async function refresh() {
    if (busy || stopped || document.hidden) return;
    busy = true;
    try {
      const ids = await conversationIds();
      let unread = 0;
      if (ids.length) {
        const [messages, reads] = await Promise.all([
          db
            .from("madic_cric_messages")
            .select("conversation_id,sender_id,created_at")
            .in("conversation_id", ids)
            .order("created_at", { ascending: false })
            .limit(1000),
          db
            .from("madic_cric_message_reads")
            .select("conversation_id,last_read_at")
            .eq("user_id", uid)
            .in("conversation_id", ids),
        ]);
        if (messages.error) throw messages.error;
        if (reads.error) throw reads.error;
        const lastRead = new Map(
          (reads.data || []).map((r) => [r.conversation_id, r.last_read_at]),
        );
        unread = (messages.data || []).filter(
          (m) =>
            m.sender_id !== uid &&
            (!lastRead.has(m.conversation_id) ||
              new Date(m.created_at) >
                new Date(lastRead.get(m.conversation_id))),
        ).length;
      }
      if (
        previousUnread !== null &&
        unread > previousUnread &&
        unread !== dismissedAtCount
      ) {
        count.textContent = `${unread} message${unread > 1 ? "s" : ""} non lu${unread > 1 ? "s" : ""}.`;
        toast.hidden = false;
        dismissedAtCount = null;
      }
      if (unread === 0) {
        toast.hidden = true;
        dismissedAtCount = null;
      }
      if (unread < previousUnread && !toast.hidden) {
        count.textContent = `${unread} message${unread > 1 ? "s" : ""} non lu${unread > 1 ? "s" : ""}.`;
      }
      if (client) {
        const badge = document.getElementById("madicHeroUnread");
        if (badge) {
          badge.hidden = unread === 0;
          badge.textContent = unread > 99 ? "99+" : String(unread);
        }
      }
      previousUnread = unread;
    } catch (error) {
      console.warn(
        "MADIC notifications : verification indisponible :",
        error?.message || String(error),
      );
    } finally {
      busy = false;
    }
  }
  await refresh();
  const timer = window.setInterval(() => {
    void refresh();
  }, 15000);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) void refresh();
  });
  window.addEventListener("pageshow", () => {
    void refresh();
  });
  window.addEventListener(
    "pagehide",
    () => {
      stopped = true;
      window.clearInterval(timer);
    },
    { once: true },
  );
})();
