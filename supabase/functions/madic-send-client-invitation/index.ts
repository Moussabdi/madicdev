import { createClient } from "npm:@supabase/supabase-js@2";
const PORTAL_URL = "https://madic.ca/invitation-client-cric.html";
const allowedOrigins = new Set([
  "https://madic.ca",
  "https://www.madic.ca",
  "http://127.0.0.1:5500",
  "http://localhost:5500",
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
Deno.serve(async (req: Request): Promise<Response> => {
  const origin = req.headers.get("Origin") || "";
  const headers: Record<string, string> = {
    "Access-Control-Allow-Origin": allowedOrigins.has(origin)
      ? origin
      : "https://madic.ca",
    Vary: "Origin",
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
    const invitationUrl = new URL(PORTAL_URL);
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
          return reply({ error: "Le site Web professionnel doit être une adresse HTTPS valide." }, 400);
        website = parsed.toString();
      } catch { return reply({ error: "Site Web professionnel invalide." }, 400); }
    }
    const safeCabinet = esc(cabinet), safeConsultant = esc(consultant);
    const safeTitle = esc(professionalTitle), safeLicense = esc(licenseNumber);
    const safePhone = esc(phone), safeUrl = esc(invitationUrl.toString());
    const websiteHtml = website ? `<p style="margin:4px 0">Site Web : <a href="${esc(website)}">${esc(website)}</a></p>` : "";

    // URL signée de 7 jours : bucket privé, sans CID non pris en charge par certains lecteurs.
    const { data: logoLink, error: logoLinkError } = await userDb.storage
      .from("madic-cric-branding").createSignedUrl(profile.logo_path, 7 * 24 * 60 * 60);
    if (logoLinkError || !logoLink?.signedUrl)
      return reply({ error: "Impossible de préparer le logo du cabinet." }, 502);
    const safeLogoUrl = esc(logoLink.signedUrl);

    const subject = `MADIC | Invitation à votre espace client - ${cabinet}`;
    const text = [
      "Bonjour,", "",
      `Vous êtes invité(e) à accéder à votre espace client sécurisé auprès de ${cabinet}.`,
      `Votre consultant en immigration : ${consultant}`, "",
      "Pour accepter votre invitation, utilisez ce lien personnel :",
      invitationUrl.toString(), "",
      "Cette invitation est valable pendant 7 jours.",
      "Ce lien est personnel et confidentiel. Ne le transmettez à personne.", "",
      "Si vous n'attendiez pas cette invitation, vous pouvez ignorer ce message.", "",
      "Cordialement,", consultant, professionalTitle,
      `Numéro de permis CRIC : ${licenseNumber}`, cabinet,
      `Téléphone : ${phone}`,
      ...(website ? [`Site Web : ${website}`] : []),
      "Invitation envoyée via MADIC PORTAIL",
    ].join("\n");
    const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#f4f7fb;font-family:Arial,sans-serif;color:#243247">
      <div style="max-width:620px;margin:auto;background:#fff;border:1px solid #e4e9f1;border-radius:12px;padding:32px;line-height:1.65">
        <div style="text-align:center;margin-bottom:20px"><img src="${safeLogoUrl}" alt="Logo de ${safeCabinet}" width="160" style="max-width:160px;max-height:90px;width:auto;height:auto"></div>
        <h2 style="text-align:center;color:#174b78;margin:12px 0 24px">Invitation à votre espace client</h2>
        <p>Bonjour,</p>
        <p>Vous êtes invité(e) à accéder à votre espace client sécurisé auprès de <strong>${safeCabinet}</strong>.</p>
        <p><strong>Votre consultant en immigration :</strong> ${safeConsultant}</p>
        <p style="text-align:center;margin:28px 0"><a href="${safeUrl}" style="display:inline-block;background:#174b78;color:#fff;padding:13px 24px;text-decoration:none;border-radius:6px;font-weight:bold">Accepter mon invitation</a></p>
        <p>Cette invitation est valable pendant <strong>7 jours</strong>.</p>
        <p>Ce lien est personnel et confidentiel. Ne le transmettez à personne.</p>
        <p>Si vous n'attendiez pas cette invitation, vous pouvez ignorer ce message.</p>
        <div style="border-top:1px solid #e4e9f1;margin-top:26px;padding-top:20px">
          <p style="margin:0">Cordialement,</p><p style="margin:8px 0 0"><strong>${safeConsultant}</strong></p>
          <p style="margin:2px 0">${safeTitle}</p><p style="margin:2px 0">Numéro de permis CRIC : ${safeLicense}</p>
          <p style="margin:8px 0 2px"><strong>${safeCabinet}</strong></p><p style="margin:2px 0">Téléphone : ${safePhone}</p>${websiteHtml}
        </div><p style="color:#68788d;font-size:12px;margin-top:24px">Invitation envoyée via MADIC PORTAIL</p>
      </div></body></html>`;
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
