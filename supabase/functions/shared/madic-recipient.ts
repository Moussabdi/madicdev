// Salutation personnalisee depuis les metadonnees du compte destinataire.
export function madicRecipientGreeting(user: {user_metadata?: Record<string, unknown>}): string {
  const m = user.user_metadata || {};
  const pick = (...keys: string[]) => keys.map(k => m[k]).find(v => typeof v === "string" && v.trim()) as string | undefined;
  const full = pick("full_name", "nom_complet", "display_name", "name") ||
    [pick("first_name", "prenom"), pick("last_name", "nom")].filter(Boolean).join(" ");
  const raw = (pick("civilite", "civility", "salutation", "title", "gender", "sexe") || "").toLowerCase().trim();
  const civilite = ["mme", "madame", "f", "female", "femme"].includes(raw) ? "Madame" :
    ["m", "mr", "monsieur", "male", "homme"].includes(raw) ? "Monsieur" : "";
  return full ? `Bonjour ${civilite ? civilite + " " : ""}${full}` : "Bonjour";
}
