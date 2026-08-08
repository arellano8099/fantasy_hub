-- Run this once in Supabase: SQL Editor > New query > Run.
-- These tables use the signed-in user's ID, so every user sees only their own data.

create table if not exists public.leagues (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  platform text,
  team text,
  buy_in numeric not null default 0,
  status text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.bets (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  bet_date date not null,
  sport text not null,
  wager text not null,
  stake numeric not null,
  odds integer not null,
  result text not null,
  created_at timestamptz not null default now()
);

alter table public.leagues enable row level security;
alter table public.bets enable row level security;

create policy "Users manage their own leagues" on public.leagues
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users manage their own bets" on public.bets
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
