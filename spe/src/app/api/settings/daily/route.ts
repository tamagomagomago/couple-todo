/**
 * daily_settings テーブル（Supabase で要作成）:
 *
 * CREATE TABLE IF NOT EXISTS daily_settings (
 *   date       DATE PRIMARY KEY,
 *   wake_time  TEXT NOT NULL DEFAULT '06:30',
 *   day_type   TEXT NOT NULL DEFAULT 'weekday',
 *   updated_at TIMESTAMPTZ DEFAULT NOW()
 * );
 */
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient();
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date") ?? new Date().toISOString().split("T")[0];

    const { data, error } = await supabase
      .from("daily_settings")
      .select("wake_time, day_type")
      .eq("date", date)
      .single();

    if (error || !data) {
      // 設定なし → デフォルト値を返す
      return NextResponse.json({ wake_time: null, day_type: null });
    }

    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient();
    const body = await request.json();
    const date = body.date ?? new Date().toISOString().split("T")[0];

    const updates: Record<string, string> = { date };
    if (body.wake_time) updates.wake_time = body.wake_time;
    if (body.day_type) updates.day_type = body.day_type;

    const { error } = await supabase
      .from("daily_settings")
      .upsert(updates, { onConflict: "date" });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
