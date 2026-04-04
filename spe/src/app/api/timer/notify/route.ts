import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { title, minutes } = await req.json();
  const token = process.env.PUSHOVER_APP_TOKEN;
  const user = process.env.PUSHOVER_USER_KEY;
  if (!token || !user) return NextResponse.json({ ok: false });

  const message = `✅ ${title}（${minutes}分）タイマー終了！`;
  await fetch("https://api.pushover.net/1/messages.json", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, user, message, priority: 0, sound: "default" }),
  });
  return NextResponse.json({ ok: true });
}
