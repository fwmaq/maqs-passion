-- MAQ'S PASSION v2.6 — Community presence and protected Discord-style roles.
-- Run AFTER supabase/setup.sql. Re-running this file is supported.
-- IMPORTANT: The owner must be assigned manually using the bootstrap instructions below.
-- No client key can create or promote an Owner.

create table if not exists public.member_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Player',
  avatar_url text,
  role text not null default 'member' check (role in ('owner','admin','moderator','vip','member')),
  updated_at timestamptz not null default now()
);

-- The Auth trigger maintains names/photos, never the role.
create or replace function public.sync_member_profile()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.member_profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(nullif(left(btrim(new.raw_user_meta_data ->> 'display_name'), 28), ''),
             nullif(split_part(coalesce(new.email,''), '@', 1), ''), 'Player'),
    nullif(new.raw_user_meta_data ->> 'avatar_url', '')
  )
  on conflict (id) do update set
    display_name = excluded.display_name,
    avatar_url = excluded.avatar_url,
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_member_auth_created on auth.users;
create trigger on_member_auth_created
  after insert on auth.users for each row
  execute function public.sync_member_profile();

drop trigger if exists on_member_auth_metadata_changed on auth.users;
create trigger on_member_auth_metadata_changed
  after update of raw_user_meta_data on auth.users for each row
  when (old.raw_user_meta_data is distinct from new.raw_user_meta_data)
  execute function public.sync_member_profile();

-- Backfill accounts that registered before the Members feature existed.
insert into public.member_profiles (id, display_name, avatar_url)
select id,
  coalesce(nullif(left(btrim(raw_user_meta_data ->> 'display_name'), 28), ''),
           nullif(split_part(coalesce(email,''), '@', 1), ''), 'Player'),
  nullif(raw_user_meta_data ->> 'avatar_url', '')
from auth.users
on conflict (id) do update set
  display_name = excluded.display_name,
  avatar_url = excluded.avatar_url;

alter table public.member_profiles enable row level security;
drop policy if exists "Signed-in members can read member profiles" on public.member_profiles;
create policy "Signed-in members can read member profiles"
  on public.member_profiles for select to authenticated using (true);

-- Clients can read profile data but cannot directly insert/update role rows.
revoke all on public.member_profiles from anon, authenticated;
grant select on public.member_profiles to authenticated;

-- Only a database-controlled SECURITY DEFINER function can assign roles.
create or replace function public.set_member_role(target_user_id uuid, new_role text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  acting_user uuid := (select auth.uid());
  acting_role text;
  target_role text;
begin
  if acting_user is null then
    raise exception 'You must be signed in' using errcode = '42501';
  end if;
  if target_user_id is null or target_user_id = acting_user then
    raise exception 'You cannot change your own role' using errcode = '42501';
  end if;
  if new_role not in ('admin','moderator','vip','member') then
    raise exception 'Only a database administrator can assign the Owner role' using errcode = '42501';
  end if;
  select role into acting_role from public.member_profiles where id = acting_user;
  select role into target_role from public.member_profiles where id = target_user_id for update;
  if target_role is null then
    raise exception 'Target member was not found' using errcode = 'P0002';
  end if;
  if acting_role = 'owner' then
    if target_role = 'owner' then
      raise exception 'Owner roles must be managed in the database' using errcode = '42501';
    end if;
  elsif acting_role = 'admin' then
    if target_role in ('owner','admin') or new_role = 'admin' then
      raise exception 'Admins cannot manage Owners or other Admins' using errcode = '42501';
    end if;
  else
    raise exception 'Only Owners and Admins can assign roles' using errcode = '42501';
  end if;
  update public.member_profiles
  set role = new_role, updated_at = now()
  where id = target_user_id;
end;
$$;
revoke all on function public.set_member_role(uuid, text) from public, anon;
grant execute on function public.set_member_role(uuid, text) to authenticated;

-- Authenticated users can see/publish presence in this private channel only.
-- Don't ALTER realtime.messages: Supabase already manages RLS on that table.
drop policy if exists "Maq members can read private presence" on realtime.messages;
create policy "Maq members can read private presence"
  on realtime.messages for select to authenticated
  using (realtime.topic() = 'maq-members-online' and extension = 'presence');
drop policy if exists "Maq members can publish private presence" on realtime.messages;
create policy "Maq members can publish private presence"
  on realtime.messages for insert to authenticated
  with check (realtime.topic() = 'maq-members-online' and extension = 'presence');

-- Deliver real-time role/name/avatar changes to clients. Publication membership is idempotent.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'member_profiles'
  ) then
    alter publication supabase_realtime add table public.member_profiles;
  end if;
end $$;

-- ONE-TIME OWNER BOOTSTRAP (SQL Editor only; run after your account has signed up):
-- Replace the email with your actual account email, then execute this UPDATE separately.
-- update public.member_profiles
-- set role = 'owner'
-- where id = (select id from auth.users where lower(email) = lower('you@example.com') limit 1);
--
-- Check your role:
-- select display_name, role from public.member_profiles order by role, display_name;
--
-- IMPORTANT: Never put your database password or Supabase service-role key in Maq's Passion.
