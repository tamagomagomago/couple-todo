import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { decomposeOKRWithClaude } from "@/lib/claudeTaskDecomposer";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(req: Request) {
  try {
    const { goal_id, goal, breakdown_config } = await req.json();

    if (!goal_id || !goal || !breakdown_config) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Claude で分解
    const decomposition = await decomposeOKRWithClaude(goal, breakdown_config);

    // トランザクション内で weekly_tasks と weekly_subtasks を作成
    const now = new Date();
    const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    // 月別TODO を1件生成（マスターリストに追加）
    // これを毎月1日に自動分解して4つの週別TODOを作成
    const monthlyTodos = [];

    const monthlyTodoTitle = `${goal.title}`;
    const subtasksList = decomposition.weeklyBreakdowns
      .flatMap((w) => w.tasks.flatMap((t) => t.subtasks))
      .join(", ");

    const breakdownConfig = (goal.breakdown_config as Record<string, number>) || {};
    const totalHours = Object.values(breakdownConfig).reduce((a: number, b: number) => a + b, 0);

    const { data: monthlyTodoData, error: monthlyTodoError } = await supabase
      .from("todos")
      .insert({
        title: monthlyTodoTitle,
        description: `【月別タスク】\n目標: ${goal.title}\n目標値: ${goal.targetValue}${goal.unit}\n\nカテゴリ別配分:\n${Object.entries(breakdownConfig)
          .map(([cat, hours]) => `- ${cat}: ${hours}時間/${goal.unit}`)
          .join("\n")}\n\nタスク詳細:\n${subtasksList}\n\n[Goal ID: ${goal_id}]\n[月別タスク: 毎月1日に週別に分解されます]`,
        priority: 2,
        estimated_minutes: totalHours * (goal.targetValue || 1) * 60,
        category: "engineer",
        is_today: false,
        is_monthly_base: true, // 月別タスクフラグ
        preferred_time: null,
        due_date: null, // 毎月1日のcronで週別に分配されます
      })
      .select();

    if (monthlyTodoError) throw monthlyTodoError;
    if (monthlyTodoData && monthlyTodoData[0]) {
      monthlyTodos.push(monthlyTodoData[0]);
    }

    // goal テーブルを更新
    await supabase
      .from("goals")
      .update({
        breakdown_config,
        decomposed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", goal_id);

    return NextResponse.json({
      success: true,
      monthlyTodos,
      summary: decomposition.summary,
    });
  } catch (err) {
    console.error("Failed to decompose OKR:", err);
    return NextResponse.json(
      { error: "Failed to decompose OKR", details: String(err) },
      { status: 500 }
    );
  }
}
