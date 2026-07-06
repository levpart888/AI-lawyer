-- Базовые привилегии ролей Supabase (anon/authenticated). Реальный доступ к строкам
-- определяется исключительно политиками RLS выше, эти GRANT лишь открывают
-- саму возможность выполнять операции для проверки политик.

grant select, insert, update, delete on tracks, profiles, cases, responses, assignments, ratings, credits, credit_transactions
  to authenticated;

grant select on tracks, cases to anon;

grant usage, select on all sequences in schema public to authenticated;

grant execute on function public.current_role() to authenticated;
grant execute on function public.current_track() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.can_respond(uuid) to authenticated;
grant execute on function public.apply_credit(uuid) to authenticated;
grant execute on function public.grant_credit(uuid) to authenticated;
grant execute on function public.close_case(uuid, int, int, int, text) to authenticated;
