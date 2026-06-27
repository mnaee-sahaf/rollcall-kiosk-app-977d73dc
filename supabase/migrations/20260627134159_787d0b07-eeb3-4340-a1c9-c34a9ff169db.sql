
-- Storage RLS for school-assets bucket: admin write, authenticated read.
do $$
begin
  if exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='school-assets admin write') then
    drop policy "school-assets admin write" on storage.objects;
  end if;
  if exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='school-assets read') then
    drop policy "school-assets read" on storage.objects;
  end if;
end $$;

create policy "school-assets admin write"
on storage.objects
for all
to authenticated
using (bucket_id = 'school-assets' and public.has_role(auth.uid(), 'admin'))
with check (bucket_id = 'school-assets' and public.has_role(auth.uid(), 'admin'));

create policy "school-assets read"
on storage.objects
for select
to authenticated
using (bucket_id = 'school-assets');
