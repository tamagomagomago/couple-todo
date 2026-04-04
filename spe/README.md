# SPE — Sotobori Performance Engine

Next.js 14 + Supabase で動くパーソナルダッシュボード（Phase 1）

## スタック

| Layer | Tech |
|-------|------|
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind CSS |
| Backend | Next.js API Routes |
| DB | Supabase (PostgreSQL) |
| AI | Anthropic Claude API |
| Deploy | Vercel |

---

## セットアップ手順

### 1. リポジトリをクローン・依存関係インストール

```bash
cd spe
npm install
```

### 2. 環境変数の設定

`.env.local.example` をコピーして `.env.local` を作成:

```bash
cp .env.local.example .env.local
```

`.env.local` を編集:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
ANTHROPIC_API_KEY=sk-ant-...
```

### 3. Supabase セットアップ

[Supabase Dashboard](https://supabase.com/) で新しいプロジェクトを作成後、
SQL Editor で以下を実行:

```sql
-- TODOテーブル
create table todos (
  id bigint primary key generated always as identity,
  title text not null,
  description text,
  priority int default 3,
  estimated_minutes int default 30,
  category text default 'personal',
  is_completed boolean default false,
  is_today boolean default false,
  due_date date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- インデックス
create index todos_priority_idx on todos(priority);
create index todos_category_idx on todos(category);
create index todos_is_completed_idx on todos(is_completed);

-- ルーティンテーブル
create table routines (
  id bigint primary key generated always as identity,
  title text not null,
  timing text not null,
  duration_minutes int default 15,
  notify_time text,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- 目標テーブル
create table goals (
  id bigint primary key generated always as identity,
  title text not null,
  description text,
  category text not null,
  period_type text not null,   -- 'annual' | 'monthly' | 'weekly'
  target_value numeric,
  current_value numeric default 0,
  unit text,
  start_date date not null,
  end_date date not null,
  is_achieved boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- インデックス
create index goals_period_type_idx on goals(period_type);
create index goals_category_idx on goals(category);

-- updated_at 自動更新トリガー
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger todos_updated_at
  before update on todos
  for each row execute function update_updated_at();

create trigger goals_updated_at
  before update on goals
  for each row execute function update_updated_at();
```

### 4. RLS（Row Level Security）の設定

開発中は RLS を無効化するか、以下のポリシーを設定:

```sql
-- todos
alter table todos enable row level security;
create policy "anon all" on todos for all using (true) with check (true);

-- goals
alter table goals enable row level security;
create policy "anon all" on goals for all using (true) with check (true);

-- routines
alter table routines enable row level security;
create policy "anon all" on routines for all using (true) with check (true);
```

### 5. サンプルデータの投入

```bash
npm run seed
```

### 6. 開発サーバー起動

```bash
npm run dev
```

→ http://localhost:3000

---

## API リファレンス

| Method | Path | 説明 |
|--------|------|------|
| GET | `/api/todos` | TODO一覧（?category=&is_completed=） |
| POST | `/api/todos` | TODO作成 |
| PUT | `/api/todos/[id]` | TODO更新 |
| PATCH | `/api/todos/[id]` | 完了状態トグル |
| DELETE | `/api/todos/[id]` | TODO削除 |
| GET | `/api/schedule` | スケジュール生成（?date=YYYY-MM-DD&day_type=weekday） |
| GET | `/api/goals` | 目標一覧 |
| POST | `/api/goals` | 目標作成 |
| PUT | `/api/goals/[id]` | 目標更新 |
| DELETE | `/api/goals/[id]` | 目標削除 |
| POST | `/api/advice` | AIアドバイス生成（手動トリガーのみ） |

---

## スケジューリングロジック

### 日種別

| タイプ | 説明 |
|--------|------|
| `weekday` | 平日（通常） |
| `overtime` | 平日（残業） |
| `holiday` | 休日 |

### ゴールデンタイム

- 平日: **06:50 – 08:20**（ディープワーク90分）
- 休日: **06:50 – 12:00**（5時間10分）

ゴールデンタイムにはカテゴリ優先順でタスクを配置:
`vfx > english > investment > personal`

priority=1 のタスクは最前（Eat the Frog 🐸）

### タスク配置ルール

1. ゴールデンタイム → 高負荷タスク優先
2. 平日夜（20:00–21:50）→ 低負荷タスクのみ
3. 残業日の夜 → 作業ブロックなし
4. `category=fitness` → 昼枠（12:00–12:30）に固定
5. 90分連続作業ごとに10分休憩を自動挿入
6. 時間超過タスク → `overflow_todos` に格納

---

## Vercel へのデプロイ

```bash
# Vercel CLIを使う場合
npx vercel

# 環境変数をVercelに設定
npx vercel env add NEXT_PUBLIC_SUPABASE_URL
npx vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
npx vercel env add SUPABASE_SERVICE_ROLE_KEY
npx vercel env add ANTHROPIC_API_KEY
```

---

## Phase 2 予定

- [ ] PWA対応（オフライン・プッシュ通知）
- [ ] /api/routines CRUD
- [ ] 週次/月次レポート
- [ ] タスク実績トラッキング（actual_minutes）
- [ ] Google Calendar 連携
