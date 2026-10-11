create table if not exists public.saved_answers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  question text not null,
  answer_text text not null default '',
  variants text[] not null default '{}',
  language text not null default 'Español' check (language in ('Español', 'Inglés')),
  category text not null default 'Presentación profesional',
  status text not null default 'draft' check (status in ('draft', 'confirmed', 'review')),
  evidence text[] not null default '{}',
  archived boolean not null default false,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (char_length(question) between 1 and 500),
  check (char_length(answer_text) <= 10000)
);

alter table public.saved_answers enable row level security;
revoke all on table public.saved_answers from anon;
revoke all on table public.saved_answers from authenticated;
grant select, insert, update, delete on table public.saved_answers to authenticated;

create policy "Users can read their own saved answers"
on public.saved_answers for select to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can create their own saved answers"
on public.saved_answers for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update their own saved answers"
on public.saved_answers for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete their own saved answers"
on public.saved_answers for delete to authenticated
using ((select auth.uid()) = user_id);

drop trigger if exists set_saved_answers_updated_at on public.saved_answers;
create trigger set_saved_answers_updated_at
before update on public.saved_answers
for each row execute function public.set_updated_at();
