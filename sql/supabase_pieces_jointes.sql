-- Exécuter dans Supabase SQL Editor avant de déployer les fichiers.
-- Les règles sont indépendantes du client JavaScript et s'appliquent aux utilisateurs authentifiés.
create or replace function public.madic_can_access_message_conversation(p_conversation_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
 select exists (
   select 1 from public.madic_cric_conversations c
   where c.id = p_conversation_id
     and (c.client_id = (select auth.uid())
       or public.madic_can_manage_cric_space(c.space_id))
 );
$$;
revoke all on function public.madic_can_access_message_conversation(uuid) from public;
grant execute on function public.madic_can_access_message_conversation(uuid) to authenticated;

create table if not exists public.madic_cric_message_attachments (
 id uuid primary key default gen_random_uuid(),
 conversation_id uuid not null references public.madic_cric_conversations(id) on delete cascade,
 uploader_id uuid not null references auth.users(id),
 filename text not null check (length(filename) between 1 and 240),
 storage_path text not null unique,
 mime_type text not null check (mime_type in ('application/pdf','image/jpeg','image/png')),
 size_bytes bigint not null check (size_bytes between 1 and 10485760),
 created_at timestamptz not null default now(),
 constraint madic_attachment_path_check check (storage_path like conversation_id::text || '/%' and storage_path !~ '[[:space:]]')
);
alter table public.madic_cric_message_attachments enable row level security;
drop policy if exists "madic_attachment_select" on public.madic_cric_message_attachments;
create policy "madic_attachment_select" on public.madic_cric_message_attachments for select to authenticated
 using (public.madic_can_access_message_conversation(conversation_id));
drop policy if exists "madic_attachment_insert" on public.madic_cric_message_attachments;
create policy "madic_attachment_insert" on public.madic_cric_message_attachments for insert to authenticated
 with check (uploader_id = (select auth.uid()) and public.madic_can_access_message_conversation(conversation_id));
grant select,insert on public.madic_cric_message_attachments to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('madic-message-attachments','madic-message-attachments',false,10485760,array['application/pdf','image/jpeg','image/png'])
on conflict(id) do update set public=false,file_size_limit=10485760,allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "madic_message_files_insert" on storage.objects;
create policy "madic_message_files_insert" on storage.objects for insert to authenticated
 with check (bucket_id='madic-message-attachments'
   and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
   and public.madic_can_access_message_conversation(((storage.foldername(name))[1])::uuid));
drop policy if exists "madic_message_files_select" on storage.objects;
create policy "madic_message_files_select" on storage.objects for select to authenticated
 using (bucket_id='madic-message-attachments'
   and (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
   and public.madic_can_access_message_conversation(((storage.foldername(name))[1])::uuid));
