import { createClient } from "npm:@supabase/supabase-js@2";
// Sur un portail public, garder l'invitation dans le portail de l'expediteur.
const publicPortalOrigins = new Map([
  ["https://madic.ca", "https://madic.ca"],
  ["https://www.madic.ca", "https://madic.ca"],
  ["https://madicdev.netlify.app", "https://madicdev.netlify.app"],
]);
const allowedOrigins = new Set([
  "https://madic.ca",
  "https://www.madic.ca",
  "http://127.0.0.1:5500",
  "http://localhost:5500",
  "https://madicdev.netlify.app",
]);
const env = (name: string) => {
  const v = Deno.env.get(name);
  if (!v) throw Error(`Missing ${name}`);
  return v;
};
const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ] || c,
  );
function invitationEmail(input: {
  title: string;
  cabinet: string;
  logoUrl?: string;
  content: string;
  footer: string;
}): string {
  const branding = input.logoUrl
    ? `<img src="${esc(input.logoUrl)}" alt="Logo de ${esc(input.cabinet)}" width="160" style="max-width:160px;max-height:90px;width:auto;height:auto">`
    : '<strong style="color:#174b78;font-size:17px;letter-spacing:.4px">MADIC PORTAIL</strong>';
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:24px;background:#f4f7fb;font-family:Arial,sans-serif;color:#243247">
    <div style="max-width:620px;margin:auto;background:#fff;border:1px solid #e4e9f1;border-radius:12px;padding:32px;line-height:1.65">
      <div style="text-align:center;margin-bottom:20px">${branding}</div>
      <h2 style="text-align:center;color:#174b78;margin:12px 0 24px">${esc(input.title)}</h2>
      ${input.content}
      <p style="color:#68788d;font-size:12px;margin-top:24px">${esc(input.footer)}</p>
    </div></body></html>`;
}
function invitationAction(url: string, label: string): string {
  return `<p style="text-align:center;margin:28px 0"><a href="${esc(url)}" style="display:inline-block;background:#174b78;color:#fff;padding:13px 24px;text-decoration:none;border-radius:6px;font-weight:bold">${esc(label)}</a></p>`;
}
const isUuid = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);
Deno.serve(async (req: Request): Promise<Response> => {
  const origin = req.headers.get("Origin") || "";
  const headers: Record<string, string> = {
    "Access-Control-Allow-Origin": allowedOrigins.has(origin)
      ? origin
      : "https://madic.ca",
    Vary: "Origin",
    "Cache-Control": "private, no-store",
    "Access-Control-Allow-Headers":
      "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json; charset=utf-8",
  };
  const reply = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), { status, headers });
  if (req.method === "OPTIONS")
    return new Response(null, { status: 204, headers });
  if (req.method !== "POST")
    return reply({ error: "Méthode non autorisée." }, 405);
  if (origin && !allowedOrigins.has(origin))
    return reply({ error: "Origine non autorisée." }, 403);
  try {
    const authorization = req.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer "))
      return reply({ error: "Authentification requise." }, 401);
    const token = authorization.slice(7);
    const userDb = createClient(env("SUPABASE_URL"), env("SUPABASE_ANON_KEY"), {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: auth, error: authError } = await userDb.auth.getUser(token);
    if (authError || !auth.user)
      return reply({ error: "Session invalide." }, 401);
    let payload: Record<string, unknown>;
    try {
      const p: unknown = await req.json();
      if (!p || typeof p !== "object" || Array.isArray(p))
        return reply({ error: "Données invalides." }, 400);
      payload = p as Record<string, unknown>;
    } catch {
      return reply({ error: "Corps JSON invalide." }, 400);
    }
    if (payload.action === "guest_download") {
      const { grant_id: grantId, bucket, path } = payload;
      if (
        !isUuid(grantId) ||
        ![
          "madic-documents",
          "madic-message-attachments",
          "madic-profile-avatars",
        ].includes(String(bucket)) ||
        typeof path !== "string" ||
        !path ||
        path.length > 1024 ||
        !path
          .split("/")
          .every(
            (segment) =>
              segment &&
              segment !== "." &&
              segment !== ".." &&
              !/[\\%]/.test(segment),
          )
      ) {
        return reply({ error: "Fichier invalide." }, 400);
      }
      const { data: permitted, error } = await userDb.rpc("madic_guest_file", {
        p_grant: grantId,
        p_bucket: bucket,
        p_path: path,
      });
      if (error || permitted !== true)
        return reply({ error: "Fichier inaccessible." }, 403);
      const serviceKey = env("SUPABASE_SERVICE_ROLE_KEY");
      const objectPath = path.split("/").map(encodeURIComponent).join("/");
      const file = await fetch(
        `${env("SUPABASE_URL")}/storage/v1/object/authenticated/${bucket}/${objectPath}`,
        {
          headers: {
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`,
          },
          redirect: "error",
        },
      );
      if (!file.ok || !file.body)
        return reply({ error: "Fichier indisponible." }, 404);
      return new Response(file.body, {
        headers: {
          ...headers,
          "Content-Type": "application/octet-stream",
          "Content-Disposition": "attachment",
          "Cache-Control": "private, no-store",
          "X-Madic-File-Type": file.headers.get("Content-Type") || "",
          "Access-Control-Expose-Headers": "X-Madic-File-Type",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }
    const spaceId =
      typeof payload.space_id === "string" ? payload.space_id.trim() : "";
    const email =
      typeof payload.email === "string"
        ? payload.email.trim().toLowerCase()
        : "";
    if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(spaceId))
      return reply({ error: "Espace CRIC invalide." }, 400);
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return reply({ error: "Adresse courriel invalide." }, 400);
    const { data: authorized, error: permissionError } = await userDb.rpc(
      "madic_can_manage_cric_space",
      { p_space_id: spaceId },
    );
    if (permissionError || authorized !== true)
      return reply({ error: "Accès au cabinet non autorisé." }, 403);
    const { data: space, error: spaceError } = await userDb
      .from("madic_cric_spaces")
      .select("id,name,access_status")
      .eq("id", spaceId)
      .single();
    if (spaceError || !space || space.access_status !== "active")
      return reply({ error: "Espace CRIC inactif ou inaccessible." }, 403);
    if (payload.action === "guest_invite") {
      if (!isUuid(payload.client_id))
        return reply({ error: "Client invalide." }, 400);
      const resendKey = env("RESEND_API_KEY");
      const sender = env("MADIC_EMAIL_FROM");
      const { data: guestToken, error } = await userDb.rpc(
        "madic_guest_create",
        {
          p_space: spaceId,
          p_client: payload.client_id,
          p_email: email,
        },
      );
      if (
        error ||
        typeof guestToken !== "string" ||
        !/^[a-f0-9]{64}$/.test(guestToken)
      ) {
        return reply(
          { error: "Impossible de créer l’invitation." },
          error?.code === "23505" ? 409 : 400,
        );
      }
      const portalOrigin =
        publicPortalOrigins.get(origin) ?? "https://madic.ca";
      const url = new URL("/invitation-client-cric.html", portalOrigin);
      url.searchParams.set("invite", guestToken);
      const title = "Accès invité / Guest access";
      let cabinet = space.name;
      let logoUrl: string | undefined;
      try {
        const { data: branding } = await userDb
          .from("madic_cric_professional_profiles")
          .select("business_name,logo_path")
          .eq("space_id", spaceId)
          .maybeSingle();
        cabinet = branding?.business_name?.trim() || cabinet;
        if (branding?.logo_path?.startsWith(spaceId + "/")) {
          const { data: logo } = await userDb.storage
            .from("madic-cric-branding")
            .createSignedUrl(branding.logo_path, 7 * 24 * 60 * 60);
          logoUrl = logo?.signedUrl;
        }
      } catch {
        // Le gabarit affiche le nom MADIC si le logo du cabinet est inaccessible.
      }
      const invitationFr = `${cabinet} vous invite à consulter un dossier MADIC en lecture seule.`;
      const instructionsFr =
        "Utilisez votre propre compte associé à l’adresse qui reçoit ce courriel. Cette invitation est valable pendant 7 jours.";
      const privacyFr =
        "Ce lien est personnel et confidentiel. Si vous n’attendiez pas cette invitation, vous pouvez ignorer ce message.";
      const invitationEn = `${cabinet} has invited you to view a MADIC client file in read-only mode.`;
      const instructionsEn =
        "Use your own account associated with the email address that received this message. This invitation is valid for 7 days.";
      const privacyEn =
        "This link is personal and confidential. If you were not expecting this invitation, you can ignore this message.";
      const action = "Accepter l’invitation / Accept invitation";
      const footer =
        "Invitation envoyée via MADIC PORTAIL / Invitation sent via MADIC PORTAL";
      const text = [
        "Bonjour,",
        invitationFr,
        instructionsFr,
        privacyFr,
        "Hello,",
        invitationEn,
        instructionsEn,
        privacyEn,
        action,
        url.href,
        cabinet,
        footer,
      ].join("\n\n");
      const html = invitationEmail({
        title,
        cabinet,
        logoUrl,
        footer,
        content: `<div lang="fr"><p>Bonjour,</p><p>${esc(invitationFr)}</p><p>${esc(instructionsFr)}</p><p>${esc(privacyFr)}</p></div>
          <div lang="en" style="border-top:1px solid #e4e9f1;margin-top:22px;padding-top:8px"><p>Hello,</p><p>${esc(invitationEn)}</p><p>${esc(instructionsEn)}</p><p>${esc(privacyEn)}</p></div>
          ${invitationAction(url.href, action)}
          <div style="border-top:1px solid #e4e9f1;margin-top:26px;padding-top:20px"><p style="margin:0"><strong>${esc(cabinet)}</strong></p></div>`,
      });
      let sent = false;
      try {
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: sender,
            to: [email],
            subject: `MADIC | ${title}`,
            text,
            html,
          }),
        });
        sent = response.ok;
      } catch {
        // L'invitation existe déjà, le CRIC peut copier son lien.
      }
      return reply({ email_sent: sent, invitation_url: url.href });
    }
    const { data: profile, error: profileError } = await userDb
      .from("madic_cric_professional_profiles")
      .select(
        "first_name,last_name,business_name,professional_title,license_number,website_url,phone,business_address,logo_path",
      )
      .eq("space_id", spaceId)
      .maybeSingle();
    if (profileError)
      return reply(
        {
          error: "Profil professionnel inaccessible : " + profileError.message,
        },
        400,
      );
    if (
      !profile ||
      !profile.first_name?.trim() ||
      !profile.last_name?.trim() ||
      !profile.business_name?.trim() ||
      !profile.professional_title?.trim() ||
      !profile.license_number?.trim() ||
      !profile.phone?.trim() ||
      !profile.business_address?.trim() ||
      !profile.logo_path?.trim()
    )
      return reply(
        {
          error:
            "Complétez votre profil professionnel et votre logo avant d’inviter un client.",
        },
        400,
      );
    // Vérifie la présence effective du logo privé avant la création de l'invitation.
    const logoName = profile.logo_path.split("/").pop() || "";
    const logoDir = profile.logo_path.slice(
      0,
      profile.logo_path.lastIndexOf("/"),
    );
    if (logoDir !== spaceId)
      return reply({ error: "Chemin du logo invalide." }, 400);
    const { data: objects, error: objectError } = await userDb.storage
      .from("madic-cric-branding")
      .list(logoDir, { search: logoName, limit: 20 });
    if (
      objectError ||
      !objects?.some((o: { name: string }) => o.name === logoName)
    )
      return reply(
        {
          error:
            "Logo professionnel introuvable. Veuillez le téléverser à nouveau.",
        },
        400,
      );
    // Fonction SQL existante : droits, expiration et hash du jeton restent inchangés.
    const { data: invitationToken, error: invitationError } = await userDb.rpc(
      "madic_create_cric_invitation",
      { p_space_id: spaceId, p_email: email },
    );
    if (
      invitationError ||
      typeof invitationToken !== "string" ||
      !/^[0-9a-f]{64}$/i.test(invitationToken)
    )
      return reply(
        {
          error:
            invitationError?.message || "Impossible de créer l'invitation.",
        },
        400,
      );
    const portalOrigin = publicPortalOrigins.get(origin) ?? "https://madic.ca";
    const invitationUrl = new URL("/invitation-client-cric.html", portalOrigin);
    invitationUrl.searchParams.set("token", invitationToken);
    const cabinet = profile.business_name.trim();
    const consultant = `${profile.first_name.trim()} ${profile.last_name.trim()}`;
    const professionalTitle = profile.professional_title.trim();
    const licenseNumber = profile.license_number.trim();
    const phone = profile.phone.trim();
    const websiteRaw = (profile.website_url || "").trim();
    let website = "";
    if (websiteRaw) {
      try {
        const parsed = new URL(websiteRaw);
        if (parsed.protocol !== "https:" || parsed.username || parsed.password)
          return reply(
            {
              error:
                "Le site Web professionnel doit être une adresse HTTPS valide.",
            },
            400,
          );
        website = parsed.toString();
      } catch {
        return reply({ error: "Site Web professionnel invalide." }, 400);
      }
    }
    const safeCabinet = esc(cabinet),
      safeConsultant = esc(consultant);
    const safeTitle = esc(professionalTitle),
      safeLicense = esc(licenseNumber);
    const safePhone = esc(phone);
    const websiteHtml = website
      ? `<p style="margin:4px 0">Site Web : <a href="${esc(website)}">${esc(website)}</a></p>`
      : "";

    // URL signée de 7 jours : bucket privé, sans CID non pris en charge par certains lecteurs.
    const { data: logoLink, error: logoLinkError } = await userDb.storage
      .from("madic-cric-branding")
      .createSignedUrl(profile.logo_path, 7 * 24 * 60 * 60);
    if (logoLinkError || !logoLink?.signedUrl)
      return reply(
        { error: "Impossible de préparer le logo du cabinet." },
        502,
      );

    const subject = `MADIC | Invitation à votre espace client - ${cabinet}`;
    const text = [
      "Bonjour,",
      "",
      `Vous êtes invité(e) à accéder à votre espace client sécurisé auprès de ${cabinet}.`,
      `Votre consultant en immigration : ${consultant}`,
      "",
      "Pour accepter votre invitation, utilisez ce lien personnel :",
      invitationUrl.toString(),
      "",
      "Cette invitation est valable pendant 7 jours.",
      "Ce lien est personnel et confidentiel. Ne le transmettez à personne.",
      "",
      "Si vous n'attendiez pas cette invitation, vous pouvez ignorer ce message.",
      "",
      "Cordialement,",
      consultant,
      professionalTitle,
      `Numéro de permis CRIC : ${licenseNumber}`,
      cabinet,
      `Téléphone : ${phone}`,
      ...(website ? [`Site Web : ${website}`] : []),
      "Invitation envoyée via MADIC PORTAIL",
    ].join("\n");
    const html = invitationEmail({
      title: "Invitation à votre espace client",
      cabinet,
      logoUrl: logoLink.signedUrl,
      footer: "Invitation envoyée via MADIC PORTAIL",
      content: `
        <p>Bonjour,</p>
        <p>Vous êtes invité(e) à accéder à votre espace client sécurisé auprès de <strong>${safeCabinet}</strong>.</p>
        <p><strong>Votre consultant en immigration :</strong> ${safeConsultant}</p>
        ${invitationAction(invitationUrl.toString(), "Accepter mon invitation")}
        <p>Cette invitation est valable pendant <strong>7 jours</strong>.</p>
        <p>Ce lien est personnel et confidentiel. Ne le transmettez à personne.</p>
        <p>Si vous n'attendiez pas cette invitation, vous pouvez ignorer ce message.</p>
        <div style="border-top:1px solid #e4e9f1;margin-top:26px;padding-top:20px">
          <p style="margin:0">Cordialement,</p><p style="margin:8px 0 0"><strong>${safeConsultant}</strong></p>
          <p style="margin:2px 0">${safeTitle}</p><p style="margin:2px 0">Numéro de permis CRIC : ${safeLicense}</p>
          <p style="margin:8px 0 2px"><strong>${safeCabinet}</strong></p><p style="margin:2px 0">Téléphone : ${safePhone}</p>${websiteHtml}
        </div>`,
    });
    let resendResponse: Response;
    try {
      resendResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env("RESEND_API_KEY")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: env("MADIC_EMAIL_FROM"),
          to: [email],
          subject,
          text,
          html,
        }),
      });
    } catch {
      return reply(
        {
          success: false,
          email_sent: false,
          invitation_url: invitationUrl.toString(),
          error:
            "Invitation créée, mais le service de courriel est inaccessible.",
        },
        502,
      );
    }
    if (!resendResponse.ok) {
      console.error("Resend error HTTP:", resendResponse.status);
      return reply(
        {
          success: false,
          email_sent: false,
          invitation_url: invitationUrl.toString(),
          error: "Invitation créée, mais l'envoi du courriel a échoué.",
        },
        502,
      );
    }
    return reply({
      success: true,
      email_sent: true,
      invitation_url: invitationUrl.toString(),
      message: "Invitation envoyée par courriel.",
    });
  } catch (error) {
    console.error(
      "Invitation error:",
      error instanceof Error ? error.message : "Unknown error",
    );
    return reply(
      { success: false, error: "Erreur interne lors de l’invitation." },
      500,
    );
  }
});
