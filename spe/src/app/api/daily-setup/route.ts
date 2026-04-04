/**
 * GET /api/daily-setup?secret=XXX&day_type=weekday
 *
 * 毎朝 06:30 に cron-job.org から呼び出す。
 * 今日のTOP3タスクを含む朝のミッション通知を Pushover に送る。
 * → 朝のミッション通知（1日の始まりに何をやるか明確にする）
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { DayType } from "@/types";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const APP_URL = "https://spe-daily-schedule.vercel.app";

function autoDetectDayType(): DayType {
  const jstNow = new Date(new Date().getTime() + 9 * 60 * 60 * 1000);
  const day = jstNow.getUTCDay();
  return (day === 0 || day === 6) ? "holiday" : "weekday";
}

const DAY_LABEL: Record<DayType, string> = {
  weekday:  "平日",
  overtime: "残業日",
  holiday:  "休日",
};

export async function GET(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dayTypeParam = request.nextUrl.searchParams.get("day_type");
  const dayType: DayType = (dayTypeParam as DayType) ?? autoDetectDayType();

  const token = process.env.PUSHOVER_APP_TOKEN;
  const user  = process.env.PUSHOVER_USER_KEY;
  if (!token || !user) {
    return NextResponse.json({ error: "Pushover未設定" }, { status: 400 });
  }

  // 今日のTODO取得
  const { data: allTodos } = await supabase
    .from("todos")
    .select("*")
    .eq("is_completed", false)
    .eq("is_today", true);

  const todos = allTodos ?? [];
  const top3 = todos
    .sort((a, b) => a.priority - b.priority)
    .slice(0, 3);

  // 通知メッセージ構築
  const dayLabel = DAY_LABEL[dayType];
  let msg = `今日は${dayLabel}。\n`;

  if (top3.length > 0) {
    msg += "\n【今日のミッション】\n";
    top3.forEach((t, i) => {
      const mark = t.priority === 1 ? "🔴" : t.priority <= 2 ? "🟡" : "🟢";
      msg += `${i + 1}. ${mark} ${t.title}（${t.estimated_minutes}分）\n`;
    });
  } else {
    msg += "\n今日のTODOが未設定。今すぐ設定しろ。\n";
  }

  msg += `\n全力でやりきれ。`;

  const res = await fetch("https://api.pushover.net/1/messages.json", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token, user,
      title: `⚡ 朝のミッション（${dayLabel}）`,
      message: msg,
      url: `${APP_URL}?focus=todo`,
      url_title: "今日のTODOを開く",
      sound: "bugle",
      priority: 0,
    }),
  });

  if (!res.ok) {
    return NextResponse.json({ error: "Pushover送信失敗" }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    day_type: dayType,
    top3: top3.map(t => t.title),
    message: "朝のミッション通知を送信しました",
  });
}
