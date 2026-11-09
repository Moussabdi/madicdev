import { madicRecipientGreeting } from "../shared/madic-recipient.ts";
import { madicEmailHtml } from "../shared/madic-email-template.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const env = (key: string): string => {
  const value = Deno.env.get(key);
  if (!value) throw new Error(`Missing ${key}`);
  return value;
};
const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false, autoRefreshToken: false },
});
type EventType =
  | "client_to_sign"
  | "client_signed"
  | "cric_signed"
  | "contract_finalized";
type Job = {
  id: string;
  contract_id: string;
  recipient_user_id: string;
  event_type: EventType;
  attempts: number;
};
type Status = "sent" | "skipped" | "pending" | "failed";
const descriptions: Record<
  EventType,
  { title: string; client: string; cric: string }
> = {
  client_to_sign: {
    title: "Contrat disponible pour signature",
    client:
      "Votre contrat est disponible dans votre espace sécurisé. Veuillez le consulter et le signer.",
    cric: "Le contrat a été publié et transmis au client pour signature.",
  },
  client_signed: {
    title: "Signature du client enregistrée",
    client: "Votre signature du contrat a été enregistrée.",
    cric: "Le client a signé son contrat. Consultez votre espace professionnel.",
  },
  cric_signed: {
    title: "Signature du CRIC enregistrée",
    client: "Le CRIC a signé votre contrat professionnel.",
    cric: "Votre signature du contrat a été enregistrée.",
  },
  contract_finalized: {
    title: "Contrat professionnel finalisé",
    client: "Votre contrat professionnel est signé par les deux parties.",
    cric: "Le contrat professionnel est signé par les deux parties.",
  },
};
async function finish(job: Job, status: Status, reason?: string) {
  const fields: Record<string, unknown> = {
    status,
    locked_at: null,
    last_error: reason?.slice(0, 180) || null,
  };
  if (status === "sent") fields.sent_at = new Date().toISOString();
  if (status === "pending")
    fields.next_attempt_at = new Date(
      Date.now() + Math.min(60, 2 ** Math.min(job.attempts, 6)) * 60000,
    ).toISOString();
  const { data, error } = await db
    .from("madic_initial_contract_email_queue")
    .update(fields)
    .eq("id", job.id)
    .eq("status", "processing")
    .eq("attempts", job.attempts)
    .select("id");
  if (error) throw Error(`Queue update ${error.code}: ${error.message}`);
  if (data?.length !== 1) throw Error(`Queue finalization conflict: ${job.id}`);
}
async function processJob(job: Job): Promise<void> {
  let attempted = false;
  try {
    const { data: c, error: ce } = await db
      .from("madic_initial_contracts")
      .select("id,space_id,client_id,dossier_id,status,created_at")
      .eq("id", job.contract_id)
      .maybeSingle();
    if (ce) throw Error(`Contract lookup: ${ce.code}`);
    if (!c) {
      await finish(job, "skipped", "Contrat introuvable");
      return;
    }
    const { data: s, error: se } = await db
      .from("madic_cric_spaces")
      .select("id,owner_user_id,name")
      .eq("id", c.space_id)
      .maybeSingle();
    if (se) throw Error(`Space lookup: ${se.code}`);
    if (!s) {
      await finish(job, "skipped", "Espace CRIC introuvable");
      return;
    }
    if (
      job.recipient_user_id !== c.client_id &&
      job.recipient_user_id !== s.owner_user_id
    ) {
      await finish(job, "skipped", "Destinataire non autorisé");
      return;
    }
    const isClient = job.recipient_user_id === c.client_id;
    if (job.event_type === "client_to_sign") {
      if (!["publie", "signe"].includes(c.status)) {
        await finish(job, "skipped", "Contrat non disponible");
        return;
      }
      const { data: latest, error: le } = await db
        .from("madic_initial_contracts")
        .select("id")
        .eq("space_id", c.space_id)
        .eq("client_id", c.client_id)
        .eq("dossier_id", c.dossier_id)
        .in("status", ["publie", "signe"])
        .order("created_at", { ascending: false })
        .limit(1);
      if (le) throw Error(`Latest contract: ${le.code}`);
      if (latest?.[0]?.id !== c.id) {
        await finish(job, "skipped", "Contrat remplacé");
        return;
      }
    } else if (job.event_type === "client_signed") {
      if (c.status !== "signe") {
        await finish(job, "skipped", "Contrat non signé");
        return;
      }
    } else if (job.event_type === "cric_signed") {
      if (!["publie", "signe"].includes(c.status)) {
        await finish(job, "skipped", "Contrat non publié");
        return;
      }
    } else if (job.event_type === "contract_finalized") {
      if (c.status !== "signe") {
        await finish(job, "skipped", "Contrat non finalisé");
        return;
      }
    } else {
      await finish(job, "skipped", "Événement inconnu");
      return;
    }
    const { data: account, error: ae } = await db.auth.admin.getUserById(
      job.recipient_user_id,
    );
    if (ae) throw Error(`Recipient lookup: ${ae.message}`);
    if (!account?.user?.email) {
      await finish(job, "skipped", "Adresse courriel absente");
      return;
    }
    const greeting = madicRecipientGreeting(account.user);
    // Numero de dossier: privilegier sa reference lisible si disponible.
    let dossierNumber = String(c.dossier_id || "");
    if (c.dossier_id) {
      const { data: dossier } = await db.from("madic_dossiers")
        .select("*").eq("id", c.dossier_id).maybeSingle();
      if (dossier) {
        const d = dossier as Record<string, unknown>;
        dossierNumber = String(d.numero_dossier || d.reference || d.numero || d.dossier_number || dossierNumber);
      }
    }
    const dossierLabel = dossierNumber ? `Dossier ${dossierNumber}` : `Contrat ${c.id}`;
    const desc = descriptions[job.event_type];
    const message = isClient ? desc.client : desc.cric;
    const cabinet = String(s.name || "MADIC Portail");
    const url =
      job.event_type === "client_to_sign" && isClient
        ? `https://madic.ca/contrat-initial-client.html?id=${encodeURIComponent(c.id)}`
        : isClient
          ? "https://madic.ca/"
          : "https://madic.ca/cric-dashboard.html";
    const payload = {
      from: env("MADIC_EMAIL_FROM"),
      to: [account.user.email],
      subject: `MADIC | ${desc.title} | ${dossierLabel}`,
      text: `${greeting},\n\n${dossierLabel}\n\n${desc.title}\n\n${message}\n\nConsultez votre espace MADIC : ${url}`,
      html: madicEmailHtml({
        title: desc.title,
        greeting,
        details: [{ label: "Dossier", value: dossierNumber || c.id }],
        cabinet,
        paragraphs: [message],
        action: { label: "Accéder à mon espace MADIC", url },
      }),
    };
    attempted = true;
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env("RESEND_API_KEY")}`,
        "Content-Type": "application/json",
        "Idempotency-Key": job.id,
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const body = (await response.text()).slice(0, 200);
      throw Error(`Resend HTTP ${response.status}: ${body}`);
    }
    const receipt: unknown = await response.json();
    if (
      !receipt ||
      typeof receipt !== "object" ||
      !("id" in receipt) ||
      typeof (receipt as { id?: unknown }).id !== "string"
    )
      throw Error("Resend response missing ID");
    console.info("MADIC_CONTRACT_RESEND_ACCEPTED", {
      jobId: job.id,
      resendId: (receipt as { id: string }).id,
    });
    await finish(job, "sent");
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    console.error("MADIC_CONTRACT_EMAIL_ERROR", {
      jobId: job.id,
      attempted,
      reason,
    });
    if (attempted)
      throw Error(`Résultat Resend à réconcilier : ${job.id}; ${reason}`);
    await finish(job, job.attempts >= 5 ? "failed" : "pending", reason);
  }
}
Deno.serve(async (req: Request): Promise<Response> => {
  const secret = Deno.env.get("MADIC_CRON_SECRET");
  if (
    req.method !== "POST" ||
    !secret ||
    req.headers.get("x-madic-cron-secret") !== secret
  )
    return new Response("Unauthorized", { status: 401 });
  try {
    const { data, error } = await db.rpc("madic_initial_contract_email_claim", {
      p_limit: 3,
    });
    if (error) throw Error(`Queue claim: ${error.code} ${error.message}`);
    let errors = 0;
    for (const job of (data || []) as Job[]) {
      try {
        await processJob(job);
      } catch (e) {
        errors++;
        console.error("MADIC_CONTRACT_JOB_FAILED", {
          jobId: job.id,
          message: String(e),
        });
      }
    }
    return Response.json(
      { processed: (data || []).length, errors },
      { status: errors ? 500 : 200 },
    );
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
});
