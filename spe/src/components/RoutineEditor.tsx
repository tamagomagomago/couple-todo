"use client";

import { useState, useEffect, useCallback } from "react";
import { Routine } from "@/types";

export default function RoutineEditor() {
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [open, setOpen] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    title: "",
    timing: "",
    duration_minutes: 15,
    notify_time: "",
  });
  const [loading, setLoading] = useState(false);

  const fetchRoutines = useCallback(async () => {
    const res = await fetch("/api/todos?category=routine").catch(() => null);
    // ルーティンは別テーブルだが、APIがなければモックで対応
    // 将来的に /api/routines を実装する
    setRoutines([]);
  }, []);

  useEffect(() => {
    fetchRoutines();
  }, [fetchRoutines]);

  // ルーティンの直接編集はPhase 2で実装予定
  // Phase 1では固定スケジュールをそのまま表示
  const fixedRoutines = [
    { id: 1, title: "起床・水1杯・朝日", timing: "06:30", duration_minutes: 5 },
    { id: 2, title: "プランク＋ダンベルトレ", timing: "06:35", duration_minutes: 5 },
    { id: 3, title: "プロテイン・食事・エビオス", timing: "06:40", duration_minutes: 10 },
    { id: 4, title: "筋トレ（昼）", timing: "12:00", duration_minutes: 30 },
    { id: 5, title: "入浴（20分）", timing: "21:50", duration_minutes: 20 },
    { id: 6, title: "胸・首ストレッチ", timing: "22:10", duration_minutes: 15 },
    { id: 7, title: "翌日TODO確認・プロテイン＋マルデキ", timing: "22:25", duration_minutes: 20 },
  ];

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-800 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-purple-400 text-lg">🔄</span>
          <span className="font-semibold text-gray-200">固定ルーティン</span>
          <span className="text-xs bg-gray-700 text-gray-400 rounded-full px-2 py-0.5">
            {fixedRoutines.length}件
          </span>
        </div>
        <span className="text-gray-400 text-sm">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-2">
          <p className="text-xs text-gray-500 mb-2">
            固定ルーティンはスケジューラーに自動で組み込まれます
          </p>
          {fixedRoutines.map((r) => (
            <div
              key={r.id}
              className="flex items-center gap-3 bg-gray-800 rounded-lg px-3 py-2 border border-gray-700"
            >
              <span className="text-purple-400 text-sm font-mono w-10 shrink-0">
                {r.timing}
              </span>
              <span className="text-gray-300 text-sm flex-1">{r.title}</span>
              <span className="text-gray-500 text-xs">{r.duration_minutes}分</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
