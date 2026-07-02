-- Enforce at most one admin at the database level.
--
-- createOrganization used a check-then-insert pattern ("does any admin
-- exist?" then insert admin role) with no atomicity, so two people
-- completing first-time setup simultaneously could both become admin. The
-- existing unique(user_id, role) constraint only stops a single user from
-- duplicating their own role, not two different users both becoming admin.
--
-- A partial unique index guarantees at most one row with role = 'admin',
-- turning the losing concurrent insert into a unique-violation the server
-- function surfaces cleanly.
CREATE UNIQUE INDEX IF NOT EXISTS user_roles_single_admin
  ON public.user_roles ((role))
  WHERE role = 'admin';
