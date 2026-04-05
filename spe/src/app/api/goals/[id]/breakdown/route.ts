import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createServerClient } from "@/lib/supabase";
import { buildProfileContext } from "@/lib/profile";

const client = new Anthropic();

interface MonthlyGoalData {
  title: string;
  target_value: number;
  unit: string;
  start_date: string;
  end_date: string;
  description: string;
}

interface WeeklyGoalData {
  title: string;
  target_value: number;
  unit: string;
  start_date: string;
  end_date: string;
  description: string;
}

interface TodoData {
  title: string;
  priority: number;
  estimated_minutes: number;
  category: string;
}

interface BreakdownResult {
  analysis: string;
  monthly_goals: MonthlyGoalData[];
  weekly_goals: WeeklyGoalData[];
  todos: TodoData[];
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const goalId = Number(id);
    if (isNaN(goalId)) {
      return NextResponse.json({ error: "Invalid goal id" }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const save = searchParams.get("save") === "true";

    const supabase = createServerClient();

    // 目標を取得
    const { data: goal, error: goalError } = await supabase
      .from("goals")
      .select("*")
      .eq("id", goalId)
      .single();

    if (goalError || !goal) {
      return NextResponse.json({ error: "Goal not found" }, { status: 404 });
    }

    // save=true の場合はリクエストボディを使って保存
    if (save) {
      const body: BreakdownResult = await request.json();

      // 月次目標を保存（IDを取得して週次目標と紐付ける）
      const savedMonthlyIds: number[] = [];
      for (const mg of body.monthly_goals) {
        const { data: mgData, error: mgError } = await supabase.from("goals").insert({
          title: mg.title,
          description: mg.description || null,
          category: goal.category,
          period_type: "monthly",
          target_value: mg.target_value || null,
          current_value: 0,
          unit: mg.unit || null,
          start_date: mg.start_date,
          end_date: mg.end_date,
          parent_id: goalId,
        }).select().single();
        if (!mgError && mgData) savedMonthlyIds.push(mgData.id);
      }

      // 週次目標を保存（月次目標に均等に紐付け）
      for (let i = 0; i < body.weekly_goals.length; i++) {
        const wg = body.weekly_goals[i];
        // 月次目標のIDを順番に割り当て（なければ null）
        const parentMonthlyId = savedMonthlyIds.length > 0
          ? savedMonthlyIds[i % savedMonthlyIds.length]
          : null;
        await supabase.from("goals").insert({
          title: wg.title,
          description: wg.description || null,
          category: goal.category,
          period_type: "weekly",
          target_value: wg.target_value || null,
          current_value: 0,
          unit: wg.unit || null,
          start_date: wg.start_date,
          end_date: wg.end_date,
          parent_id: parentMonthlyId,
        });
      }

      // TODOを保存（マスターリストへ）
      for (const todo of body.todos) {
        const { error: todoError } = await supabase.from("todos").insert({
          title: todo.title,
          priority: todo.priority,
          estimated_minutes: todo.estimated_minutes,
          category: todo.category,
          is_completed: false,
          is_today: false,
        });
        if (todoError) {
          return NextResponse.json({ error: `TODO保存エラー: ${todoError.message}` }, { status: 500 });
        }
      }

      return NextResponse.json({ ok: true });
    }

    // AI分解を実行
    const today = new Date().toISOString().split("T")[0];
    const profileContext = buildProfileContext();

    const prompt = `
${profileContext}

---

## 分解する目標

タイトル: ${goal.title}
説明: ${goal.description ?? "なし"}
カテゴリ: ${goal.category}
期間: ${goal.start_date} 〜 ${goal.end_date}
目標値: ${goal.target_value ?? "未設定"} ${goal.unit ?? ""}
現在値: ${goal.current_value} ${goal.unit ?? ""}
今日の日付: ${today}

---

上記の年間目標をOKR的に分解してください。
以下のJSON形式で返してください。他のテキストは不要です。

{
  "analysis": "現状分析と戦略（200文字以内）",
  "monthly_goals": [
    {
      "title": "月次目標タイトル",
      "target_value": 0,
      "unit": "単位",
      "start_date": "YYYY-MM-DD",
      "end_date": "YYYY-MM-DD",
      "description": "説明"
    }
  ],
  "weekly_goals": [
    {
      "title": "週次目標タイトル",
      "target_value": 0,
      "unit": "単位",
      "start_date": "YYYY-MM-DD",
      "end_date": "YYYY-MM-DD",
      "description": "説明"
    }
  ],
  "todos": [
    {
      "title": "TODOタイトル",
      "priority": 1,
      "estimated_minutes": 30,
      "category": "${goal.category}"
    }
  ]
}

月次目標は3件、週次目標は4件、TODOは5件生成してください。
start_date/end_dateは今日(${today})を起点に現実的な日付を設定してください。
priority は 1（高）〜 5（低）の整数です。
`.trim();

    const message = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 2048,
      system:
        "あなたは目標設定とOKRの専門家です。ユーザーの年間目標を月次・週次・今日のTODOに分解します。" +
        "必ず指定されたJSON形式のみで返答し、他のテキストは含めないでください。",
      messages: [{ role: "user", content: prompt }],
    });

    const rawText =
      message.content[0].type === "text" ? message.content[0].text : "";

    // JSON部分を抽出
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json(
        { error: "Failed to parse AI response", raw: rawText },
        { status: 500 }
      );
    }

    const result: BreakdownResult = JSON.parse(jsonMatch[0]);

    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
