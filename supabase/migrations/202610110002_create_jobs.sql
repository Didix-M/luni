-- Luni: private, manually managed job vacancies.
create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company text not null,
  title text not null,
  source_url text,
  description text,
  workplace_mode text,
  location text,
  contract_type text,
  salary_min numeric(14,2),
  salary_max numeric(14,2),
  salary_currency text,
  salary_period text,
  opening_status text not null default 'unverified',
  panama_eligibility text not null default 'unconfirmed',
  tracking_stage text not null default 'new',
  published_on date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint jobs_company_not_blank check (length(btrim(company)) > 0),
  constraint jobs_title_not_blank check (length(btrim(title)) > 0),
  constraint jobs_salary_nonnegative check ((salary_min is null or salary_min >= 0) and (salary_max is null or salary_max >= 0)),
  constraint jobs_salary_order check (salary_min is null or salary_max is null or salary_max >= salary_min),
  constraint jobs_salary_period check (salary_period is null or salary_period in ('hourly', 'monthly', 'yearly')),
  constraint jobs_opening_status check (opening_status in ('open', 'closed', 'unverified')),
  constraint jobs_panama_eligibility check (panama_eligibility in ('confirmed', 'unconfirmed', 'excluded')),
  constraint jobs_tracking_stage check (tracking_stage in ('new', 'saved', 'approved', 'discarded'))
);

comment on table public.jobs is 'Private job vacancies manually saved by each Luni user.';
create index if not exists jobs_user_id_created_at_idx on public.jobs (user_id, created_at desc);

drop trigger if exists jobs_set_updated_at on public.jobs;
create trigger jobs_set_updated_at
before update on public.jobs
for each row execute function public.set_updated_at();

alter table public.jobs enable row level security;
revoke all on table public.jobs from anon;
revoke all on table public.jobs from authenticated;
grant select, insert, update, delete on table public.jobs to authenticated;

drop policy if exists "Users can read their own jobs" on public.jobs;
create policy "Users can read their own jobs" on public.jobs for select to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

drop policy if exists "Users can create their own jobs" on public.jobs;
create policy "Users can create their own jobs" on public.jobs for insert to authenticated
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

drop policy if exists "Users can update their own jobs" on public.jobs;
create policy "Users can update their own jobs" on public.jobs for update to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

drop policy if exists "Users can delete their own jobs" on public.jobs;
create policy "Users can delete their own jobs" on public.jobs for delete to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);
