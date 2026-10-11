create table if not exists public.cv_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  file_name text not null,
  storage_path text not null unique,
  file_size bigint not null check (file_size > 0 and file_size <= 10485760),
  mime_type text not null default 'application/pdf' check (mime_type = 'application/pdf'),
  extracted_text text not null default '',
  extracted_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.cv_documents enable row level security;
revoke all on table public.cv_documents from anon;
revoke all on table public.cv_documents from authenticated;
grant select, insert, update, delete on table public.cv_documents to authenticated;

create policy "Users can read their own CV documents"
on public.cv_documents for select to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can create their own CV documents"
on public.cv_documents for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update their own CV documents"
on public.cv_documents for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete their own CV documents"
on public.cv_documents for delete to authenticated
using ((select auth.uid()) = user_id);

drop trigger if exists set_cv_documents_updated_at on public.cv_documents;
create trigger set_cv_documents_updated_at
before update on public.cv_documents
for each row execute function public.set_updated_at();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('private-cvs', 'private-cvs', false, 10485760, array['application/pdf'])
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Users can read their own CV files"
on storage.objects for select to authenticated
using (
  bucket_id = 'private-cvs'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "Users can upload their own CV files"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'private-cvs'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "Users can update their own CV files"
on storage.objects for update to authenticated
using (
  bucket_id = 'private-cvs'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'private-cvs'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "Users can delete their own CV files"
on storage.objects for delete to authenticated
using (
  bucket_id = 'private-cvs'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
