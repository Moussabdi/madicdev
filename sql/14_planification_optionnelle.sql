-- OPTION : planifier toutes les 5 minutes dans Supabase SQL Editor.
-- Remplacer <PROJECT_REF> par l'identifiant du projet Supabase.
-- Enregistrer MADIC_CRON_SECRET dans Supabase Vault AVANT cette requete :
-- select vault.create_secret('UNE_CLE_LONGUE_ALEATOIRE', 'madic_rdv_cron_secret');
-- La meme valeur doit etre configuree comme secret Edge Function MADIC_CRON_SECRET.
-- Extensions pg_cron, pg_net et supabase_vault requises (disponibilite selon projet).
-- Ne pas utiliser la cle service_role ici. Ne jamais mettre cette cle dans Git.
-- Executer ce bloc seulement APRES avoir remplace <PROJECT_REF> et configure Vault.
/*
select cron.schedule(
 'madic-rdv-email-worker-5min',
 '*/5 * * * *',
 $$
 select net.http_post(
   url := 'https://<PROJECT_REF>.supabase.co/functions/v1/madic-rdv-email-worker',
   headers := jsonb_build_object(
     'Content-Type','application/json',
     'x-madic-cron-secret',(select decrypted_secret from vault.decrypted_secrets where name='madic_rdv_cron_secret' limit 1)
   ),
   body := '{}'::jsonb
 );
 $$
);
*/
