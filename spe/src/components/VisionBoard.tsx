"use client";

import { useEffect, useRef, useState } from "react";

export default function VisionBoard() {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [blobReady, setBlobReady] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/vision/board")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setBlobReady(false);
        else setImageUrl(d.url ?? null);
      })
      .catch(() => setBlobReady(false));
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/vision/board", { method: "POST", body: formData });
      const data = await res.json();
      if (data.url) setImageUrl(data.url);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDelete = async () => {
    if (!confirm("ビジョン画像を削除しますか？")) return;
    await fetch("/api/vision/board", { method: "DELETE" });
    setImageUrl(null);
  };

  // Blob未設定の場合はコンパクトなセットアップ案内のみ
  if (!blobReady) {
    return (
      <div className="bg-gray-900 border border-dashed border-gray-700 rounded-xl px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🎯</span>
          <div>
            <p className="text-sm font-semibold text-gray-300">ビジョンボード</p>
            <p className="text-xs text-gray-500">
              Vercel → Storage → Blob を作成し、BLOB_READ_WRITE_TOKEN を設定すると画像を貼れます
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative rounded-xl overflow-hidden bg-gray-900 border border-gray-700">
      {imageUrl ? (
        <>
          {/* ビジョン画像 */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt="Vision Board"
            className="w-full object-cover"
            style={{ maxHeight: "280px" }}
          />
          {/* グラデーションオーバーレイ */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
          {/* ラベル */}
          <div className="absolute bottom-3 left-4">
            <p className="text-white text-xs font-semibold drop-shadow">🎯 VISION</p>
          </div>
          {/* 操作ボタン */}
          <div className="absolute top-2 right-2 flex gap-1.5">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="bg-black/50 hover:bg-black/70 text-white text-xs px-2.5 py-1 rounded-lg backdrop-blur-sm transition-colors"
            >
              {uploading ? "..." : "📷 変更"}
            </button>
            <button
              onClick={handleDelete}
              className="bg-black/50 hover:bg-red-900/70 text-white text-xs px-2.5 py-1 rounded-lg backdrop-blur-sm transition-colors"
            >
              削除
            </button>
          </div>
        </>
      ) : (
        /* 画像なし: アップロード誘導 */
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="w-full py-10 flex flex-col items-center gap-2 hover:bg-gray-800/50 transition-colors"
        >
          <span className="text-4xl">🎯</span>
          <p className="text-gray-400 text-sm font-semibold">ビジョン画像を追加</p>
          <p className="text-gray-600 text-xs">
            {uploading ? "アップロード中..." : "タップして画像を選択"}
          </p>
        </button>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleUpload}
      />
    </div>
  );
}
