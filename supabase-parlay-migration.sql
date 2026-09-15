-- Run this once in Supabase: SQL Editor > New query > Run.
-- Adds the fields used by the bet form without changing or deleting existing bets.

alter table public.bets add column if not exists bet_type text not null default 'Single';
alter table public.bets add column if not exists legs jsonb not null default '[]'::jsonb;

-- Make the new fields available to the browser API immediately.
notify pgrst, 'reload schema';
