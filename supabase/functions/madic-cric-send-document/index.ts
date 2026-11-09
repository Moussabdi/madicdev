import { createClient } from "npm:@supabase/supabase-js@2";

const allowedOrigins = new Set(["https://madic.ca", "https://www.madic.ca"]);
const corsHeaders = (request: Request): Record<string, string> => {
  const origin = request.headers.get("Origin") || "";
  return {
    ...(allowedOrigins.has(origin)
      ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" }
      : {}),
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "authorization, apikey, content-type, x-client-info, x-supabase-api-version",
    "Access-Control-Max-Age": "86400",
  };
};
const json = (request: Request, body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(request),
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(request) });
  }
  if (!allowedOrigins.has(request.headers.get("Origin") || ""))
    return json(request, { error: "Origine non autorisée." }, 403);
  if (request.method !== "POST")
    return json(request, { error: "Méthode non autorisée." }, 405);
  const auth = request.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer "))
    return json(request, { error: "Connexion requise." }, 401);
  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anon || !service)
    return json(request, { error: "Configuration serveur manquante." }, 500);
  const userDb = createClient(url, anon, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const adminDb = createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  try {
    const { data: identity, error: identityError } = await userDb.auth.getUser(
      auth.slice(7),
    );
    if (identityError || !identity.user)
      return json(request, { error: "Session invalide." }, 401);
    const form = await request.formData();
    const clientId = form.get("client_id");
    const dossierId = form.get("dossier_id");
    const title = form.get("title");
    const file = form.get("file");
    const uuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (
      typeof clientId !== "string" ||
      !uuid.test(clientId) ||
      typeof dossierId !== "string" ||
      !uuid.test(dossierId) ||
      !(file instanceof File) ||
      !["application/pdf", "image/jpeg", "image/png"].includes(file.type) ||
      file.size < 1 ||
      file.size > 10 * 1024 * 1024 ||
      typeof title !== "string" ||
      !title.trim() ||
      title.length > 200
    ) {
      return json(
        request,
        { error: "Document ou dossier invalide (PDF/JPG/PNG, 10 Mo maximum)." },
        400,
      );
    }
    // The authenticated user's own RLS context checks CRIC ownership and approval.
    const { data: dossier, error: dossierError } = await userDb
      .from("dossiers")
      .select("id,client_id,space_id,status")
      .eq("id", dossierId)
      .eq("client_id", clientId)
      .maybeSingle();
    if (
      dossierError ||
      !dossier ||
      dossier.status !== "actif" ||
      !dossier.space_id
    )
      return json(
        request,
        { error: "Dossier actif introuvable ou inaccessible." },
        403,
      );
    const { data: allowed, error: accessError } = await userDb.rpc(
      "madic_can_manage_cric_space",
      {
        p_space_id: dossier.space_id,
      },
    );
    if (accessError || allowed !== true)
      return json(
        request,
        { error: "Vous ne pouvez pas gérer cet espace CRIC." },
        403,
      );
    // Ensure the recipient is associated with the same CRIC space.
    const { data: linked, error: linkError } = await userDb
      .from("madic_cric_clients")
      .select("client_id")
      .eq("space_id", dossier.space_id)
      .eq("client_id", clientId)
      .maybeSingle();
    if (linkError || !linked)
      return json(
        request,
        { error: "Client non associé à cet espace CRIC." },
        403,
      );
    // Do not trust browser-supplied paths; create one server-side.
    const path = `${clientId}/${dossierId}/cric-${crypto.randomUUID()}`;
    const { error: uploadError } = await adminDb.storage
      .from("madic-documents")
      .upload(path, file, { contentType: file.type, upsert: false });
    if (uploadError)
      return json(
        request,
        { error: `Téléversement impossible : ${uploadError.message}` },
        400,
      );
    // Service role is only used after the user's identity and dossier access are verified.
    const { error: insertError } = await adminDb.from("documents").insert({
      dossier_id: dossierId,
      client_id: clientId,
      original_name: title.trim(),
      storage_path: path,
      mime_type: file.type,
      size_bytes: file.size,
    });
    if (insertError) {
      const { error: cleanupError } = await adminDb.storage
        .from("madic-documents")
        .remove([path]);
      return json(
        request,
        {
          error: `Enregistrement impossible : ${insertError.message}${cleanupError ? " (nettoyage requis)" : ""}`,
        },
        400,
      );
    }
    return json(request, { ok: true });
  } catch (error) {
    return json(
      request,
      { error: error instanceof Error ? error.message : "Erreur serveur." },
      500,
    );
  }
});
