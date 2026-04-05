import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const user_id = searchParams.get("user_id");
    const period = searchParams.get("period") || "week"; // 'week', 'month', or 'year'

    if (!user_id) {
      return NextResponse.json(
        { error: "Missing user_id" },
        { status: 400 }
      );
    }

    const supabase = createServerClient();
    const now = new Date();
    let startDate: Date;

    if (period === "year") {
      startDate = new Date(now.getFullYear(), 0, 1);
    } else if (period === "month") {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else {
      // Default to week (last 7 days)
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 6);
    }

    startDate.setHours(0, 0, 0, 0);

    const { data: sessions, error } = await supabase
      .from("focus_sessions")
      .select("*")
      .eq("user_id", user_id)
      .eq("session_status", "completed")
      .gte("start_time", startDate.toISOString());

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Build daily breakdown
    const daily_breakdown: Record<string, number> = {};
    const mode_breakdown: Record<string, number> = {};

    (sessions || []).forEach((session) => {
      const date = session.start_time.split("T")[0];
      const minutes = session.actual_minutes || 0;

      daily_breakdown[date] = (daily_breakdown[date] || 0) + minutes;
      mode_breakdown[session.mode_name] =
        (mode_breakdown[session.mode_name] || 0) + minutes;
    });

    // Fill in missing days with 0
    if (period === "week") {
      for (let i = 0; i < 7; i++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + i);
        const dateStr = date.toISOString().split("T")[0];
        if (!(dateStr in daily_breakdown)) {
          daily_breakdown[dateStr] = 0;
        }
      }
    }

    const total_minutes = Object.values(daily_breakdown).reduce(
      (sum, m) => sum + m,
      0
    );

    return NextResponse.json({
      period,
      daily_breakdown,
      mode_breakdown,
      total_minutes,
    });
  } catch (e) {
    console.error("Error:", e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
