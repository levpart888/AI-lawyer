-- Бизнес-функции: зачёты и закрытие дела. См. CLAUDE.md п.6.

-- apply_credit: списывает зачёт исполнителя дела в счёт комиссии платформы.
-- Возвращает: сколько списано, остаток самого свежего использованного зачёта,
-- сумму к оплате партнёром (комиссия минус списание).
create or replace function public.apply_credit(p_assignment_id uuid)
returns table(charged_rub int, remaining_balance_rub int, due_rub int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_executor uuid;
  v_platform_fee int;
  v_credit_id uuid;
  v_balance int;
  v_charge int;
begin
  if not public.is_admin() then
    raise exception 'Только администратор может применять зачёт';
  end if;

  select executor_id, platform_fee_rub
  into v_executor, v_platform_fee
  from assignments
  where id = p_assignment_id;

  if v_executor is null then
    raise exception 'Назначение % не найдено', p_assignment_id;
  end if;

  if v_platform_fee is null then
    raise exception 'У назначения % не указана комиссия платформы', p_assignment_id;
  end if;

  select id, balance_rub
  into v_credit_id, v_balance
  from credits
  where profile_id = v_executor
    and balance_rub > 0
    and expires_at > now()
  order by created_at asc
  limit 1
  for update;

  if v_credit_id is null then
    return query select 0, null::int, v_platform_fee;
    return;
  end if;

  v_charge := least(v_balance, floor(v_platform_fee * 0.5)::int);

  insert into credit_transactions (credit_id, assignment_id, amount_rub)
  values (v_credit_id, p_assignment_id, v_charge);

  update credits set balance_rub = balance_rub - v_charge where id = v_credit_id;

  return query select v_charge, (v_balance - v_charge), (v_platform_fee - v_charge);
end;
$$;

-- grant_credit: начисляет зачёт за обучение специалисту (50% цены трека, срок 18 мес).
create or replace function public.grant_credit(p_profile_id uuid)
returns credits
language plpgsql
security definer
set search_path = public
as $$
declare
  v_track_id uuid;
  v_price int;
  v_amount int;
  v_row credits;
begin
  if not public.is_admin() then
    raise exception 'Только администратор может начислять зачёт';
  end if;

  select track_id into v_track_id from profiles where id = p_profile_id;
  if v_track_id is null then
    raise exception 'У профиля % не указано направление сертификации', p_profile_id;
  end if;

  select price_rub into v_price from tracks where id = v_track_id;
  v_amount := floor(v_price * 0.5)::int;

  insert into credits (profile_id, amount_rub, balance_rub, expires_at)
  values (p_profile_id, v_amount, v_amount, now() + interval '18 months')
  returning * into v_row;

  return v_row;
end;
$$;

-- close_case: полный цикл закрытия дела (гонорар -> комиссия -> оценка -> зачёт -> рейтинг).
create or replace function public.close_case(
  p_assignment_id uuid,
  p_fee_rub int,
  p_platform_fee_rub int,
  p_score int,
  p_client_comment text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_case_id uuid;
  v_executor uuid;
  v_credit_result record;
  v_avg numeric(3,2);
begin
  if not public.is_admin() then
    raise exception 'Только администратор может закрывать дело';
  end if;

  select case_id, executor_id into v_case_id, v_executor
  from assignments
  where id = p_assignment_id;

  if v_case_id is null then
    raise exception 'Назначение % не найдено', p_assignment_id;
  end if;

  update assignments
  set fee_rub = p_fee_rub,
      platform_fee_rub = p_platform_fee_rub,
      closed_at = now()
  where id = p_assignment_id;

  insert into ratings (assignment_id, score, client_comment)
  values (p_assignment_id, p_score, p_client_comment);

  update cases set status = 'closed' where id = v_case_id;

  select charged_rub, remaining_balance_rub, due_rub
  into v_credit_result
  from public.apply_credit(p_assignment_id);

  select round(avg(r.score), 2) into v_avg
  from ratings r
  join assignments a on a.id = r.assignment_id
  where a.executor_id = v_executor;

  update profiles
  set rating = v_avg,
      cases_closed = cases_closed + 1
  where id = v_executor;

  return jsonb_build_object(
    'charged_rub', v_credit_result.charged_rub,
    'remaining_balance_rub', v_credit_result.remaining_balance_rub,
    'due_rub', v_credit_result.due_rub
  );
end;
$$;
