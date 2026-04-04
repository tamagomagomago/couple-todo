import { DayType, TimeBlock, Todo, ScheduleResult, ScheduledTodo, BlockType } from "@/types";

// HH:MM を分に変換
function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

// 分を HH:MM に変換
function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

interface FixedBlock {
  start: string;
  end: string;
  type: BlockType;
  title: string;
  is_golden_time?: boolean;
  is_task_slot?: boolean; // タスクを配置できるスロット
  is_low_load?: boolean;  // 低負荷タスクのみ
  time_of_day?: "morning" | "afternoon" | "evening"; // 時間帯（スケジューリング優先用）
}

// 起床時刻に依存しない固定ブロック（平日・残業 共通の昼以降）
const WEEKDAY_FIXED_AFTERNOON: FixedBlock[] = [
  { start: "08:30", end: "09:10", type: "commute", title: "通勤（技術士Podcast・TOEIC単語）" },
  { start: "09:10", end: "12:00", type: "work", title: "仕事" },
  { start: "12:00", end: "12:30", type: "fitness", title: "筋トレ" },
  { start: "12:30", end: "13:00", type: "meal", title: "昼食・休憩" },
  { start: "13:00", end: "19:00", type: "work", title: "仕事" },
  { start: "19:00", end: "19:30", type: "commute", title: "通勤" },
  { start: "19:30", end: "20:00", type: "meal", title: "夕食（高タンパク）＋エビオス" },
  { start: "20:00", end: "21:50", type: "task", title: "夜のワーク", is_task_slot: true, is_low_load: true, time_of_day: "evening" },
  { start: "21:50", end: "22:10", type: "routine", title: "入浴（20分）" },
  { start: "22:10", end: "22:25", type: "routine", title: "胸・首ストレッチ" },
  { start: "22:25", end: "22:45", type: "routine", title: "翌日TODO確認・プロテイン＋マルデキ" },
];

const OVERTIME_FIXED_AFTERNOON: FixedBlock[] = [
  { start: "08:30", end: "09:10", type: "commute", title: "通勤（技術士Podcast・TOEIC単語）" },
  { start: "09:10", end: "12:00", type: "work", title: "仕事" },
  { start: "12:00", end: "12:30", type: "fitness", title: "筋トレ" },
  { start: "12:30", end: "13:00", type: "meal", title: "昼食・休憩" },
  { start: "13:00", end: "22:00", type: "work", title: "仕事（残業）" },
  { start: "22:00", end: "22:40", type: "commute", title: "通勤・帰宅" },
  { start: "22:40", end: "22:50", type: "routine", title: "高速シャワー" },
  { start: "22:50", end: "23:00", type: "routine", title: "体幹3分＋ストレッチ・プロテイン・エビオス" },
];

const HOLIDAY_FIXED_AFTERNOON: FixedBlock[] = [
  { start: "12:00", end: "13:00", type: "meal", title: "昼食" },
  { start: "13:00", end: "18:00", type: "task", title: "午後作業", is_task_slot: true, time_of_day: "afternoon" },
  { start: "18:00", end: "19:00", type: "meal", title: "夕食" },
  { start: "19:00", end: "23:00", type: "task", title: "夜作業・自由", is_task_slot: true, is_low_load: true, time_of_day: "evening" },
];

// 起床時刻から朝のブロックを動的生成
// 順序: 起床(5min) → プロテイン(5min) → ダンベルトレ(20min) → 朝ごはん(15min) → ディープワーク
function buildMorningBlocks(dayType: DayType, wakeTime: string): FixedBlock[] {
  const wakeMin    = timeToMinutes(wakeTime);
  const proteinMin = wakeMin + 5;   // プロテイン開始（起床5分後）
  const trainMin   = wakeMin + 10;  // ダンベルトレ開始（プロテイン5分）
  const mealMin    = wakeMin + 30;  // 朝ごはん開始（トレ20分）
  const deepBase   = wakeMin + 45;  // ディープワーク開始（朝ごはん15分）

  if (dayType === "holiday") {
    const deepMin = deepBase;
    const blocks: FixedBlock[] = [
      { start: wakeTime,                    end: minutesToTime(proteinMin), type: "routine", title: "起床・水1杯・朝日を浴びる" },
      { start: minutesToTime(proteinMin),   end: minutesToTime(trainMin),   type: "meal",    title: "🥛 プロテイン" },
      { start: minutesToTime(trainMin),     end: minutesToTime(mealMin),    type: "fitness", title: "💪 ダンベルトレ（朝トレ）" },
      { start: minutesToTime(mealMin),      end: minutesToTime(deepMin),    type: "meal",    title: "🍳 朝ごはん・エビオス・身支度" },
    ];
    if (deepMin < 720) {
      blocks.push({ start: minutesToTime(deepMin), end: "12:00", type: "deep_work", title: "ディープワーク⚡", is_golden_time: true, is_task_slot: true, time_of_day: "morning" });
    }
    return blocks;
  } else {
    // 平日・残業：起床から45分後にディープワーク開始
    const deepMin = deepBase;
    const blocks: FixedBlock[] = [
      { start: wakeTime,                    end: minutesToTime(proteinMin), type: "routine", title: "起床・水1杯・朝日を浴びる" },
      { start: minutesToTime(proteinMin),   end: minutesToTime(trainMin),   type: "meal",    title: "🥛 プロテイン" },
      { start: minutesToTime(trainMin),     end: minutesToTime(mealMin),    type: "fitness", title: "💪 ダンベルトレ（朝トレ）" },
      { start: minutesToTime(mealMin),      end: minutesToTime(deepMin),    type: "meal",    title: "🍳 朝ごはん・エビオス・身支度準備完了" },
    ];
    if (deepMin < 510) {
      blocks.push({ start: minutesToTime(deepMin), end: "08:30", type: "deep_work", title: "ディープワーク⚡", is_golden_time: true, is_task_slot: true, time_of_day: "morning" });
    }
    return blocks;
  }
}

function getFixedSchedule(dayType: DayType, wakeTime: string): FixedBlock[] {
  const morning = buildMorningBlocks(dayType, wakeTime);
  const sleep: FixedBlock = { start: "23:00", end: wakeTime, type: "sleep", title: "睡眠" };

  switch (dayType) {
    case "weekday":  return [...morning, ...WEEKDAY_FIXED_AFTERNOON,  sleep];
    case "overtime": return [...morning, ...OVERTIME_FIXED_AFTERNOON, sleep];
    case "holiday":  return [...morning, ...HOLIDAY_FIXED_AFTERNOON,  sleep];
  }
}

// カテゴリの優先度（高負荷向き）
const GOLDEN_TIME_PRIORITY: Record<string, number> = {
  vfx: 1,
  english: 2,
  investment: 3,
  personal: 4,
  fitness: 99,
};

function sortTodosForSlot(
  todos: Todo[],
  isGoldenTime: boolean,
  isLowLoad: boolean,
  slotTimeOfDay?: "morning" | "afternoon" | "evening"
): Todo[] {
  return [...todos].sort((a, b) => {
    // fitness は昼枠固定なのでここには来ないはず
    if (a.category === "fitness") return 1;
    if (b.category === "fitness") return -1;

    // 【時間帯優先】設定済み > 未設定 > 別時間帯
    if (slotTimeOfDay) {
      const aMatch = a.preferred_time === slotTimeOfDay ? 0 : a.preferred_time == null ? 1 : 2;
      const bMatch = b.preferred_time === slotTimeOfDay ? 0 : b.preferred_time == null ? 1 : 2;
      if (aMatch !== bMatch) return aMatch - bMatch;
    }

    // priority=1 は最前に（Eat the Frog）
    if (isGoldenTime) {
      if (a.priority === 1 && b.priority !== 1) return -1;
      if (b.priority === 1 && a.priority !== 1) return 1;
      // ゴールデンタイムはカテゴリ優先
      const catA = GOLDEN_TIME_PRIORITY[a.category] ?? 5;
      const catB = GOLDEN_TIME_PRIORITY[b.category] ?? 5;
      if (catA !== catB) return catA - catB;
    }

    // 低負荷スロットでは簡単なもの（estimated_minutes が短め）を前に
    if (isLowLoad) {
      return a.estimated_minutes - b.estimated_minutes;
    }

    // 通常はpriority順
    return a.priority - b.priority;
  });
}

export function buildSchedule(
  date: string,
  dayType: DayType,
  todos: Todo[],
  wakeTime: string = "06:30"
): ScheduleResult {
  const fixed = getFixedSchedule(dayType, wakeTime);
  const blocks: TimeBlock[] = [];
  const scheduledTodos: ScheduledTodo[] = [];
  const overflowTodos: Todo[] = [];

  // fitness タスクは昼枠に固定
  const fitnessTodos = todos.filter((t) => t.category === "fitness" && !t.is_completed);
  const workTodos = todos.filter((t) => t.category !== "fitness" && !t.is_completed);

  let blockCounter = 0;

  for (const fixedBlock of fixed) {
    const slotStartMin = timeToMinutes(fixedBlock.start);
    const slotEndMin = fixedBlock.start > fixedBlock.end
      ? timeToMinutes("24:00") // 睡眠は翌日にまたがるので24:00まで
      : timeToMinutes(fixedBlock.end);
    const slotDuration = slotEndMin - slotStartMin;

    // タスクを配置できないブロック
    if (!fixedBlock.is_task_slot) {
      // fitnesスロットに fitness タスクを埋め込む
      if (fixedBlock.type === "fitness" && fixedBlock.start === "12:00") {
        const id = `block-${blockCounter++}`;
        blocks.push({
          id,
          start_time: fixedBlock.start,
          end_time: fixedBlock.end,
          type: "fitness",
          title: fitnessTodos.length > 0 ? fitnessTodos[0].title : fixedBlock.title,
          is_golden_time: false,
          duration_minutes: slotDuration,
          todo_id: fitnessTodos[0]?.id,
        });
        if (fitnessTodos[0]) {
          scheduledTodos.push({
            todo: fitnessTodos[0],
            start_time: fixedBlock.start,
            end_time: fixedBlock.end,
            block_id: id,
          });
        }
        continue;
      }

      blocks.push({
        id: `block-${blockCounter++}`,
        start_time: fixedBlock.start,
        end_time: fixedBlock.end,
        type: fixedBlock.type,
        title: fixedBlock.title,
        is_golden_time: fixedBlock.is_golden_time ?? false,
        duration_minutes: slotDuration,
      });
      continue;
    }

    // タスクスロット：todoを配置する
    const isGoldenTime = fixedBlock.is_golden_time ?? false;
    const isLowLoad = fixedBlock.is_low_load ?? false;

    // このスロットで配置するタスクを選択
    const candidateTodos = sortTodosForSlot(
      workTodos.filter((t) => !scheduledTodos.find((s) => s.todo.id === t.id)),
      isGoldenTime,
      isLowLoad,
      fixedBlock.time_of_day
    );

    let currentMin = slotStartMin;
    let consecutiveWorkMin = 0;
    let tasksPlaced = 0;

    for (const todo of candidateTodos) {
      const remaining = slotEndMin - currentMin;
      if (remaining <= 0) break;

      // 低負荷スロットに高負荷カテゴリは入れない
      // （ここでは制限しない。優先度ソートに任せる）

      // 90分ごとに10分休憩
      if (consecutiveWorkMin > 0 && consecutiveWorkMin + todo.estimated_minutes > 90) {
        if (remaining < 10 + todo.estimated_minutes) break;
        // 休憩ブロック挿入
        const breakEnd = minutesToTime(currentMin + 10);
        blocks.push({
          id: `block-${blockCounter++}`,
          start_time: minutesToTime(currentMin),
          end_time: breakEnd,
          type: "break",
          title: "休憩",
          duration_minutes: 10,
        });
        currentMin += 10;
        consecutiveWorkMin = 0;
      }

      const taskRemaining = slotEndMin - currentMin;
      if (taskRemaining < todo.estimated_minutes) {
        // このスロットには入らない→overflow
        overflowTodos.push(todo);
        continue;
      }

      const taskEnd = minutesToTime(currentMin + todo.estimated_minutes);
      const taskBlockId = `block-${blockCounter++}`;

      blocks.push({
        id: taskBlockId,
        start_time: minutesToTime(currentMin),
        end_time: taskEnd,
        type: isGoldenTime ? "deep_work" : "task",
        title: todo.title,
        is_golden_time: isGoldenTime,
        todo_id: todo.id,
        duration_minutes: todo.estimated_minutes,
      });

      scheduledTodos.push({
        todo,
        start_time: minutesToTime(currentMin),
        end_time: taskEnd,
        block_id: taskBlockId,
      });

      currentMin += todo.estimated_minutes;
      consecutiveWorkMin += todo.estimated_minutes;
      tasksPlaced++;
    }

    // スロットに空きがある場合、スロット自体のブロックを追加（タスク未配置分）
    if (tasksPlaced === 0) {
      blocks.push({
        id: `block-${blockCounter++}`,
        start_time: fixedBlock.start,
        end_time: fixedBlock.end,
        type: fixedBlock.type,
        title: fixedBlock.title,
        is_golden_time: isGoldenTime,
        duration_minutes: slotDuration,
      });
    } else if (currentMin < slotEndMin) {
      // 残り時間を空きスロットとして追加
      blocks.push({
        id: `block-${blockCounter++}`,
        start_time: minutesToTime(currentMin),
        end_time: fixedBlock.end,
        type: "free",
        title: "空き時間",
        duration_minutes: slotEndMin - currentMin,
      });
    }
  }

  // まだスケジュールされていないtodosをoverflowに追加
  for (const todo of workTodos) {
    if (!scheduledTodos.find((s) => s.todo.id === todo.id) &&
        !overflowTodos.find((o) => o.id === todo.id)) {
      overflowTodos.push(todo);
    }
  }

  // ブロックを時間順にソート
  blocks.sort((a, b) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time));

  return {
    date,
    day_type: dayType,
    blocks,
    scheduled_todos: scheduledTodos,
    overflow_todos: overflowTodos,
  };
}
