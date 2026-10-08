-- Create a new storage bucket for Avatars
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Set up access controls for avatars
DROP POLICY IF EXISTS "Avatar images are publicly accessible." ON storage.objects;
create policy "Avatar images are publicly accessible."
  on storage.objects for select
  using ( bucket_id = 'avatars' );

DROP POLICY IF EXISTS "Anyone can upload an avatar." ON storage.objects;
create policy "Anyone can upload an avatar."
  on storage.objects for insert
  with check ( bucket_id = 'avatars' );

DROP POLICY IF EXISTS "Anyone can update an avatar." ON storage.objects;
create policy "Anyone can update an avatar."
  on storage.objects for update
  with check ( bucket_id = 'avatars' );

DROP POLICY IF EXISTS "Anyone can delete their avatar." ON storage.objects;
create policy "Anyone can delete their avatar."
  on storage.objects for delete
  using ( bucket_id = 'avatars' );

-- Create a new storage bucket for Support Attachments
insert into storage.buckets (id, name, public)
values ('support', 'support', true)
on conflict (id) do nothing;

-- Set up access controls for support attachments
DROP POLICY IF EXISTS "Support images are publicly accessible." ON storage.objects;
create policy "Support images are publicly accessible."
  on storage.objects for select
  using ( bucket_id = 'support' );

DROP POLICY IF EXISTS "Anyone can upload a support image." ON storage.objects;
create policy "Anyone can upload a support image."
  on storage.objects for insert
  with check ( bucket_id = 'support' );

DROP POLICY IF EXISTS "Anyone can update a support image." ON storage.objects;
create policy "Anyone can update a support image."
  on storage.objects for update
  with check ( bucket_id = 'support' );

DROP POLICY IF EXISTS "Anyone can delete a support image." ON storage.objects;
create policy "Anyone can delete a support image."
  on storage.objects for delete
  using ( bucket_id = 'support' );
