-- Luni: one private professional profile per authenticated user.
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  professional_email text,
  phone text,
  location text,
  portfolio_url text,
  linkedin_url text,
  professional_summary text,
  experiences jsonb not null default '[]'::jsonb,
  education jsonb not null default '[]'::jsonb,
  skills jsonb not null default '[]'::jsonb,
  languages jsonb not null default '[]'::jsonb,
  job_preferences jsonb not null default '{}'::jsonb,
  salary_min numeric(14,2),
  salary_max numeric(14,2),
  salary_currency text,
  salary_period text,
  contract_types text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_experiences_array check (jsonb_typeof(experiences) = 'array'),
  constraint profiles_education_array check (jsonb_typeof(education) = 'array'),
  constraint profiles_skills_array check (jsonb_typeof(skills) = 'array'),
  constraint profiles_languages_array check (jsonb_typeof(languages) = 'array'),
  constraint profiles_preferences_object check (jsonb_typeof(job_preferences) = 'object'),
  constraint profiles_salary_nonnegative check ((salary_min is null or salary_min >= 0) and (salary_max is null or salary_max >= 0)),
  constraint profiles_salary_order check (salary_min is null or salary_max is null or salary_max >= salary_min),
  constraint profiles_salary_period check (salary_period is null or salary_period in ('hourly', 'monthly', 'yearly'))
);

comment on table public.profiles is 'Private professional profiles for Luni users.';

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

revoke all on table public.profiles from anon;
revoke all on table public.profiles from authenticated;
grant select, insert, update, delete on table public.profiles to authenticated;

drop policy if exists "Users can read their own profile" on public.profiles;
create policy "Users can read their own profile"
on public.profiles for select
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

drop policy if exists "Users can create their own profile" on public.profiles;
create policy "Users can create their own profile"
on public.profiles for insert
to authenticated
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile"
on public.profiles for update
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

drop policy if exists "Users can delete their own profile" on public.profiles;
create policy "Users can delete their own profile"
on public.profiles for delete
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

revoke execute on function public.set_updated_at() from public, anon, authenticated;
