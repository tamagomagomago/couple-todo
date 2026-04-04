import { NextRequest, NextResponse } from "next/server";
import { put, list, del } from "@vercel/blob";

const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;

/** POST /api/vision?goal_id=XX - 画像アップロード（multipart/form-data） */
export async function POST(request: NextRequest) {
  try {
    if (!BLOB_TOKEN) {
      return NextResponse.json(
        { error: "BLOB_READ_WRITE_TOKEN is not configured" },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const goalId = searchParams.get("goal_id");

    if (!goalId) {
      return NextResponse.json({ error: "goal_id is required" }, { status: 400 });
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: "file is required" }, { status: 400 });
    }

    const fileName = file instanceof File ? file.name : "image.jpg";
    const ext = fileName.split(".").pop() ?? "jpg";
    const pathname = `vision/goal_${goalId}/${Date.now()}.${ext}`;

    const blob = await put(pathname, file, {
      access: "public",
      token: BLOB_TOKEN,
    });

    return NextResponse.json({
      url: blob.url,
      pathname: blob.pathname,
      goal_id: goalId,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

/** GET /api/vision?goal_id=XX - 画像一覧取得 */
export async function GET(request: NextRequest) {
  try {
    if (!BLOB_TOKEN) {
      return NextResponse.json(
        { error: "BLOB_READ_WRITE_TOKEN is not configured" },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const goalId = searchParams.get("goal_id");

    if (!goalId) {
      return NextResponse.json({ error: "goal_id is required" }, { status: 400 });
    }

    const { blobs } = await list({
      prefix: `vision/goal_${goalId}/`,
      token: BLOB_TOKEN,
    });

    const images = blobs.map((b) => ({
      url: b.url,
      pathname: b.pathname,
    }));

    return NextResponse.json({ images });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

/** DELETE /api/vision?url=XX - 画像削除 */
export async function DELETE(request: NextRequest) {
  try {
    if (!BLOB_TOKEN) {
      return NextResponse.json(
        { error: "BLOB_READ_WRITE_TOKEN is not configured" },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const url = searchParams.get("url");

    if (!url) {
      return NextResponse.json({ error: "url is required" }, { status: 400 });
    }

    await del(url, { token: BLOB_TOKEN });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
