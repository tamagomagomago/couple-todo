/**
 * GET    /api/plans?date=YYYY-MM-DD  → その日のAI計画を取得
 * POST   /api/plans                  → AI計画を保存（upsert）
 * DELETE /api/plans?date=YYYY-MM-DD  → AI計画を削除
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  const date = request.nextUrl.searchParams.get("date");
  if (!date) return NextResponse.json({ error: "date required" }, { status: 400 });

  const { data, error } = await supabase
    .from("daily_plans")
    .select("*")
    .eq("date", date)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? null);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { date, plan_text, ai_blocks, slot_notes, custom_blocks } = body;
  if (!date) return NextResponse.json({ error: "date required" }, { status: 400 });

  const { data, error } = await supabase
    .from("daily_plans")
    .upsert(
      { date, plan_text, ai_blocks, slot_notes, custom_blocks, updated_at: new Date().toISOString() },
      { onConflict: "date" }
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(request: NextRequest) {
  const date = request.nextUrl.searchParams.get("date");
  if (!date) return NextResponse.json({ error: "date required" }, { status: 400 });

  const { error } = await supabase.from("daily_plans").delete().eq("date", date);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
