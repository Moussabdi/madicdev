-- Exécuter une fois dans l’éditeur SQL Supabase (rôle administrateur).
-- Bucket privé : chaque utilisateur ne peut accéder qu’à ses propres fichiers.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('madic-profile-avatars', 'madic-profile-avatars', false, 2097152, ARRAY['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = false, file_size_limit = 2097152, allowed_mime_types = excluded.allowed_mime_types;

create policy "madic_avatar_select_own" on storage.objects for select to authenticated
using (bucket_id = 'madic-profile-avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "madic_avatar_insert_own" on storage.objects for insert to authenticated
with check (bucket_id = 'madic-profile-avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "madic_avatar_delete_own" on storage.objects for delete to authenticated
using (bucket_id = 'madic-profile-avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
