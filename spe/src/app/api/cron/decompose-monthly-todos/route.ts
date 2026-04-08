import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * 月別TODOから週別TODOを自動生成するcronエンドポイント
 * 毎月1日に実行される
 *
 * 動作:
 * 1. is_monthly_base = true && due_date = null のTODOを取得
 * 2. 各月別TODOから4つの週別TODO（W1-W4）を生成
 * 3. due_date を 7日、14日、21日、月末日に割り当て
 * 4. decomposed_at タイムスタンプを記録
 */
export async function GET(request: Request) {
  // Vercel Cron の検証
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const monthStr = `${currentYear}-${String(currentMonth).padStart(2, "0")}`;

    // 月別TODOを取得（is_monthly_base = true && due_date = null）
    const { data: monthlyTodos, error: fetchError } = await supabase
      .from("todos")
      .select("id, title, description, estimated_minutes, priority, category")
      .eq("is_monthly_base", true)
      .is("due_date", null)
      .gte("created_at", `${monthStr}-01T00:00:00Z`);

    if (fetchError) throw fetchError;

    if (!monthlyTodos || monthlyTodos.length === 0) {
      return NextResponse.json({
        success: true,
        processed: 0,
        message: "No monthly base TODOs found to decompose",
      });
    }

    const weekDates = getWeekDatesForMonth(currentYear, currentMonth);
    let createdCount = 0;
    let decomposedCount = 0;

    // 各月別TODOから4つの週別TODOを生成
    for (const monthlyTodo of monthlyTodos) {
      // 優先度を3段階に分配
      // W1: 簡単（優先度低）、W2-3: 中程度、W4: 難しい（優先度高）
      const priorities = [5, 3, 3, 1]; // W1, W2, W3, W4

      for (let week = 1; week <= 4; week++) {
        const { error: insertError } = await supabase
          .from("todos")
          .insert({
            title: `${monthlyTodo.title} (W${week})`,
            description: `${monthlyTodo.description}\n\n[週別分解: W${week}]`,
            estimated_minutes: Math.round(
              (monthlyTodo.estimated_minutes || 0) / 4
            ),
            priority: priorities[week - 1],
            category: monthlyTodo.category || "personal",
            is_today: false,
            is_monthly_base: false, // 週別TODO（月別ではない）
            preferred_time: null,
            due_date: weekDates[week],
            decomposed_at: new Date().toISOString(),
          });

        if (insertError) {
          console.error(`Failed to insert W${week} TODO:`, insertError);
        } else {
          createdCount++;
        }
      }

      decomposedCount++;
    }

    // Pushover 通知
    try {
      await fetch("https://api.pushover.net/1/messages.json", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: process.env.PUSHOVER_APP_TOKEN,
          user: process.env.PUSHOVER_USER_KEY,
          message: `✅ ${decomposedCount}個の月別TODOを週別に分解しました（${createdCount}件作成）`,
          priority: 0,
        }),
      });
    } catch {}

    return NextResponse.json({
      success: true,
      decomposed: decomposedCount,
      created: createdCount,
      message: `Decomposed ${decomposedCount} monthly TODOs into ${createdCount} weekly tasks`,
    });
  } catch (err) {
    console.error("Cron decomposition failed:", err);
    return NextResponse.json(
      { error: "Failed to process cron task", details: String(err) },
      { status: 500 }
    );
  }
}

/**
 * 指定月の週末日を取得
 */
function getWeekDatesForMonth(year: number, month: number): Record<number, string> {
  const dates: Record<number, string> = {};

  dates[1] = `${year}-${String(month).padStart(2, "0")}-07`;
  dates[2] = `${year}-${String(month).padStart(2, "0")}-14`;
  dates[3] = `${year}-${String(month).padStart(2, "0")}-21`;

  const lastDay = new Date(year, month, 0).getDate();
  dates[4] = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  return dates;
}
