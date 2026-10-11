alter table public.jobs
  add column if not exists is_favorite boolean not null default false,
  add column if not exists compatibility_score smallint;

alter table public.jobs
  drop constraint if exists jobs_compatibility_score_range;

alter table public.jobs
  add constraint jobs_compatibility_score_range
  check (compatibility_score is null or compatibility_score between 0 and 100);

create index if not exists jobs_user_favorite_idx
on public.jobs (user_id, is_favorite, created_at desc);
