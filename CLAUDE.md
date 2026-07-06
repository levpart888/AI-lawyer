# ТЗ: Платформа «Лига AI-Юристов» — MVP для пилота

> Этот файл — контекст для Claude Code. Все решения по коду принимать в соответствии с этим документом; при противоречии — спросить.

## 1. Контекст и цель

Закрытая биржа юридических дел для сертифицированных выпускников курса «AI-Юрист».
Пилот: 1 направление (крипто-форензика), 8–12 участников, 12–18 дел в год.
Администратор публикует обезличенные карточки дел → специалисты/партнёры откликаются →
админ назначает исполнителя (на первых делах — с супервизором) → дело закрывается
с оценкой клиента → применяется зачёт стоимости обучения против комиссии платформы.

MVP — рабочий инструмент, не витрина. Приоритет: корректность доступов и зачётов,
а не красота. Деньги через платформу НЕ ходят (расчёты офлайн по договорам).

## 2. Стек и принципы

- Next.js 14+ (App Router, TypeScript), Tailwind, shadcn/ui
- Supabase: Postgres, Auth (email magic link + приглашения), RLS, Storage
- Деплой: Vercel. Уведомления: Telegram Bot API (webhook из route handler)
- Интерфейс на русском. Мобильная вёрстка обязательна (партнёры живут в телефоне)
- Никаких платёжных интеграций в MVP
- ВСЯ авторизация доступа — через RLS-политики Postgres. Проверки в UI — только дублирующие

## 3. Роли

| Роль | Как получает | Что может |
|---|---|---|
| `admin` | назначается вручную (сид) | всё: CRUD дел, назначение, пользователи, зачёты |
| `partner` | админ повышает специалиста | видеть и откликаться на дела своего направления, приоритетная метка |
| `specialist` | админ создаёт по приглашению | видеть и откликаться на дела своего направления |
| (нет роли) | — | доступа нет; публичной регистрации НЕТ |

Один пользователь = одна роль. Клиенты (доверители) в системе НЕ присутствуют.

## 4. Схема данных (миграции Supabase)

```sql
-- profiles: расширение auth.users
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role text not null check (role in ('admin','partner','specialist')),
  track_id uuid references tracks(id),          -- направление сертификации
  rating numeric(3,2) default null,             -- среднее по закрытым делам
  cases_closed int not null default 0,
  is_active boolean not null default true,
  telegram_chat_id text,                        -- для личных уведомлений (опц.)
  created_at timestamptz not null default now()
);

create table tracks (
  id uuid primary key default gen_random_uuid(),
  name text not null,                           -- 'Крипто-форензика'
  price_rub int not null                        -- 89900
);

create table cases (
  id uuid primary key default gen_random_uuid(),
  track_id uuid not null references tracks(id),
  title text not null,                          -- ОБЕЗЛИЧЕННОЕ название
  summary text not null,                        -- обезличенное описание, без ПД
  fee_min_rub int, fee_max_rub int,             -- вилка гонорара
  min_role text not null default 'specialist' check (min_role in ('specialist','partner')),
  status text not null default 'draft'
    check (status in ('draft','published','assigned','in_progress','closed','cancelled')),
  respond_until timestamptz,                    -- дедлайн откликов
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now()
);

create table responses (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references cases(id) on delete cascade,
  profile_id uuid not null references profiles(id),
  comment text,
  created_at timestamptz not null default now(),
  unique (case_id, profile_id)
);

create table assignments (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null unique references cases(id),
  executor_id uuid not null references profiles(id),
  supervisor_id uuid references profiles(id),   -- null, если супервизия не нужна
  fee_rub int,                                  -- фактический гонорар (вносит админ при закрытии)
  platform_fee_rub int,                         -- комиссия платформы (25% по умолчанию, редактируемо)
  assigned_at timestamptz not null default now(),
  closed_at timestamptz
);

create table ratings (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null unique references assignments(id),
  score int not null check (score between 1 and 5),
  client_comment text,                          -- вносит админ со слов клиента
  created_at timestamptz not null default now()
);

-- Зачёты обучения
create table credits (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id),
  amount_rub int not null,                      -- начислено: 50% цены трека
  balance_rub int not null,                     -- остаток
  expires_at timestamptz not null,              -- сертификация + 18 месяцев
  created_at timestamptz not null default now()
);

create table credit_transactions (
  id uuid primary key default gen_random_uuid(),
  credit_id uuid not null references credits(id),
  assignment_id uuid not null references assignments(id),
  amount_rub int not null,                      -- списано по делу
  created_at timestamptz not null default now()
);
```

## 5. RLS-политики (обязательные)

Включить RLS на всех таблицах. Хелпер: `current_role()` и `current_track()` читают из profiles по `auth.uid()`.

| Таблица | select | insert | update/delete |
|---|---|---|---|
| profiles | своя строка; admin — все; имя+рейтинг других участников своего направления (для витрины реестра) | только admin | своя строка (кроме role, track_id, rating); admin — всё |
| cases | admin — все; participant — status='published' И track = свой И min_role допускает; свои назначенные дела в любом статусе | admin | admin |
| responses | свои; admin — все; НИКОГДА не видеть чужие отклики | своя роль допущена к делу И status='published' И дедлайн не истёк | delete — свой до назначения; admin |
| assignments | admin; executor и supervisor — свои | admin | admin |
| ratings | admin; executor — свои | admin | admin |
| credits, credit_transactions | admin; владелец — свои | admin (транзакции — только через функцию, см. п.6) | admin |

**Критично:** партнёр А не должен видеть отклики партнёра Б, чужие assignments, чужие зачёты, дела чужого направления и дела в статусе draft. На это — обязательные тесты (п.10).

## 6. Бизнес-правила зачётов (реализовать функцией Postgres)

`apply_credit(assignment_id)` вызывается админом при закрытии дела, в транзакции:

1. Найти активный зачёт исполнителя: `balance_rub > 0` и `expires_at > now()` (старейший первым).
2. Лимит списания по делу: `min(balance_rub, platform_fee_rub * 0.5)` (целые рубли, округление вниз).
3. Записать credit_transactions, уменьшить balance_rub.
4. Вернуть: сколько списано, остаток, сумма комиссии к оплате партнёром = `platform_fee_rub - списано`.

Начисление зачёта: при создании профиля со статусом сертификации админ жмёт «начислить зачёт» → `amount_rub = tracks.price_rub * 0.5`, `expires_at = now() + interval '18 months'`.
Просроченный зачёт не списывается (проверка в п.1), в кабинете показывается как «сгорел».

Пример-эталон для теста: трек 89 900 → зачёт 44 950; дело с гонораром 300 000, комиссия 75 000 → списание 37 500, остаток 7 450, к оплате партнёром 37 500.

## 7. Экраны (App Router)

- `/login` — magic link. Без ссылки «зарегистрироваться».
- `/cases` — лента опубликованных дел своего направления: карточка (title, summary, вилка, дедлайн, бейдж «нужен уровень: партнёр»), кнопка «Откликнуться» (+ необязательный комментарий). Уже откликнулся — бейдж «отклик отправлен».
- `/cases/[id]` — деталь дела; для исполнителя назначенного дела — статус и контакты супервизора.
- `/me` — кабинет: мои отклики, мои дела (активные/закрытые), рейтинг, зачёт (остаток, срок сгорания, история списаний).
- `/registry` — реестр участников направления: имя, уровень, рейтинг, число закрытых дел (публичная гордость, приватного — ничего).
- `/admin` — список дел по статусам; создание/редактирование дела; просмотр откликов по делу и назначение исполнителя+супервизора; закрытие дела: ввод fee_rub → авторасчёт комиссии 25% (редактируемо) → оценка клиента → вызов apply_credit → итоговая сводка «к оплате партнёром»; управление пользователями (создать приглашение, повысить до партнёра, начислить зачёт, деактивировать).

## 8. Telegram-уведомления

Бот, токен в env. События → сообщение в закрытый канал Лиги (chat_id в env):
- дело опубликовано (title, вилка, дедлайн, ссылка),
- дело назначено (без имени исполнителя в общий канал),
- дело закрыто (оценка).
Личные уведомления исполнителю (если telegram_chat_id задан): назначение, закрытие, списание зачёта. Отправка — fire-and-forget из server actions, ошибки логировать, не блокировать операцию.

## 9. Не-цели MVP (не делать)

Онлайн-платежи и эскроу; публичная регистрация; клиентский портал; чат внутри платформы (общение — в Telegram); загрузка материалов дел (файлы дел живут вне платформы — карточки только обезличенные); мультиязычность; email-рассылки.

## 10. Приёмка

- Тесты RLS (pgTAP или интеграционные через service role + anon key): матрица из п.5, минимум: партнёр не видит чужие отклики/назначения/зачёты/draft-дела/чужое направление; specialist не видит дела с min_role='partner' — ВИДИТ, но не может откликнуться (кнопка заблокирована И insert отклонён политикой).
- Тест apply_credit: пример-эталон из п.6 + случаи «зачёт просрочен», «зачёт меньше лимита», «два зачёта подряд».
- Прогон сценария вручную: создать дело → 2 отклика → назначить → закрыть с оценкой → проверить рейтинг, счётчик дел, списание.
- Lighthouse mobile ≥ 90 по /cases.

## 11. Сид-данные

1 admin, 1 track («Крипто-форензика», 89900), 3 specialist, 1 partner, 2 published-дела, 1 закрытое дело с оценкой 5 и применённым зачётом — чтобы кабинет и реестр сразу выглядели живыми.

## 12. Порядок работы

Этап 1: миграции + RLS + тесты доступов (не идти дальше, пока тесты не зелёные).
Этап 2: auth + /cases + отклики. Этап 3: /admin (дела, назначение, закрытие).
Этап 4: зачёты + /me + /registry. Этап 5: Telegram + сид + прогон сценария.
После каждого этапа — краткое резюме изменений и что проверить руками.
