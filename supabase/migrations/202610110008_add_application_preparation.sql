alter table public.applications
  add column if not exists preparation_step smallint not null default 2,
  add column if not exists selected_cv_id uuid references public.cv_documents(id) on delete set null,
  add column if not exists selected_answer_ids uuid[] not null default '{}',
  add column if not exists analysis_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists submission_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists authorized_at timestamptz;

alter table public.applications
  drop constraint if exists applications_preparation_step_range;

alter table public.applications
  add constraint applications_preparation_step_range
  check (preparation_step between 2 and 6);

comment on column public.applications.analysis_snapshot is
  'Explainable, orientative text comparison saved when the user reviews the analysis.';

comment on column public.applications.submission_snapshot is
  'Exact CV and answer selection authorized by the user before leaving Luni to apply.';
