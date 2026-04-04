import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// 各day_typeの作業スロット定義
const WORK_SLOTS: Record<string, Array<{start: string; end: string; label: string; isGolden: boolean}>> = {
  weekday: [
    { start: "06:50", end: "08:20", label: "朝のディープワーク（ゴールデンタイム⚡）", isGolden: true },
    { start: "20:00", end: "21:50", label: "夜のワーク（低負荷推奨）", isGolden: false },
  ],
  overtime: [
    { start: "06:50", end: "08:20", label: "朝のディープワーク（ゴールデンタイム⚡）", isGolden: true },
  ],
  holiday: [
    { start: "06:50", end: "12:00", label: "午前ディープワーク（ゴールデンタイム⚡）", isGolden: true },
    { start: "13:00", end: "18:00", label: "午後作業", isGolden: false },
    { start: "19:00", end: "23:00", label: "夜作業・自由", isGolden: false },
  ],
};

function minutesBetween(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return (eh * 60 + em) - (sh * 60 + sm);
}

function addMinutes(time: string, mins: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + mins;
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export async function POST(request: NextRequest) {
  try {
    const { date, day_type, focus } = await request.json();

    if (!focus?.trim()) {
      return NextResponse.json({ error: "focus is required" }, { status: 400 });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "ANTHROPIC_API_KEY not set" }, { status: 500 });
    }

    const slots = WORK_SLOTS[day_type] ?? WORK_SLOTS.weekday;

    const slotDesc = slots
      .map((s) => `- ${s.label}（${s.start}〜${s.end}、${minutesBetween(s.start, s.end)}分）`)
      .join("\n");

    const prompt = `日付: ${date}
利用可能な作業スロット:
${slotDesc}

今日やりたいこと・集中テーマ:
${focus}

以下の形式でJSONのみを返してください。説明文不要。
スロット内のタスクを具体的に時間配分して、ai_blocksに入れてください。
90分以上連続する場合は10分の休憩ブロックを自動挿入してください。

{
  "plan": "一言で今日の計画の要点（50文字以内）",
  "ai_blocks": [
    {
      "start_time": "HH:MM",
      "end_time": "HH:MM",
      "title": "タスク名",
      "type": "deep_work または task または break",
      "is_golden_time": true/false,
      "duration_minutes": 数値
    }
  ]
}

制約:
- start_time/end_timeはスロットの時間内に収めること
- durationとstart/endの時間差を一致させること
- スロット外の時間帯には入れないこと
- typeはdeep_work（ゴールデンタイム）、task（通常作業）、break（休憩）のみ`;

    const message = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1500,
      system: `あなたはSotoboriの専属スケジューラーです。与えられた作業スロットと目標に基づき、最も効率的なタスク配置をJSON形式で返してください。JSONのみを返し、余分な説明は不要です。`,
      messages: [{ role: "user", content: prompt }],
    });

    const content = message.content[0];
    if (content.type !== "text") {
      return NextResponse.json({ error: "Invalid response" }, { status: 500 });
    }

    // JSON抽出
    let parsed;
    try {
      const text = content.text.trim();
      // ```json ... ``` ブロックを除去
      const cleaned = text.replace(/^```json\n?/, "").replace(/\n?```$/, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      const match = content.text.match(/\{[\s\S]*\}/);
      if (match) {
        parsed = JSON.parse(match[0]);
      } else {
        return NextResponse.json({ error: "Failed to parse AI response" }, { status: 500 });
      }
    }

    // idを付与
    const aiBlocks = (parsed.ai_blocks ?? []).map((b: Record<string, unknown>, i: number) => ({
      ...b,
      id: `ai-block-${i}`,
    }));

    return NextResponse.json({
      plan: parsed.plan ?? "",
      ai_blocks: aiBlocks,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
