-- Run this once in Supabase: SQL Editor > New query > Run.
-- Creates the missing table that otherwise blocks the dashboard from loading bets.

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

alter table public.daily_fantasy_entries enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'daily_fantasy_entries'
      and policyname = 'Users manage their own daily fantasy entries'
  ) then
    create policy "Users manage their own daily fantasy entries"
      on public.daily_fantasy_entries
      for all to authenticated
      using ((select auth.uid()) = user_id)
      with check ((select auth.uid()) = user_id);
  end if;
end;
$$;

notify pgrst, 'reload schema';
