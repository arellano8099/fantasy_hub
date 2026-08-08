-- Run this one-time Draft Center setup in Supabase: SQL Editor > New query > Run.
create table if not exists public.draft_player_states (
  user_id uuid not null references auth.users(id) on delete cascade,
  player_key text not null,
  drafted boolean not null default false,
  hidden boolean not null default false,
  tier text,
  primary key (user_id, player_key)
);

alter table public.draft_player_states add column if not exists hidden boolean not null default false;

create table if not exists public.draft_custom_players (
  user_id uuid not null references auth.users(id) on delete cascade,
  player_key text not null,
  name text not null,
  position text not null,
  team text not null,
  adp text,
  tier text not null,
  tags jsonb not null default '[]'::jsonb,
  primary key (user_id, player_key)
);

alter table public.draft_player_states enable row level security;
alter table public.draft_custom_players enable row level security;

drop policy if exists "Users manage their own draft states" on public.draft_player_states;
drop policy if exists "Users manage their own draft custom players" on public.draft_custom_players;

create policy "Users manage their own draft states" on public.draft_player_states
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users manage their own draft custom players" on public.draft_custom_players
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
