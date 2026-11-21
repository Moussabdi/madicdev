begin;

create table if not exists public.madic_cric_onboarding_invites (
  prevalidation_id uuid primary key references public.madic_cric_prevalidations(id),
  email text not null,
  token_hash text not null unique,
  invited_by uuid not null,
  sent_at timestamptz not null default now(),
  delivered_at timestamptz,
  expires_at timestamptz not null,
  claimed_by uuid references auth.users(id),
  claimed_at timestamptz
);
create table if not exists public.madic_cric_identity_reviews (
  user_id uuid primary key references public.madic_cric_applications(user_id),
  document_type text not null check (document_type in ('passport','driver_licence','photo_id')),
  object_path text not null unique,
  status text not null default 'submitted' check (status in ('submitted','verified','refused')),
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid,
  review_note text
);
create table if not exists public.madic_cric_professional_revocations (
  user_id uuid primary key references public.madic_cric_applications(user_id),
  revoked_by uuid not null,
  reason text not null,
  revoked_at timestamptz not null default now()
);
create table if not exists public.madic_radar_sessions (
  space_id uuid not null references public.madic_cric_spaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  actor_type text not null check (actor_type in ('cric','client')),
  session_id uuid not null,
  country_code text check (country_code ~ '^[A-Z]{2}$'),
  occurred_at timestamptz not null default now(),
  primary key (space_id,user_id,actor_type,session_id)
);
create index if not exists madic_radar_sessions_period on public.madic_radar_sessions(occurred_at,space_id);

alter table public.madic_cric_onboarding_invites enable row level security;
alter table public.madic_cric_identity_reviews enable row level security;
alter table public.madic_cric_professional_revocations enable row level security;
alter table public.madic_radar_sessions enable row level security;
revoke all on public.madic_cric_onboarding_invites, public.madic_cric_identity_reviews,
  public.madic_cric_professional_revocations, public.madic_radar_sessions from public, anon, authenticated;

create or replace function public.madic_assert_cric_admin()
returns void language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null or public.madic_is_super_admin() is distinct from true
    or auth.jwt()->>'aal' is distinct from 'aal2' then
    raise exception 'Super administrateur avec double authentification requis' using errcode='42501';
  end if;
end $$;

create or replace function public.madic_issue_cric_onboarding(p_prevalidation uuid, p_email text, p_token_hash text)
returns void language plpgsql security definer set search_path='' as $$
declare
  item public.madic_cric_prevalidations%rowtype;
  email_address text := lower(btrim(p_email));
begin
  perform public.madic_assert_cric_admin();
  if email_address is null or length(email_address)>254
    or email_address !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or p_token_hash is null or p_token_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'Invitation invalide' using errcode='22023';
  end if;
  select * into item from public.madic_cric_prevalidations where id=p_prevalidation for update;
  if not found or item.registry_verified is distinct from true
    or item.status not in ('pending','approved') or item.expires_at<=now()
    or (item.claimed_by is not null and not exists (
      select from public.madic_cric_applications a where a.user_id=item.claimed_by
        and a.license_number=item.license_number and a.status='pending' and lower(a.professional_email)=email_address
    ))
    or exists (select from public.madic_cric_applications a where upper(a.license_number)=upper(item.license_number) and
      (a.status<>'pending' or lower(a.professional_email)<>email_address)) then
    raise exception 'Prévalidation expirée, non admissible ou déjà associée';
  end if;
  if exists (select from public.madic_cric_onboarding_invites
    where prevalidation_id=item.id and sent_at>now()-interval '30 seconds'
      and claimed_at is null) then
    raise exception 'Patientez 30 secondes avant de renvoyer';
  end if;
  insert into public.madic_cric_onboarding_invites(prevalidation_id,email,token_hash,invited_by,expires_at)
    values(item.id,email_address,p_token_hash,auth.uid(),least(item.expires_at,now()+interval '7 days'))
  on conflict(prevalidation_id) do update set
    email=excluded.email,token_hash=excluded.token_hash,invited_by=excluded.invited_by,
    sent_at=now(),delivered_at=null,expires_at=excluded.expires_at
  where madic_cric_onboarding_invites.claimed_at is null;
  if not found then raise exception 'Invitation déjà utilisée'; end if;
end $$;

-- Appelé après acceptation par Resend. Une ancienne réponse ne marque jamais un nouveau lien.
create or replace function public.madic_mark_cric_invite_sent(p_prevalidation uuid, p_token_hash text)
returns void language sql security definer set search_path='' as $$
  update public.madic_cric_onboarding_invites set delivered_at=now()
    where prevalidation_id=p_prevalidation and token_hash=p_token_hash
$$;

create or replace function public.madic_check_cric_onboarding(p_token text, p_email text)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select from public.madic_cric_onboarding_invites i
    join public.madic_cric_prevalidations p on p.id=i.prevalidation_id
    where p_token ~ '^[a-f0-9]{64}$' and i.token_hash=encode(extensions.digest(p_token,'sha256'),'hex')
      and i.email=lower(btrim(p_email)) and i.claimed_at is null and least(i.expires_at,p.expires_at)>now()
      and p.registry_verified and p.status in ('pending','approved'))
$$;

create or replace function public.madic_claim_cric_onboarding(p_token text)
returns void language plpgsql security definer set search_path='' as $$
declare
  principal uuid := auth.uid();
  verified_email text;
  token_digest text;
  target uuid;
  invitation public.madic_cric_onboarding_invites%rowtype;
  item public.madic_cric_prevalidations%rowtype;
begin
  if principal is null or auth.jwt()->>'aal' is distinct from 'aal2'
    or p_token is null or p_token !~ '^[a-f0-9]{64}$' then
    raise exception 'Invitation ou session invalide' using errcode='42501';
  end if;
  select lower(email) into verified_email from auth.users where id=principal and email_confirmed_at is not null;
  token_digest := encode(extensions.digest(p_token,'sha256'),'hex');
  select prevalidation_id into target from public.madic_cric_onboarding_invites where token_hash=token_digest;
  select * into item from public.madic_cric_prevalidations where id=target for update;
  if not found or item.registry_verified is distinct from true or item.status not in ('pending','approved') then
    raise exception 'Invitation expirée ou invalide';
  end if;
  select * into invitation from public.madic_cric_onboarding_invites where prevalidation_id=target for update;
  if not found or invitation.token_hash<>token_digest or verified_email is distinct from invitation.email then
    raise exception 'Invitation ou courriel invalide';
  end if;
  if invitation.claimed_by=principal then return; end if;
  if invitation.claimed_at is not null or invitation.expires_at<=now() or item.expires_at<=now()
    or (item.claimed_by is not null and item.claimed_by<>principal) then raise exception 'Invitation expirée ou utilisée'; end if;
  insert into public.madic_cric_applications(user_id,full_name,license_number,professional_email)
    values(principal,item.full_name,item.license_number,verified_email)
  on conflict(user_id) do nothing;
  if not exists(select from public.madic_cric_applications a
    where a.user_id=principal and a.license_number=item.license_number and a.status='pending'
      and lower(a.professional_email)=verified_email) then
    raise exception 'Le compte est déjà associé à une autre demande';
  end if;
  update public.madic_cric_prevalidations set claimed_by=principal where id=item.id;
  update public.madic_cric_onboarding_invites set claimed_by=principal,claimed_at=now() where prevalidation_id=target;
end $$;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('madic-cric-identity','madic-cric-identity',false,8388608,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create or replace function public.madic_cric_identity_may_submit()
returns boolean language sql stable security definer set search_path='' as $$
  select auth.jwt()->>'aal' = 'aal2' and exists(
    select from public.madic_cric_applications a
    join public.madic_cric_prevalidations p on p.claimed_by=a.user_id and p.license_number=a.license_number
    join public.madic_cric_onboarding_invites i on i.prevalidation_id=p.id and i.claimed_by=a.user_id
    where a.user_id=auth.uid() and a.status='pending' and p.registry_verified is true
      and p.status in ('pending','approved')
  ) and not exists(select from public.madic_cric_identity_reviews d where d.user_id=auth.uid())
$$;

drop policy if exists madic_cric_identity_insert on storage.objects;
create policy madic_cric_identity_insert on storage.objects for insert to authenticated with check (
  bucket_id='madic-cric-identity' and name=auth.uid()::text||'/photo' and public.madic_cric_identity_may_submit()
);
drop policy if exists madic_cric_identity_read on storage.objects;
create policy madic_cric_identity_read on storage.objects for select to authenticated using (
  bucket_id='madic-cric-identity' and auth.jwt()->>'aal'='aal2' and (
    public.madic_is_super_admin() or name=auth.uid()::text||'/photo'
  )
);
drop policy if exists madic_cric_identity_delete on storage.objects;
create policy madic_cric_identity_delete on storage.objects for delete to authenticated using (
  bucket_id='madic-cric-identity' and (
    (name=auth.uid()::text||'/photo' and public.madic_cric_identity_may_submit())
    or (auth.jwt()->>'aal'='aal2' and public.madic_is_super_admin() and exists (
      select from public.madic_cric_identity_reviews d where d.object_path=objects.name and d.status in ('verified','refused')
    ))
  )
);
-- Lecture des métadonnées nécessaire à la condition de suppression administrateur.
grant select on public.madic_cric_identity_reviews to authenticated;
drop policy if exists madic_cric_identity_review_metadata_read on public.madic_cric_identity_reviews;
create policy madic_cric_identity_review_metadata_read on public.madic_cric_identity_reviews
for select to authenticated using (auth.jwt()->>'aal'='aal2' and public.madic_is_super_admin());

create or replace function public.madic_submit_cric_identity(p_type text)
returns void language plpgsql security definer set search_path='' as $$
declare principal uuid := auth.uid();
begin
  perform 1 from public.madic_cric_applications where user_id=principal for update;
  if exists(select from public.madic_cric_identity_reviews where user_id=principal)
     and auth.jwt()->>'aal'='aal2' then return; end if;
  if public.madic_cric_identity_may_submit() is distinct from true then
    raise exception 'Dépôt non autorisé' using errcode='42501';
  end if;
  perform 1 from storage.objects where bucket_id='madic-cric-identity' and name=principal::text||'/photo' for update;
  if not found then raise exception 'Document introuvable'; end if;
  insert into public.madic_cric_identity_reviews(user_id,document_type,object_path)
    values(principal,p_type,principal::text||'/photo');
end $$;

create or replace function public.madic_my_cric_identity()
returns text language sql stable security definer set search_path='' as $$
 select coalesce((select case when a.status='approved' then 'approved' when a.status='rejected' then 'rejected' end
                  from public.madic_cric_applications a where a.user_id=auth.uid()),
   (select d.status from public.madic_cric_identity_reviews d where d.user_id=auth.uid()),
   case when public.madic_cric_identity_may_submit() then 'required' else 'unavailable' end)
$$;

create or replace function public.madic_review_cric_identity(p_user_id uuid, p_verified boolean, p_note text)
returns void language plpgsql security definer set search_path='' as $$
declare review public.madic_cric_identity_reviews%rowtype;
begin
  perform public.madic_assert_cric_admin();
  if p_verified is null or length(btrim(coalesce(p_note,''))) not between 5 and 500 then
    raise exception 'Note de contrôle obligatoire (5 à 500 caractères)';
  end if;
  perform 1 from public.madic_cric_applications where user_id=p_user_id and status='pending' for update;
  if not found then raise exception 'Demande déjà traitée'; end if;
  select * into review from public.madic_cric_identity_reviews where user_id=p_user_id for update;
  if not found or review.status<>'submitted' then raise exception 'Document absent ou déjà examiné'; end if;
  perform 1 from storage.objects where bucket_id='madic-cric-identity' and name=review.object_path for share;
  if not found then raise exception 'Document introuvable'; end if;
  update public.madic_cric_identity_reviews set status=case when p_verified then 'verified' else 'refused' end,
    reviewed_at=now(),reviewed_by=auth.uid(),review_note=btrim(p_note) where user_id=p_user_id;
end $$;

-- Garde serveur y compris lorsque la décision passe par une ancienne page ou RPC.
create or replace function public.madic_guard_cric_decision()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if tg_op='UPDATE' and new.status is not distinct from old.status then return new; end if;
  if new.status='approved' then
    perform public.madic_assert_cric_admin();
    if exists(select from public.madic_cric_professional_revocations where user_id=new.user_id)
      or not exists(select from public.madic_cric_identity_reviews where user_id=new.user_id and status='verified')
      or not exists(select from public.madic_cric_prevalidations p where p.claimed_by=new.user_id
        and p.license_number=new.license_number and p.registry_verified and p.status in ('pending','approved')) then
      raise exception 'Identité avec photo et vérification CCIC obligatoires' using errcode='42501';
    end if;
    update public.madic_cric_prevalidations set status='approved' where claimed_by=new.user_id and license_number=new.license_number and status='pending';
  elsif tg_op='UPDATE' and new.status='rejected' and old.status='pending' then
    perform public.madic_assert_cric_admin();
    if not exists(select from public.madic_cric_identity_reviews where user_id=new.user_id and status in ('verified','refused')) then
      raise exception 'Examinez la pièce d’identité avant de décider' using errcode='42501';
    end if;
    update public.madic_cric_prevalidations set status='rejected' where claimed_by=new.user_id and license_number=new.license_number and status in ('pending','approved');
  end if;
  return new;
end $$;
drop trigger if exists madic_guard_cric_decision on public.madic_cric_applications;
create trigger madic_guard_cric_decision before insert or update of status on public.madic_cric_applications
for each row execute function public.madic_guard_cric_decision();

create or replace function public.madic_admin_revoke_cric(p_user_id uuid, p_reason text)
returns void language plpgsql security definer set search_path='' as $$
begin
  perform public.madic_assert_cric_admin();
  if p_user_id=auth.uid() or exists(select from public.madic_super_admins where user_id=p_user_id)
    or length(btrim(coalesce(p_reason,''))) not between 5 and 500 then
    raise exception 'Révocation invalide' using errcode='22023';
  end if;
  perform 1 from public.madic_cric_applications where user_id=p_user_id and status='approved' for update;
  if not found then
    if exists(select from public.madic_cric_professional_revocations where user_id=p_user_id) then return; end if;
    raise exception 'Compte CRIC non approuvé';
  end if;
  insert into public.madic_cric_professional_revocations(user_id,revoked_by,reason)
    values(p_user_id,auth.uid(),btrim(p_reason));
  update public.madic_cric_applications set status='rejected',admin_note=btrim(p_reason),
    reviewed_at=now(),reviewed_by=auth.uid() where user_id=p_user_id;
  update public.madic_cric_spaces set access_status='suspended',suspended_at=now(),
    suspension_reason=btrim(p_reason) where owner_user_id=p_user_id;
end $$;

-- Même protection si une action d’abonnement existante essaie de réactiver le cabinet.
create or replace function public.madic_guard_cric_space_reactivation()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.access_status='active' and exists(
    select from public.madic_cric_professional_revocations where user_id=new.owner_user_id
  ) then
    raise exception 'La révocation professionnelle bloque la réactivation du cabinet' using errcode='42501';
  end if;
  return new;
end $$;
revoke all on function public.madic_guard_cric_space_reactivation() from public,anon,authenticated;
drop trigger if exists madic_guard_cric_space_reactivation on public.madic_cric_spaces;
create trigger madic_guard_cric_space_reactivation before insert or update of access_status,owner_user_id on public.madic_cric_spaces
for each row execute function public.madic_guard_cric_space_reactivation();

create or replace function public.madic_admin_cric_onboarding_state()
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  perform public.madic_assert_cric_admin();
  return jsonb_build_object(
    'identity',coalesce((select jsonb_agg(jsonb_build_object(
      'user_id',d.user_id,'status',d.status,'document_type',d.document_type,'object_path',o.name))
      from public.madic_cric_identity_reviews d
      left join storage.objects o on o.bucket_id='madic-cric-identity' and o.name=d.object_path),'[]'::jsonb),
    'invites',coalesce((select jsonb_agg(jsonb_build_object('prevalidation_id',i.prevalidation_id,
      'email',i.email,'delivered_at',i.delivered_at,'claimed_at',i.claimed_at,'expires_at',i.expires_at))
      from public.madic_cric_onboarding_invites i),'[]'::jsonb),
    'revoked',coalesce((select jsonb_agg(user_id) from public.madic_cric_professional_revocations),'[]'::jsonb)
  );
end $$;

create or replace function public.madic_radar_record_session(p_user uuid,p_session uuid,p_country text,p_actor text)
returns void language plpgsql security definer set search_path='' as $$
declare country text := case when p_country ~ '^[A-Z]{2}$' then p_country end;
begin
  if p_user is null or p_session is null or p_actor is null or p_actor not in ('cric','client') then return; end if;
  insert into public.madic_radar_sessions(space_id,user_id,actor_type,session_id,country_code)
  select s.id,p_user,p_actor,p_session,country from public.madic_cric_spaces s
  where s.access_status='active' and (
    (p_actor='cric' and s.owner_user_id=p_user and exists(
      select from public.madic_cric_applications a where a.user_id=p_user and a.status='approved'
    ))
    or (p_actor='client' and exists(
      select from public.madic_cric_clients c where c.space_id=s.id and c.client_id=p_user
    ))
  ) on conflict do nothing;
end $$;

create or replace function public.madic_admin_radar(p_days integer)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
  cutoff timestamptz;
  result jsonb;
begin
  perform public.madic_assert_cric_admin();
  if p_days is null or p_days not in (7,30,90,365) then raise exception 'Période invalide'; end if;
  cutoff := now()-make_interval(days=>p_days);
  with tracked as (
    select s.space_id,s.user_id,s.actor_type,coalesce(l.first_seen,s.occurred_at) as occurred_at,s.country_code
    from public.madic_radar_sessions s
    left join lateral (
      select min(a.created_at) as first_seen from public.madic_client_activity_logs a
      where s.actor_type='client' and a.space_id=s.space_id and a.client_id=s.user_id
        and a.event_type='portal_login' and a.auth_session_id=s.session_id
    ) l on true
    where s.occurred_at>=cutoff
  ), old_clients as (
    select a.space_id,a.client_id as user_id,'client'::text as actor_type,a.created_at as occurred_at,null::text as country_code
    from public.madic_client_activity_logs a
    where a.event_type='portal_login' and a.created_at>=cutoff and not exists (
      select from public.madic_radar_sessions s where s.space_id=a.space_id and s.user_id=a.client_id
        and s.actor_type='client' and s.session_id=a.auth_session_id
    )
  ), activity as (
    select * from tracked where occurred_at>=cutoff union all select * from old_clients
  ), object_keys as (
    select d.space_id,'madic-documents'::text as bucket,f.storage_path as path
      from public.documents f join public.dossiers d on d.id=f.dossier_id
    union
    select c.space_id,'madic-message-attachments',f.storage_path
      from public.madic_cric_message_attachments f join public.madic_cric_conversations c on c.id=f.conversation_id
    union
    select s.id,'madic-cric-branding',o.name from public.madic_cric_spaces s
      join storage.objects o on o.bucket_id='madic-cric-branding' and split_part(o.name,'/',1)=s.id::text
    union
    select c.space_id,'madic-documents',path.name
      from public.madic_initial_contracts c cross join lateral (values
        ('contrats-signes/'||c.client_id||'/'||c.id||'.pdf'),
        ('contrats-client-cric/'||c.client_id||'/'||c.id||'.pdf')
      ) path(name)
  ), usage as (
    select k.space_id,sum((o.metadata->>'size')::bigint) bytes
    from object_keys k join storage.objects o on o.bucket_id=k.bucket and o.name=k.path
    where o.metadata->>'size' ~ '^[0-9]{1,16}$' group by k.space_id
  ), firms as (
    select s.id, s.name, a.full_name, a.license_number, s.subscription_plan, s.access_status, s.payment_status,
      r.user_id is not null as revoked, u.bytes as storage_bytes,
      (select count(*) from activity e where e.space_id=s.id and e.actor_type='cric') as cric_logins,
      (select count(*) from activity e where e.space_id=s.id and e.actor_type='client') as client_logins,
      coalesce((select jsonb_agg(jsonb_build_object('id',c.client_id,
        'name',coalesce(nullif(btrim(concat_ws(' ',p.first_name,p.last_name)),''),p.email,'-'),
        'logins',(select count(*) from activity e where e.space_id=c.space_id and e.user_id=c.client_id and e.actor_type='client'))
        order by p.last_name,p.first_name,c.client_id)
        from public.madic_cric_clients c left join public.profiles p on p.id=c.client_id where c.space_id=s.id),'[]'::jsonb) as clients
    from public.madic_cric_applications a
    left join public.madic_cric_spaces s on s.owner_user_id=a.user_id
    left join public.madic_cric_professional_revocations r on r.user_id=a.user_id
    left join usage u on u.space_id=s.id
    where a.status='approved' or r.user_id is not null
  ), timeline as (
    select space_id,actor_type,to_char(date_trunc(case when p_days<=30 then 'day' else 'month' end,
      occurred_at at time zone 'America/Toronto'),'YYYY-MM-DD') as period,count(*) as logins
    from activity group by 1,2,3
  ), geography as (
    select space_id,actor_type,country_code,count(*) as logins from activity group by 1,2,3
  )
  select jsonb_build_object(
    'firms',coalesce((select jsonb_agg(to_jsonb(f) order by f.full_name) from firms f),'[]'::jsonb),
    'timeline',coalesce((select jsonb_agg(to_jsonb(t) order by t.period) from timeline t),'[]'::jsonb),
    'geography',coalesce((select jsonb_agg(to_jsonb(g) order by g.logins desc) from geography g),'[]'::jsonb)
  ) into result;
  return result;
end $$;

revoke all on function public.madic_assert_cric_admin(), public.madic_issue_cric_onboarding(uuid,text,text),
 public.madic_mark_cric_invite_sent(uuid,text), public.madic_check_cric_onboarding(text,text), public.madic_claim_cric_onboarding(text),
 public.madic_cric_identity_may_submit(), public.madic_submit_cric_identity(text), public.madic_my_cric_identity(),
 public.madic_review_cric_identity(uuid,boolean,text), public.madic_guard_cric_decision(),
 public.madic_admin_revoke_cric(uuid,text), public.madic_admin_cric_onboarding_state(),
 public.madic_radar_record_session(uuid,uuid,text,text), public.madic_admin_radar(integer)
 from public,anon,authenticated;
grant execute on function public.madic_issue_cric_onboarding(uuid,text,text), public.madic_claim_cric_onboarding(text),
 public.madic_cric_identity_may_submit(), public.madic_submit_cric_identity(text), public.madic_my_cric_identity(),
 public.madic_review_cric_identity(uuid,boolean,text), public.madic_admin_revoke_cric(uuid,text),
 public.madic_admin_cric_onboarding_state(), public.madic_admin_radar(integer) to authenticated;
grant execute on function public.madic_check_cric_onboarding(text,text) to anon,authenticated;
grant execute on function public.madic_mark_cric_invite_sent(uuid,text), public.madic_radar_record_session(uuid,uuid,text,text) to service_role;

notify pgrst, 'reload schema';
commit;
