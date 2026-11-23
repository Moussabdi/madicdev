import {
  createClient,
  type SupabaseClient,
  type User,
} from "npm:@supabase/supabase-js@2";

import { madicEmailHtml } from "../shared/madic-email-template.ts";
import { madicRecipientLanguage } from "../shared/madic-language.ts";
import { madicRecipientGreeting } from "../shared/madic-recipient.ts";

const allowedOrigins = new Set([
  "https://madic.ca",
  "https://www.madic.ca",
  "https://madicdev.netlify.app",
]);
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

type RecipientRole = "client" | "guest" | "cric";
type NotificationStatus = "accepted" | "not_applicable" | "unconfirmed";

const notificationCopy = {
  client: {
    fr: [
      "Nouveau document dans votre espace client",
      "Votre cabinet a déposé un document dans votre espace client sécurisé.",
      "Ouvrir mes documents",
    ],
    en: [
      "New document in your client workspace",
      "Your practice added a document to your secure client workspace.",
      "Open my documents",
    ],
    path: "/documents-client-cric.html",
  },
  guest: {
    fr: [
      "Nouveau document disponible dans le portail",
      "Un document a été déposé pour un dossier auquel vous avez accès en tant que personne de confiance.",
      "Ouvrir mes accès invités",
    ],
    en: [
      "New document available in the portal",
      "A document was added to a case you can access as a trusted person.",
      "Open my guest accesses",
    ],
    path: "/invitation-client-cric.html?guest=1",
  },
  cric: {
    fr: [
      "Dépôt de document confirmé",
      "Le document que vous avez transmis est disponible dans l’espace client correspondant.",
      "Ouvrir la gestion documentaire",
    ],
    en: [
      "Document upload confirmed",
      "The document you sent is available in the corresponding client workspace.",
      "Open document management",
    ],
    path: "/demandes-documents-cric.html",
  },
} as const;

async function notifyDocumentRecipients(
  adminDb: SupabaseClient,
  sender: User,
  clientId: string,
  spaceId: string,
  documentKey: string,
  origin: string,
  notificationLanguage: "fr" | "en" | undefined,
) {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  const from = Deno.env.get("MADIC_EMAIL_FROM");
  const { data: space, error: spaceError } = await adminDb
    .from("madic_cric_spaces")
    .select("name")
    .eq("id", spaceId)
    .maybeSingle();
  if (spaceError)
    console.warn("MADIC document notification: cabinet lookup failed");
  const cabinet = space?.name || "MADIC";

  async function findUser(id: string): Promise<User> {
    const { data, error } = await adminDb.auth.admin.getUserById(id);
    if (error || !data?.user) throw Error("Recipient lookup failed");
    return data.user;
  }

  async function send(role: RecipientRole, user: User): Promise<void> {
    if (!apiKey || !from || !user.email || !user.email_confirmed_at)
      throw Error("Email configuration or confirmed recipient missing");
    const copy = notificationCopy[role];
    const language = notificationLanguage ?? madicRecipientLanguage(user);
    const [title, message, label] = copy[language];
    const action = { label, url: new URL(copy.path, origin).href };
    const input = JSON.stringify({
      from,
      to: [user.email],
      subject: `MADIC - ${title}`,
      html: madicEmailHtml({
        title,
        language,
        cabinet,
        greeting: madicRecipientGreeting(user, language),
        paragraphs: [message],
        action,
      }),
      text: `${title}\n\n${message}\n\n${label}: ${action.url}`,
    });
    const options = {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `madic-document-${documentKey}-${role}`,
      },
      body: input,
    };
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await fetch("https://api.resend.com/emails", {
        ...options,
        signal: AbortSignal.timeout(4500),
      }).catch(() => null);
      if (response?.ok) {
        const receipt = await response.json().catch(() => null);
        if (typeof receipt?.id === "string" && receipt.id) return;
      }
      if (
        response &&
        !response.ok &&
        response.status !== 429 &&
        response.status < 500
      )
        break;
      if (attempt === 0)
        await new Promise((resolve) => setTimeout(resolve, 350));
    }
    throw Error("Email acceptance not confirmed");
  }

  async function notifyGuest() {
    const { data: guest, error } = await adminDb
      .from("madic_client_guest_access")
      .select("email,user_id")
      .eq("space_id", spaceId)
      .eq("client_id", clientId)
      .is("revoked_at", null)
      .not("accepted_at", "is", null)
      .maybeSingle();
    if (error) throw Error("Guest authorization lookup failed");
    if (!guest?.user_id) return false;
    const user = await findUser(guest.user_id);
    if (
      !user.email_confirmed_at ||
      user.email?.trim().toLowerCase() !== guest.email.trim().toLowerCase()
    )
      return false;
    await send("guest", user);
    return true;
  }

  const results = await Promise.allSettled([
    findUser(clientId).then((user) => send("client", user)),
    notifyGuest(),
    send("cric", sender),
  ]);
  const status = (
    result: PromiseSettledResult<unknown>,
    role: RecipientRole,
  ): NotificationStatus => {
    if (result.status === "rejected") {
      console.warn("MADIC document notification unconfirmed", {
        role,
        documentKey,
      });
      return "unconfirmed";
    }
    return result.value === false ? "not_applicable" : "accepted";
  };
  return {
    client: status(results[0], "client"),
    guest: status(results[1], "guest"),
    cric: status(results[2], "cric"),
  };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(request) });
  }
  const origin = request.headers.get("Origin") || "";
  if (!allowedOrigins.has(origin))
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
    const requestedLanguage = form.get("notification_language");
    const notificationLanguage =
      requestedLanguage === "fr" || requestedLanguage === "en"
        ? requestedLanguage
        : undefined;
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
    const documentKey = crypto.randomUUID();
    const path = `${clientId}/${dossierId}/cric-${documentKey}`;
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
    // Email failures must not turn a committed upload into a failed submission.
    const notifications = await notifyDocumentRecipients(
      adminDb,
      identity.user,
      clientId,
      dossier.space_id,
      documentKey,
      origin,
      notificationLanguage,
    ).catch(() => {
      console.warn("MADIC document notification lookup failed", {
        documentKey,
      });
      return {
        client: "unconfirmed",
        guest: "unconfirmed",
        cric: "unconfirmed",
      };
    });
    return json(request, { ok: true, notifications });
  } catch (error) {
    return json(
      request,
      { error: error instanceof Error ? error.message : "Erreur serveur." },
      500,
    );
  }
});
