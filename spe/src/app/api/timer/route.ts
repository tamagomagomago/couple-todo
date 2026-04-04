import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

export async function GET() {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("time_sessions")
    .select("*")
    .order("started_at", { ascending: false })
    .limit(200);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const body = await req.json();
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("time_sessions")
    .insert({
      todo_id: body.todo_id ?? null,
      todo_title: body.todo_title,
      category: body.category ?? "personal",
      started_at: body.started_at ?? new Date().toISOString(),
      estimated_seconds: body.estimated_seconds ?? null,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function PATCH(req: Request) {
  const body = await req.json();
  const { id, ended_at, duration_seconds, completed } = body;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("time_sessions")
    .update({ ended_at, duration_seconds, completed })
    .eq("id", id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
