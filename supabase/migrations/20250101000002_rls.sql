-- RLS-политики. См. CLAUDE.md п.5.

alter table tracks enable row level security;
alter table profiles enable row level security;
alter table cases enable row level security;
alter table responses enable row level security;
alter table assignments enable row level security;
alter table ratings enable row level security;
alter table credits enable row level security;
alter table credit_transactions enable row level security;

-- tracks: справочник, не содержит ПД, читают все залогиненные, пишет только admin
create policy tracks_select on tracks
  for select using (auth.uid() is not null);

create policy tracks_admin_all on tracks
  for all using (public.is_admin()) with check (public.is_admin());

-- profiles: своя строка либо admin. Публичный реестр — через отдельное view (registry.sql).
create policy profiles_select on profiles
  for select using (id = auth.uid() or public.is_admin());

create policy profiles_insert on profiles
  for insert with check (public.is_admin());

create policy profiles_update on profiles
  for update using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

create policy profiles_delete on profiles
  for delete using (public.is_admin());

-- cases: admin — всё; участник — опубликованные дела своего направления
-- либо дела, на которые он назначен исполнителем/супервизором (в любом статусе).
create policy cases_select on cases
  for select using (
    public.is_admin()
    or (status = 'published' and track_id = public.current_track())
    or exists (
      select 1 from assignments a
      where a.case_id = cases.id
        and (a.executor_id = auth.uid() or a.supervisor_id = auth.uid())
    )
  );

create policy cases_admin_write on cases
  for all using (public.is_admin()) with check (public.is_admin());

-- responses: видны только свои (и admin). Никогда не видны чужие отклики.
create policy responses_select on responses
  for select using (profile_id = auth.uid() or public.is_admin());

create policy responses_insert on responses
  for insert with check (
    profile_id = auth.uid() and public.can_respond(case_id)
  );

create policy responses_delete on responses
  for delete using (
    (profile_id = auth.uid()
      and not exists (select 1 from assignments a where a.case_id = responses.case_id))
    or public.is_admin()
  );

create policy responses_admin_update on responses
  for update using (public.is_admin()) with check (public.is_admin());

-- assignments: admin, либо исполнитель/супервизор своей записи
create policy assignments_select on assignments
  for select using (
    public.is_admin() or executor_id = auth.uid() or supervisor_id = auth.uid()
  );

create policy assignments_admin_write on assignments
  for all using (public.is_admin()) with check (public.is_admin());

-- ratings: admin, либо исполнитель своего дела
create policy ratings_select on ratings
  for select using (
    public.is_admin()
    or exists (
      select 1 from assignments a
      where a.id = ratings.assignment_id and a.executor_id = auth.uid()
    )
  );

create policy ratings_admin_write on ratings
  for all using (public.is_admin()) with check (public.is_admin());

-- credits: admin, либо владелец зачёта (чтение). Запись — admin.
create policy credits_select on credits
  for select using (public.is_admin() or profile_id = auth.uid());

create policy credits_admin_write on credits
  for all using (public.is_admin()) with check (public.is_admin());

-- credit_transactions: admin, либо владелец соответствующего зачёта (чтение).
-- Запись НЕ разрешена никакими политиками — только через security definer
-- функцию apply_credit(), которая выполняется от имени владельца и обходит RLS.
create policy credit_transactions_select on credit_transactions
  for select using (
    public.is_admin()
    or exists (
      select 1 from credits c
      where c.id = credit_transactions.credit_id and c.profile_id = auth.uid()
    )
  );
