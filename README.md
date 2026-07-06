# Лига AI-Юристов

Закрытая биржа юридических дел для сертифицированных выпускников курса «AI-Юрист».
Полное ТЗ — в [`CLAUDE.md`](./CLAUDE.md).

Стек: Next.js (App Router, TypeScript) + Tailwind + shadcn/ui + Supabase (Postgres, Auth, RLS).

## Настройка Supabase-проекта

1. Создайте проект на [supabase.com](https://supabase.com) (или поднимите локально через `npx supabase start`, если у вас есть Docker).
2. Примените миграции из `supabase/migrations/*.sql` по порядку (через SQL-редактор проекта, `supabase db push`, либо `supabase db reset` локально).
3. (Опционально, для демо) выполните `supabase/seed.sql` — заведёт 1 admin, 1 трек, 3 специалистов, 1 партнёра, 2 опубликованных дела и 1 закрытое с применённым зачётом.
4. Скопируйте `.env.local.example` в `.env.local` и заполните:
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` — из Settings → API проекта.
   - `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHANNEL_CHAT_ID` — если нужны уведомления в Telegram.
   - `NEXT_PUBLIC_APP_URL` — публичный URL приложения (для ссылок в уведомлениях).
5. Настоящих участников заводите через `/admin/users` → «Пригласить участника» (magic link уходит на реальную почту) — сид нужен только чтобы сразу увидеть наполненный интерфейс.

## Разработка

```bash
npm install
npm run dev       # http://localhost:3000
npm run lint
npm run build
```

## Тесты RLS и бизнес-функций

Тесты (pgTAP) проверяют матрицу доступа из `CLAUDE.md` п.5 и функцию `apply_credit` из п.6.
Требуют локальный PostgreSQL 16 + расширение `pgtap` (Docker в этой среде разработки недоступен,
поэтому тесты гоняются напрямую на postgres с шимом `auth.uid()`/ролей `anon`/`authenticated`,
без полного стека GoTrue/PostgREST):

```bash
sudo apt-get install -y postgresql-16 postgresql-16-pgtap
npm run test:db
```

Ожидаемый результат — `ВСЕ ТЕСТЫ ЗЕЛЁНЫЕ`.

## Структура

- `supabase/migrations/` — схема, RLS-политики, бизнес-функции (`apply_credit`, `grant_credit`, `close_case`).
- `supabase/tests/` — pgTAP-тесты и шим окружения Supabase для локального прогона без Docker.
- `supabase/seed.sql` — демо-данные для пилота.
- `src/app/` — страницы: `/login`, `/cases`, `/cases/[id]`, `/me`, `/registry`, `/admin/*`.
- `src/lib/supabase/` — клиенты Supabase (browser/server/admin) и обновление сессии.
- `src/lib/telegram.ts` — уведомления в канал Лиги и участникам.
