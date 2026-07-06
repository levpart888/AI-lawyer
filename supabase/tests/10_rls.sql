-- Тесты RLS-политик. См. CLAUDE.md п.5, п.10.
-- Запуск: psql -d ai_lawyer_test -f supabase/tests/10_rls.sql
-- Работает поверх шима supabase/tests/00_shim.sql (auth.uid(), роли anon/authenticated).

begin;
select no_plan();

-- ============================= ФИКСТУРЫ (как superuser, обходя RLS) =============================

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'admin@example.com'),
  ('22222222-2222-2222-2222-222222222221', 'partner-a1@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'partner-a2@example.com'),
  ('33333333-3333-3333-3333-333333333331', 'specialist-a1@example.com'),
  ('33333333-3333-3333-3333-333333333332', 'specialist-a2@example.com'),
  ('44444444-4444-4444-4444-444444444441', 'partner-b1@example.com');

insert into tracks (id, name, price_rub) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Крипто-форензика', 89900),
  ('aaaaaaaa-0000-0000-0000-000000000002', 'Иное направление', 50000);

insert into profiles (id, full_name, role, track_id) values
  ('11111111-1111-1111-1111-111111111111', 'Админ', 'admin', null),
  ('22222222-2222-2222-2222-222222222221', 'Партнёр A1', 'partner', 'aaaaaaaa-0000-0000-0000-000000000001'),
  ('22222222-2222-2222-2222-222222222222', 'Партнёр A2', 'partner', 'aaaaaaaa-0000-0000-0000-000000000001'),
  ('33333333-3333-3333-3333-333333333331', 'Специалист A1', 'specialist', 'aaaaaaaa-0000-0000-0000-000000000001'),
  ('33333333-3333-3333-3333-333333333332', 'Специалист A2', 'specialist', 'aaaaaaaa-0000-0000-0000-000000000001'),
  ('44444444-4444-4444-4444-444444444441', 'Партнёр B1', 'partner', 'aaaaaaaa-0000-0000-0000-000000000002');

insert into cases (id, track_id, title, summary, min_role, status, created_by) values
  ('caaaaaaa-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Черновик A', 'Черновик, не публикуется', 'specialist', 'draft', '11111111-1111-1111-1111-111111111111'),
  ('caaaaaaa-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'Дело для специалистов A', 'Обезличенное описание', 'specialist', 'published', '11111111-1111-1111-1111-111111111111'),
  ('caaaaaaa-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', 'Дело для партнёров A', 'Обезличенное описание', 'partner', 'published', '11111111-1111-1111-1111-111111111111'),
  ('caaaaaaa-0000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000002', 'Дело трека B', 'Обезличенное описание', 'specialist', 'published', '11111111-1111-1111-1111-111111111111');

-- ============================= /cases: видимость =============================

set role authenticated;
set request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222221"}';
select array_agg(id order by id) as ids from cases \gset partner_a1_cases_
reset role;
reset request.jwt.claims;
select is(
  :'partner_a1_cases_ids'::text,
  '{caaaaaaa-0000-0000-0000-000000000002,caaaaaaa-0000-0000-0000-000000000003}'::text,
  'Партнёр A1 видит оба опубликованных дела трека A (specialist- и partner-уровня), но не видит черновик'
);

set role authenticated;
set request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333331"}';
select array_agg(id order by id) as ids from cases \gset spec_a1_cases_
reset role;
reset request.jwt.claims;
select is(
  :'spec_a1_cases_ids'::text,
  '{caaaaaaa-0000-0000-0000-000000000002,caaaaaaa-0000-0000-0000-000000000003}'::text,
  'Специалист A1 ВИДИТ дело уровня partner (просто не может откликнуться), но не видит черновик и не видит чужой трек'
);

set role authenticated;
set request.jwt.claims = '{"sub":"44444444-4444-4444-4444-444444444441"}';
select array_agg(id order by id) as ids from cases \gset partner_b1_cases_
reset role;
reset request.jwt.claims;
select is(
  :'partner_b1_cases_ids'::text,
  '{caaaaaaa-0000-0000-0000-000000000004}'::text,
  'Партнёр B1 видит только опубликованные дела своего трека (B), дела трека A не видны'
);

set role authenticated;
set request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111"}';
select count(*)::int as n from cases \gset admin_cases_
reset role;
reset request.jwt.claims;
select is(:'admin_cases_n'::int, 4, 'Admin видит все дела, включая черновики, во всех треках');

-- ============================= responses: отклики и допуск по min_role =============================

-- Специалист A1 не может откликнуться на дело уровня partner
set role authenticated;
set request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333331"}';
select throws_like(
  $$ insert into responses (case_id, profile_id) values ('caaaaaaa-0000-0000-0000-000000000003', '33333333-3333-3333-3333-333333333331') $$,
  '%row-level security%',
  'Специалист A1: insert отклика на дело уровня partner отклонён политикой'
);
reset role;
reset request.jwt.claims;

-- Специалист A1 успешно откликается на дело своего уровня
set role authenticated;
set request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333331"}';
insert into responses (case_id, profile_id, comment) values
  ('caaaaaaa-0000-0000-0000-000000000002', '33333333-3333-3333-3333-333333333331', 'Готов взять');
reset role;
reset request.jwt.claims;

-- Партнёр A1 тоже откликается на дело specialist-уровня (партнёр может всё в своём треке)
set role authenticated;
set request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222221"}';
insert into responses (case_id, profile_id, comment) values
  ('caaaaaaa-0000-0000-0000-000000000002', '22222222-2222-2222-2222-222222222221', 'Тоже беру');
reset role;
reset request.jwt.claims;

select ok(true, 'Партнёр A1 успешно откликается на дело specialist-уровня своего трека');

-- Партнёр A2 не должен видеть чужие отклики (ни A1, ни специалиста A1) — только свои (их пока нет)
set role authenticated;
set request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222"}';
select count(*)::int as n from responses \gset partner_a2_resp_
reset role;
reset request.jwt.claims;
select is(:'partner_a2_resp_n'::int, 0, 'Партнёр A2 не видит чужие отклики (своих пока не подавал)');

-- Специалист A1 видит только свой отклик (1), не видит отклик партнёра A1
set role authenticated;
set request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333331"}';
select count(*)::int as n from responses \gset spec_a1_resp_
reset role;
reset request.jwt.claims;
select is(:'spec_a1_resp_n'::int, 1, 'Специалист A1 видит ровно один (свой) отклик, не видит отклик партнёра A1');

-- Admin видит оба отклика
set role authenticated;
set request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111"}';
select count(*)::int as n from responses \gset admin_resp_
reset role;
reset request.jwt.claims;
select is(:'admin_resp_n'::int, 2, 'Admin видит все отклики');

-- ============================= assignments =============================

insert into assignments (id, case_id, executor_id, supervisor_id) values
  ('55555555-0000-0000-0000-000000000001', 'caaaaaaa-0000-0000-0000-000000000002', '33333333-3333-3333-3333-333333333331', '22222222-2222-2222-2222-222222222221');
update cases set status = 'assigned' where id = 'caaaaaaa-0000-0000-0000-000000000002';

set role authenticated;
set request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333331"}';
select count(*)::int as n from assignments \gset exec_assign_
reset role;
reset request.jwt.claims;
select is(:'exec_assign_n'::int, 1, 'Исполнитель видит своё назначение');

set role authenticated;
set request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222221"}';
select count(*)::int as n from assignments \gset sup_assign_
reset role;
reset request.jwt.claims;
select is(:'sup_assign_n'::int, 1, 'Супервизор видит назначение, где он супервизор');

set role authenticated;
set request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222"}';
select count(*)::int as n from assignments \gset other_assign_
reset role;
reset request.jwt.claims;
select is(:'other_assign_n'::int, 0, 'Партнёр A2 (не исполнитель и не супервизор) не видит чужое назначение');

-- Дело в статусе 'assigned' (не published) по-прежнему видно исполнителю, но не постороннему специалисту
set role authenticated;
set request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333332"}';
select count(*)::int as n from cases where id = 'caaaaaaa-0000-0000-0000-000000000002' \gset outsider_case_
reset role;
reset request.jwt.claims;
select is(:'outsider_case_n'::int, 0, 'Специалист A2 (посторонний) не видит чужое назначенное (уже не published) дело');

set role authenticated;
set request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333331"}';
select count(*)::int as n from cases where id = 'caaaaaaa-0000-0000-0000-000000000002' \gset exec_case_
reset role;
reset request.jwt.claims;
select is(:'exec_case_n'::int, 1, 'Исполнитель по-прежнему видит своё назначенное дело в статусе assigned');

-- ============================= credits =============================

set role authenticated;
set request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111"}';
select (grant_credit('33333333-3333-3333-3333-333333333331')).id as credit_id \gset
reset role;
reset request.jwt.claims;

select ok((:'credit_id')::uuid is not null, 'Admin успешно начислил зачёт специалисту A1 через grant_credit()');

set role authenticated;
set request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333331"}';
select count(*)::int as n from credits \gset owner_credit_
reset role;
reset request.jwt.claims;
select is(:'owner_credit_n'::int, 1, 'Владелец зачёта видит свой зачёт');

set role authenticated;
set request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222221"}';
select count(*)::int as n from credits \gset other_credit_
reset role;
reset request.jwt.claims;
select is(:'other_credit_n'::int, 0, 'Партнёр A1 не видит чужой зачёт специалиста A1');

-- credit_transactions: прямой insert запрещён политиками даже для admin (только через apply_credit())
set role authenticated;
set request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111"}';
select throws_ok(
  format($$ insert into credit_transactions (credit_id, assignment_id, amount_rub) values (%L, %L, 100) $$, (:'credit_id')::text, '55555555-0000-0000-0000-000000000001'::text),
  42501,
  null,
  'Прямой insert в credit_transactions запрещён -- запись только через apply_credit()'
);
reset role;
reset request.jwt.claims;

-- ============================= profiles: защита служебных колонок =============================

set role authenticated;
set request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333331"}';
update profiles set full_name = 'Специалист A1 (обновлено)' where id = auth.uid();
reset role;
reset request.jwt.claims;
select is(
  (select full_name from profiles where id = '33333333-3333-3333-3333-333333333331'),
  'Специалист A1 (обновлено)',
  'Участник может обновить своё full_name'
);

set role authenticated;
set request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333331"}';
select throws_like(
  $$ update profiles set role = 'partner' where id = '33333333-3333-3333-3333-333333333331' $$,
  '%Недостаточно прав%',
  'Участник не может сам себе повысить роль'
);
reset role;
reset request.jwt.claims;

-- ============================= registry: публичный реестр по треку =============================

set role authenticated;
set request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222221"}';
select count(*)::int as n from registry \gset partner_a1_registry_
reset role;
reset request.jwt.claims;
select is(:'partner_a1_registry_n'::int, 4, 'Партнёр A1 видит в реестре только 4 активных участников своего трека (не видит партнёра B1)');

select * from finish();
rollback;
