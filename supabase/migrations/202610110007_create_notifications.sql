create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null default 'general' check (type in ('general', 'application', 'interview', 'reminder', 'vacancy', 'warning')),
  title text not null,
  message text not null,
  action_label text,
  action_href text,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  check (char_length(title) between 1 and 180),
  check (char_length(message) between 1 and 2000),
  check (action_label is null or char_length(action_label) <= 80),
  check (action_href is null or (left(action_href, 1) = '/' and left(action_href, 2) <> '//'))
);

create index if not exists notifications_user_created_idx
on public.notifications (user_id, created_at desc);

create index if not exists notifications_user_unread_idx
on public.notifications (user_id, read_at)
where read_at is null;

alter table public.notifications enable row level security;
revoke all on table public.notifications from anon;
revoke all on table public.notifications from authenticated;
grant select, insert, update, delete on table public.notifications to authenticated;

create policy "Users can read their own notifications"
on public.notifications for select to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can create their own notifications"
on public.notifications for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update their own notifications"
on public.notifications for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete their own notifications"
on public.notifications for delete to authenticated
using ((select auth.uid()) = user_id);
