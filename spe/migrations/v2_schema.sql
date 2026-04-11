-- V2 Schema
-- Run this in Supabase SQL Editor

-- goals_v2
CREATE TABLE IF NOT EXISTS goals_v2 (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT 'default_user',
  title TEXT NOT NULL,
  category TEXT NOT NULL, -- fitness, investment, english, vfx, engineer, personal
  period_type TEXT NOT NULL, -- annual, monthly, weekly
  parent_id INTEGER REFERENCES goals_v2(id) ON DELETE SET NULL,
  target_value NUMERIC,
  current_value NUMERIC DEFAULT 0,
  unit TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_achieved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_goals_v2_period_type ON goals_v2(period_type);
CREATE INDEX IF NOT EXISTS idx_goals_v2_parent_id ON goals_v2(parent_id);
CREATE INDEX IF NOT EXISTS idx_goals_v2_user_id ON goals_v2(user_id);

-- todos_v2
CREATE TABLE IF NOT EXISTS todos_v2 (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT 'default_user',
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  priority INTEGER DEFAULT 3, -- 1=高 3=中 5=低
  estimated_minutes INTEGER DEFAULT 30,
  actual_minutes INTEGER,
  is_completed BOOLEAN DEFAULT FALSE,
  is_mit BOOLEAN DEFAULT FALSE, -- Most Important Task
  scheduled_date DATE,
  scheduled_start TIME,
  goal_id INTEGER REFERENCES goals_v2(id) ON DELETE SET NULL,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_todos_v2_scheduled_date ON todos_v2(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_todos_v2_is_completed ON todos_v2(is_completed);
CREATE INDEX IF NOT EXISTS idx_todos_v2_user_id ON todos_v2(user_id);

-- focus_sessions_v2
CREATE TABLE IF NOT EXISTS focus_sessions_v2 (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT 'default_user',
  todo_id INTEGER REFERENCES todos_v2(id) ON DELETE SET NULL,
  todo_title TEXT,
  category TEXT NOT NULL,
  planned_minutes INTEGER NOT NULL,
  actual_minutes INTEGER,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_focus_v2_started_at ON focus_sessions_v2(started_at);
CREATE INDEX IF NOT EXISTS idx_focus_v2_user_id ON focus_sessions_v2(user_id);

-- weekly_reviews_v2
CREATE TABLE IF NOT EXISTS weekly_reviews_v2 (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT 'default_user',
  week_start DATE NOT NULL,
  achievement_rate INTEGER, -- 0-100
  memo TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, week_start)
);
