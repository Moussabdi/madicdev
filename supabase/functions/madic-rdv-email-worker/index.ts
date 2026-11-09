import { madicEmailHtml } from "../shared/madic-email-template.ts";
import { madicRecipientGreeting } from "../shared/madic-recipient.ts";
// MADIC 6.2: Supabase Edge Function, invocation uniquement par planificateur autorise.
import { createClient } from "npm:@supabase/supabase-js@2";

type Job = {
  id: string;
  appointment_id: string;
  recipient_user_id: string;
  kind: string;
  attempts: number;
};
const TZ = "America/Toronto";
const env = (name: string) => {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`Missing ${name}`);
  return v;
};
const supabase = createClient(
  env("SUPABASE_URL"),
  env("SUPABASE_SERVICE_ROLE_KEY"),
  { auth: { persistSession: false } },
);
const dateLabel = (iso: string) =>
  new Intl.DateTimeFormat("fr-CA", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: TZ,
  }).format(new Date(iso));
const get = async (table: string, fields: string, id: string) => {
  const { data, error } = await supabase
    .from(table)
    .select(fields)
    .eq("id", id)
    .single();
  if (error) throw new Error(`DB ${table}: ${error.code}`);
  return data as Record<string, unknown>;
};
async function finish(
  id: string,
  status: "sent" | "skipped" | "pending" | "failed",
  err?: string,
  attempts = 0,
) {
  const update: Record<string, unknown> = {
    status,
    locked_at: null,
    last_error: err?.slice(0, 180) || null,
  };
  if (status === "sent") update.sent_at = new Date().toISOString();
  if (status === "pending")
    update.next_attempt_at = new Date(
      Date.now() + Math.min(60, 2 ** Math.min(attempts, 6)) * 60_000,
    ).toISOString();
  const { error } = await supabase
    .from("madic_rdv_email_queue")
    .update(update)
    .eq("id", id)
    .eq("status", "processing");
  if (error) throw new Error(`Queue update: ${error.code}`);
}
async function send(job: Job) {
  try {
    const a = await get(
      "madic_cric_appointments",
      "id,space_id,slot_id,client_id,status",
      job.appointment_id,
    );
    const sp = await get(
      "madic_cric_spaces",
      "id,owner_user_id,name",
      String(a.space_id),
    );
    const s = await get(
      "madic_cric_appointment_slots",
      "id,space_id,starts_at,ends_at,mode,location_info,is_open",
      String(a.slot_id),
    );
    const owner = String(sp.owner_user_id),
      client = String(a.client_id);
    if (
      String(s.space_id) !== String(a.space_id) ||
      ![owner, client].includes(job.recipient_user_id)
    ) {
      await finish(job.id, "skipped", "Recipient/tenant mismatch");
      return;
    }
    // Do not send obsolete confirmation or reminder emails.
    if (
      (job.kind === "confirmed" || job.kind.startsWith("reminder_")) &&
      a.status !== "confirmed"
    ) {
      await finish(job.id, "skipped", "No longer confirmed");
      return;
    }
    if (job.kind === "requested" && a.status !== "requested") {
      await finish(job.id, "skipped", "No longer requested");
      return;
    }
    if (job.kind === "declined" && a.status !== "declined") {
      await finish(job.id, "skipped", "No longer declined");
      return;
    }
    if (job.kind === "cancelled" && a.status !== "cancelled") {
      await finish(job.id, "skipped", "No longer cancelled");
      return;
    }
    if (
      job.kind.startsWith("reminder_") &&
      (!s.is_open || Date.parse(String(s.starts_at)) <= Date.now())
    ) {
      await finish(job.id, "skipped", "Past/closed slot");
      return;
    }
    const { data: user, error: ue } = await supabase.auth.admin.getUserById(
      job.recipient_user_id,
    );
    if (ue || !user?.user?.email) {
      await finish(job.id, "skipped", "Recipient email unavailable");
      return;
    }
    const titles: Record<string, string> = {
      requested: "Nouvelle demande de rendez-vous",
      confirmed: "Rendez-vous confirme",
      declined: "Demande de rendez-vous refusee",
      cancelled: "Rendez-vous annule",
      reminder_24h: "Rappel de rendez-vous dans 24 heures",
      reminder_1h: "Rappel de rendez-vous dans 1 heure",
    };
    const greeting = madicRecipientGreeting(user.user);
    const title = titles[job.kind];
    if (!title) {
      await finish(job.id, "skipped", "Unknown kind");
      return;
    }
    const isClient = job.recipient_user_id === client;
    const dateText = dateLabel(String(s.starts_at));
    const mode: Record<string, string> = {
      video: "Visioconference",
      phone: "Telephone",
      in_person: "En personne",
    };
    const place =
      (job.kind === "confirmed" || job.kind.startsWith("reminder_")) &&
      isClient &&
      a.status === "confirmed"
        ? String(
            s.location_info ||
              "Le consultant communiquera les details de consultation.",
          )
        : "";
    // Never include confidential consultation links in email to the consultant, nor for unconfirmed appointments.
    const lines = [
      `${greeting},`,
      title,
      `Cabinet : ${String(sp.name || "Cabinet")}`,
      `Date : ${dateText} (heure de Montreal)`,
      `Mode : ${mode[String(s.mode)] || String(s.mode)}`,
    ];
    if (place) lines.push(`Lieu ou lien : ${place}`);
    lines.push(
      "Connectez-vous a votre espace MADIC PORTAIL pour consulter les informations a jour.",
    );
    const body = lines.join("\n");
    const sender = env("MADIC_EMAIL_FROM");
    const emailHtml = madicEmailHtml({
          greeting,
          title,
          cabinet: String(sp.name || "Cabinet"),
          paragraphs: ["Veuillez consulter les informations de votre rendez-vous dans votre espace sécurisé."],
          details: [
            { label: "Date", value: `${dateText} (heure de Montréal)` },
            { label: "Mode", value: mode[String(s.mode)] || String(s.mode) },
            ...(place ? [{ label: "Lieu ou lien", value: place }] : []),
          ],
        });
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env("RESEND_API_KEY")}`,
        "Content-Type": "application/json",
        "Idempotency-Key": job.id,
      },
      body: JSON.stringify({
        from: sender,
        to: [user.user.email],
        subject: `MADIC | ${title}`,
        text: body,
        html: emailHtml,
      }),
    });
    if (!response.ok) throw new Error(`Email provider HTTP ${response.status}`);
    await finish(job.id, "sent");
  } catch (e) {
    const error = e instanceof Error ? e.message : "Unexpected error";
    await finish(
      job.id,
      job.attempts >= 5 ? "failed" : "pending",
      error,
      job.attempts,
    );
  }
}
Deno.serve(async (req) => {
  // No user/admin portal session can invoke this function.
  const secret = Deno.env.get("MADIC_CRON_SECRET");
  if (
    req.method !== "POST" ||
    !secret ||
    req.headers.get("x-madic-cron-secret") !== secret
  )
    return new Response("Unauthorized", { status: 401 });
  try {
    const { error: re } = await supabase.rpc("madic_rdv_prepare_reminders");
    if (re) throw new Error(`Reminder preparation: ${re.code}`);
    const { data, error } = await supabase.rpc("madic_rdv_claim_emails", {
      p_limit: 25,
    });
    if (error) throw new Error(`Queue claim: ${error.code}`);
    for (const job of (data || []) as Job[]) await send(job);
    return Response.json({ processed: (data || []).length });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : "Internal error" },
      { status: 500 },
    );
  }
});
