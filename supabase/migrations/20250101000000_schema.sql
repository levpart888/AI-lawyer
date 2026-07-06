-- Лига AI-Юристов: базовая схема данных
-- см. CLAUDE.md п.4

create extension if not exists pgcrypto;

create table tracks (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  price_rub int not null check (price_rub >= 0),
  created_at timestamptz not null default now()
);

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role text not null check (role in ('admin','partner','specialist')),
  track_id uuid references tracks(id),
  rating numeric(3,2) default null check (rating is null or (rating >= 1 and rating <= 5)),
  cases_closed int not null default 0,
  is_active boolean not null default true,
  telegram_chat_id text,
  created_at timestamptz not null default now()
);

create index profiles_track_id_idx on profiles(track_id);

create table cases (
  id uuid primary key default gen_random_uuid(),
  track_id uuid not null references tracks(id),
  title text not null,
  summary text not null,
  fee_min_rub int,
  fee_max_rub int,
  min_role text not null default 'specialist' check (min_role in ('specialist','partner')),
  status text not null default 'draft'
    check (status in ('draft','published','assigned','in_progress','closed','cancelled')),
  respond_until timestamptz,
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now()
);

create index cases_track_status_idx on cases(track_id, status);

create table responses (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references cases(id) on delete cascade,
  profile_id uuid not null references profiles(id),
  comment text,
  created_at timestamptz not null default now(),
  unique (case_id, profile_id)
);

create index responses_case_id_idx on responses(case_id);
create index responses_profile_id_idx on responses(profile_id);

create table assignments (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null unique references cases(id),
  executor_id uuid not null references profiles(id),
  supervisor_id uuid references profiles(id),
  fee_rub int,
  platform_fee_rub int,
  assigned_at timestamptz not null default now(),
  closed_at timestamptz
);

create index assignments_executor_id_idx on assignments(executor_id);
create index assignments_supervisor_id_idx on assignments(supervisor_id);

create table ratings (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null unique references assignments(id),
  score int not null check (score between 1 and 5),
  client_comment text,
  created_at timestamptz not null default now()
);

create table credits (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id),
  amount_rub int not null check (amount_rub >= 0),
  balance_rub int not null check (balance_rub >= 0),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index credits_profile_id_idx on credits(profile_id);

create table credit_transactions (
  id uuid primary key default gen_random_uuid(),
  credit_id uuid not null references credits(id),
  assignment_id uuid not null references assignments(id),
  amount_rub int not null check (amount_rub >= 0),
  created_at timestamptz not null default now()
);

create index credit_transactions_credit_id_idx on credit_transactions(credit_id);
create index credit_transactions_assignment_id_idx on credit_transactions(assignment_id);
