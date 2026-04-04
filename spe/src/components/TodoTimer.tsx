"use client";

import { useEffect, useState, useRef } from "react";

export interface ActiveTimer {
  sessionId: number | null;
  todoId: number;
  todoTitle: string;
  category: string;
  estimatedMinutes: number;
  startedAt: number; // unix ms
}

const CATEGORY_ACCENT: Record<string, { ring: string; bar: string; text: string }> = {
  vfx:        { ring: "ring-purple-500/40", bar: "bg-purple-500", text: "text-purple-300" },
  english:    { ring: "ring-blue-500/40",   bar: "bg-blue-500",   text: "text-blue-300"   },
  investment: { ring: "ring-green-500/40",  bar: "bg-green-500",  text: "text-green-300"  },
  fitness:    { ring: "ring-orange-500/40", bar: "bg-orange-500", text: "text-orange-300" },
  engineer:   { ring: "ring-teal-500/40",   bar: "bg-teal-500",   text: "text-teal-300"   },
  personal:   { ring: "ring-gray-500/40",   bar: "bg-gray-500",   text: "text-gray-300"   },
};

function pad(n: number) { return String(Math.floor(n)).padStart(2, "0"); }

function fmtTime(totalSec: number): string {
  const sec = Math.abs(totalSec);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${pad(h)}:${pad(m)}:${pad(s)}`;
  return `${pad(m)}:${pad(s)}`;
}

export default function TodoTimer({
  timer,
  onComplete,
  onStop,
}: {
  timer: ActiveTimer;
  onComplete: (durationSeconds: number) => void;
  onStop: (durationSeconds: number) => void;
}) {
  const [elapsed, setElapsed] = useState(0);
  const notifiedRef = useRef(false);
  const totalSec = timer.estimatedMinutes * 60;

  useEffect(() => {
    const tick = () => {
      const s = Math.floor((Date.now() - timer.startedAt) / 1000);
      setElapsed(s);
      if (s >= totalSec && !notifiedRef.current) {
        notifiedRef.current = true;
        fetch("/api/timer/notify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: timer.todoTitle, minutes: timer.estimatedMinutes }),
        });
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [timer.startedAt, totalSec, timer.todoTitle, timer.estimatedMinutes]);

  const remaining = totalSec - elapsed;          // 負の数 = 超過
  const isOvertime = remaining < 0;
  const progress = Math.min(1, elapsed / totalSec);

  const accent = CATEGORY_ACCENT[timer.category] ?? CATEGORY_ACCENT.personal;

  return (
    <div className={`bg-gray-900 border border-gray-700 rounded-xl overflow-hidden ring-2 ${accent.ring}`}>

      {/* プログレスバー */}
      <div className="h-1.5 bg-gray-800">
        <div
          className={`h-full transition-all duration-1000 ${isOvertime ? "bg-red-500" : accent.bar}`}
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      <div className="px-4 py-4">
        {/* タスク名 */}
        <div className="flex items-center gap-2 mb-3">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse shrink-0" />
          <span className="text-xs text-gray-400 font-medium">フォーカス中</span>
          <span className={`text-xs font-semibold ml-1 ${accent.text}`}>
            {timer.todoTitle}
          </span>
        </div>

        <div className="flex items-center gap-4">
          {/* ===== 残り時間 大きく表示 ===== */}
          <div className="flex-1 text-center">
            {isOvertime ? (
              <>
                <p className="text-[11px] text-red-400 font-bold uppercase tracking-widest mb-1">
                  ⚠ 超過中
                </p>
                <p className="text-5xl font-mono font-black text-red-400 tabular-nums leading-none">
                  +{fmtTime(-remaining)}
                </p>
              </>
            ) : (
              <>
                <p className="text-[11px] text-gray-500 uppercase tracking-widest mb-1">
                  残り時間
                </p>
                <p className={`text-6xl font-mono font-black tabular-nums leading-none ${
                  remaining <= 60 ? "text-red-400" :
                  remaining <= 300 ? "text-amber-400" :
                  "text-white"
                }`}>
                  {fmtTime(remaining)}
                </p>
              </>
            )}
            {/* 経過時間（サブ） */}
            <p className="text-xs text-gray-600 mt-2">
              経過 {fmtTime(elapsed)} / 予定 {fmtTime(totalSec)}
            </p>
          </div>

          {/* ===== ボタン ===== */}
          <div className="flex flex-col gap-2 shrink-0">
            <button
              onClick={() => onComplete(elapsed)}
              className="px-4 py-3 bg-green-700 hover:bg-green-600 active:bg-green-800 text-white text-sm font-bold rounded-xl transition-colors shadow-md"
            >
              ✓ 完了
            </button>
            <button
              onClick={() => onStop(elapsed)}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs rounded-xl transition-colors"
            >
              ■ 中断
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
