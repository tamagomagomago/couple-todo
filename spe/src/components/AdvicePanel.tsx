"use client";

import { useState } from "react";

export default function AdvicePanel({ date }: { date: string }) {
  const [advice, setAdvice] = useState<string>("");
  const [generatedAt, setGeneratedAt] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [open, setOpen] = useState(true);

  const fetchAdvice = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/advice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Unknown error");
      setAdvice(json.advice);
      setGeneratedAt(json.generated_at);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-800 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-orange-400 text-lg">🧠</span>
          <span className="font-semibold text-gray-200">AIアドバイス</span>
        </div>
        <span className="text-gray-400 text-sm">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          <button
            onClick={fetchAdvice}
            disabled={loading}
            className="w-full py-2 rounded-lg bg-orange-700 hover:bg-orange-600 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-medium text-sm transition-colors"
          >
            {loading ? "生成中..." : "アドバイスを更新"}
          </button>

          {error && (
            <p className="text-red-400 text-sm bg-red-900/30 rounded-lg p-3">{error}</p>
          )}

          {advice ? (
            <div className="space-y-2">
              <div className="bg-gray-800 rounded-lg p-3 text-gray-200 text-sm leading-relaxed whitespace-pre-wrap">
                {advice}
              </div>
              {generatedAt && (
                <p className="text-gray-500 text-xs text-right">
                  生成: {new Date(generatedAt).toLocaleString("ja-JP")}
                </p>
              )}
            </div>
          ) : (
            !loading && (
              <p className="text-gray-500 text-sm text-center py-4">
                「アドバイスを更新」ボタンを押してください
              </p>
            )
          )}
        </div>
      )}
    </div>
  );
}
