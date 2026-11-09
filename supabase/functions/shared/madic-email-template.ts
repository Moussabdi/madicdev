// MADIC PORTAIL - Gabarit commun de courriels transactionnels.
// Aligné sur le courriel existant d'invitation à l'espace client.
export const escapeEmailHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function madicEmailHtml(input: {
  title: string;
  greeting?: string;
  cabinet: string;
  paragraphs: string[];
  details?: { label: string; value: string }[];
  action?: { label: string; url: string };
}): string {
  const esc = escapeEmailHtml;
  const details = (input.details || []).map(({ label, value }) =>
    `<p style="margin:8px 0"><strong>${esc(label)} :</strong> ${esc(value)}</p>`
  ).join("");
  const paragraphs = input.paragraphs.map((value) =>
    `<p style="margin:14px 0">${esc(value)}</p>`
  ).join("");
  const action = input.action ? `<p style="text-align:center;margin:28px 0"><a href="${esc(input.action.url)}" style="display:inline-block;background:#174b78;color:#ffffff;padding:13px 24px;text-decoration:none;border-radius:6px;font-weight:bold">${esc(input.action.label)}</a></p>` : "";
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:24px;background:#f4f7fb;font-family:Arial,sans-serif;color:#243247">
  <div style="max-width:620px;margin:auto;background:#ffffff;border:1px solid #e4e9f1;border-radius:12px;padding:32px;line-height:1.65">
    <div style="text-align:center;color:#174b78;font-size:17px;font-weight:bold;letter-spacing:.4px;margin-bottom:20px">MADIC PORTAIL</div>
    <h2 style="text-align:center;color:#174b78;margin:12px 0 24px;font-size:21px">${esc(input.title)}</h2>
    <p>${esc(input.greeting || "Bonjour")},</p>${paragraphs}${details}${action}
    <p style="color:#68788d;font-size:13px">Connectez-vous à votre espace MADIC PORTAIL pour consulter les informations à jour.</p>
    <div style="border-top:1px solid #e4e9f1;margin-top:26px;padding-top:20px">
      <p style="margin:0">Cordialement,</p>
      <p style="margin:8px 0 0"><strong>${esc(input.cabinet)}</strong></p>
    </div>
    <p style="color:#68788d;font-size:12px;margin-top:24px">Notification envoyée via MADIC PORTAIL</p>
  </div></body></html>`;
}
