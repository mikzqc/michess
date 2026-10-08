-- Create a new storage bucket for Avatars
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Set up access controls for avatars
create policy "Avatar images are publicly accessible."
  on storage.objects for select
  using ( bucket_id = 'avatars' );

create policy "Anyone can upload an avatar."
  on storage.objects for insert
  with check ( bucket_id = 'avatars' );

create policy "Anyone can update an avatar."
  on storage.objects for update
  with check ( bucket_id = 'avatars' );

create policy "Anyone can delete their avatar."
  on storage.objects for delete
  using ( bucket_id = 'avatars' );

-- Create a new storage bucket for Support Attachments
insert into storage.buckets (id, name, public)
values ('support', 'support', true)
on conflict (id) do nothing;

-- Set up access controls for support attachments
create policy "Support images are publicly accessible."
  on storage.objects for select
  using ( bucket_id = 'support' );

create policy "Anyone can upload a support image."
  on storage.objects for insert
  with check ( bucket_id = 'support' );

create policy "Anyone can update a support image."
  on storage.objects for update
  with check ( bucket_id = 'support' );

create policy "Anyone can delete a support image."
  on storage.objects for delete
  using ( bucket_id = 'support' );
