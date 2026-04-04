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
  parent_id?: number | null;
  created_at: string;
  updated_at: string;
}

export interface CreateGoalInput {
  title: string;
  description?: string;
  category: GoalCategory;
  period_type: PeriodType;
  target_value?: number;
  current_value?: number;
  unit?: string;
  start_date: string;
  end_date: string;
  parent_id?: number;
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
