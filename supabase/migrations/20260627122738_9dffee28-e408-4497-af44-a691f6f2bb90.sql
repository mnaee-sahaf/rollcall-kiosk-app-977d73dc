
-- =========== ENUMS ===========
create type public.app_role as enum ('admin', 'teacher');
create type public.attendance_method as enum ('kiosk', 'manual');
create type public.attendance_status as enum ('present', 'absent', 'late');

-- =========== PROFILES ===========
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  school_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

-- =========== USER ROLES ===========
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role app_role not null,
  created_at timestamptz not null default now(),
  unique(user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create or replace function public.current_user_role()
returns app_role
language sql
stable
security definer
set search_path = public
as $$
  select role from public.user_roles where user_id = auth.uid() order by case role when 'admin' then 0 else 1 end limit 1
$$;

-- =========== TEACHER INVITES ===========
create table public.teacher_invites (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  token text not null unique,
  invited_by uuid references auth.users(id) on delete set null,
  accepted_at timestamptz,
  expires_at timestamptz not null default (now() + interval '14 days'),
  created_at timestamptz not null default now()
);
grant select, insert, update on public.teacher_invites to authenticated;
grant all on public.teacher_invites to service_role;
alter table public.teacher_invites enable row level security;

-- =========== CLASSES ===========
create table public.classes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  grade text,
  teacher_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index on public.classes(teacher_id);
grant select, insert, update, delete on public.classes to authenticated;
grant all on public.classes to service_role;
alter table public.classes enable row level security;

-- =========== STUDENTS ===========
create table public.students (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  full_name text not null,
  external_id text,
  qr_token text not null unique default encode(gen_random_bytes(18), 'hex'),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index on public.students(class_id);
grant select, insert, update, delete on public.students to authenticated;
grant all on public.students to service_role;
alter table public.students enable row level security;

-- =========== KIOSK SESSIONS ===========
create table public.kiosk_sessions (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  token text not null unique default encode(gen_random_bytes(24), 'hex'),
  starts_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.kiosk_sessions(class_id);
grant select, insert, update on public.kiosk_sessions to authenticated;
grant all on public.kiosk_sessions to service_role;
alter table public.kiosk_sessions enable row level security;

-- =========== ATTENDANCE ===========
create table public.attendance_events (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  kiosk_session_id uuid references public.kiosk_sessions(id) on delete set null,
  marked_by uuid references auth.users(id) on delete set null,
  method attendance_method not null,
  status attendance_status not null,
  occurred_at timestamptz not null default now(),
  day date not null default (now() at time zone 'utc')::date,
  unique(student_id, day)
);
create index on public.attendance_events(class_id, day);
create index on public.attendance_events(student_id, day);
grant select, insert, update, delete on public.attendance_events to authenticated;
grant all on public.attendance_events to service_role;
alter table public.attendance_events enable row level security;

-- =========== POLICIES ===========
-- profiles
create policy "users read own profile" on public.profiles for select to authenticated using (id = auth.uid() or public.has_role(auth.uid(),'admin'));
create policy "users update own profile" on public.profiles for update to authenticated using (id = auth.uid());
create policy "users insert own profile" on public.profiles for insert to authenticated with check (id = auth.uid());

-- user_roles
create policy "users see own roles" on public.user_roles for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));

-- teacher_invites: admin manage; anyone authenticated can look up by token (to accept)
create policy "admin manage invites" on public.teacher_invites for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- classes
create policy "teacher manage own classes" on public.classes for all to authenticated
  using (teacher_id = auth.uid() or public.has_role(auth.uid(),'admin'))
  with check (teacher_id = auth.uid() or public.has_role(auth.uid(),'admin'));

-- students
create policy "teacher manage own students" on public.students for all to authenticated
  using (
    public.has_role(auth.uid(),'admin') or
    exists (select 1 from public.classes c where c.id = students.class_id and c.teacher_id = auth.uid())
  )
  with check (
    public.has_role(auth.uid(),'admin') or
    exists (select 1 from public.classes c where c.id = students.class_id and c.teacher_id = auth.uid())
  );

-- kiosk_sessions
create policy "teacher manage own kiosk sessions" on public.kiosk_sessions for all to authenticated
  using (
    public.has_role(auth.uid(),'admin') or
    exists (select 1 from public.classes c where c.id = kiosk_sessions.class_id and c.teacher_id = auth.uid())
  )
  with check (
    created_by = auth.uid() and (
      public.has_role(auth.uid(),'admin') or
      exists (select 1 from public.classes c where c.id = kiosk_sessions.class_id and c.teacher_id = auth.uid())
    )
  );

-- attendance_events
create policy "teacher read class attendance" on public.attendance_events for select to authenticated
  using (
    public.has_role(auth.uid(),'admin') or
    exists (select 1 from public.classes c where c.id = attendance_events.class_id and c.teacher_id = auth.uid())
  );
create policy "teacher write class attendance" on public.attendance_events for insert to authenticated
  with check (
    public.has_role(auth.uid(),'admin') or
    exists (select 1 from public.classes c where c.id = attendance_events.class_id and c.teacher_id = auth.uid())
  );
create policy "teacher update class attendance" on public.attendance_events for update to authenticated
  using (
    public.has_role(auth.uid(),'admin') or
    exists (select 1 from public.classes c where c.id = attendance_events.class_id and c.teacher_id = auth.uid())
  );
create policy "teacher delete class attendance" on public.attendance_events for delete to authenticated
  using (
    public.has_role(auth.uid(),'admin') or
    exists (select 1 from public.classes c where c.id = attendance_events.class_id and c.teacher_id = auth.uid())
  );

-- =========== AUTO PROFILE + ROLE TRIGGER ===========
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin_exists boolean;
  v_invite_token text;
begin
  insert into public.profiles (id, full_name, school_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email), new.raw_user_meta_data->>'school_name')
  on conflict (id) do nothing;

  select exists(select 1 from public.user_roles where role = 'admin') into v_admin_exists;
  if not v_admin_exists then
    insert into public.user_roles(user_id, role) values (new.id, 'admin') on conflict do nothing;
    return new;
  end if;

  v_invite_token := new.raw_user_meta_data->>'invite_token';
  if v_invite_token is not null then
    update public.teacher_invites
      set accepted_at = now()
      where token = v_invite_token
        and accepted_at is null
        and expires_at > now()
        and lower(email) = lower(new.email);
    if found then
      insert into public.user_roles(user_id, role) values (new.id, 'teacher') on conflict do nothing;
    end if;
  end if;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
