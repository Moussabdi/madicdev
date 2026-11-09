import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const REGISTER =
  "https://registre.college-ic.ca/Public-Register-FR/RCIC_Search.aspx";
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
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
const hash = async (s: string) =>
  Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)),
    ),
  )
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
const decode = (s: string) =>
  s
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#(?:x([0-9a-f]+)|(\d+));/gi, (_, h, d) =>
      String.fromCodePoint(parseInt(h || d, h ? 16 : 10)),
    );
const strip = (s: string) =>
  decode(s.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
const attrs = (tag: string) => {
  const a: Record<string, string> = {};
  for (const m of tag.matchAll(/([\w:$-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g))
    a[m[1].toLowerCase()] = decode(m[2] ?? m[3] ?? "");
  return a;
};
const prefix =
  "ctl01$TemplateBody$WebPartManager1$gwpciRCICSearchFR$ciRCICSearchFR$ResultsGrid$Sheet0$";
const submit = prefix + "SubmitButton";

async function lookup(fullName: string, license: string) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const page = await fetch(REGISTER, {
      headers: { Accept: "text/html" },
      signal: controller.signal,
    });
    if (!page.ok) throw new Error("GET_HTTP_" + page.status);
    const html = await page.text();
    const form = new URLSearchParams();
    for (const tag of html.match(/<input\b[^>]*>/gi) ?? []) {
      const a = attrs(tag);
      if (
        !a.name ||
        ["submit", "button", "image", "file", "reset"].includes(
          (a.type || "text").toLowerCase(),
        )
      )
        continue;
      if (
        ["checkbox", "radio"].includes((a.type || "").toLowerCase()) &&
        !/\bchecked(?:\s|=|>)/i.test(tag)
      )
        continue;
      form.set(a.name, a.value || "");
    }
    // Do not require guessed ctl03/ctl07/ctl11 fields: they are not guaranteed to exist.
    if (!form.has("__VIEWSTATE")) throw new Error("MISSING_VIEWSTATE");
    if (!form.has(prefix + "Input2$TextBox1"))
      throw new Error("MISSING_SEARCH_INPUT");
    form.set(prefix + "Input0$TextBox1", "");
    form.set(prefix + "Input1$TextBox1", "");
    form.set(prefix + "Input2$TextBox1", license);
    form.set("__EVENTTARGET", submit);
    form.set("__EVENTARGUMENT", "");
    // Standard WebForms postback, avoiding a guessed AJAX ScriptManager control ID.
    form.delete("__ASYNCPOST");
    const cookies =
      typeof page.headers.getSetCookie === "function"
        ? page.headers
            .getSetCookie()
            .map((v) => v.split(";", 1)[0])
            .join("; ")
        : "";
    const headers: Record<string, string> = {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "text/html,application/xhtml+xml",
      Origin: "https://registre.college-ic.ca",
      Referer: REGISTER,
    };
    if (cookies) headers.Cookie = cookies;
    const search = await fetch(REGISTER, {
      method: "POST",
      headers,
      body: form,
      signal: controller.signal,
    });
    if (!search.ok) throw new Error("POST_HTTP_" + search.status);
    const result = await search.text();
    const rows = [...result.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)];
    let recognized = false;
    for (const row of rows) {
      const cells = [...row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(
        (m) => strip(m[1]),
      );
      if (cells.length < 7) continue;
      const [, id, name, , , category, entitled] = cells;
      if (!/^R\d{6,}$/i.test(id)) continue;
      recognized = true;
      if (id.toUpperCase() !== license || norm(name) !== norm(fullName))
        continue;
      return {
        verified: /\bCRIC\b/i.test(category) && /^(YES|OUI)$/i.test(entitled),
        registry_name: name,
        registry_license: id,
        category,
        entitled_to_practise: entitled,
      };
    }
    // Empty results cannot be distinguished reliably from a changed registry page.
    if (!recognized) throw new Error("NO_PARSEABLE_RESULTS");
    return { verified: false, reason: "no_matching_active_license" };
  } finally {
    clearTimeout(timer);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST")
    return reply({ error: "Méthode non autorisée" }, 405);
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key)
    return reply({ error: "Configuration serveur incomplète" }, 500);
  const admin = createClient(url, key, { auth: { persistSession: false } });
  try {
    const body = await req.json();
    if (body.action === "request") {
      const name = String(body.full_name || "")
        .trim()
        .replace(/\s+/g, " ");
      const license = String(body.license_number || "")
        .trim()
        .toUpperCase();
      if (name.length < 3 || name.length > 150 || !/^R\d{6,}$/.test(license))
        return reply({ error: "Nom ou numéro CRIC invalide" }, 400);
      let result;
      try {
        result = await lookup(name, license);
      } catch (e) {
        console.error(
          "CCIC lookup:",
          e instanceof Error ? e.message : String(e),
        );
        return reply(
          {
            verified: false,
            status: "verification_unavailable",
            error:
              "La consultation du registre CCIC est indisponible. Aucun permis non vérifié ne sera approuvé.",
          },
          503,
        );
      }
      if (!result.verified)
        return reply(
          {
            verified: false,
            status: "rejected",
            error: "Permis, nom et droit d’exercer non confirmés.",
          },
          422,
        );
      const token = crypto.randomUUID() + crypto.randomUUID();
      const { error } = await admin
        .from("madic_cric_prevalidations")
        .insert({
          full_name: name,
          license_number: license,
          lookup_token_hash: await hash(token),
          status: "pending",
        });
      if (error) throw error;
      return reply({
        verified: true,
        status: "pending",
        token,
        registry: result,
        message:
          "Permis confirmé dans le registre CCIC. Identité du demandeur à confirmer avant activation.",
      });
    }
    if (body.action === "status") {
      const token = String(body.token || "");
      if (!/^[a-f0-9-]{72}$/.test(token))
        return reply({ error: "Référence invalide" }, 400);
      const { data, error } = await admin
        .from("madic_cric_prevalidations")
        .select("full_name,license_number,status,expires_at")
        .eq("lookup_token_hash", await hash(token))
        .maybeSingle();
      if (error) throw error;
      if (!data) return reply({ error: "Demande introuvable" }, 404);
      if (new Date(data.expires_at).getTime() < Date.now())
        return reply({ status: "expired", verified: false });
      return reply({
        status: data.status,
        verified: data.status === "approved",
        full_name: data.full_name,
        license_number: data.license_number,
      });
    }
    return reply({ error: "Action inconnue" }, 400);
  } catch (e) {
    console.error("MADIC server:", e);
    return reply({ error: "Erreur de vérification" }, 500);
  }
});
