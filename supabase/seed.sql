-- Сид-данные для пилота. См. CLAUDE.md п.11.
-- Рассчитан на реальный стек Supabase (auth-схема GoTrue) — локальный
-- (`supabase start` + `supabase db reset`) или ручной прогон в SQL-редакторе
-- облачного проекта перед пилотом. НЕ предназначен для шима из supabase/tests/.
--
-- Логин по magic link по-прежнему требует реальных email — эти пользователи
-- заведены напрямую в auth.users только для того, чтобы кабинет/реестр сразу
-- были наполнены; реальных участников заводите через /admin/users (приглашение).

do $$
declare
  v_track_id uuid := 'a0000000-0000-0000-0000-000000000001';
  v_admin_id uuid := 'a0000000-0000-0000-0000-0000000000a1';
  v_partner_id uuid := 'a0000000-0000-0000-0000-0000000000b1';
  v_spec1_id uuid := 'a0000000-0000-0000-0000-0000000000c1';
  v_spec2_id uuid := 'a0000000-0000-0000-0000-0000000000c2';
  v_spec3_id uuid := 'a0000000-0000-0000-0000-0000000000c3';
  v_case_closed_id uuid := 'a0000000-0000-0000-0000-0000000000d1';
  v_case_pub1_id uuid := 'a0000000-0000-0000-0000-0000000000d2';
  v_case_pub2_id uuid := 'a0000000-0000-0000-0000-0000000000d3';
  v_assignment_id uuid := 'a0000000-0000-0000-0000-0000000000e1';
  v_credit_id uuid;
begin

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  ) values
    ('00000000-0000-0000-0000-000000000000', v_admin_id, 'authenticated', 'authenticated', 'admin@ai-lawyer-league.test', crypt('placeholder', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', v_partner_id, 'authenticated', 'authenticated', 'partner1@ai-lawyer-league.test', crypt('placeholder', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', v_spec1_id, 'authenticated', 'authenticated', 'specialist1@ai-lawyer-league.test', crypt('placeholder', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', v_spec2_id, 'authenticated', 'authenticated', 'specialist2@ai-lawyer-league.test', crypt('placeholder', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
    ('00000000-0000-0000-0000-000000000000', v_spec3_id, 'authenticated', 'authenticated', 'specialist3@ai-lawyer-league.test', crypt('placeholder', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '')
  on conflict (id) do nothing;

  insert into public.tracks (id, name, price_rub)
  values (v_track_id, 'Крипто-форензика', 89900)
  on conflict (id) do nothing;

  insert into public.profiles (id, full_name, role, track_id, is_active)
  values
    (v_admin_id, 'Админ Лиги', 'admin', null, true),
    (v_partner_id, 'Партнёр Иванов', 'partner', v_track_id, true),
    (v_spec1_id, 'Специалист Петров', 'specialist', v_track_id, true),
    (v_spec2_id, 'Специалист Сидорова', 'specialist', v_track_id, true),
    (v_spec3_id, 'Специалист Кузнецов', 'specialist', v_track_id, true)
  on conflict (id) do nothing;

  -- Триггер protect_profile_columns() требует is_admin() = true (проверяет auth.uid(),
  -- а не привилегии текущей роли Postgres), поэтому для последующих служебных
  -- обновлений профиля выдаём себя за админа, созданного выше.
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin_id)::text, true);

  insert into public.cases (id, track_id, title, summary, fee_min_rub, fee_max_rub, min_role, status, respond_until, created_by)
  values
    (v_case_pub1_id, v_track_id, 'Оспаривание блокировки биржевого счёта', 'Клиент — физлицо, счёт заблокирован биржей по 115-ФЗ, требуется подготовка позиции и переписка с комплаенсом.', 80000, 150000, 'specialist', 'published', now() + interval '10 days', v_admin_id),
    (v_case_pub2_id, v_track_id, 'Взыскание похищенных с кошелька средств', 'Требуется форензик-анализ движения средств через несколько бирж и подготовка заявления в правоохранительные органы.', 150000, 350000, 'partner', 'published', now() + interval '7 days', v_admin_id),
    (v_case_closed_id, v_track_id, 'Консультация по легализации криптоактивов', 'Разовая консультация и подготовка меморандума по учёту и легализации криптоактивов физлица.', 250000, 350000, 'specialist', 'closed', now() - interval '20 days', v_admin_id)
  on conflict (id) do nothing;

  insert into public.assignments (id, case_id, executor_id, supervisor_id, fee_rub, platform_fee_rub, assigned_at, closed_at)
  values (v_assignment_id, v_case_closed_id, v_spec1_id, v_partner_id, 300000, 75000, now() - interval '25 days', now() - interval '18 days')
  on conflict (id) do nothing;

  insert into public.ratings (assignment_id, score, client_comment)
  values (v_assignment_id, 5, 'Отличная работа, всё сделали быстро и понятно')
  on conflict (assignment_id) do nothing;

  update public.profiles set rating = 5, cases_closed = 1 where id = v_spec1_id;

  insert into public.credits (profile_id, amount_rub, balance_rub, expires_at)
  values (v_spec1_id, 44950, 44950, now() + interval '18 months')
  returning id into v_credit_id;

  if v_credit_id is not null then
    update public.credits set balance_rub = balance_rub - 37500 where id = v_credit_id;
    insert into public.credit_transactions (credit_id, assignment_id, amount_rub)
    values (v_credit_id, v_assignment_id, 37500);
  end if;

end $$;
