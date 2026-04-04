/**
 * GET  /api/vision/board        → 現在のビジョンボード画像URLを返す
 * POST /api/vision/board        → 画像をVercel Blobにアップロード
 * DELETE /api/vision/board?url= → 画像を削除
 */
import { NextRequest, NextResponse } from "next/server";
import { put, list, del } from "@vercel/blob";

const PREFIX = "vision-board/";

export async function GET() {
  try {
    const { blobs } = await list({ prefix: PREFIX });
    // 最新1件を返す
    const latest = blobs.sort((a, b) =>
      new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
    )[0];
    return NextResponse.json({ url: latest?.url ?? null });
  } catch {
    return NextResponse.json({ url: null });
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "file required" }, { status: 400 });

    // 古いボードを削除
    const { blobs } = await list({ prefix: PREFIX });
    await Promise.all(blobs.map((b) => del(b.url)));

    const blob = await put(`${PREFIX}${Date.now()}-${file.name}`, file, {
      access: "public",
    });
    return NextResponse.json({ url: blob.url });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const url = request.nextUrl.searchParams.get("url");
    if (!url) {
      // 全削除
      const { blobs } = await list({ prefix: PREFIX });
      await Promise.all(blobs.map((b) => del(b.url)));
    } else {
      await del(url);
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
