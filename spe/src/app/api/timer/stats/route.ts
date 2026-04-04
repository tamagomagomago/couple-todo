import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const period = searchParams.get("period") ?? "week"; // "week" | "month"
  const supabase = createServerClient();

  const daysBack = period === "month" ? 28 : 7;
  const since = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("time_sessions")
    .select("*")
    .gte("started_at", since)
    .not("duration_seconds", "is", null)
    .order("started_at");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
}
