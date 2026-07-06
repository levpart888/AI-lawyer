-- Публичный реестр участников направления (/registry). См. CLAUDE.md п.7.
-- View выполняется от имени владельца (postgres, обходит RLS profiles),
-- поэтому фильтрация видимости целиком описана в WHERE ниже,
-- а наружу отдаются только неприватные колонки.
create view public.registry as
select
  p.id,
  p.full_name,
  p.role,
  p.track_id,
  p.rating,
  p.cases_closed
from profiles p
where p.is_active = true
  and (public.is_admin() or p.track_id = public.current_track());

grant select on public.registry to authenticated;
