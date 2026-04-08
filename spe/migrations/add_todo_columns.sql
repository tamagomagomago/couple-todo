-- todos テーブルへ列追加
ALTER TABLE todos
ADD COLUMN IF NOT EXISTS is_monthly_base BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS decomposed_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS actual_minutes INTEGER DEFAULT 0;

-- インデックス追加（検索パフォーマンス向上）
CREATE INDEX IF NOT EXISTS todos_is_monthly_base_idx ON todos(is_monthly_base);
CREATE INDEX IF NOT EXISTS todos_decomposed_at_idx ON todos(decomposed_at);
CREATE INDEX IF NOT EXISTS todos_due_date_idx ON todos(due_date);
