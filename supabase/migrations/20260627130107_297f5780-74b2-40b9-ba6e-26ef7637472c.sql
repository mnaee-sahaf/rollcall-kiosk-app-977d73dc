
CREATE POLICY "read school-assets" ON storage.objects FOR SELECT TO authenticated, anon
  USING (bucket_id = 'school-assets');
CREATE POLICY "admin upload school-assets" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'school-assets' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin update school-assets" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'school-assets' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin delete school-assets" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'school-assets' AND public.has_role(auth.uid(), 'admin'));
