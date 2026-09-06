-- Run this once in Supabase SQL Editor if you already ran the older setup SQL.
-- It changes anonymous inserts so comment + referral URL are temporarily allowed.

create index if not exists game_scores_game_score_time_idx
on public.game_scores (game_slug, score desc, play_time_ms asc);

drop policy if exists "game_scores_anon_insert" on public.game_scores;
create policy "game_scores_anon_insert"
on public.game_scores for insert
to anon
with check (
  user_id is null
  and (comment is null or char_length(comment) <= 160)
  and (referral_url is null or (char_length(referral_url) <= 500 and referral_url ~ '^https?://'))
);
