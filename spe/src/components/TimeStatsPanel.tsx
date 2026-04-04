"use client";

import { useEffect, useState } from "react";

interface TimeSession {
  id: number;
  todo_id: number | null;
  todo_title: string;
  category: string;
  started_at: string;
  duration_seconds: number;
  estimated_seconds: number | null;
  completed: boolean;
}

type Period = "week" | "month";

const CATEGORY_COLOR: Record<string, string> = {
  vfx:        "#9333ea",
  english:    "#3b82f6",
  investment: "#22c55e",
  fitness:    "#f97316",
  engineer:   "#14b8a6",
  personal:   "#9ca3af",
};

const CATEGORY_LABEL: Record<string, string> = {
  vfx:        "🎬 VFX",
  english:    "🗣️ 英語",
  investment: "💰 投資",
  fitness:    "💪 筋トレ",
  engineer:   "📐 技術士",
  personal:   "⭐ 個人",
};

function fmtDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}h${m > 0 ? m + "m" : ""}`;
  if (m > 0) return `${m}分`;
  return `${sec}秒`;
}

function sumByCategory(sessions: TimeSession[]): Record<string, number> {
  const sums: Record<string, number> = {};
  for (const s of sessions) {
    sums[s.category] = (sums[s.category] ?? 0) + (s.duration_seconds ?? 0);
  }
  return sums;
}

export default function TimeStatsPanel() {
  const [sessions, setSessions] = useState<TimeSession[]>([]);
  const [period, setPeriod] = useState<Period>("week");
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch(`/api/timer/stats?period=${period}`)
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setSessions(data); })
      .finally(() => setLoading(false));
  }, [period, open]);

  // 日別データ（週表示）
  const getDayData = () => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      const daySessions = sessions.filter((s) => s.started_at.startsWith(dateStr));
      const byCat = sumByCategory(daySessions);
      days.push({
        label: ["日", "月", "火", "水", "木", "金", "土"][d.getDay()],
        dateStr,
        total: Object.values(byCat).reduce((a, b) => a + b, 0),
        byCat,
      });
    }
    return days;
  };

  // 週別データ（月表示）
  const getWeekData = () => {
    const weeks = [];
    for (let w = 3; w >= 0; w--) {
      const start = new Date();
      start.setDate(start.getDate() - (w + 1) * 7);
      const end = new Date();
      end.setDate(end.getDate() - w * 7);
      const weekSessions = sessions.filter((s) => {
        const d = new Date(s.started_at);
        return d >= start && d < end;
      });
      const byCat = sumByCategory(weekSessions);
      weeks.push({
        label: `${start.getMonth() + 1}/${start.getDate()}〜`,
        total: Object.values(byCat).reduce((a, b) => a + b, 0),
        byCat,
      });
    }
    return weeks;
  };

  const chartData = period === "week" ? getDayData() : getWeekData();
  const maxTotal = Math.max(...chartData.map((d) => d.total), 1);
  const totalByCategory = sumByCategory(sessions);
  const totalSeconds = Object.values(totalByCategory).reduce((a, b) => a + b, 0);
  const sortedCats = Object.entries(totalByCategory).sort((a, b) => b[1] - a[1]);

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full px-4 py-3 flex items-center justify-between border-b border-gray-800 hover:bg-gray-800/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">⏱️</span>
          <span className="font-semibold text-gray-200">時間記録・統計</span>
          {totalSeconds > 0 && open && (
            <span className="text-xs text-gray-500">
              合計 {fmtDuration(totalSeconds)}
            </span>
          )}
        </div>
        <span className="text-gray-500 text-xs">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="p-4 space-y-5">
          {/* 期間選択 */}
          <div className="flex gap-1 bg-gray-800 rounded-lg p-1 w-fit">
            {(["week", "month"] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`text-xs px-3 py-1.5 rounded-md transition-colors ${
                  period === p
                    ? "bg-blue-700 text-white"
                    : "text-gray-400 hover:text-gray-200"
                }`}
              >
                {p === "week" ? "今週（7日）" : "今月（28日）"}
              </button>
            ))}
          </div>

          {loading ? (
            <p className="text-gray-500 text-sm text-center py-6">読み込み中...</p>
          ) : sessions.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-600 text-sm">まだ記録がありません</p>
              <p className="text-gray-700 text-xs mt-1">TODOのタイマーを使うと記録が蓄積されます</p>
            </div>
          ) : (
            <>
              {/* 棒グラフ */}
              <div>
                <p className="text-xs text-gray-500 font-medium mb-3">
                  {period === "week" ? "日別" : "週別"}作業時間
                </p>
                <div className="flex items-end gap-1.5" style={{ height: "100px" }}>
                  {chartData.map((bar, i) => (
                    <div
                      key={i}
                      className="flex-1 flex flex-col items-center gap-1"
                    >
                      {/* スタック棒グラフ */}
                      <div
                        className="w-full flex flex-col-reverse rounded-sm overflow-hidden relative"
                        style={{ height: "80px" }}
                        title={`合計 ${fmtDuration(bar.total)}`}
                      >
                        {bar.total === 0 ? (
                          <div className="w-full bg-gray-800 rounded-sm" style={{ height: "4px" }} />
                        ) : (
                          Object.entries(bar.byCat)
                            .sort((a, b) => b[1] - a[1])
                            .map(([cat, sec]) => (
                              <div
                                key={cat}
                                className="w-full"
                                style={{
                                  height: `${(sec / maxTotal) * 80}px`,
                                  backgroundColor:
                                    CATEGORY_COLOR[cat] ?? "#6b7280",
                                }}
                              />
                            ))
                        )}
                      </div>
                      <span className="text-[10px] text-gray-500 leading-none">
                        {bar.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* カテゴリ別内訳 */}
              {sortedCats.length > 0 && (
                <div>
                  <p className="text-xs text-gray-500 font-medium mb-2">
                    カテゴリ別合計
                  </p>
                  <div className="space-y-2">
                    {sortedCats.map(([cat, sec]) => (
                      <div key={cat} className="flex items-center gap-2">
                        <span className="text-xs text-gray-400 w-20 shrink-0 truncate">
                          {CATEGORY_LABEL[cat] ?? cat}
                        </span>
                        <div className="flex-1 bg-gray-800 rounded-full h-2 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${(sec / totalSeconds) * 100}%`,
                              backgroundColor:
                                CATEGORY_COLOR[cat] ?? "#6b7280",
                            }}
                          />
                        </div>
                        <span className="text-xs text-gray-400 w-14 text-right shrink-0">
                          {fmtDuration(sec)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 合計 */}
              <div className="bg-gray-800/60 rounded-lg px-3 py-2 flex items-center justify-between">
                <span className="text-xs text-gray-400">
                  {period === "week" ? "今週（7日）" : "今月（28日）"}の合計
                </span>
                <span className="text-sm font-bold text-white">
                  {fmtDuration(totalSeconds)}
                </span>
              </div>

              {/* 最近のセッション */}
              <div>
                <p className="text-xs text-gray-500 font-medium mb-2">最近の記録</p>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {sessions.slice(0, 10).map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center gap-2 text-xs py-1 border-b border-gray-800 last:border-0"
                    >
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{
                          backgroundColor:
                            CATEGORY_COLOR[s.category] ?? "#6b7280",
                        }}
                      />
                      <span className="text-gray-300 flex-1 truncate">
                        {s.todo_title}
                      </span>
                      <span className="text-gray-500 shrink-0">
                        {fmtDuration(s.duration_seconds)}
                      </span>
                      {s.completed && (
                        <span className="text-green-500 shrink-0">✓</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
