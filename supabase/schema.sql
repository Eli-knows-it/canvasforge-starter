-- CanvasForge database and storage setup
-- Run this entire file in the Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.sites (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  html text not null default '',
  css text not null default '',
  javascript text not null default '',
  project_data jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, slug)
);

create index if not exists sites_owner_updated_idx on public.sites(owner_id, updated_at desc);

alter table public.sites enable row level security;

revoke all on public.sites from anon;
grant select, insert, update, delete on public.sites to authenticated;

create policy "Owners can read their websites"
on public.sites for select
to authenticated
using ((select auth.uid()) = owner_id);

create policy "Owners can create websites"
on public.sites for insert
to authenticated
with check ((select auth.uid()) = owner_id);

create policy "Owners can update their websites"
on public.sites for update
to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

create policy "Owners can delete their websites"
on public.sites for delete
to authenticated
using ((select auth.uid()) = owner_id);

-- Public image bucket. Files are readable by URL, but only their owner can upload,
-- replace, or delete files in the first folder matching their authenticated user ID.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'site-assets',
  'site-assets',
  true,
  8388608,
  array['image/png','image/jpeg','image/webp','image/gif','image/svg+xml']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Anyone can view published site images"
on storage.objects for select
to public
using (bucket_id = 'site-assets');

create policy "Users can upload to their own asset folder"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'site-assets'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "Users can update their own asset files"
on storage.objects for update
to authenticated
using (
  bucket_id = 'site-assets'
  and owner_id = (select auth.uid())::text
)
with check (
  bucket_id = 'site-assets'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "Users can delete their own asset files"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'site-assets'
  and owner_id = (select auth.uid())::text
);
