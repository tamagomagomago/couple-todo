export type DayType = "weekday" | "overtime" | "holiday";

export type TodoCategory =
  | "vfx"
  | "english"
  | "investment"
  | "fitness"
  | "personal";

export type GoalCategory =
  | "fitness"
  | "investment"
  | "english"
  | "vfx"
  | "personal";

export type PeriodType = "annual" | "monthly" | "weekly";

export type BlockType =
  | "sleep"
  | "work"
  | "commute"
  | "task"
  | "fitness"
  | "break"
  | "meal"
  | "deep_work"
  | "free"
  | "routine";

export type PriorityLabel = "高" | "中" | "低";

export type PreferredTime = "morning" | "afternoon" | "evening";

export interface Todo {
  id: number;
  title: string;
  description?: string | null;
  priority: number; // 1=高 3=中 5=低
  estimated_minutes: number;
  category: string; // フリーテキスト可
  is_completed: boolean;
  is_today: boolean;
  preferred_time?: PreferredTime | null; // スケジュール優先時間帯
  due_date?: string | null;
  goal_id?: number | null;
  completed_at?: string | null;
  is_monthly_base?: boolean; // 月別ベースTODO（自動分解対象）
  actual_minutes?: number; // 実際に使用した時間（進捗管理用）
  decomposed_at?: string | null; // 分解タイムスタンプ
  created_at: string;
  updated_at: string;
}

export interface CreateTodoInput {
  title: string;
  description?: string;
  priority?: number;
  estimated_minutes?: number;
  category?: string;
  is_today?: boolean;
  preferred_time?: PreferredTime | null;
  due_date?: string;
}

export interface UpdateTodoInput extends Partial<CreateTodoInput> {
  is_completed?: boolean;
  is_today?: boolean;
}

export interface Routine {
  id: number;
  title: string;
  timing: string;
  duration_minutes: number;
  notify_time?: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Goal {
  id: number;
  title: string;
  description?: string | null;
  category: GoalCategory;
  period_type: PeriodType;
  target_value?: number | null;
  current_value: number;
  unit?: string | null;
  start_date: string;
  end_date: string;
  is_achieved: boolean;
  breakdown_config?: Record<string, number> | null;
  decomposed_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateGoalInput {
  title: string;
  description?: string;
  category: GoalCategory | string; // カスタムカテゴリ対応
  period_type: PeriodType;
  target_value?: number;
  current_value?: number;
  unit?: string;
  start_date: string;
  end_date: string;
}

export interface UpdateGoalInput extends Partial<CreateGoalInput> {
  is_achieved?: boolean;
}

export interface TimeBlock {
  id: string;
  start_time: string; // "HH:MM"
  end_time: string;   // "HH:MM"
  type: BlockType;
  title: string;
  is_golden_time?: boolean;
  todo_id?: number;
  duration_minutes: number;
}

export interface ScheduledTodo {
  todo: Todo;
  start_time: string;
  end_time: string;
  block_id: string;
}

export interface ScheduleResult {
  date: string;
  day_type: DayType;
  blocks: TimeBlock[];
  scheduled_todos: ScheduledTodo[];
  overflow_todos: Todo[];
}

export interface AdviceRequest {
  todos: Todo[];
  goals: Goal[];
  date: string;
}

export interface AdviceResponse {
  advice: string;
  generated_at: string;
}

export interface GeneratedTodo {
  text: string;
  priority: PriorityLabel;
  cat: string;
  est: number;
}

// Focus Session Types
export interface FocusSession {
  id: number;
  user_id: string;
  mode_name: string;
  target_minutes: number;
  actual_minutes?: number | null;
  break_minutes?: number | null;
  start_time: string;
  end_time?: string | null;
  break_end_time?: string | null;
  session_status: "active" | "completed" | "paused";
  created_at: string;
  updated_at: string;
  tip?: string; // ランダムな集中のコツ
}

export interface FocusMode {
  id: number;
  user_id: string;
  mode_name: string;
  color_hex: string;
  created_at: string;
}

export interface FocusGoal {
  id: number;
  user_id: string;
  goal_type: "daily" | "weekly" | "monthly";
  target_minutes: number;
  start_date: string;
  end_date?: string | null;
  created_at: string;
}

export interface FocusTodayStats {
  total_minutes: number;
  session_count: number;
  breakdown_by_mode: Record<string, number>;
  sessions: FocusSession[];
  today_goal_minutes: number;
}
