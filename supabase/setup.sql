-- Run once in the Supabase SQL editor. Email/password identities are managed by Supabase Auth.
-- Public avatars are intentionally viewable to anyone who has their URL; uploads are restricted per user.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public=true, file_size_limit=2097152,
 allowed_mime_types=array['image/jpeg','image/png','image/webp'];

create policy "Public avatar reading" on storage.objects for select
 to public using (bucket_id = 'avatars');
create policy "Users may upload their own avatar" on storage.objects for insert
 to authenticated with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid()::text));
create policy "Users may remove their own avatar" on storage.objects for delete
 to authenticated using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid()::text));
