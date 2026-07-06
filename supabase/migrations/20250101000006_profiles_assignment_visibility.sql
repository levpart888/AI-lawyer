-- Исполнитель и супервизор одного назначения должны видеть профиль друг друга
-- (контакты супервизора на странице дела, см. CLAUDE.md п.7).
create policy profiles_select_assignment_counterpart on profiles
  for select using (
    exists (
      select 1 from assignments a
      where (a.executor_id = profiles.id and a.supervisor_id = auth.uid())
         or (a.supervisor_id = profiles.id and a.executor_id = auth.uid())
    )
  );
