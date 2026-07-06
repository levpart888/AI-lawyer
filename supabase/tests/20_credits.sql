-- Тесты бизнес-функции apply_credit(). См. CLAUDE.md п.6, п.10.
-- Запуск: psql -d ai_lawyer_test -f supabase/tests/20_credits.sql

begin;
select no_plan();

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'admin@example.com'),
  ('66666666-6666-6666-6666-666666666661', 'executor-1@example.com'),
  ('66666666-6666-6666-6666-666666666662', 'executor-2@example.com'),
  ('66666666-6666-6666-6666-666666666663', 'executor-3@example.com');

insert into tracks (id, name, price_rub) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Крипто-форензика', 89900);

insert into profiles (id, full_name, role, track_id) values
  ('11111111-1111-1111-1111-111111111111', 'Админ', 'admin', null),
  ('66666666-6666-6666-6666-666666666661', 'Исполнитель 1 (эталон)', 'specialist', 'aaaaaaaa-0000-0000-0000-000000000001'),
  ('66666666-6666-6666-6666-666666666662', 'Исполнитель 2 (просрочен)', 'specialist', 'aaaaaaaa-0000-0000-0000-000000000001'),
  ('66666666-6666-6666-6666-666666666663', 'Исполнитель 3 (два зачёта подряд)', 'specialist', 'aaaaaaaa-0000-0000-0000-000000000001');

insert into cases (id, track_id, title, summary, created_by) values
  ('caaaaaaa-1000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'Дело 1', 'x', '11111111-1111-1111-1111-111111111111'),
  ('caaaaaaa-1000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'Дело 2', 'x', '11111111-1111-1111-1111-111111111111'),
  ('caaaaaaa-1000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', 'Дело 3', 'x', '11111111-1111-1111-1111-111111111111'),
  ('caaaaaaa-1000-0000-0000-000000000004', 'aaaaaaaa-0000-0000-0000-000000000001', 'Дело 4', 'x', '11111111-1111-1111-1111-111111111111'),
  ('caaaaaaa-1000-0000-0000-000000000005', 'aaaaaaaa-0000-0000-0000-000000000001', 'Дело 5', 'x', '11111111-1111-1111-1111-111111111111');

-- Все operations as admin (RLS требует is_admin() внутри самих функций)
set role authenticated;
set request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111"}';

-- ============================= Эталонный пример из CLAUDE.md п.6 =============================
-- Трек 89900 -> зачёт 44950. Дело: гонорар 300000, комиссия 75000 -> списание 37500, остаток 7450, к оплате 37500.

select (grant_credit('66666666-6666-6666-6666-666666666661')).id as ref_credit_id \gset
select is((select amount_rub from credits where id = (:'ref_credit_id')::uuid), 44950, 'grant_credit: 50% от цены трека 89900 = 44950');

insert into assignments (id, case_id, executor_id, platform_fee_rub) values
  ('75555555-0000-0000-0000-000000000001', 'caaaaaaa-1000-0000-0000-000000000001', '66666666-6666-6666-6666-666666666661', 75000);

select charged_rub, remaining_balance_rub, due_rub
  from apply_credit('75555555-0000-0000-0000-000000000001') \gset ref_

select is(:'ref_charged_rub'::int, 37500, 'Эталон: списано 37500');
select is(:'ref_remaining_balance_rub'::int, 7450, 'Эталон: остаток зачёта 7450');
select is(:'ref_due_rub'::int, 37500, 'Эталон: к оплате партнёром 37500');

-- ============================= Зачёт просрочен =============================

insert into credits (profile_id, amount_rub, balance_rub, expires_at) values
  ('66666666-6666-6666-6666-666666666662', 40000, 40000, now() - interval '1 day');

insert into assignments (id, case_id, executor_id, platform_fee_rub) values
  ('75555555-0000-0000-0000-000000000002', 'caaaaaaa-1000-0000-0000-000000000002', '66666666-6666-6666-6666-666666666662', 20000);

select charged_rub, remaining_balance_rub, due_rub
  from apply_credit('75555555-0000-0000-0000-000000000002') \gset exp_

select is(:'exp_charged_rub'::int, 0, 'Просроченный зачёт: списано 0');
select is(:'exp_due_rub'::int, 20000, 'Просроченный зачёт: к оплате вся комиссия 20000');

-- ============================= Два зачёта подряд (одному исполнителю) =============================
-- Исполнитель 3: зачёт 44950 (как в эталоне). Дело A комиссия 60000 (лимит 30000) -> списано 30000, остаток 14950.
-- Дело Б комиссия 40000 (лимит 20000, но остаток только 14950) -> списано 14950 (меньше лимита), остаток 0.

select (grant_credit('66666666-6666-6666-6666-666666666663')).id as two_credit_id \gset

insert into assignments (id, case_id, executor_id, platform_fee_rub) values
  ('75555555-0000-0000-0000-000000000003', 'caaaaaaa-1000-0000-0000-000000000003', '66666666-6666-6666-6666-666666666663', 60000);

select charged_rub, remaining_balance_rub, due_rub
  from apply_credit('75555555-0000-0000-0000-000000000003') \gset two_a_

select is(:'two_a_charged_rub'::int, 30000, 'Два зачёта подряд, дело А: списано 30000 (лимит 50% от 60000)');
select is(:'two_a_remaining_balance_rub'::int, 14950, 'Два зачёта подряд, дело А: остаток 14950');
select is(:'two_a_due_rub'::int, 30000, 'Два зачёта подряд, дело А: к оплате 30000');

insert into assignments (id, case_id, executor_id, platform_fee_rub) values
  ('75555555-0000-0000-0000-000000000004', 'caaaaaaa-1000-0000-0000-000000000004', '66666666-6666-6666-6666-666666666663', 40000);

select charged_rub, remaining_balance_rub, due_rub
  from apply_credit('75555555-0000-0000-0000-000000000004') \gset two_b_

select is(:'two_b_charged_rub'::int, 14950, 'Два зачёта подряд, дело Б: зачёт меньше лимита (50% от 40000=20000) -> списан весь остаток 14950');
select is(:'two_b_remaining_balance_rub'::int, 0, 'Два зачёта подряд, дело Б: остаток зачёта 0');
select is(:'two_b_due_rub'::int, 25050, 'Два зачёта подряд, дело Б: к оплате 40000-14950=25050');

reset role;
reset request.jwt.claims;

-- ============================= apply_credit доступен только admin =============================

insert into assignments (id, case_id, executor_id, platform_fee_rub) values
  ('75555555-0000-0000-0000-000000000005', 'caaaaaaa-1000-0000-0000-000000000005', '66666666-6666-6666-6666-666666666661', 10000);

set role authenticated;
set request.jwt.claims = '{"sub":"66666666-6666-6666-6666-666666666661"}';
select throws_like(
  $$ select * from apply_credit('75555555-0000-0000-0000-000000000005') $$,
  '%Только администратор%',
  'apply_credit(): не-admin не может применить зачёт'
);
reset role;
reset request.jwt.claims;

select * from finish();
rollback;
