-- QuizTime: profiles table additions for account settings
-- Run this on your Supabase project (SQL editor) before using the new UI

-- 1) Ensure columns exist
alter table if exists public.profiles
  add column if not exists display_name text,
  add column if not exists short_id text unique,
  add column if not exists birth_date date,
  add column if not exists avatar_url text;

-- 2) Example RPC to generate/get short_id (optional, if not present)
create or replace function public.get_or_create_short_id()
returns text
language plpgsql
security definer
as $$
declare
  v_id uuid;
  v_short text;
begin
  select auth.uid() into v_id;
  if v_id is null then
    return null;
  end if;
  select short_id into v_short from public.profiles where id = v_id;
  if v_short is not null then
    return v_short;
  end if;
  -- generate 6-digit id (retry on conflict)
  for i in 1..5 loop
    v_short := lpad((floor(random()*1000000))::int::text, 6, '0');
    begin
      insert into public.profiles(id, short_id) values (v_id, v_short)
      on conflict (id) do update set short_id = excluded.short_id where public.profiles.short_id is null;
      return v_short;
    exception when unique_violation then
      continue;
    end;
  end loop;
  return v_short;
end;
$$;

grant execute on function public.get_or_create_short_id() to authenticated;

-- 3) Basic RLS (adjust to your policies)
alter table public.profiles enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='profiles' and policyname='profiles_self_select') then
    create policy profiles_self_select on public.profiles for select to authenticated using (id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='profiles' and policyname='profiles_self_upsert') then
    create policy profiles_self_upsert on public.profiles for insert to authenticated with check (id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='profiles' and policyname='profiles_self_update') then
    create policy profiles_self_update on public.profiles for update to authenticated using (id = auth.uid());
  end if;
end $$;

