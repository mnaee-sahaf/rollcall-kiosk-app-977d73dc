
revoke execute on function public.has_role(uuid, public.app_role) from public, anon, authenticated;
revoke execute on function public.current_user_role() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
grant execute on function public.has_role(uuid, public.app_role) to service_role;
grant execute on function public.current_user_role() to authenticated, service_role;
