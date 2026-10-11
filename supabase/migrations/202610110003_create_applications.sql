-- Luni: private application tracking. This migration never sends applications.
create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid not null references public.jobs(id) on delete cascade,
  status text not null default 'preparing',
  send_result text not null default 'not_sent',
  submitted_at timestamptz,
  confirmation_source text,
  next_step text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint applications_one_per_job unique (user_id, job_id),
  constraint applications_status check (status in ('preparing','needs_info','ready','sent','interview','offer','rejected','withdrawn')),
  constraint applications_send_result check (send_result in ('not_sent','platform_confirmed','manual_confirmed','uncertain')),
  constraint applications_confirmed_date check (
    (send_result in ('platform_confirmed','manual_confirmed') and submitted_at is not null)
    or (send_result in ('not_sent','uncertain') and submitted_at is null)
  ),
  constraint applications_sent_state_confirmed check (
    status not in ('sent','interview','offer','rejected')
    or send_result in ('platform_confirmed','manual_confirmed')
  ),
  constraint applications_manual_source check (send_result <> 'manual_confirmed' or length(btrim(coalesce(confirmation_source, ''))) > 0)
);

create table if not exists public.application_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  application_id uuid not null references public.applications(id) on delete cascade,
  event_type text not null,
  title text not null,
  details text,
  origin text not null default 'user',
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint application_events_origin check (origin in ('user','luni','platform'))
);

create table if not exists public.interviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  application_id uuid not null references public.applications(id) on delete cascade,
  interview_type text not null,
  scheduled_at timestamptz not null,
  timezone text not null default 'America/Panama',
  contact text,
  meeting_location text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  application_id uuid not null references public.applications(id) on delete cascade,
  title text not null,
  remind_at timestamptz not null,
  completed boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists applications_user_updated_idx on public.applications (user_id, updated_at desc);
create index if not exists application_events_application_idx on public.application_events (application_id, occurred_at desc);
create index if not exists interviews_application_idx on public.interviews (application_id, scheduled_at);
create index if not exists reminders_application_idx on public.reminders (application_id, remind_at);

drop trigger if exists applications_set_updated_at on public.applications;
create trigger applications_set_updated_at before update on public.applications
for each row execute function public.set_updated_at();

alter table public.applications enable row level security;
alter table public.application_events enable row level security;
alter table public.interviews enable row level security;
alter table public.reminders enable row level security;

revoke all on public.applications, public.application_events, public.interviews, public.reminders from anon;
revoke all on public.applications, public.application_events, public.interviews, public.reminders from authenticated;
grant select, insert, update, delete on public.applications, public.application_events, public.interviews, public.reminders to authenticated;

drop policy if exists "Users manage their own applications" on public.applications;
create policy "Users manage their own applications" on public.applications for all to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
with check (
  (select auth.uid()) is not null and (select auth.uid()) = user_id
  and exists (select 1 from public.jobs where jobs.id = job_id and jobs.user_id = (select auth.uid()))
);

drop policy if exists "Users manage their own application events" on public.application_events;
create policy "Users manage their own application events" on public.application_events for all to authenticated
using (
  (select auth.uid()) is not null and (select auth.uid()) = user_id
  and exists (select 1 from public.applications where applications.id = application_id and applications.user_id = (select auth.uid()))
)
with check (
  (select auth.uid()) is not null and (select auth.uid()) = user_id
  and exists (select 1 from public.applications where applications.id = application_id and applications.user_id = (select auth.uid()))
);

drop policy if exists "Users manage their own interviews" on public.interviews;
create policy "Users manage their own interviews" on public.interviews for all to authenticated
using (
  (select auth.uid()) is not null and (select auth.uid()) = user_id
  and exists (select 1 from public.applications where applications.id = application_id and applications.user_id = (select auth.uid()))
)
with check (
  (select auth.uid()) is not null and (select auth.uid()) = user_id
  and exists (select 1 from public.applications where applications.id = application_id and applications.user_id = (select auth.uid()))
);

drop policy if exists "Users manage their own reminders" on public.reminders;
create policy "Users manage their own reminders" on public.reminders for all to authenticated
using (
  (select auth.uid()) is not null and (select auth.uid()) = user_id
  and exists (select 1 from public.applications where applications.id = application_id and applications.user_id = (select auth.uid()))
)
with check (
  (select auth.uid()) is not null and (select auth.uid()) = user_id
  and exists (select 1 from public.applications where applications.id = application_id and applications.user_id = (select auth.uid()))
);
