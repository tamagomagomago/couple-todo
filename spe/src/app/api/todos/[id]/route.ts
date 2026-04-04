import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { UpdateTodoInput } from "@/types";

type Params = { params: { id: string } };

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("todos")
      .select("*")
      .eq("id", params.id)
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 404 });
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const supabase = createServerClient();
    const body: UpdateTodoInput = await request.json();

    const { data, error } = await supabase
      .from("todos")
      .update({
        ...body,
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const supabase = createServerClient();
    const body = await request.json().catch(() => ({}));

    // is_completed, is_today など部分的に更新
    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (typeof body.is_completed === "boolean") {
      updates.is_completed = body.is_completed;
      // 完了時は completed_at を記録、未完了に戻す時はクリア
      updates.completed_at = body.is_completed ? new Date().toISOString() : null;
    }
    if (typeof body.is_today === "boolean") {
      updates.is_today = body.is_today;
      updates.today_date = body.is_today
        ? new Date().toISOString().split("T")[0]
        : null;
    }
    if ("preferred_time" in body) {
      updates.preferred_time = body.preferred_time ?? null;
    }
    if (typeof body.priority === "number") {
      updates.priority = body.priority;
    }
    if (typeof body.title === "string" && body.title.trim()) {
      updates.title = body.title.trim();
    }

    const { data, error } = await supabase
      .from("todos")
      .update(updates)
      .eq("id", params.id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const supabase = createServerClient();
    const { error } = await supabase
      .from("todos")
      .delete()
      .eq("id", params.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
