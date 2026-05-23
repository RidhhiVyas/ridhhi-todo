-- ============================================================
-- RIDHHI'S TODO — DATABASE SETUP
-- Run this in Supabase SQL Editor (SQL Editor → New Query → paste → Run)
-- If you already ran the tasks part before, re-running the whole thing
-- is safe because of "if not exists" / "drop policy if exists".
-- ============================================================

-- ---------- TASKS TABLE ----------
create table if not exists tasks (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  text text not null,
  category text not null check (category in ('office', 'personal')),
  priority text not null default 'medium' check (priority in ('high', 'medium', 'low')),
  completed boolean default false,
  due_at timestamptz,
  created_at timestamptz default now(),
  completed_at timestamptz,
  reminder_sent boolean default false
);

-- If the tasks table already existed, make sure the new column is there:
alter table tasks add column if not exists reminder_sent boolean default false;

alter table tasks enable row level security;

drop policy if exists "Users can view their own tasks" on tasks;
create policy "Users can view their own tasks"
  on tasks for select using (auth.uid() = user_id);

drop policy if exists "Users can insert their own tasks" on tasks;
create policy "Users can insert their own tasks"
  on tasks for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update their own tasks" on tasks;
create policy "Users can update their own tasks"
  on tasks for update using (auth.uid() = user_id);

drop policy if exists "Users can delete their own tasks" on tasks;
create policy "Users can delete their own tasks"
  on tasks for delete using (auth.uid() = user_id);

-- ---------- PUSH SUBSCRIPTIONS TABLE (new) ----------
-- Stores one row per browser/device the user enabled notifications on.
create table if not exists push_subscriptions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz default now()
);

alter table push_subscriptions enable row level security;

drop policy if exists "Users manage their own subscriptions" on push_subscriptions;
create policy "Users manage their own subscriptions"
  on push_subscriptions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------- REALTIME ----------
do $$
begin
  begin
    alter publication supabase_realtime add table tasks;
  exception when duplicate_object then null;
  end;
end $$;
