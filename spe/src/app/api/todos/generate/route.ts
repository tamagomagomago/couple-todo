import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { buildProfileContext } from "@/lib/profile";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request: NextRequest) {
  try {
    const { prompt } = await request.json();

    if (!prompt?.trim()) {
      return NextResponse.json({ error: "prompt is required" }, { status: 400 });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "ANTHROPIC_API_KEY not set" }, { status: 500 });
    }

    const profileCtx = buildProfileContext();

    const message = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1024,
      system: `あなたはタスク分解の専門家です。以下のユーザープロフィールを踏まえ、具体的なTODOリストをJSON配列のみで返してください。マークダウンや説明文は一切含めないでください。形式: [{"text":"タスク内容","priority":"高|中|低","cat":"カテゴリ名","est":推定分数}] 5〜8件生成してください。カテゴリはvfx/english/investment/fitness/personalから選ぶか、適切なものを日本語で設定してください。

${profileCtx}`,
      messages: [{ role: "user", content: prompt }],
    });

    const content = message.content[0];
    if (content.type !== "text") {
      return NextResponse.json({ error: "Invalid response from Claude" }, { status: 500 });
    }

    // JSON を抽出
    let todos;
    try {
      todos = JSON.parse(content.text.trim());
    } catch {
      const match = content.text.match(/\[[\s\S]*\]/);
      if (match) {
        todos = JSON.parse(match[0]);
      } else {
        return NextResponse.json({ error: "Failed to parse AI response" }, { status: 500 });
      }
    }

    return NextResponse.json({ todos });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
