import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * 月別TODOを4つの週別TODOに手動分解
 * POST /api/todos/decompose
 * Body: { todo_id: number }
 */
export async function POST(req: Request) {
  try {
    const { todo_id } = await req.json();

    if (!todo_id) {
      return NextResponse.json(
        { error: "todo_id is required" },
        { status: 400 }
      );
    }

    // 月別TODOを取得
    const { data: monthlyTodo, error: fetchError } = await supabase
      .from("todos")
      .select("id, title, description, estimated_minutes, priority, category, is_monthly_base")
      .eq("id", todo_id)
      .single();

    if (fetchError || !monthlyTodo) {
      return NextResponse.json(
        { error: "TODO not found" },
        { status: 404 }
      );
    }

    if (!monthlyTodo.is_monthly_base) {
      return NextResponse.json(
        { error: "This TODO is not a monthly base TODO" },
        { status: 400 }
      );
    }

    // 現在の月を取得
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    // 週の期限を計算
    const weekDates = {
      1: `${currentYear}-${String(currentMonth).padStart(2, "0")}-07`,
      2: `${currentYear}-${String(currentMonth).padStart(2, "0")}-14`,
      3: `${currentYear}-${String(currentMonth).padStart(2, "0")}-21`,
      4: `${currentYear}-${String(currentMonth).padStart(2, "0")}-${String(new Date(currentYear, currentMonth, 0).getDate()).padStart(2, "0")}`,
    };

    // 優先度を週別に分配（W1: 簡単、W4: 難しい）
    const priorities = [5, 3, 3, 1]; // W1, W2, W3, W4

    // 4つの週別TODOを作成
    const weeklyTodos = [];
    for (let week = 1; week <= 4; week++) {
      const { data: insertedTodo, error: insertError } = await supabase
        .from("todos")
        .insert({
          title: `${monthlyTodo.title} (W${week})`,
          description: `${monthlyTodo.description || ""}\n\n[週別分解: W${week}]`,
          estimated_minutes: Math.round((monthlyTodo.estimated_minutes || 0) / 4),
          priority: priorities[week - 1],
          category: monthlyTodo.category || "personal",
          is_today: false,
          is_monthly_base: false,
          preferred_time: null,
          due_date: weekDates[week as keyof typeof weekDates],
          decomposed_at: new Date().toISOString(),
        })
        .select();

      if (insertError) {
        console.error(`Failed to insert W${week} TODO:`, insertError);
      } else if (insertedTodo && insertedTodo[0]) {
        weeklyTodos.push(insertedTodo[0]);
      }
    }

    return NextResponse.json({
      success: true,
      decomposed_todo_id: todo_id,
      created_weekly_todos: weeklyTodos,
      message: `${monthlyTodo.title}を4つの週別タスク(W1-W4)に分解しました`,
    });
  } catch (err) {
    console.error("Failed to decompose TODO:", err);
    return NextResponse.json(
      { error: "Failed to decompose TODO", details: String(err) },
      { status: 500 }
    );
  }
}
