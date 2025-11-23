create or replace function public.signal_phone_pending(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set phone = coalesce(phone, auth.jwt()->>'phone'), phone_confirmed_at = null
  where id = coalesce(p_user_id, auth.uid());
end;
$$;

create or replace function public.mark_phone_confirmed(p_user_id uuid, p_phone text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set phone = coalesce(p_phone, phone), phone_confirmed_at = now()
  where id = coalesce(p_user_id, auth.uid());
end;
$$;

grant execute on function public.signal_phone_pending(uuid) to authenticated, service_role;
grant execute on function public.mark_phone_confirmed(uuid,text) to authenticated, service_role;
