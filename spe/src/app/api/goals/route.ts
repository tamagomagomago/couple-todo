import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { CreateGoalInput } from "@/types";

export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient();
    const { searchParams } = new URL(request.url);
    const period_type = searchParams.get("period_type");
    const category = searchParams.get("category");

    let query = supabase
      .from("goals")
      .select("*")
      .order("period_type", { ascending: true })
      .order("created_at", { ascending: false });

    if (period_type) query = query.eq("period_type", period_type);
    if (category) query = query.eq("category", category);

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
    const body: CreateGoalInput = await request.json();

    if (!body.title?.trim()) {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }
    if (!body.category || !body.period_type || !body.start_date || !body.end_date) {
      return NextResponse.json(
        { error: "category, period_type, start_date, end_date are required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("goals")
      .insert({
        title: body.title.trim(),
        description: body.description ?? null,
        category: body.category,
        period_type: body.period_type,
        target_value: body.target_value ?? null,
        current_value: body.current_value ?? 0,
        unit: body.unit ?? null,
        start_date: body.start_date,
        end_date: body.end_date,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json(data, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
