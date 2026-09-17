-- Issue #8: club_id 기반 다중 동아리 (계정 <-> 동아리 N:M)
--
-- Supabase 대시보드의 SQL 편집기(SQL Editor)에서 이 파일 전체를 실행하세요.
-- clubs / club_members(N:M 조인) / club_invites(초대 링크 토큰) 테이블과,
-- 클라이언트가 anon key로 직접 호출하는 SECURITY DEFINER RPC 3개를 만듭니다.
-- RLS는 조회(select)만 "내 소속 한정"으로 걸고, 쓰기는 전부 아래 RPC를 통해서만 허용합니다.

create extension if not exists pgcrypto;

create table if not exists public.clubs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.club_members (
  club_id uuid not null references public.clubs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  primary key (club_id, user_id)
);

create table if not exists public.club_invites (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  token text not null unique default encode(gen_random_bytes(16), 'hex'),
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.clubs enable row level security;
alter table public.club_members enable row level security;
alter table public.club_invites enable row level security;

drop policy if exists "members can read their clubs" on public.clubs;
create policy "members can read their clubs" on public.clubs
  for select using (
    exists (
      select 1 from public.club_members m
      where m.club_id = clubs.id and m.user_id = auth.uid()
    )
  );

drop policy if exists "users can read their own memberships" on public.club_members;
create policy "users can read their own memberships" on public.club_members
  for select using (user_id = auth.uid());

-- club_invites에는 select 정책을 두지 않는다: 초대 토큰 조회/소비는 전부
-- redeem_invite()/create_invite() RPC(SECURITY DEFINER) 안에서만 이루어진다.

create or replace function public.create_club(p_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_club_id uuid;
begin
  if p_name is null or length(trim(p_name)) = 0 then
    raise exception 'club name required';
  end if;

  insert into public.clubs (name, created_by)
    values (trim(p_name), auth.uid())
    returning id into v_club_id;

  insert into public.club_members (club_id, user_id, role)
    values (v_club_id, auth.uid(), 'owner');

  return v_club_id;
end;
$$;

create or replace function public.create_invite(p_club_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text;
begin
  if not exists (
    select 1 from public.club_members
    where club_id = p_club_id and user_id = auth.uid()
  ) then
    raise exception 'not a member of this club';
  end if;

  insert into public.club_invites (club_id, created_by)
    values (p_club_id, auth.uid())
    returning token into v_token;

  return v_token;
end;
$$;

create or replace function public.redeem_invite(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_club_id uuid;
begin
  select club_id into v_club_id
    from public.club_invites
    where token = p_token;

  if v_club_id is null then
    raise exception 'invalid invite';
  end if;

  insert into public.club_members (club_id, user_id, role)
    values (v_club_id, auth.uid(), 'member')
    on conflict (club_id, user_id) do nothing;

  return v_club_id;
end;
$$;

grant execute on function public.create_club(text) to authenticated;
grant execute on function public.create_invite(uuid) to authenticated;
grant execute on function public.redeem_invite(text) to authenticated;
