import { madicRecipientLanguage } from "../shared/madic-language.ts";
import { madicEmailHtml } from "../shared/madic-email-template.ts";
import { madicRecipientGreeting } from "../shared/madic-recipient.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const env = (key: string): string => {
  const value = Deno.env.get(key);
  if (!value) throw new Error(`Missing ${key}`);
  return value;
};

const db = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
  auth: { persistSession: false },
});

type Job = {
  id: string;
  client_id: string;
  space_id: string;
  recipient_user_id: string;
  event_type: string;
  attempts: number;
};

type ReceiptJob = {
  id: string;
  attempts: number;
  recipient_email: string | null;
};

type JobStatus = "sent" | "skipped" | "pending" | "failed";

const names: Record<string, string> = {
  created: "Nouvelle demande de service",
  status_received: "Demande reçue",
  status_reviewing: "Demande en analyse",
  status_responded: "Réponse transmise",
  status_closed: "Demande clôturée",
};

// Finalisation contrôlée des notifications
async function finish(
  job: Job | ReceiptJob,
  status: JobStatus,
  reason?: string,
): Promise<void> {
  const fields: Record<string, unknown> = {
    status,
    locked_at: null,
    last_error: reason?.slice(0, 180) || null,
  };

  if (status === "sent") {
    fields.sent_at = new Date().toISOString();
  }

  if (status === "pending") {
    const delayMinutes = Math.min(60, 2 ** Math.min(job.attempts, 6));

    fields.next_attempt_at = new Date(
      Date.now() + delayMinutes * 60000,
    ).toISOString();
  }

  const queue =
    "recipient_email" in job
      ? "madic_cric_receipt_email_queue"
      : "madic_service_email_queue";
  const { data, error } = await db
    .from(queue)
    .update(fields)
    .eq("id", job.id)
    .eq("status", "processing")
    .eq("attempts", job.attempts)
    .select("id");

  if (error) {
    console.error("MADIC_QUEUE_FINALIZATION_ERROR", {
      jobId: job.id,
      status,
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });

    throw new Error(`Queue update failed: ${error.code} - ${error.message}`);
  }

  if (!data || data.length !== 1) {
    console.error("MADIC_QUEUE_FINALIZATION_CONFLICT", {
      jobId: job.id,
      status,
      updatedRows: data?.length ?? 0,
    });

    throw new Error(`Queue finalization conflict: ${job.id}`);
  }

  console.info("MADIC_QUEUE_FINALIZED", {
    jobId: job.id,
    status,
  });
}

async function sendReceipt(job: ReceiptJob, email: string): Promise<void> {
  const title = "Demande CRIC reçue / RCIC application received";
  const greeting = "Bonjour";
  const paragraphs = [
    "Nous avons bien reçu votre demande d’accès au portail MADIC. Votre permis a été vérifié dans le registre officiel du CCIC.",
    "Notre équipe examinera les renseignements fournis afin de valider votre identité. Si votre demande est approuvée, vous recevrez un second courriel vous invitant à poursuivre votre inscription au portail MADIC.",
    "Merci pour votre patience pendant que nous validons les renseignements fournis.",
    "L’équipe MADIC",
    "Hello,",
    "We have received your MADIC Portal access application. Your licence was verified in the official CICC register.",
    "Our team will review the information you provided to verify your identity. If your application is approved, you will receive a separate email inviting you to continue your MADIC Portal registration.",
    "Thank you for your patience while we verify your information.",
    "The MADIC Team",
  ];

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    signal: AbortSignal.timeout(15000),
    headers: {
      Authorization: `Bearer ${env("RESEND_API_KEY")}`,
      "Content-Type": "application/json",
      "Idempotency-Key": job.id,
    },
    body: JSON.stringify({
      from: env("MADIC_EMAIL_FROM"),
      to: [email],
      subject: `MADIC | ${title}`,
      text: [`${greeting},`, ...paragraphs].join("\n\n"),
      html: madicEmailHtml({
        title,
        greeting,
        cabinet: "Administration MADIC",
        paragraphs,
      }),
    }),
  });
  if (!response.ok) {
    throw new Error(`Receipt email provider HTTP ${response.status}`);
  }
}

// Traitement d'une notification
async function send(job: Job | ReceiptJob): Promise<void> {
  let providerAccepted = false;

  try {
    if ("recipient_email" in job) {
      if (!job.recipient_email) {
        await finish(job, "skipped", "Courriel professionnel indisponible");
        return;
      }
      await sendReceipt(job, job.recipient_email);
      providerAccepted = true;
      await finish(job, "sent");
      return;
    }

    const { data: space, error: se } = await db
      .from("madic_cric_spaces")
      .select("id,owner_user_id,name,access_status")
      .eq("id", job.space_id)
      .maybeSingle();

    if (se) {
      throw new Error(`Cabinet lookup: ${se.code}`);
    }

    if (!space || space.access_status !== "active") {
      await finish(job, "skipped", "Cabinet non disponible");
      return;
    }

    const { data: link, error: le } = await db
      .from("madic_cric_clients")
      .select("client_id")
      .eq("space_id", job.space_id)
      .eq("client_id", job.client_id)
      .maybeSingle();

    if (le) {
      throw new Error(`Client association lookup: ${le.code}`);
    }

    if (!link) {
      await finish(job, "skipped", "Association inactive");
      return;
    }

    if (
      job.recipient_user_id !== job.client_id &&
      job.recipient_user_id !== space.owner_user_id
    ) {
      await finish(job, "skipped", "Destinataire non autorisé");
      return;
    }

    const { data: account, error: ae } = await db.auth.admin.getUserById(
      job.recipient_user_id,
    );

    if (ae) {
      throw new Error(`Recipient lookup: ${ae.message}`);
    }

    if (!account?.user?.email) {
      await finish(job, "skipped", "Courriel indisponible");
      return;
    }

    const language = madicRecipientLanguage(account.user);
    const greeting = madicRecipientGreeting(account.user, language);
    const englishNames: Record<string, string> = {
      created: "New service request",
      status_received: "Request received",
      status_reviewing: "Request under review",
      status_responded: "Response sent",
      status_closed: "Request closed",
    };
    const title =
      language === "en"
        ? englishNames[job.event_type] || names[job.event_type]
        : names[job.event_type];

    if (!title) {
      await finish(job, "skipped", "Événement inconnu");
      return;
    }

    const isClient = job.recipient_user_id === job.client_id;
    const cabinet = String(space.name || "MADIC Portail");

    const message =
      language === "en"
        ? isClient
          ? "An update about your service request is available in your secure portal."
          : "An activity concerning an office service request is available in your professional portal."
        : isClient
          ? "Une mise à jour concernant votre demande de service est disponible dans votre espace sécurisé."
          : "Une activité concernant une demande de service de votre cabinet est disponible dans votre espace professionnel.";

    const emailHtml = madicEmailHtml({
      greeting,
      title,
      cabinet,
      paragraphs: [message],
    });

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env("RESEND_API_KEY")}`,
        "Content-Type": "application/json",
        "Idempotency-Key": job.id,
      },
      body: JSON.stringify({
        from: env("MADIC_EMAIL_FROM"),
        to: [account.user.email],
        subject: `MADIC | ${title}`,
        text:
          `${greeting},\n\n${title}\n\n${message}\n\n` +
          (language === "en"
            ? "Sign in to MADIC PORTAL to view the latest information."
            : "Connectez-vous à MADIC Portail pour consulter les informations à jour."),
        html: emailHtml,
      }),
    });

    if (!response.ok) {
      const responseText = await response.text();

      throw new Error(
        `Email provider HTTP ${response.status}: ${responseText.slice(0, 200)}`,
      );
    }

    providerAccepted = true;

    // Ne marquer sent qu'après acceptation par Resend.
    await finish(job, "sent");
  } catch (error) {
    const reason = error instanceof Error ? error.message : "Erreur inconnue";

    console.error("MADIC_SERVICE_EMAIL_ERROR", {
      jobId: job.id,
      attempts: job.attempts,
      providerAccepted,
      reason,
    });

    // Resend a accepté le courriel :
    // ne pas le remettre en attente après une erreur SQL.
    if (providerAccepted) {
      throw new Error(`Email accepted but finalization failed: ${job.id}`);
    }

    // Avant acceptation par Resend, une tentative ultérieure
    // reste possible. L'idempotence limite les doublons.
    const status: JobStatus = job.attempts >= 5 ? "failed" : "pending";

    await finish(job, status, reason);
  }
}

// Point d'entrée sécurisé du worker
Deno.serve(async (req: Request): Promise<Response> => {
  const secret = Deno.env.get("MADIC_CRON_SECRET");

  if (
    req.method !== "POST" ||
    !secret ||
    req.headers.get("x-madic-cron-secret") !== secret
  ) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    let processed = 0;
    let completed = 0;
    let errors = 0;

    for (const claim of [
      "madic_service_claim_emails",
      "madic_claim_cric_receipt_emails",
    ]) {
      const { data, error } = await db.rpc(claim, { p_limit: 25 });
      if (error) {
        errors++;
        console.error("MADIC_QUEUE_CLAIM_ERROR", { claim, code: error.code });
        continue;
      }
      const jobs = (data || []) as (Job | ReceiptJob)[];
      processed += jobs.length;
      for (const job of jobs) {
        try {
          await send(job);
          completed++;
        } catch (error) {
          errors++;
          console.error("MADIC_SERVICE_JOB_FAILED", {
            jobId: job.id,
            message: error instanceof Error ? error.message : "Erreur inconnue",
          });
        }
      }
    }

    return Response.json(
      {
        processed,
        completed,
        errors,
      },
      {
        status: errors > 0 ? 500 : 200,
      },
    );
  } catch (error) {
    console.error("MADIC_SERVICE_WORKER_ERROR", error);

    return Response.json(
      {
        error: error instanceof Error ? error.message : "Internal error",
      },
      { status: 500 },
    );
  }
});
