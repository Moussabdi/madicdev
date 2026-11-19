const endpoint = "https://ezijsozitnydhjkxzqem.supabase.co";
const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

export const config = { path: "/api/madic-radar-session" };

export default async function (request, context) {
  const respond = (status) =>
    new Response(null, { status, headers: { "Cache-Control": "no-store" } });
  if (request.method !== "POST") return respond(405);
  const authorization = request.headers.get("authorization");
  const token = authorization?.match(/^Bearer ([A-Za-z0-9._-]{1,10000})$/)?.[1];
  if (!token) return respond(401);
  const apiKey = Netlify.env.get("MADIC_RADAR_SUPABASE_KEY");
  if (!apiKey?.startsWith("sb_secret_")) return respond(503);

  try {
    const actor = new URL(request.url).searchParams.get("actor");
    if (actor !== "cric" && actor !== "client") return respond(400);
    const verified = await fetch(endpoint + "/auth/v1/user", {
      headers: { apikey: apiKey, Authorization: authorization },
      signal: AbortSignal.timeout(5000),
    });
    if (!verified.ok)
      return respond(
        verified.status === 401 || verified.status === 403 ? 401 : 503,
      );
    const user = await verified.json();
    // Les claims de ce même jeton sont lus seulement après sa validation par Supabase Auth.
    const raw = token.split(".")[1].replaceAll("-", "+").replaceAll("_", "/");
    const claims = JSON.parse(atob(raw));
    if (
      claims.sub !== user.id ||
      claims.aal !== "aal2" ||
      !uuid.test(claims.session_id || "")
    )
      return respond(403);
    const country = context.geo?.country?.code;
    const saved = await fetch(
      endpoint + "/rest/v1/rpc/madic_radar_record_session",
      {
        method: "POST",
        headers: { apikey: apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({
          p_user: user.id,
          p_session: claims.session_id,
          p_country: /^[A-Z]{2}$/.test(country || "") ? country : null,
          p_actor: actor,
        }),
        signal: AbortSignal.timeout(5000),
      },
    );
    return respond(saved.ok ? 204 : 503);
  } catch {
    return respond(503);
  }
}
