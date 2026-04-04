import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { CreateTodoInput } from "@/types";

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient();

    // 前日以前に「今日へ」追加されたTODOをマスターリストに自動返却
    const today = new Date().toISOString().split("T")[0];
    await supabase
      .from("todos")
      .update({ is_today: false, today_date: null })
      .eq("is_today", true)
      .lt("today_date", today);

    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const is_completed = searchParams.get("is_completed");
    const is_today = searchParams.get("is_today");

    let query = supabase
      .from("todos")
      .select("*")
      .order("priority", { ascending: true })
      .order("created_at", { ascending: false });

    if (category) query = query.eq("category", category);
    if (is_completed !== null && is_completed !== "") {
      query = query.eq("is_completed", is_completed === "true");
    }
    if (is_today !== null && is_today !== "") {
      const flag = is_today === "true";
      if (flag) {
        // 今日の日付のものだけ返す（前日以前は除外）
        const today = new Date().toISOString().split("T")[0];
        query = query.eq("is_today", true).eq("today_date", today);
      } else {
        query = query.eq("is_today", false);
      }
    }

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerClient();
    const body: CreateTodoInput = await request.json();

    if (!body.title?.trim()) {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }

    const isToday = body.is_today ?? false;
    const { data, error } = await supabase
      .from("todos")
      .insert({
        title: body.title.trim(),
        description: body.description ?? null,
        priority: body.priority ?? 3,
        estimated_minutes: body.estimated_minutes ?? 30,
        category: body.category ?? "personal",
        is_today: isToday,
        today_date: isToday ? new Date().toISOString().split("T")[0] : null,
        preferred_time: body.preferred_time ?? null,
        due_date: body.due_date ?? null,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json(data, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
