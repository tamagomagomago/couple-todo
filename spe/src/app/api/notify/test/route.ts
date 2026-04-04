/**
 * POST /api/notify/test
 * テスト通知を即座に送信する
 */
import { NextResponse } from "next/server";

export async function POST() {
  const token = process.env.PUSHOVER_APP_TOKEN;
  const user = process.env.PUSHOVER_USER_KEY;

  if (!token || !user) {
    return NextResponse.json(
      { error: "PUSHOVER_APP_TOKEN / PUSHOVER_USER_KEY が未設定です" },
      { status: 400 }
    );
  }

  const res = await fetch("https://api.pushover.net/1/messages.json", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      token,
      user,
      title: "⚡ SPE テスト通知",
      message: "Pushover連携が正常に動作しています！",
      sound: "pushover",
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    return NextResponse.json({ error: err }, { status: 500 });
  }

  return NextResponse.json({ ok: true, message: "テスト通知を送信しました" });
}
