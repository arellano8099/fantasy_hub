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

-- Each league owns an editable player list. Existing leagues receive an empty roster.
alter table public.leagues add column if not exists roster jsonb not null default '[]'::jsonb;
-- Store a league's editable final result and its net win/loss amount.
alter table public.leagues add column if not exists result text not null default 'Pending';
alter table public.leagues add column if not exists payout numeric not null default 0;
-- Refresh Supabase's REST schema cache so the browser can write the new column immediately.
notify pgrst, 'reload schema';

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

-- Daily fantasy entries share the dashboard's net-profit total.
create table if not exists public.daily_fantasy_entries (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  entry_date date not null,
  game_type text not null,
  slate text not null,
  site text,
  result text not null default 'Pending',
  amount numeric not null default 0,
  created_at timestamptz not null default now()
);

-- A bet can be a standard wager or a parlay with its legs preserved for display.
alter table public.bets add column if not exists bet_type text not null default 'Single';
alter table public.bets add column if not exists legs jsonb not null default '[]'::jsonb;

alter table public.leagues enable row level security;
alter table public.bets enable row level security;
alter table public.daily_fantasy_entries enable row level security;

create policy "Users manage their own leagues" on public.leagues
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users manage their own bets" on public.bets
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users manage their own daily fantasy entries" on public.daily_fantasy_entries
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Make the newly added columns and table available to the REST API immediately.
notify pgrst, 'reload schema';

create table if not exists public.draft_player_states (
  user_id uuid not null references auth.users(id) on delete cascade,
  player_key text not null,
  drafted boolean not null default false,
  tier text,
  primary key (user_id, player_key)
);
alter table public.draft_player_states add column if not exists hidden boolean not null default false;
alter table public.draft_player_states add column if not exists sort_order integer not null default 0;
alter table public.draft_player_states add column if not exists player_data jsonb;
create table if not exists public.draft_custom_players (
  user_id uuid not null references auth.users(id) on delete cascade,
  player_key text not null,
  name text not null, position text not null, team text not null, adp text, tier text not null,
  tags jsonb not null default '[]'::jsonb,
  primary key (user_id, player_key)
);
alter table public.draft_player_states enable row level security;
alter table public.draft_custom_players enable row level security;
create policy "Users manage their own draft states" on public.draft_player_states for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Users manage their own draft custom players" on public.draft_custom_players for all to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
