begin;

create extension if not exists pgcrypto;
create extension if not exists btree_gist;

do $$ begin
  create type public.app_role as enum ('admin', 'editor', 'viewer');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.lead_status as enum ('new', 'contacted', 'qualified', 'converted', 'archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.appointment_status as enum ('scheduled', 'confirmed', 'completed', 'cancelled', 'no_show');
exception when duplicate_object then null; end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  role public.app_role not null default 'viewer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 80),
  email text not null check (char_length(email) between 5 and 254),
  phone text not null default '' check (char_length(phone) <= 24),
  message text not null check (char_length(message) between 10 and 1500),
  status public.lead_status not null default 'new',
  source text not null default 'site' check (char_length(source) <= 80),
  assigned_to uuid references public.profiles(id) on delete set null,
  client_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 80),
  email text not null default '' check (char_length(email) <= 254),
  phone text not null default '' check (char_length(phone) <= 24),
  notes text not null default '' check (char_length(notes) <= 3000),
  created_from_lead uuid unique references public.leads(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.leads drop constraint if exists leads_client_id_fkey;
alter table public.leads add constraint leads_client_id_fkey
  foreign key (client_id) references public.clients(id) on delete set null;

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null check (char_length(name) between 2 and 100),
  category text not null check (char_length(category) between 2 and 80),
  description text not null check (char_length(description) between 10 and 500),
  price_label text not null check (char_length(price_label) between 2 and 60),
  duration_label text not null check (char_length(duration_label) between 2 and 40),
  duration_minutes integer not null check (duration_minutes between 10 and 720),
  maintenance text not null check (char_length(maintenance) between 2 and 160),
  intensity smallint not null default 1 check (intensity between 1 and 3),
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.gallery_items (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 2 and 100),
  subtitle text not null default '' check (char_length(subtitle) <= 160),
  image_path text not null check (char_length(image_path) between 1 and 500),
  alt_text text not null check (char_length(alt_text) between 5 and 220),
  object_position text not null default '50% 50%' check (char_length(object_position) <= 40),
  zoom numeric(4,2) not null default 1 check (zoom between 1 and 2.5),
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete set null,
  lead_id uuid references public.leads(id) on delete set null,
  service_id uuid references public.services(id) on delete set null,
  client_name text not null check (char_length(client_name) between 2 and 80),
  client_phone text not null default '' check (char_length(client_phone) <= 24),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status public.appointment_status not null default 'scheduled',
  notes text not null default '' check (char_length(notes) <= 2000),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint appointment_time_order check (ends_at > starts_at)
);

do $$ begin
  alter table public.appointments add constraint appointments_no_overlap
    exclude using gist (tstzrange(starts_at, ends_at, '[)') with &&)
    where (status in ('scheduled', 'confirmed'));
exception when duplicate_object then null; end $$;

create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id) on delete set null,
  table_name text not null,
  record_id text not null,
  action text not null check (action in ('INSERT', 'UPDATE', 'DELETE')),
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.lead_rate_limits (
  id bigint generated always as identity primary key,
  fingerprint_hash text not null check (char_length(fingerprint_hash) = 64),
  created_at timestamptz not null default now()
);

create index if not exists leads_created_at_idx on public.leads(created_at desc);
create index if not exists leads_status_idx on public.leads(status, created_at desc);
create index if not exists clients_name_idx on public.clients(lower(name));
create index if not exists appointments_starts_at_idx on public.appointments(starts_at);
create index if not exists services_active_sort_idx on public.services(active, sort_order);
create index if not exists gallery_active_sort_idx on public.gallery_items(active, sort_order);
create index if not exists lead_rate_limits_lookup_idx on public.lead_rate_limits(fingerprint_hash, created_at desc);

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.current_app_role()
returns public.app_role
language sql stable security definer
set search_path = public, pg_temp
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_staff()
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select coalesce(public.current_app_role() in ('admin', 'editor', 'viewer'), false);
$$;

create or replace function public.can_edit()
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select coalesce(public.current_app_role() in ('admin', 'editor'), false);
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = public, pg_temp
as $$
  select coalesce(public.current_app_role() = 'admin', false);
$$;

drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();

create or replace function public.audit_change()
returns trigger
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.audit_logs(actor_id, table_name, record_id, action, old_data, new_data)
  values (
    auth.uid(), tg_table_name,
    coalesce((case when tg_op = 'DELETE' then old else new end).id::text, ''),
    tg_op,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
  );
  return coalesce(new, old);
end;
$$;

create or replace function public.submit_lead(
  p_name text,
  p_email text,
  p_phone text,
  p_message text,
  p_fingerprint_hash text
)
returns uuid
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  new_id uuid;
  recent_id uuid;
begin
  p_name := trim(p_name);
  p_email := lower(trim(p_email));
  p_phone := trim(coalesce(p_phone, ''));
  p_message := trim(p_message);

  if char_length(p_name) not between 2 and 80
    or char_length(p_email) not between 5 and 254
    or p_email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'
    or char_length(p_phone) > 24
    or char_length(p_message) not between 10 and 1500
    or p_fingerprint_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid_lead_payload' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_fingerprint_hash, 0));
  delete from public.lead_rate_limits where created_at < now() - interval '24 hours';
  if (select count(*) from public.lead_rate_limits
      where fingerprint_hash = p_fingerprint_hash
      and created_at > now() - interval '15 minutes') >= 5 then
    raise exception 'rate_limit_exceeded' using errcode = 'P0001';
  end if;
  insert into public.lead_rate_limits(fingerprint_hash) values (p_fingerprint_hash);

  select id into recent_id from public.leads
  where email = p_email and message = p_message
    and created_at > now() - interval '10 minutes'
  order by created_at desc limit 1;
  if recent_id is not null then return recent_id; end if;

  insert into public.leads(name, email, phone, message)
  values (p_name, p_email, p_phone, p_message)
  returning id into new_id;
  return new_id;
end;
$$;

revoke all on function public.submit_lead(text,text,text,text,text) from public;
grant execute on function public.submit_lead(text,text,text,text,text) to anon, authenticated;
revoke all on function public.current_app_role() from public;
revoke all on function public.is_staff() from public;
revoke all on function public.can_edit() from public;
revoke all on function public.is_admin() from public;
grant execute on function public.current_app_role() to authenticated;
grant execute on function public.is_staff() to authenticated;
grant execute on function public.can_edit() to authenticated;
grant execute on function public.is_admin() to authenticated;

alter table public.profiles enable row level security;
alter table public.leads enable row level security;
alter table public.clients enable row level security;
alter table public.services enable row level security;
alter table public.gallery_items enable row level security;
alter table public.appointments enable row level security;
alter table public.audit_logs enable row level security;
alter table public.lead_rate_limits enable row level security;

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists leads_select on public.leads;
create policy leads_select on public.leads for select to authenticated using (public.is_staff());
drop policy if exists leads_update on public.leads;
create policy leads_update on public.leads for update to authenticated
  using (public.can_edit()) with check (public.can_edit());
drop policy if exists leads_delete on public.leads;
create policy leads_delete on public.leads for delete to authenticated using (public.is_admin());

drop policy if exists clients_select on public.clients;
create policy clients_select on public.clients for select to authenticated using (public.is_staff());
drop policy if exists clients_insert on public.clients;
create policy clients_insert on public.clients for insert to authenticated with check (public.can_edit());
drop policy if exists clients_update on public.clients;
create policy clients_update on public.clients for update to authenticated
  using (public.can_edit()) with check (public.can_edit());
drop policy if exists clients_delete on public.clients;
create policy clients_delete on public.clients for delete to authenticated using (public.is_admin());

drop policy if exists services_public_select on public.services;
create policy services_public_select on public.services for select to anon, authenticated
  using (active or public.is_staff());
drop policy if exists services_insert on public.services;
create policy services_insert on public.services for insert to authenticated with check (public.can_edit());
drop policy if exists services_update on public.services;
create policy services_update on public.services for update to authenticated
  using (public.can_edit()) with check (public.can_edit());
drop policy if exists services_delete on public.services;
create policy services_delete on public.services for delete to authenticated using (public.is_admin());

drop policy if exists gallery_public_select on public.gallery_items;
create policy gallery_public_select on public.gallery_items for select to anon, authenticated
  using (active or public.is_staff());
drop policy if exists gallery_insert on public.gallery_items;
create policy gallery_insert on public.gallery_items for insert to authenticated with check (public.can_edit());
drop policy if exists gallery_update on public.gallery_items;
create policy gallery_update on public.gallery_items for update to authenticated
  using (public.can_edit()) with check (public.can_edit());
drop policy if exists gallery_delete on public.gallery_items;
create policy gallery_delete on public.gallery_items for delete to authenticated using (public.is_admin());

drop policy if exists appointments_select on public.appointments;
create policy appointments_select on public.appointments for select to authenticated using (public.is_staff());
drop policy if exists appointments_insert on public.appointments;
create policy appointments_insert on public.appointments for insert to authenticated
  with check (public.can_edit() and (created_by is null or created_by = auth.uid()));
drop policy if exists appointments_update on public.appointments;
create policy appointments_update on public.appointments for update to authenticated
  using (public.can_edit()) with check (public.can_edit());
drop policy if exists appointments_delete on public.appointments;
create policy appointments_delete on public.appointments for delete to authenticated using (public.is_admin());

drop policy if exists audit_select on public.audit_logs;
create policy audit_select on public.audit_logs for select to authenticated using (public.is_admin());

do $$ declare table_name text; begin
  foreach table_name in array array['profiles','leads','clients','services','gallery_items','appointments'] loop
    execute format('drop trigger if exists set_%I_updated_at on public.%I', table_name, table_name);
    execute format('create trigger set_%I_updated_at before update on public.%I for each row execute function public.set_updated_at()', table_name, table_name);
  end loop;
  foreach table_name in array array['leads','clients','services','gallery_items','appointments'] loop
    execute format('drop trigger if exists audit_%I on public.%I', table_name, table_name);
    execute format('create trigger audit_%I after insert or update or delete on public.%I for each row execute function public.audit_change()', table_name, table_name);
  end loop;
end $$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('gallery', 'gallery', true, 8388608, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists gallery_storage_public_read on storage.objects;
create policy gallery_storage_public_read on storage.objects for select to public
  using (bucket_id = 'gallery');
drop policy if exists gallery_storage_staff_insert on storage.objects;
create policy gallery_storage_staff_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'gallery' and public.can_edit());
drop policy if exists gallery_storage_staff_update on storage.objects;
create policy gallery_storage_staff_update on storage.objects for update to authenticated
  using (bucket_id = 'gallery' and public.can_edit())
  with check (bucket_id = 'gallery' and public.can_edit());
drop policy if exists gallery_storage_admin_delete on storage.objects;
create policy gallery_storage_admin_delete on storage.objects for delete to authenticated
  using (bucket_id = 'gallery' and public.is_admin());

commit;
