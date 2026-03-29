-- Pulse schema — run this once in the Supabase SQL editor
-- https://supabase.com/dashboard/project/ryojbyctouiktnfnnvkw/sql/new

create extension if not exists "uuid-ossp";

create table health_profiles (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null unique,
  display_name text not null,
  age integer, sex text, height_cm float, weight_kg float,
  primary_conditions jsonb not null default '[]',
  current_medications jsonb not null default '[]',
  allergies jsonb not null default '[]',
  health_facts jsonb not null default '[]',
  wearable_summary jsonb,
  conversation_count integer not null default 0,
  member_since timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table lab_results (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  test_name text not null, loinc_code text,
  value float, value_text text, unit text,
  reference_range_low float, reference_range_high float,
  status text check (status in ('normal','low','high','critical','unknown')),
  date_collected date,
  lab_source text check (lab_source in ('photo_ocr','healthkit','manual','pdf')),
  created_at timestamptz not null default now()
);

create table conversations (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  messages jsonb not null default '[]',
  health_domain text,
  citations jsonb not null default '[]',
  created_at timestamptz not null default now()
);

create table symptom_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  symptoms jsonb not null default '[]',
  severity integer check (severity between 1 and 10),
  notes text, logged_at timestamptz not null default now()
);

create table documents (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  filename text not null, storage_path text not null,
  document_type text, extracted_facts jsonb not null default '[]',
  created_at timestamptz not null default now()
);

alter table health_profiles enable row level security;
alter table lab_results enable row level security;
alter table conversations enable row level security;
alter table symptom_logs enable row level security;
alter table documents enable row level security;

create policy "Users own their health profiles"
  on health_profiles for all using (auth.uid() = user_id);
create policy "Users own their lab results"
  on lab_results for all using (auth.uid() = user_id);
create policy "Users own their conversations"
  on conversations for all using (auth.uid() = user_id);
create policy "Users own their symptom logs"
  on symptom_logs for all using (auth.uid() = user_id);
create policy "Users own their documents"
  on documents for all using (auth.uid() = user_id);

create index idx_lab_results_user_date on lab_results(user_id, date_collected desc);
create index idx_symptom_logs_user_date on symptom_logs(user_id, logged_at desc);
create index idx_conversations_user on conversations(user_id, created_at desc);
