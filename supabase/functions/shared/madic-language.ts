// Langue du destinataire, conservée dans les métadonnées du compte Supabase Auth.
// La préférence doit être synchronisée depuis le portail lors de chaque changement FR/EN.
export type MadicLanguage = "fr" | "en";
export function madicRecipientLanguage(user: { user_metadata?: Record<string, unknown>; app_metadata?: Record<string, unknown> }): MadicLanguage {
  const m = user.user_metadata || {};
  const a = user.app_metadata || {};
  const raw = [m.madic_language, m.preferred_language, m.language, m.locale, a.madic_language, a.preferred_language]
    .find(v => typeof v === "string" && /^(fr|en)([-_].*)?$/i.test(v.trim()));
  return typeof raw === "string" && raw.toLowerCase().startsWith("en") ? "en" : "fr";
}
