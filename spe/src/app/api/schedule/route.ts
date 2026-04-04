import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { buildSchedule } from "@/lib/scheduler";
import { DayType } from "@/types";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date") ?? new Date().toISOString().split("T")[0];
    const day_type = (searchParams.get("day_type") ?? "weekday") as DayType;
    const wake_time = searchParams.get("wake_time") ?? "06:30";

    if (!["weekday", "overtime", "holiday"].includes(day_type)) {
      return NextResponse.json(
        { error: "day_type must be one of: weekday, overtime, holiday" },
        { status: 400 }
      );
    }

    const supabase = createServerClient();
    const { data: todos, error } = await supabase
      .from("todos")
      .select("*")
      .eq("is_completed", false)
      .eq("is_today", true)
      .order("priority", { ascending: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const schedule = buildSchedule(date, day_type, todos ?? [], wake_time);

    return NextResponse.json(schedule);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
