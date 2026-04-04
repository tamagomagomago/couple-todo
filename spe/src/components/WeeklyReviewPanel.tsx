"use client";

import { useState, useEffect, useCallback } from "react";

interface CategoryStat {
  completed: number;
  total: number;
}

interface GoalSummary {
  id: number;
  title: string;
  category: string;
  period_type: string;
  current_value: number;
  target_value: number | null;
  unit: string | null;
  is_achieved: boolean;
  progress: number;
}

interface WeeklyReviewData {
  week: { monday: string; sunday: string };
  todos: {
    total: number;
    completed: number;
    completion_rate: number;
  };
  category_stats: Record<string, CategoryStat>;
  goals: GoalSummary[];
}

const CATEGORY_EMOJI: Record<string, string> = {
  vfx: "🎬",
  english: "🗣️",
  investment: "💰",
  fitness: "💪",
  personal: "⭐",
};

const CATEGORY_LABEL: Record<string, string> = {
  vfx: "VFX",
  english: "英語",
  investment: "投資",
  fitness: "フィットネス",
  personal: "その他",
};

const PERIOD_LABEL: Record<string, string> = {
  annual: "年間",
  monthly: "月次",
  weekly: "週次",
};

function ProgressBar({ value, color = "bg-blue-500" }: { value: number; color?: string }) {
  return (
    <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
      <div
        className={`h-full ${color} transition-all duration-500`}
        style={{ width: `${value}%` }}
      />
    </div>
  );
}

// 週次レビューの実施手順
const REVIEW_STEPS = [
  { emoji: "📊", text: "今週のTODO完了率を確認する（下の数値を見る）" },
  { emoji: "🎬", text: "カテゴリ別実績を確認する（VFX・英語・投資・筋トレ）" },
  { emoji: "🎯", text: "週次・月次目標の進捗を確認する" },
  { emoji: "📝", text: "来週フォーカスすることを1つ決めて入力する" },
  { emoji: "🤖", text: "「AIに振り返りを生成」を押して改善ポイントを把握する" },
  { emoji: "➕", text: "来週のTODOをマスターリストに追加しておく" },
  { emoji: "💤", text: "レビュー完了 → 明日の準備OK！就寝" },
];

export default function WeeklyReviewPanel({ featured = false }: { featured?: boolean }) {
  const isReviewDay = new Date().getDay() === 0; // 日曜日
  const [expanded, setExpanded] = useState(featured || isReviewDay);
  const [stepsDone, setStepsDone] = useState<Record<number, boolean>>({});

  // 今日のチェック状態をlocalStorageから復元
  const today = new Date().toISOString().split("T")[0];
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`weeklyReviewSteps-${today}`);
      if (saved) setStepsDone(JSON.parse(saved));
    } catch {}
  }, [today]);

  const toggleStep = (i: number) => {
    const updated = { ...stepsDone, [i]: !stepsDone[i] };
    setStepsDone(updated);
    try { localStorage.setItem(`weeklyReviewSteps-${today}`, JSON.stringify(updated)); } catch {}
  };

  const stepsDoneCount = Object.values(stepsDone).filter(Boolean).length;
  const [reviewData, setReviewData] = useState<WeeklyReviewData | null>(null);
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiReview, setAiReview] = useState<string | null>(null);
  const [nextWeekGoal, setNextWeekGoal] = useState("");

  const fetchReviewData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/weekly-review");
      if (res.ok) {
        const data = await res.json();
        setReviewData(data);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (expanded && !reviewData) {
      fetchReviewData();
    }
  }, [expanded, reviewData, fetchReviewData]);

  const handleGenerateAiReview = async () => {
    setAiLoading(true);
    setAiReview(null);
    try {
      const res = await fetch("/api/weekly-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ next_week_goal: nextWeekGoal }),
      });
      if (res.ok) {
        const data = await res.json();
        setAiReview(data.review ?? "");
      } else {
        setAiReview("エラー: AI振り返りの生成に失敗しました");
      }
    } catch {
      setAiReview("エラー: ネットワークエラーが発生しました");
    } finally {
      setAiLoading(false);
    }
  };

  const completionColor =
    reviewData && reviewData.todos.completion_rate >= 80
      ? "bg-green-500"
      : reviewData && reviewData.todos.completion_rate >= 40
      ? "bg-yellow-500"
      : "bg-red-500";

  const categories = ["vfx", "english", "investment", "fitness", "personal"];

  const isFeaturedOrReviewDay = featured || isReviewDay;

  return (
    <div className={`rounded-xl overflow-hidden border ${
      isFeaturedOrReviewDay
        ? "border-purple-500/60 bg-gradient-to-br from-purple-950/60 via-gray-900 to-gray-900 shadow-lg shadow-purple-900/20"
        : "border-gray-700 bg-gray-900"
    }`}>
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-lg">📊</span>
          <span className={`font-semibold ${isFeaturedOrReviewDay ? "text-purple-200" : "text-gray-200"}`}>
            週次レビュー
          </span>
          {isFeaturedOrReviewDay ? (
            <span className="text-xs bg-purple-600 text-white px-2 py-0.5 rounded-full font-bold animate-pulse">
              🗓 今日やること！
            </span>
          ) : (
            <span className="text-xs bg-purple-900/50 text-purple-400 border border-purple-800/50 px-1.5 py-0.5 rounded-full">
              今週の振り返り
            </span>
          )}
          {isFeaturedOrReviewDay && stepsDoneCount > 0 && (
            <span className="text-xs text-purple-300">
              {stepsDoneCount}/{REVIEW_STEPS.length}ステップ完了
            </span>
          )}
        </div>
        <span className="text-gray-500 text-xs">{expanded ? "▲" : "▼"}</span>
      </button>

      {expanded && (
        <div className="px-4 pb-5 space-y-5 border-t border-gray-700/50 pt-4">

          {/* ===== 日曜日：やることチェックリスト ===== */}
          {isFeaturedOrReviewDay && (
            <div className="bg-purple-950/40 border border-purple-800/40 rounded-xl p-4">
              <p className="text-sm font-bold text-purple-200 mb-3">
                ✅ 週次レビューの手順（{stepsDoneCount}/{REVIEW_STEPS.length}）
              </p>
              <div className="space-y-2">
                {REVIEW_STEPS.map((step, i) => (
                  <button
                    key={i}
                    onClick={() => toggleStep(i)}
                    className={`w-full flex items-start gap-3 text-left py-1.5 px-0.5 rounded transition-all ${
                      stepsDone[i] ? "opacity-50" : "opacity-100"
                    }`}
                  >
                    <div className={`mt-0.5 w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center transition-colors ${
                      stepsDone[i]
                        ? "border-green-500 bg-green-500"
                        : "border-purple-500 hover:border-green-400"
                    }`}>
                      {stepsDone[i] && <span className="text-white text-[10px]">✓</span>}
                    </div>
                    <span className={`text-sm leading-snug ${
                      stepsDone[i] ? "line-through text-gray-500" : "text-gray-200"
                    }`}>
                      {step.emoji} {step.text}
                    </span>
                  </button>
                ))}
              </div>
              {stepsDoneCount === REVIEW_STEPS.length && (
                <div className="mt-3 text-center text-green-400 font-bold text-sm">
                  🎉 週次レビュー完了！お疲れ様でした！
                </div>
              )}
            </div>
          )}
          {loading && (
            <p className="text-gray-500 text-sm text-center py-4">データ読み込み中...</p>
          )}

          {reviewData && (
            <>
              {/* 期間表示 */}
              <p className="text-xs text-gray-500 text-center">
                {reviewData.week.monday} 〜 {reviewData.week.sunday}
              </p>

              {/* 完了率 */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-xs font-semibold text-gray-300">
                    ✅ 今週のTODO完了率
                  </p>
                  <span
                    className={`text-sm font-bold ${
                      reviewData.todos.completion_rate >= 80
                        ? "text-green-400"
                        : reviewData.todos.completion_rate >= 40
                        ? "text-yellow-400"
                        : "text-red-400"
                    }`}
                  >
                    {reviewData.todos.completion_rate}%
                  </span>
                </div>
                <ProgressBar value={reviewData.todos.completion_rate} color={completionColor} />
                <p className="text-xs text-gray-500 mt-1">
                  {reviewData.todos.completed} / {reviewData.todos.total} 件完了
                </p>
              </div>

              {/* カテゴリ別完了数 */}
              <div>
                <p className="text-xs font-semibold text-gray-300 mb-2">
                  📂 カテゴリ別完了数
                </p>
                <div className="space-y-2">
                  {categories.map((cat) => {
                    const stat = reviewData.category_stats[cat];
                    if (!stat || stat.total === 0) return null;
                    const rate =
                      stat.total > 0
                        ? Math.round((stat.completed / stat.total) * 100)
                        : 0;
                    return (
                      <div key={cat}>
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-xs text-gray-400">
                            {CATEGORY_EMOJI[cat]} {CATEGORY_LABEL[cat]}
                          </span>
                          <span className="text-xs text-gray-400">
                            {stat.completed}/{stat.total}
                          </span>
                        </div>
                        <ProgressBar
                          value={rate}
                          color={
                            rate >= 80
                              ? "bg-green-500"
                              : rate >= 40
                              ? "bg-yellow-500"
                              : "bg-red-500"
                          }
                        />
                      </div>
                    );
                  })}
                  {categories.every(
                    (cat) => !reviewData.category_stats[cat] || reviewData.category_stats[cat].total === 0
                  ) && (
                    <p className="text-xs text-gray-500">今週のTODOはありません</p>
                  )}
                </div>
              </div>

              {/* 目標の進捗サマリー */}
              {reviewData.goals.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-300 mb-2">
                    🎯 目標の進捗
                  </p>
                  <div className="space-y-2">
                    {reviewData.goals
                      .filter((g) => g.period_type !== "weekly")
                      .map((g) => (
                        <div
                          key={g.id}
                          className="bg-gray-800 rounded-lg p-2.5 border border-gray-700"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-gray-200 flex-1 truncate">
                              {CATEGORY_EMOJI[g.category]} {g.title}
                            </span>
                            <div className="flex items-center gap-1.5 ml-2 shrink-0">
                              <span className="text-xs text-gray-500">
                                {PERIOD_LABEL[g.period_type] ?? g.period_type}
                              </span>
                              {g.is_achieved && (
                                <span className="text-green-400 text-xs">✓</span>
                              )}
                              <span
                                className={`text-xs font-bold ${
                                  g.progress >= 80
                                    ? "text-green-400"
                                    : g.progress >= 40
                                    ? "text-yellow-400"
                                    : "text-red-400"
                                }`}
                              >
                                {g.progress}%
                              </span>
                            </div>
                          </div>
                          <ProgressBar
                            value={g.progress}
                            color={
                              g.progress >= 80
                                ? "bg-green-500"
                                : g.progress >= 40
                                ? "bg-yellow-500"
                                : "bg-red-500"
                            }
                          />
                          <p className="text-xs text-gray-500 mt-0.5">
                            {g.current_value} / {g.target_value ?? "?"} {g.unit ?? ""}
                          </p>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </>
          )}

          {/* 来週の目標入力 */}
          <div>
            <label className="text-xs font-semibold text-gray-300 mb-1 block">
              📝 来週の目標（任意）
            </label>
            <textarea
              value={nextWeekGoal}
              onChange={(e) => setNextWeekGoal(e.target.value)}
              placeholder="来週に達成したいことを入力..."
              rows={2}
              className="w-full bg-gray-800 text-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 border border-gray-700 resize-none"
            />
          </div>

          {/* AI振り返り生成ボタン */}
          <button
            onClick={handleGenerateAiReview}
            disabled={aiLoading}
            className="w-full py-2.5 bg-purple-900/60 hover:bg-purple-800/60 border border-purple-700/50 text-purple-300 text-sm rounded-lg transition-colors disabled:opacity-50 font-medium"
          >
            {aiLoading ? "🤖 AI振り返りを生成中..." : "🤖 AIに振り返りを生成してもらう"}
          </button>

          {/* AI振り返り表示エリア */}
          {aiReview && (
            <div className="bg-gray-800 border border-purple-800/30 rounded-xl p-4">
              <p className="text-xs font-semibold text-purple-300 mb-2">
                🤖 AI振り返りレポート
              </p>
              <p className="text-xs text-gray-300 leading-relaxed whitespace-pre-wrap">
                {aiReview}
              </p>
            </div>
          )}

          {/* リフレッシュボタン */}
          <button
            onClick={fetchReviewData}
            disabled={loading}
            className="w-full py-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            {loading ? "更新中..." : "↻ データを更新"}
          </button>
        </div>
      )}
    </div>
  );
}
