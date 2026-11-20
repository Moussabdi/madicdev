import { createClient } from "npm:@supabase/supabase-js@2";
import { madicEmailHtml } from "../shared/madic-email-template.ts";

const origins = new Set([
  "https://madic.ca",
  "https://www.madic.ca",
  "https://madicdev.netlify.app",
]);
const hex = (bytes: Uint8Array) =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

Deno.serve(async (request) => {
  const origin = request.headers.get("origin") || "";
  const headers = new Headers({
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    Vary: "Origin",
    "Access-Control-Allow-Headers":
      "authorization, apikey, x-client-info, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  });
  const reply = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), { status, headers });
  if (!origins.has(origin)) return reply({ error: "Origin not allowed" }, 403);
  headers.set("Access-Control-Allow-Origin", origin);
  if (request.method === "OPTIONS")
    return new Response(null, { status: 204, headers });
  if (request.method !== "POST")
    return reply({ error: "Method not allowed" }, 405);
  const bearer = request.headers.get("authorization");
  if (!bearer?.startsWith("Bearer "))
    return reply({ error: "Authentication required" }, 401);

  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const resend = Deno.env.get("RESEND_API_KEY");
  const sender = Deno.env.get("MADIC_EMAIL_FROM");
  if (!url || !anonKey || !serviceKey || !resend || !sender)
    return reply({ error: "Email service unavailable" }, 503);

  try {
    const body = await request.json();
    const id = String(body.prevalidation_id || "");
    if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id)) {
      return reply({ error: "Invalid reference" }, 400);
    }
    const scoped = createClient(url, anonKey, {
      global: { headers: { Authorization: bearer } },
      auth: { persistSession: false },
    });
    const recipient = await scoped.rpc("madic_admin_cric_invitation_email", {
      p_prevalidation: id,
    });
    if (recipient.error || typeof recipient.data !== "string") {
      return reply({ error: "Verified professional email unavailable", code: recipient.error?.code }, 409);
    }
    const email = recipient.data.trim().toLowerCase();
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return reply({ error: "Invalid registered email" }, 409);
    }
    const token = hex(crypto.getRandomValues(new Uint8Array(32)));
    const digest = hex(
      new Uint8Array(
        await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)),
      ),
    );
    const { error } = await scoped.rpc("madic_issue_cric_onboarding", {
      p_prevalidation: id,
      p_email: email,
      p_token_hash: digest,
    });
    if (error)
      return reply(
        { error: "Invitation refused", code: error.code },
        error.code === "42501" ? 403 : 409,
      );
    const link = new URL("/inscription-cric.html", origin);
    link.hash = new URLSearchParams({ invitation: token }).toString();
    const subject = "MADIC | Poursuivre votre inscription CRIC";
    const paragraphs = [
      "MADIC vous invite à poursuivre votre inscription comme consultant réglementé en immigration canadienne.",
      "Utilisez cette adresse courriel pour vous connecter ou créer votre compte, puis transmettez une pièce d’identité avec photo pour examen.",
      "Ce lien est personnel. Vous pourrez consulter votre dossier d’inscription après avoir transmis votre pièce.",
    ];
    const result = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + resend,
        "Content-Type": "application/json",
        "Idempotency-Key": "madic-cric-" + digest,
      },
      body: JSON.stringify({
        from: sender,
        to: [email],
        subject,
        text: paragraphs.join("\n\n") + "\n\n" + link.href,
        html: madicEmailHtml({
          title: subject,
          cabinet: "Administration MADIC",
          paragraphs,
          action: { label: "Poursuivre l’inscription", url: link.href },
        }),
      }),
      signal: AbortSignal.timeout(12000),
    });
    if (!result.ok) {
      console.error("MADIC CRIC mail HTTP", result.status);
      return reply({ error: "Email delivery request failed" }, 502);
    }
    const admin = createClient(url, serviceKey, {
      auth: { persistSession: false },
    });
    const mark = await admin.rpc("madic_mark_cric_invite_sent", {
      p_prevalidation: id,
      p_token_hash: digest,
    });
    if (mark.error) console.error("MADIC CRIC sent status", mark.error.code);
    return reply({ accepted: true });
  } catch (error) {
    console.error(
      "MADIC CRIC invitation failed",
      error instanceof Error ? error.name : "unknown",
    );
    return reply({ error: "Invitation unavailable" }, 502);
  }
});
