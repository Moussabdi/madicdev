import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const cors = {
  "Access-Control-Allow-Origin": "https://madic.ca",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      ...cors,
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
const sha256 = async (value: string) =>
  Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
    ),
  )
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST")
    return reply({ error: "Méthode non autorisée" }, 405);
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const anon = Deno.env.get("SUPABASE_ANON_KEY");
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !anon || !service)
      return reply({ error: "Configuration serveur incomplète" }, 500);
    const bearer = req.headers.get("Authorization") || "";
    if (!/^Bearer\s+\S+$/i.test(bearer))
      return reply({ error: "Authentification requise" }, 401);
    const jwt = bearer.replace(/^Bearer\s+/i, "");
    const authClient = createClient(url, anon, {
      auth: { persistSession: false },
    });
    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser(jwt);
    if (authError || !user || !user.email || !user.email_confirmed_at)
      return reply(
        { error: "Confirmez votre adresse courriel et connectez-vous." },
        401,
      );
    const body = await req.json();
    const token = String(body.token || "");
    if (!/^[a-f0-9-]{72}$/.test(token))
      return reply({ error: "Référence de prévalidation invalide" }, 400);
    const admin = createClient(url, service, {
      auth: { persistSession: false },
    });
    const { error } = await admin.rpc("madic_submit_verified_cric", {
      p_user_id: user.id,
      p_email: user.email,
      p_token_hash: await sha256(token),
    });
    if (error) {
      console.error("CRIC application rejected:", error.message);
      return reply(
        {
          error:
            "Impossible de finaliser la demande : prévalidation non admissible, expirée ou déjà utilisée.",
        },
        409,
      );
    }
    return reply({ success: true, status: "pending" });
  } catch (error) {
    console.error("CRIC submission error:", error);
    return reply({ error: "Erreur serveur lors de la soumission." }, 500);
  }
});
