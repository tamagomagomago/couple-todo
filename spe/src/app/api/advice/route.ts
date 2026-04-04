import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createServerClient } from "@/lib/supabase";
import { Goal, Todo } from "@/types";
import { buildProfileContext } from "@/lib/profile";

const client = new Anthropic();

function buildPrompt(todos: Todo[], goals: Goal[], date: string): string {
  const today = new Date(date);

  const completedTodos = todos.filter((t) => t.is_completed);
  const completionRate =
    todos.length > 0
      ? Math.round((completedTodos.length / todos.length) * 100)
      : 0;

  const priorityDist = todos
    .filter((t) => !t.is_completed)
    .reduce<Record<number, number>>((acc, t) => {
      acc[t.priority] = (acc[t.priority] ?? 0) + 1;
      return acc;
    }, {});

  const goalsSummary = goals.map((g) => {
    const progress =
      g.target_value && g.target_value > 0
        ? Math.round((g.current_value / g.target_value) * 100)
        : 0;
    const daysLeft = Math.ceil(
      (new Date(g.end_date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );
    return `- [${g.period_type}/${g.category}] ${g.title}: ${g.current_value}/${g.target_value ?? "?"} ${g.unit ?? ""} (${progress}% 達成, 残り${daysLeft}日)`;
  });

  return `
${buildProfileContext()}

---

## 本日の状況 (${date})

### TODO完了率
${completedTodos.length}/${todos.length}件完了 (${completionRate}%)

### 未完了タスクの優先度分布
${Object.entries(priorityDist)
    .map(([p, c]) => `- Priority ${p}: ${c}件`)
    .join("\n") || "なし"}

### 目標の進捗状況
${goalsSummary.join("\n") || "目標なし"}

以上のデータを基に、厳しく現実的なアドバイスをしてください。
目標との差異、遅れている点、今日・今週やるべき具体的なアクションを提案してください。
`.trim();
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const date: string = body.date ?? new Date().toISOString().split("T")[0];

    const supabase = createServerClient();

    const [{ data: todos }, { data: goals }] = await Promise.all([
      supabase.from("todos").select("*").order("priority"),
      supabase.from("goals").select("*"),
    ]);

    const prompt = buildPrompt(todos ?? [], goals ?? [], date);

    const message = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1024,
      system:
        `あなたは外堀の人生の最高責任者兼コンサルタントです。` +
        `甘い言葉は不要。データとプロフィールに基づき、目標との差異を明確に指摘し、` +
        `今日・今週やるべきアクションを具体的に提案してください。`,
      messages: [{ role: "user", content: prompt }],
    });

    const advice =
      message.content[0].type === "text" ? message.content[0].text : "";

    return NextResponse.json({
      advice,
      generated_at: new Date().toISOString(),
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
