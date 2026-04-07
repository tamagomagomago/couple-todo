/**
 * GET /api/cron/notify?secret=XXX&day_type=weekday
 *
 * cron-job.org から5分おきに呼び出す。
 * 科学的手法（If-Then形式・進捗表示・クイックアクション）で通知。
 *
 * 通知する: routine（朝・夜ルーティン）, deep_work, task
 * 通知しない: work, fitness（昼）, commute, meal, sleep, break, free
 *
 * 特別通知:
 *  - 朝のディープワーク開始時 → TOP3タスクを含むミッション通知
 *  - 22:25 翌日TODO確認 → 今日の完了率+レビュー通知
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { buildSchedule } from "@/lib/scheduler";
import { DayType, BlockType } from "@/types";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const APP_URL = "https://spe-daily-schedule.vercel.app";

// 通知するブロックタイプ
const NOTIFY_TYPES = new Set<BlockType>(["routine", "deep_work", "task"]);

const TYPE_EMOJI: Record<string, string> = {
  routine:   "🔔",
  deep_work: "⚡",
  task:      "📋",
};

const TYPE_LABEL: Record<string, string> = {
  routine:   "ルーティン",
  deep_work: "ディープワーク",
  task:      "ワーク",
};

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

// 曜日から day_type を自動判定（土日→holiday, 平日→weekday）
function autoDetectDayType(): DayType {
  const jstNow = new Date(new Date().getTime() + 9 * 60 * 60 * 1000);
  const day = jstNow.getUTCDay(); // 0=日, 6=土
  return (day === 0 || day === 6) ? "holiday" : "weekday";
}

async function sendPushover(params: {
  title: string;
  message: string;
  url?: string;
  url_title?: string;
  priority?: number;
}): Promise<boolean> {
  const token = process.env.PUSHOVER_APP_TOKEN;
  const user  = process.env.PUSHOVER_USER_KEY;
  if (!token || !user) return false;

  const body: Record<string, string | number> = {
    token, user,
    title: params.title,
    message: params.message,
    sound: "pushover",
    priority: params.priority ?? 0,
  };
  if (params.url)       body.url = params.url;
  if (params.url_title) body.url_title = params.url_title;

  const res = await fetch("https://api.pushover.net/1/messages.json", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return res.ok;
}

export async function GET(request: NextRequest) {
  // 認証チェック
  const secret = request.nextUrl.searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // day_type: 指定がなければ曜日から自動判定
  const dayTypeParam = request.nextUrl.searchParams.get("day_type");
  const dayType: DayType = (dayTypeParam as DayType) ?? autoDetectDayType();

  // JST 現在時刻
  const jstNow = new Date(new Date().getTime() + 9 * 60 * 60 * 1000);
  const jstMinutes = jstNow.getUTCHours() * 60 + jstNow.getUTCMinutes();
  const todayStr = jstNow.toISOString().split("T")[0];
  const todayStart = new Date(`${todayStr}T00:00:00Z`);

  // 前日以前に更新された is_today フラグをリセット（日付変わり時の自動リセット）
  const { data: allTodosReset } = await supabase.from("todos").select("*").eq("is_today", true);
  const todosToReset = allTodosReset?.filter((t) => {
    const updatedDate = t.updated_at ? new Date(t.updated_at) : null;
    return updatedDate && updatedDate < todayStart;
  }) ?? [];
  for (const todo of todosToReset) {
    await supabase.from("todos").update({ is_today: false }).eq("id", todo.id);
  }

  // todos 取得
  const { data: allTodos } = await supabase.from("todos").select("*");
  const todos = allTodos ?? [];
  const incompleteTodos = todos.filter((t) => !t.is_completed);
  const completedToday  = todos.filter((t) => t.is_completed && t.is_today);
  const totalToday      = todos.filter((t) => t.is_today);

  // スケジュール生成
  const schedule = buildSchedule(todayStr, dayType, incompleteTodos);

  // TOP3タスク（優先度順）
  const top3 = incompleteTodos
    .filter((t) => t.is_today)
    .sort((a, b) => a.priority - b.priority)
    .slice(0, 3);

  const WINDOW = 5;
  const upcoming = schedule.blocks.filter((block) => {
    if (!NOTIFY_TYPES.has(block.type)) return false;
    const start = timeToMinutes(block.start_time);
    return start > jstMinutes && start <= jstMinutes + WINDOW;
  });

  let sent = 0;
  const results: string[] = [];

  for (const block of upcoming) {
    const emoji = TYPE_EMOJI[block.type] ?? "🔔";
    const label = TYPE_LABEL[block.type] ?? "開始";
    const isGolden = block.is_golden_time;

    // ---- 特別通知1: 朝のディープワーク ----
    // → If-Then + TOP3タスク
    if (block.type === "deep_work" && isGolden) {
      let msg = `ディープワーク開始`;
      if (top3.length > 0) {
        msg += "\n\n今日のミッション:\n";
        top3.forEach((t, i) => {
          const mark = t.priority === 1 ? "🔴" : t.priority <= 2 ? "🟡" : "🟢";
          msg += `${i + 1}. ${mark} ${t.title}（${t.estimated_minutes}分）\n`;
        });
      }
      msg += "\nやりきれ。";

      const ok = await sendPushover({
        title: `⚡ ディープワーク`,
        message: msg,
        url: `${APP_URL}?focus=timeline`,
        url_title: "タイムラインを開く",
      });
      if (ok) sent++;
      results.push(`⚡ 朝ミッション通知 → ${top3.map(t => t.title).join(", ")}`);
      continue;
    }

    // ---- 特別通知2: 夜のTODO確認（22:25 翌日確認ルーティン）----
    // → 今日の完了率 + レビュー促し
    if (block.type === "routine" && block.start_time === "22:25") {
      const rate = totalToday.length > 0
        ? Math.round((completedToday.length / totalToday.length) * 100)
        : 0;

      const msg = [
        `今日の完了率: ${completedToday.length}/${totalToday.length} (${rate}%)`,
        rate >= 80 ? "よくやった。明日も攻める。" : rate >= 50 ? "まあまあ。明日挽回しろ。" : "完了率が低い。原因を振り返れ。",
        "\n明日のTOP3を今決めろ。"
      ].join("\n");

      const ok = await sendPushover({
        title: "🌙 翌日TODO確認",
        message: msg,
        url: `${APP_URL}?focus=todo`,
        url_title: "TODOを開く",
      });
      if (ok) sent++;
      results.push(`🌙 夜レビュー通知 → ${rate}%完了`);
      continue;
    }

    // ---- 通常通知 ----
    const msg = block.duration_minutes
      ? `${block.title}（${block.duration_minutes}分）`
      : block.title;

    const ok = await sendPushover({
      title: `${emoji} ${label}`,
      message: msg,
      url: `${APP_URL}`,
      url_title: "SPEを開く",
    });
    if (ok) sent++;
    results.push(`${emoji} ${block.start_time} ${block.title}`);
  }

  return NextResponse.json({
    sent,
    checked: upcoming.length,
    day_type: dayType,
    jst_now: `${String(jstNow.getUTCHours()).padStart(2,"0")}:${String(jstNow.getUTCMinutes()).padStart(2,"0")}`,
    results,
  });
}
