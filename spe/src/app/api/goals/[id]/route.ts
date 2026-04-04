import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";
import { UpdateGoalInput } from "@/types";

type Params = { params: { id: string } };

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from("goals")
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
    const body: UpdateGoalInput = await request.json();

    const { data, error } = await supabase
      .from("goals")
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

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const supabase = createServerClient();
    const { error } = await supabase
      .from("goals")
      .delete()
      .eq("id", params.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
