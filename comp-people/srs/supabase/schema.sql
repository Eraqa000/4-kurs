-- Схема AudioCanvas. Выполнить в Supabase SQL Editor.

create table profiles (
  id uuid primary key references auth.users on delete cascade,
  nickname text not null,                       -- псевдоним, без лишних персональных данных
  role text not null check (role in ('child', 'teacher')),
  language text not null default 'kk' check (language in ('kk', 'ru')),
  settings jsonb not null default '{}'::jsonb,
  teacher_id uuid references profiles(id)       -- привязка ребёнка к учителю
);

create table materials (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  prompt text not null,
  image_url text,
  alt_text text,
  long_description text,
  language text not null default 'kk',
  created_at timestamptz not null default now()
);

create table lessons (
  id uuid primary key default gen_random_uuid(),
  "order" int not null unique,
  title_kk text not null,
  title_ru text not null,
  content jsonb not null default '{}'::jsonb
);

create table lesson_progress (
  user_id uuid not null references profiles(id) on delete cascade,
  lesson_id uuid not null references lessons(id) on delete cascade,
  status text not null default 'not_started' check (status in ('not_started', 'in_progress', 'done')),
  updated_at timestamptz not null default now(),
  primary key (user_id, lesson_id)
);

-- Row Level Security
alter table profiles enable row level security;
alter table materials enable row level security;
alter table lessons enable row level security;
alter table lesson_progress enable row level security;

create policy "profile: свой" on profiles for select using (id = auth.uid());
create policy "profile: учитель видит своих детей" on profiles for select using (teacher_id = auth.uid());
create policy "profile: обновить свой" on profiles for update using (id = auth.uid());

create policy "materials: владелец" on materials for all using (owner_id = auth.uid());
create policy "materials: учитель читает" on materials for select
  using (exists (select 1 from profiles p where p.id = materials.owner_id and p.teacher_id = auth.uid()));
create policy "materials: учитель правит описание" on materials for update
  using (exists (select 1 from profiles p where p.id = materials.owner_id and p.teacher_id = auth.uid()));

create policy "lessons: читают все авторизованные" on lessons for select using (auth.uid() is not null);

create policy "progress: свой" on lesson_progress for all using (user_id = auth.uid());
create policy "progress: учитель читает" on lesson_progress for select
  using (exists (select 1 from profiles p where p.id = lesson_progress.user_id and p.teacher_id = auth.uid()));
