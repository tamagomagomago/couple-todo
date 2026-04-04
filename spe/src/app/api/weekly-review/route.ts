import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createServerClient } from "@/lib/supabase";
import { buildProfileContext } from "@/lib/profile";

const client = new Anthropic();

/** 今週の月曜〜日曜の日付範囲を返す */
function getWeekRange(): { monday: string; sunday: string } {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=日, 1=月, ..., 6=土
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  return {
    monday: monday.toISOString().split("T")[0],
    sunday: sunday.toISOString().split("T")[0],
  };
}

export async function GET() {
  try {
    const supabase = createServerClient();
    const { monday, sunday } = getWeekRange();

    // 今週更新されたTODO
    const { data: todos } = await supabase
      .from("todos")
      .select("*")
      .gte("updated_at", `${monday}T00:00:00`)
      .lte("updated_at", `${sunday}T23:59:59`);

    const allTodos = todos ?? [];
    const completedTodos = allTodos.filter((t) => t.is_completed);
    const completionRate =
      allTodos.length > 0
        ? Math.round((completedTodos.length / allTodos.length) * 100)
        : 0;

    // カテゴリ別完了数
    const categories = ["vfx", "english", "investment", "fitness", "personal"];
    const categoryStats: Record<string, { completed: number; total: number }> = {};
    for (const cat of categories) {
      const catTodos = allTodos.filter((t) => t.category === cat);
      categoryStats[cat] = {
        completed: catTodos.filter((t) => t.is_completed).length,
        total: catTodos.length,
      };
    }

    // 目標の進捗
    const { data: goals } = await supabase.from("goals").select("*");

    return NextResponse.json({
      week: { monday, sunday },
      todos: {
        total: allTodos.length,
        completed: completedTodos.length,
        completion_rate: completionRate,
      },
      category_stats: categoryStats,
      goals: (goals ?? []).map((g) => ({
        id: g.id,
        title: g.title,
        category: g.category,
        period_type: g.period_type,
        current_value: g.current_value,
        target_value: g.target_value,
        unit: g.unit,
        is_achieved: g.is_achieved,
        progress:
          g.target_value && g.target_value > 0
            ? Math.round((g.current_value / g.target_value) * 100)
            : 0,
      })),
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient();
    const { monday, sunday } = getWeekRange();

    const body = await request.json().catch(() => ({}));
    const nextWeekGoal: string = body.next_week_goal ?? "";

    // 今週のデータを取得
    const { data: todos } = await supabase
      .from("todos")
      .select("*")
      .gte("updated_at", `${monday}T00:00:00`)
      .lte("updated_at", `${sunday}T23:59:59`);

    const { data: goals } = await supabase.from("goals").select("*");

    const allTodos = todos ?? [];
    const completedTodos = allTodos.filter((t) => t.is_completed);
    const completionRate =
      allTodos.length > 0
        ? Math.round((completedTodos.length / allTodos.length) * 100)
        : 0;

    const profileContext = buildProfileContext();

    const goalsSummary = (goals ?? [])
      .map((g) => {
        const progress =
          g.target_value && g.target_value > 0
            ? Math.round((g.current_value / g.target_value) * 100)
            : 0;
        return `- [${g.period_type}/${g.category}] ${g.title}: ${g.current_value}/${g.target_value ?? "?"} ${g.unit ?? ""} (${progress}%)`;
      })
      .join("\n");

    const completedSummary = completedTodos
      .slice(0, 20)
      .map((t) => `- [${t.category}] ${t.title}`)
      .join("\n");

    const prompt = `
${profileContext}

---

## 今週（${monday} 〜 ${sunday}）の振り返りデータ

### TODO完了率
${completedTodos.length}/${allTodos.length}件完了 (${completionRate}%)

### 完了したTODO（上位20件）
${completedSummary || "なし"}

### 目標の現在進捗
${goalsSummary || "目標なし"}

${nextWeekGoal ? `### ユーザーが設定した来週の目標\n${nextWeekGoal}` : ""}

---

今週の振り返りと来週へのアドバイスを生成してください。
以下の形式で返してください：

【今週の評価】
（良かった点・課題を具体的に3〜5点）

【来週のアクションプラン】
（具体的なアクションを3〜5点）

【一言メッセージ】
（モチベーションを高める一言）
`.trim();

    const message = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1024,
      system:
        "あなたはユーザーの人生の最高責任者兼コンサルタントです。" +
        "週次レビューを通じて、現実的で具体的なフィードバックと来週のアドバイスを提供します。",
      messages: [{ role: "user", content: prompt }],
    });

    const review =
      message.content[0].type === "text" ? message.content[0].text : "";

    return NextResponse.json({
      review,
      generated_at: new Date().toISOString(),
      week: { monday, sunday },
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
