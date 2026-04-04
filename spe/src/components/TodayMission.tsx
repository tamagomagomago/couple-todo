"use client";

import { useEffect, useState, useCallback } from "react";
import { Todo } from "@/types";
import { ActiveTimer } from "@/components/TodoTimer";

const CATEGORY_ORDER: Record<string, number> = {
  vfx: 1, english: 2, investment: 3, personal: 4, fitness: 5,
};

const CATEGORY_EMOJI: Record<string, string> = {
  vfx: "🎬", english: "🗣️", investment: "💰", fitness: "💪",
  personal: "⭐", engineer: "📐",
};

const CATEGORY_COLOR: Record<string, string> = {
  vfx:        "bg-purple-900/50 text-purple-300 border-purple-700/50",
  english:    "bg-blue-900/50 text-blue-300 border-blue-700/50",
  investment: "bg-green-900/50 text-green-300 border-green-700/50",
  fitness:    "bg-orange-900/50 text-orange-300 border-orange-700/50",
  engineer:   "bg-teal-900/50 text-teal-300 border-teal-700/50",
  personal:   "bg-gray-700/50 text-gray-300 border-gray-600/50",
};

function pickMission(todos: Todo[]): Todo | null {
  return todos
    .filter((t) => t.is_today && !t.is_completed)
    .sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return (CATEGORY_ORDER[a.category] ?? 6) - (CATEGORY_ORDER[b.category] ?? 6);
    })[0] ?? null;
}

function pickTop3(todos: Todo[]): Todo[] {
  return todos
    .filter((t) => t.is_today && !t.is_completed)
    .sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return (CATEGORY_ORDER[a.category] ?? 6) - (CATEGORY_ORDER[b.category] ?? 6);
    })
    .slice(0, 3);
}

export default function TodayMission({
  onCompleted,
  onStartTimer,
  activeTimerTodoId,
}: {
  onCompleted?: () => void;
  onStartTimer?: (todo: Todo) => void;
  activeTimerTodoId?: number | null;
}) {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState<number | null>(null);

  const fetchTodos = useCallback(async () => {
    try {
      const res = await fetch("/api/todos?is_today=true");
      const data = await res.json();
      if (Array.isArray(data)) setTodos(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTodos(); }, [fetchTodos]);

  const handleComplete = async (todo: Todo) => {
    setCompleting(todo.id);
    try {
      await fetch(`/api/todos/${todo.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_completed: true }),
      });
      await fetchTodos();
      onCompleted?.();
    } finally {
      setCompleting(null);
    }
  };

  if (loading) return null;

  const mission = pickMission(todos);
  const top3 = pickTop3(todos);
  const todayTotal = todos.length;
  // 今日の日付に completed_at があるものだけ「今日の完了」としてカウント
  const todayStr = new Date().toISOString().split("T")[0];
  const todayDone = todos.filter(
    (t) => t.is_completed && t.completed_at?.startsWith(todayStr)
  ).length;
  const completionRate = todayTotal > 0 ? Math.round((todayDone / todayTotal) * 100) : 0;

  if (!mission && todayTotal === 0) {
    return (
      <div className="bg-gray-900 border border-dashed border-gray-700 rounded-xl px-4 py-5 text-center">
        <p className="text-gray-500 text-sm">📋 今日のTODOをマスターリストから追加してください</p>
      </div>
    );
  }

  if (!mission && todayDone > 0) {
    return (
      <div className="bg-green-950/40 border border-green-700/50 rounded-xl px-4 py-5 text-center">
        <p className="text-green-400 text-lg font-bold">🎉 今日のTODO完了！</p>
        <p className="text-green-300 text-sm mt-1">{todayDone}件 すべて完了</p>
      </div>
    );
  }

  const catColor = CATEGORY_COLOR[mission!.category] ?? CATEGORY_COLOR.personal;
  const catEmoji = CATEGORY_EMOJI[mission!.category] ?? "⭐";
  const isRunning = activeTimerTodoId === mission!.id;

  return (
    <div className="bg-gradient-to-br from-blue-950/80 via-gray-900 to-gray-900 border border-blue-700/40 rounded-xl overflow-hidden">
      {/* 進捗バー */}
      <div className="h-1 bg-gray-800">
        <div
          className="h-full bg-blue-500 transition-all duration-500"
          style={{ width: `${completionRate}%` }}
        />
      </div>

      <div className="px-4 pt-3 pb-1 flex items-center justify-between">
        <span className="text-xs font-bold text-blue-400 uppercase tracking-widest">
          ⚡ TODAY'S MISSION
        </span>
        <span className="text-xs text-gray-500">
          {todayDone}/{todayTotal}完了
          {completionRate > 0 && <span className="ml-1 text-blue-400">{completionRate}%</span>}
        </span>
      </div>

      {/* メインミッション */}
      <div className="px-4 pb-3">
        <div className="flex items-start gap-3 mt-1.5">
          <div className="flex-1 min-w-0">
            <p className="text-white text-xl font-bold leading-tight break-words">
              {catEmoji} {mission!.title}
            </p>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <span className={`text-xs px-2 py-0.5 rounded-full border ${catColor}`}>
                {mission!.category}
              </span>
              <span className="text-xs text-gray-400">⏱ {mission!.estimated_minutes}分</span>
              {mission!.priority === 1 && (
                <span className="text-xs text-red-400 font-semibold">🔴 最優先</span>
              )}
            </div>
          </div>

          {/* アクションボタン群 */}
          <div className="flex flex-col gap-1.5 shrink-0">
            {/* タイマー開始 or 実行中表示 */}
            {onStartTimer && (
              <button
                onClick={() => !isRunning && onStartTimer(mission!)}
                disabled={isRunning || !!activeTimerTodoId}
                className={`px-3 py-2 text-xs font-bold rounded-lg transition-colors ${
                  isRunning
                    ? "bg-blue-700/50 text-blue-300 cursor-default"
                    : activeTimerTodoId
                    ? "bg-gray-700 text-gray-500 cursor-not-allowed"
                    : "bg-blue-700 hover:bg-blue-600 text-white"
                }`}
              >
                {isRunning ? "⏱ 計測中" : "▶ 開始"}
              </button>
            )}
            <button
              onClick={() => handleComplete(mission!)}
              disabled={completing === mission!.id}
              className="px-3 py-2 bg-green-700 hover:bg-green-600 active:bg-green-800 text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-50"
            >
              {completing === mission!.id ? "..." : "✓ 完了"}
            </button>
          </div>
        </div>
      </div>

      {/* TOP3リスト（2件目以降） */}
      {top3.length > 1 && (
        <div className="border-t border-gray-800 px-4 py-2 space-y-1.5">
          {top3.slice(1).map((todo) => {
            const isThisRunning = activeTimerTodoId === todo.id;
            return (
              <div key={todo.id} className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-gray-600 text-xs shrink-0">
                    {todo.priority === 1 ? "🔴" : todo.priority <= 2 ? "🟡" : "🟢"}
                  </span>
                  <span className="text-gray-300 text-xs break-words">{todo.title}</span>
                  <span className="text-gray-600 text-xs shrink-0">{todo.estimated_minutes}分</span>
                </div>
                <div className="flex gap-1 shrink-0">
                  {onStartTimer && !activeTimerTodoId && (
                    <button
                      onClick={() => onStartTimer(todo)}
                      className="text-xs text-blue-500 hover:text-blue-300 px-1.5 py-0.5 rounded transition-colors"
                    >
                      ▶
                    </button>
                  )}
                  {isThisRunning && (
                    <span className="text-xs text-blue-400">⏱</span>
                  )}
                  <button
                    onClick={() => handleComplete(todo)}
                    disabled={completing === todo.id}
                    className="text-xs text-gray-500 hover:text-green-400 transition-colors px-1.5 py-0.5 rounded disabled:opacity-50"
                  >
                    {completing === todo.id ? "..." : "✓"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
