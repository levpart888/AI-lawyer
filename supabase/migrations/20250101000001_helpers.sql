-- Хелперы для RLS-политик.
-- security definer + фиксированный search_path: выполняются от имени владельца
-- (обходят RLS profiles), чтобы не было рекурсии при их использовании в политиках profiles.

create or replace function public.current_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from profiles where id = auth.uid()
$$;

create or replace function public.current_track()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select track_id from profiles where id = auth.uid()
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'admin'
  )
$$;

-- Может ли текущий пользователь откликнуться на дело:
-- опубликовано, своё направление, дедлайн не истёк, уровень допускает роль.
create or replace function public.can_respond(p_case_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from cases c
    where c.id = p_case_id
      and c.status = 'published'
      and c.track_id = public.current_track()
      and (c.respond_until is null or c.respond_until > now())
      and (c.min_role = 'specialist' or public.current_role() = 'partner')
  )
$$;

-- Запрещает менять служебные поля профиля всем, кроме admin.
create or replace function public.protect_profile_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    if new.role is distinct from old.role
       or new.track_id is distinct from old.track_id
       or new.rating is distinct from old.rating
       or new.cases_closed is distinct from old.cases_closed
       or new.is_active is distinct from old.is_active then
      raise exception 'Недостаточно прав для изменения этих полей профиля';
    end if;
  end if;
  return new;
end;
$$;

create trigger trg_protect_profile_columns
before update on public.profiles
for each row execute function public.protect_profile_columns();
