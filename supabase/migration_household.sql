-- ========================================
-- 世帯共有への移行SQL
-- Supabase SQL Editor で一度だけ実行してください
-- ========================================

-- 1. 世帯テーブルを作成
create table if not exists public.households (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now()
);

create table if not exists public.household_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  joined_at timestamptz default now()
);

-- 2. 既存テーブルに household_id カラムを追加
alter table public.categories  add column if not exists household_id uuid references public.households(id);
alter table public.transactions add column if not exists household_id uuid references public.households(id);
alter table public.budgets      add column if not exists household_id uuid references public.households(id);

-- 3. 世帯を1つ作成し、全ユーザーを同じ世帯に紐付ける
do $$
declare
  hid uuid;
begin
  insert into public.households default values returning id into hid;
  insert into public.household_members (user_id, household_id)
    select id, hid from auth.users;
  update public.categories  set household_id = hid where household_id is null;
  update public.transactions set household_id = hid where household_id is null;
  update public.budgets      set household_id = hid where household_id is null;
end $$;

-- 4. NOT NULL 制約を追加
alter table public.categories  alter column household_id set not null;
alter table public.transactions alter column household_id set not null;
alter table public.budgets      alter column household_id set not null;

-- 5. household_id 取得ヘルパー関数
create or replace function public.get_my_household_id()
returns uuid as $$
  select household_id from public.household_members where user_id = auth.uid()
$$ language sql stable security definer;

-- 6. RLS を有効化
alter table public.households        enable row level security;
alter table public.household_members enable row level security;

create policy "household_members_select" on public.household_members
  for select using (user_id = auth.uid());

-- 7. 既存ポリシーを削除して household_id ベースに更新
drop policy if exists "categories_select"  on public.categories;
drop policy if exists "categories_insert"  on public.categories;
drop policy if exists "categories_update"  on public.categories;
drop policy if exists "categories_delete"  on public.categories;
create policy "categories_select" on public.categories for select using (household_id = get_my_household_id());
create policy "categories_insert" on public.categories for insert with check (household_id = get_my_household_id());
create policy "categories_update" on public.categories for update using (household_id = get_my_household_id());
create policy "categories_delete" on public.categories for delete using (household_id = get_my_household_id());

drop policy if exists "transactions_select" on public.transactions;
drop policy if exists "transactions_insert" on public.transactions;
drop policy if exists "transactions_update" on public.transactions;
drop policy if exists "transactions_delete" on public.transactions;
create policy "transactions_select" on public.transactions for select using (household_id = get_my_household_id());
create policy "transactions_insert" on public.transactions for insert with check (household_id = get_my_household_id());
create policy "transactions_update" on public.transactions for update using (household_id = get_my_household_id());
create policy "transactions_delete" on public.transactions for delete using (household_id = get_my_household_id());

drop policy if exists "budgets_select" on public.budgets;
drop policy if exists "budgets_insert" on public.budgets;
drop policy if exists "budgets_update" on public.budgets;
drop policy if exists "budgets_delete" on public.budgets;
create policy "budgets_select" on public.budgets for select using (household_id = get_my_household_id());
create policy "budgets_insert" on public.budgets for insert with check (household_id = get_my_household_id());
create policy "budgets_update" on public.budgets for update using (household_id = get_my_household_id());
create policy "budgets_delete" on public.budgets for delete using (household_id = get_my_household_id());

-- 8. budgets の unique 制約を user_id → household_id ベースに変更
alter table public.budgets drop constraint if exists budgets_user_id_category_id_year_month_key;
alter table public.budgets add constraint budgets_household_category_month_key
  unique (household_id, category_id, year_month);

-- 9. create_default_categories 関数を更新（新規ユーザー登録時用）
create or replace function public.create_default_categories()
returns trigger as $$
declare
  new_household_id uuid;
begin
  insert into public.households default values returning id into new_household_id;
  insert into public.household_members (user_id, household_id) values (new.id, new_household_id);

  insert into public.categories (user_id, household_id, name, type, color, is_default) values
    (new.id, new_household_id, '衣服・美容',   'expense', '#d946ef', true),
    (new.id, new_household_id, '教養・教育',   'expense', '#06b6d4', true),
    (new.id, new_household_id, '健康・医療',   'expense', '#f43f5e', true),
    (new.id, new_household_id, '交際費',       'expense', '#14b8a6', true),
    (new.id, new_household_id, '交通費',       'expense', '#84cc16', true),
    (new.id, new_household_id, '住宅',         'expense', '#ef4444', true),
    (new.id, new_household_id, '食費',         'expense', '#f97316', true),
    (new.id, new_household_id, '水道・光熱費', 'expense', '#8b5cf6', true),
    (new.id, new_household_id, '貯金',         'expense', '#22c55e', true),
    (new.id, new_household_id, '通信費',       'expense', '#ec4899', true),
    (new.id, new_household_id, '特別な支出',   'expense', '#f59e0b', true),
    (new.id, new_household_id, '日用品',       'expense', '#3b82f6', true),
    (new.id, new_household_id, '保険',         'expense', '#eab308', true),
    (new.id, new_household_id, 'その他',       'expense', '#94a3b8', true);

  insert into public.categories (user_id, household_id, name, type, color, is_default) values
    (new.id, new_household_id, '給与',       'income', '#22c55e', true),
    (new.id, new_household_id, '副収入',     'income', '#10b981', true),
    (new.id, new_household_id, 'ボーナス',   'income', '#059669', true),
    (new.id, new_household_id, 'その他収入', 'income', '#94a3b8', true);

  return new;
end;
$$ language plpgsql security definer;
