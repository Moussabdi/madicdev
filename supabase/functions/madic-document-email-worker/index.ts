import { madicRecipientLanguage } from "../shared/madic-language.ts";
import { madicEmailHtml } from "../shared/madic-email-template.ts";
import { madicRecipientGreeting } from "../shared/madic-recipient.ts";

import { createClient } from "npm:@supabase/supabase-js@2";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

const resendKey = Deno.env.get("RESEND_API_KEY");
const from = Deno.env.get("MADIC_EMAIL_FROM");
const cronSecret = Deno.env.get("MADIC_CRON_SECRET");

async function getOne(table: string, columns: string, id: string) {
  const { data, error } = await supabase
    .from(table)
    .select(columns)
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`DB ${table}: ${error.code}`);
  return data;
}

async function updateQueue(id: string, values: Record<string, unknown>) {
  const { error } = await supabase
    .from("madic_document_email_queue")
    .update(values)
    .eq("id", id)
    .eq("status", "processing");

  if (error) throw new Error(`Queue: ${error.code}`);
}

Deno.serve(async (req) => {
  if (
    req.method !== "POST" ||
    !cronSecret ||
    req.headers.get("x-madic-cron-secret") !== cronSecret
  ) {
    return new Response("Unauthorized", { status: 401 });
  }

  if (!resendKey || !from) {
    return Response.json(
      { error: "Configuration Resend manquante" },
      { status: 500 },
    );
  }

  const { data: jobs, error } = await supabase.rpc(
    "madic_document_claim_emails",
    { p_limit: 25 },
  );

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  const results = [];

  for (const job of jobs ?? []) {
    try {
      const dossier = await getOne(
        "dossiers",
        "id,client_id,space_id,reference",
        job.dossier_id,
      );

      const space = await getOne(
        "madic_cric_spaces",
        "id,name,access_status",
        job.space_id,
      );

      if (
        !dossier ||
        !space ||
        dossier.client_id !== job.client_id ||
        dossier.space_id !== job.space_id ||
        space.access_status !== "active"
      ) {
        await updateQueue(job.id, {
          status: "skipped",
          last_error: "Dossier ou cabinet non admissible",
          locked_at: null,
        });
        results.push({ id: job.id, status: "skipped" });
        continue;
      }

      const profile = await getOne(
        "profiles",
        "id,email,first_name",
        job.client_id,
      );

      if (!profile?.email) {
        throw new Error("Adresse courriel du client absente");
      }

      // Read the persisted recipient preference from Supabase Auth, not browser storage.
      const { data: authResult, error: authError } =
        await supabase.auth.admin.getUserById(job.client_id);
      if (authError || !authResult?.user) {
        throw new Error(
          `Recipient Auth lookup failed: ${authError?.message || "User not found"}`,
        );
      }
      const language = madicRecipientLanguage(authResult.user);
      const isEn = language === "en";
      const greeting = madicRecipientGreeting(authResult.user, language);
      const cabinet = space.name || "MADIC";
      let subject = "";
      let title = "";
      let paragraphs: string[] = [];
      let details: { label: string; value: string }[] = [];

      if (job.kind === "document_requested") {
        const request = await getOne(
          "madic_cric_document_requests",
          "id,space_id,client_id,dossier_id,title,instructions,due_on,status",
          job.document_request_id,
        );

        if (
          !request ||
          request.space_id !== job.space_id ||
          request.client_id !== job.client_id ||
          request.dossier_id !== job.dossier_id ||
          request.status !== "requested"
        ) {
          await updateQueue(job.id, {
            status: "skipped",
            last_error: "Demande documentaire non active",
            locked_at: null,
          });
          results.push({ id: job.id, status: "skipped" });
          continue;
        }

        subject = isEn
          ? "MADIC - New document required"
          : "MADIC - Nouveau document requis";
        title = isEn ? "New document required" : "Nouveau document requis";
        paragraphs = [
          isEn
            ? `A document is required for your file ${dossier.reference}.`
            : `Un document est requis pour votre dossier ${dossier.reference}.`,
          isEn
            ? "Please sign in to your MADIC client portal to submit the requested document."
            : "Veuillez vous connecter à votre espace client MADIC pour transmettre le document demandé.",
        ];
        details = [
          { label: isEn ? "Document" : "Document", value: request.title || "" },
        ];
        if (request.instructions)
          details.push({
            label: isEn ? "Instructions" : "Instructions",
            value: request.instructions,
          });
        if (request.due_on)
          details.push({
            label: isEn ? "Due date" : "Date limite",
            value: request.due_on,
          });
      } else if (job.kind === "document_rejected") {
        const document = await getOne(
          "documents",
          "id,client_id,dossier_id,original_name,review_status,review_reason",
          job.document_id,
        );

        if (
          !document ||
          document.client_id !== job.client_id ||
          document.dossier_id !== job.dossier_id ||
          document.review_status !== "refuse"
        ) {
          await updateQueue(job.id, {
            status: "skipped",
            last_error: "Document non refusé",
            locked_at: null,
          });
          results.push({ id: job.id, status: "skipped" });
          continue;
        }

        subject = isEn
          ? "MADIC - Document needs correction"
          : "MADIC - Document à corriger";
        title = isEn ? "Document needs correction" : "Document à corriger";
        paragraphs = [
          isEn
            ? `A document submitted for your file ${dossier.reference} requires correction.`
            : `Un document transmis pour votre dossier ${dossier.reference} nécessite une correction.`,
          isEn
            ? "Please sign in to your MADIC client portal to submit a new version."
            : "Veuillez vous connecter à votre espace client MADIC pour transmettre une nouvelle version.",
        ];
        details = [
          { label: "Document", value: document.original_name || "" },
          {
            label: isEn ? "Reason for rejection" : "Motif du refus",
            value: document.review_reason || "",
          },
        ];
      } else {
        throw new Error("Type de notification inconnu");
      }

      const body = madicEmailHtml({
        title,
        greeting,
        cabinet,
        paragraphs,
        details,
        language,
      });

      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: [profile.email],
          subject,
          html: body,
        }),
      });

      if (!response.ok) {
        throw new Error(
          `Resend HTTP ${response.status}: ${(await response.text()).slice(
            0,
            300,
          )}`,
        );
      }

      await updateQueue(job.id, {
        status: "sent",
        sent_at: new Date().toISOString(),
        locked_at: null,
        last_error: null,
      });

      results.push({ id: job.id, status: "sent" });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);

      const failed = job.attempts >= 5;

      try {
        await updateQueue(job.id, {
          status: failed ? "failed" : "pending",
          next_attempt_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
          locked_at: null,
          last_error: message.slice(0, 500),
        });
      } catch (updateError) {
        console.error("Queue update failed", updateError);
      }

      results.push({
        id: job.id,
        status: failed ? "failed" : "pending",
        error: message,
      });
    }
  }

  return Response.json({
    processed: results.length,
    results,
  });
});
