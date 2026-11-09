// MADIC - IRCC official fee schedule reader. Never invent a tariff.
const SOURCE = "https://ircc.canada.ca/francais/information/frais/bareme.asp";
const HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};
function response(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: HEADERS });
}
function plain(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(
      /&(?:nbsp|ensp|emsp|thinsp);|&#(?:160|8239);|&#x(?:a0|202f);/gi,
      " ",
    )
    .replace(
      /&(?:eacute|egrave|ecirc|agrave|acirc|ccedil|rsquo|lsquo|ndash|mdash);/gi,
      (m) =>
        (
          ({
            "&eacute;": "é",
            "&egrave;": "è",
            "&ecirc;": "ê",
            "&agrave;": "à",
            "&acirc;": "â",
            "&ccedil;": "ç",
            "&rsquo;": "’",
            "&lsquo;": "‘",
            "&ndash;": "–",
            "&mdash;": "-",
          }) as Record<string, string>
        )[m.toLowerCase()] || " ",
    )
    .replace(/&#(\d+);|&#x([\da-f]+);/gi, (_m, dec, hex) => {
      const cp = Number.parseInt(dec || hex, dec ? 10 : 16);
      return cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : " ";
    })
    .replace(/&[a-z]+;/gi, " ")
    .replace(/[\u00a0\u202f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
function normalized(value: string): string {
  return plain(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}
function amount(cell: string): number | null {
  const value = plain(cell).replace(/\$/g, "").trim();
  // The entire price cell must be a monetary amount, not descriptive text.
  if (
    !/^(?:\d{1,3}(?:[\s\u00a0\u202f]\d{3})+|\d{1,5})(?:[,.]\d{2})?$/.test(value)
  )
    return null;
  const n = Number(value.replace(/\s/g, "").replace(",", "."));
  return Number.isFinite(n) && n >= 0 && n <= 10000 ? n : null;
}
type Row = { label: string; price: number; section: string };
function parse(html: string) {
  if (!/<table\b/i.test(html))
    throw new Error("Aucun tableau de frais dans la réponse IRCC.");
  // Extract only fee-table rows, preserving the nearest heading/section context.
  const rows: Row[] = [];
  let section = "";
  const blocks = /<(h[1-6]|summary|tr)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  for (const match of html.matchAll(blocks)) {
    const tag = match[1].toLowerCase();
    if (tag !== "tr") {
      section = normalized(match[2]);
      continue;
    }
    const cells = [
      ...match[2].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi),
    ].map((c) => plain(c[1]));
    if (cells.length < 2) continue;
    const price = amount(cells[cells.length - 1]);
    if (price === null) continue;
    rows.push({
      label: normalized(cells.slice(0, -1).join(" ")),
      price,
      section,
    });
  }
  const unique = (predicate: (row: Row) => boolean): number | null => {
    const matches = rows.filter(predicate).map((r) => r.price);
    const values = [...new Set(matches)];
    return values.length === 1 ? values[0] : null;
  };
  const biometrie = {
    personne: unique(
      (r) => /biometrie/.test(r.label) && /par personne/.test(r.label),
    ),
    famille: unique(
      (r) => /biometrie/.test(r.label) && /par famille/.test(r.label),
    ),
    groupe: unique(
      (r) => /biometrie/.test(r.label) && /par groupe/.test(r.label),
    ),
  };
  // IRCC often labels study-permit rows without "par personne".
  // Require an explicit study-permit label, or a clear study-permit section.
  const study = (s: string) => /permis d[' ]?etudes?/.test(s);
  const permisEtudes = unique(
    (r) =>
      (study(r.label) &&
        !/prolongation|retablissement|restauration|biometrie|travail|visa/.test(
          r.label,
        )) ||
      (study(r.section) &&
        /^(?:par personne|demande|frais de traitement)$/.test(r.label)),
  );
  if (
    Object.values(biometrie).some((v) => v === null) ||
    permisEtudes === null
  ) {
    console.error(
      "IRCC parser diagnostics:",
      JSON.stringify({
        totalRows: rows.length,
        biometricCandidates: rows
          .filter((r) => /biometrie/.test(r.label))
          .map((r) => r.label),
        studyCandidates: rows
          .filter((r) => study(r.label) || study(r.section))
          .map((r) => ({ label: r.label, section: r.section })),
      }),
    );
    throw new Error(
      "Structure du barème IRCC non reconnue : aucun tarif ne sera présumé.",
    );
  }
  return { biometrie, permisEtudes };
}
Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { status: 204, headers: HEADERS });
  if (req.method !== "GET")
    return response({ error: "Méthode non autorisée." }, 405);
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    let upstream: Response;
    try {
      upstream = await fetch(SOURCE, {
        signal: controller.signal,
        headers: { Accept: "text/html", "Accept-Language": "fr-CA,fr;q=0.9" },
      });
    } finally {
      clearTimeout(timer);
    }
    if (!upstream.ok)
      throw new Error("IRCC a retourné HTTP " + upstream.status);
    const html = await upstream.text();
    if (html.length > 3_000_000)
      throw new Error("Réponse IRCC trop volumineuse.");
    const rates = parse(html);
    return response({
      verified: true,
      ...rates,
      source: SOURCE,
      checkedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error("IRCC fees:", e);
    return response(
      {
        verified: false,
        error:
          "Tarifs IRCC temporairement indisponibles. Vérifiez les montants sur le site officiel.",
        source: SOURCE,
      },
      503,
    );
  }
});
