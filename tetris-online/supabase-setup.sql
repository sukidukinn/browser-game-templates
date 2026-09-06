create table if not exists public.game_scores (
  id uuid primary key default gen_random_uuid(),
  game_slug text not null,
  user_id uuid null references auth.users(id) on delete set null,
  player_name text not null default 'Anonymous' check (char_length(player_name) between 1 and 32),
  score integer not null check (score between 0 and 100000000),
  lines integer not null check (lines between 0 and 1000000),
  level integer not null check (level between 1 and 100000),
  play_time_ms integer not null check (play_time_ms between 0 and 86400000),
  comment text null check (comment is null or char_length(comment) <= 160),
  referral_url text null check (referral_url is null or (char_length(referral_url) <= 500 and referral_url ~ '^https?://')),
  created_at timestamptz not null default now()
);

create index if not exists game_scores_game_created_idx on public.game_scores (game_slug, created_at desc);
create index if not exists game_scores_game_score_time_idx on public.game_scores (game_slug, score desc, play_time_ms asc);

alter table public.game_scores enable row level security;
revoke all on table public.game_scores from anon, authenticated;
grant select, insert on table public.game_scores to anon, authenticated;

-- Public leaderboard read.
drop policy if exists "game_scores_public_read" on public.game_scores;
create policy "game_scores_public_read"
on public.game_scores for select
to anon, authenticated
using (true);

-- DEBUG MODE: signed-out users may submit all public fields, including comment and URL.
-- user_id must remain null for anonymous submissions.
drop policy if exists "game_scores_anon_insert" on public.game_scores;
create policy "game_scores_anon_insert"
on public.game_scores for insert
to anon
with check (
  user_id is null
  and (comment is null or char_length(comment) <= 160)
  and (referral_url is null or (char_length(referral_url) <= 500 and referral_url ~ '^https?://'))
);

-- Keep authenticated insert available for future login restoration.
drop policy if exists "game_scores_auth_insert" on public.game_scores;
create policy "game_scores_auth_insert"
on public.game_scores for insert
to authenticated
with check (
  user_id is null or user_id = auth.uid()
);
