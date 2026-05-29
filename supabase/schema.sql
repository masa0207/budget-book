-- ========================================
-- 家計簿アプリ Supabase スキーマ
-- ========================================

-- カテゴリテーブル（収入・支出共用）
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  type text not null check (type in ('income', 'expense')),
  color text default '#6366f1',
  is_default boolean default false,
  created_at timestamptz default now()
);

-- トランザクション（収支記録）テーブル
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  type text not null check (type in ('income', 'expense')),
  amount integer not null check (amount > 0),
  category_id uuid references public.categories(id) on delete set null,
  date date not null,
  memo text,
  source text,  -- 支払元 or 収入元
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 月別予算テーブル
create table public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  category_id uuid references public.categories(id) on delete cascade not null,
  year_month text not null,  -- 'YYYY-MM'形式
  amount integer not null check (amount >= 0),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, category_id, year_month)
);

-- ========================================
-- RLS (Row Level Security)
-- ========================================

alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.budgets enable row level security;

-- カテゴリ: 自分のデータのみ
create policy "categories_select" on public.categories for select using (auth.uid() = user_id);
create policy "categories_insert" on public.categories for insert with check (auth.uid() = user_id);
create policy "categories_update" on public.categories for update using (auth.uid() = user_id);
create policy "categories_delete" on public.categories for delete using (auth.uid() = user_id);

-- トランザクション: 自分のデータのみ
create policy "transactions_select" on public.transactions for select using (auth.uid() = user_id);
create policy "transactions_insert" on public.transactions for insert with check (auth.uid() = user_id);
create policy "transactions_update" on public.transactions for update using (auth.uid() = user_id);
create policy "transactions_delete" on public.transactions for delete using (auth.uid() = user_id);

-- 予算: 自分のデータのみ
create policy "budgets_select" on public.budgets for select using (auth.uid() = user_id);
create policy "budgets_insert" on public.budgets for insert with check (auth.uid() = user_id);
create policy "budgets_update" on public.budgets for update using (auth.uid() = user_id);
create policy "budgets_delete" on public.budgets for delete using (auth.uid() = user_id);

-- ========================================
-- デフォルトカテゴリ挿入関数
-- ユーザー登録時に自動で初期カテゴリを作成
-- ========================================

create or replace function public.create_default_categories()
returns trigger as $$
begin
  -- 支出カテゴリ（マネーフォワード大項目に対応）
  insert into public.categories (user_id, name, type, color, is_default) values
    (new.id, '衣服・美容',   'expense', '#d946ef', true),
    (new.id, '教養・教育',   'expense', '#06b6d4', true),
    (new.id, '健康・医療',   'expense', '#f43f5e', true),
    (new.id, '交際費',       'expense', '#14b8a6', true),
    (new.id, '交通費',       'expense', '#84cc16', true),
    (new.id, '住宅',         'expense', '#ef4444', true),
    (new.id, '食費',         'expense', '#f97316', true),
    (new.id, '水道・光熱費', 'expense', '#8b5cf6', true),
    (new.id, '貯金',         'expense', '#22c55e', true),
    (new.id, '通信費',       'expense', '#ec4899', true),
    (new.id, '特別な支出',   'expense', '#f59e0b', true),
    (new.id, '日用品',       'expense', '#3b82f6', true),
    (new.id, '保険',         'expense', '#eab308', true),
    (new.id, 'その他',       'expense', '#94a3b8', true);
  -- 収入カテゴリ
  insert into public.categories (user_id, name, type, color, is_default) values
    (new.id, '給与',       'income',  '#22c55e', true),
    (new.id, '副収入',     'income',  '#10b981', true),
    (new.id, 'ボーナス',   'income',  '#059669', true),
    (new.id, 'その他収入', 'income',  '#94a3b8', true);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.create_default_categories();

-- updated_at 自動更新
create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger transactions_updated_at
  before update on public.transactions
  for each row execute procedure public.update_updated_at();

create trigger budgets_updated_at
  before update on public.budgets
  for each row execute procedure public.update_updated_at();

-- インデックス
create index transactions_user_date_idx on public.transactions(user_id, date);
create index transactions_category_idx on public.transactions(category_id);
create index budgets_user_month_idx on public.budgets(user_id, year_month);
