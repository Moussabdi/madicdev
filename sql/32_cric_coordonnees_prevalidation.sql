begin;

alter table public.madic_cric_prevalidations
  add column if not exists professional_email text,
  add column if not exists professional_phone text,
  add column if not exists professional_address text;

create or replace function public.madic_save_cric_prevalidation_contact(
  p_token text, p_email text, p_phone text, p_address text
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(p_email));
  v_phone text := btrim(p_phone);
  v_address text := regexp_replace(p_address, '^[[:space:]]+|[[:space:]]+$', '', 'g');
  v_request public.madic_cric_prevalidations%rowtype;
begin
  if p_token is null or length(p_token) <> 72
    or p_token !~ '^[a-f0-9-]{72}$'
    or v_email is null or length(v_email) > 254
    or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    or v_phone is null or length(v_phone) > 48
    or length(regexp_replace(v_phone, '[^0-9]', '', 'g')) < 7
    or v_address is null or length(v_address) not between 5 and 500 then
    return false;
  end if;

  select p.* into v_request
  from public.madic_cric_prevalidations p
  where p.lookup_token_hash = encode(sha256(convert_to(p_token, 'UTF8')), 'hex')
    and p.registry_verified is true
    and p.expires_at > now()
  for update;

  if not found then
    return false;
  end if;

  if v_request.professional_email is not null then
    return v_request.professional_email = v_email
      and v_request.professional_phone = v_phone
      and v_request.professional_address = v_address;
  end if;

  if v_request.status <> 'pending' then
    return false;
  end if;

  update public.madic_cric_prevalidations
  set professional_email = v_email,
      professional_phone = v_phone,
      professional_address = v_address
  where id = v_request.id;

  return true;
end;
$$;

revoke all on function public.madic_save_cric_prevalidation_contact(text,text,text,text) from public;
grant execute on function public.madic_save_cric_prevalidation_contact(text,text,text,text) to anon, authenticated;

commit;
