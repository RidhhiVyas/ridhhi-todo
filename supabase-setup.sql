-- Run this in Supabase SQL Editor (SQL Editor → New Query → paste → Run)

create table tasks (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  text text not null,
  category text not null check (category in ('office', 'personal')),
  priority text not null default 'medium' check (priority in ('high', 'medium', 'low')),
  completed boolean default false,
  due_at timestamptz,
  created_at timestamptz default now(),
  completed_at timestamptz
);

-- Enable row-level security so users only see their own tasks
alter table tasks enable row level security;

create policy "Users can view their own tasks"
  on tasks for select
  using (auth.uid() = user_id);

create policy "Users can insert their own tasks"
  on tasks for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own tasks"
  on tasks for update
  using (auth.uid() = user_id);

create policy "Users can delete their own tasks"
  on tasks for delete
  using (auth.uid() = user_id);

-- Enable real-time sync
alter publication supabase_realtime add table tasks;
