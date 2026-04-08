"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { DayType, Todo } from "@/types";
import DayTypeSelector from "@/components/DayTypeSelector";
import GoalPanel from "@/components/GoalPanel";
import DailyTimeline from "@/components/DailyTimeline";
import TodoList from "@/components/TodoList";
import WeatherPanel from "@/components/WeatherPanel";
import HowToPanel from "@/components/HowToPanel";
import FocusButton from "@/components/focus/FocusButton";
import FocusTaskSelector from "@/components/focus/FocusTaskSelector";
import WeeklyReviewPanel from "@/components/WeeklyReviewPanel";
import VisionBoard from "@/components/VisionBoard";
import TodayMission from "@/components/TodayMission";
import DailyRoutinePanel from "@/components/DailyRoutinePanel";
import TodoTimer, { ActiveTimer } from "@/components/TodoTimer";
import TimeStatsPanel from "@/components/TimeStatsPanel";
import ShoppingListPanel from "@/components/ShoppingListPanel";
import WeeklyTasksDisplay from "@/components/WeeklyTasksDisplay";

const TIMER_LS_KEY = "spe-active-timer";

function getTodayString(): string {
  return new Date().toISOString().split("T")[0];
}

export default function Home() {
  const [dayType, setDayType] = useState<DayType>("weekday");
  const [date, setDate] = useState(getTodayString());
  const [wakeTime, setWakeTime] = useState("06:30");
  const [currentTab, setCurrentTab] = useState<"todo" | "other">("other");

  // ===== タイマー状態 =====
  const [activeTimer, setActiveTimer] = useState<ActiveTimer | null>(null);

  // ===== シングルフォーカス状態 =====
  const [selectedFocusTask, setSelectedFocusTask] = useState<Todo | null>(null);
  const [showFocusSelector, setShowFocusSelector] = useState(false);

  // LocalStorage から シングルフォーカスタスクを復元
  useEffect(() => {
    try {
      const saved = localStorage.getItem("spe-selected-focus-task");
      if (saved) {
        const task = JSON.parse(saved) as Todo;
        setSelectedFocusTask(task);
      }
    } catch {}

    // focusTaskChanged イベントをリッスン
    const handleFocusChanged = (e: Event) => {
      const event = e as CustomEvent<Todo>;
      setSelectedFocusTask(event.detail);
    };
    window.addEventListener("focusTaskChanged", handleFocusChanged);
    return () => window.removeEventListener("focusTaskChanged", handleFocusChanged);
  }, []);

  // ref: スクロール対象セクション
  const routineRef = useRef<HTMLDivElement>(null);
  const todoRef = useRef<HTMLDivElement>(null);

  // 当日の設定（起床時刻・曜日タイプ）をAPIとlocalStorageから復元
  useEffect(() => {
    const today = getTodayString();
    // まずlocalStorageで即時反映（オフライン対応）
    try {
      const savedWake = localStorage.getItem(`wakeTime-${today}`);
      if (savedWake) setWakeTime(savedWake);
      const savedDayType = localStorage.getItem(`dayType-${today}`) as DayType | null;
      if (savedDayType) setDayType(savedDayType);
      // タイマー復元（当日のものだけ）
      const savedTimer = localStorage.getItem(TIMER_LS_KEY);
      if (savedTimer) {
        const t: ActiveTimer & { date?: string } = JSON.parse(savedTimer);
        if (t.date === today) setActiveTimer(t);
        else localStorage.removeItem(TIMER_LS_KEY);
      }
    } catch {}
    // APIから最新設定を取得してlocalStorageを上書き（デバイス間同期）
    fetch(`/api/settings/daily?date=${today}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.wake_time) {
          setWakeTime(data.wake_time);
          try { localStorage.setItem(`wakeTime-${today}`, data.wake_time); } catch {}
        }
        if (data.day_type) {
          setDayType(data.day_type as DayType);
          try { localStorage.setItem(`dayType-${today}`, data.day_type); } catch {}
        }
      })
      .catch(() => {}); // API失敗時はlocalStorageの値を使い続ける
  }, []);

  // 起床時刻変更 → API + localStorage に保存
  const handleWakeTimeChange = (t: string) => {
    const today = getTodayString();
    setWakeTime(t);
    try { localStorage.setItem(`wakeTime-${today}`, t); } catch {}
    fetch("/api/settings/daily", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: today, wake_time: t }),
    }).catch(() => {});
  };

  // 曜日タイプ変更 → API + localStorage に保存
  const handleDayTypeChange = (t: DayType) => {
    const today = getTodayString();
    setDayType(t);
    try { localStorage.setItem(`dayType-${today}`, t); } catch {}
    fetch("/api/settings/daily", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: today, day_type: t }),
    }).catch(() => {});
  };

  // 時刻に応じて適切なセクションへ自動スクロール
  useEffect(() => {
    const hour = new Date().getHours();
    const scrollTarget = hour < 9 || hour >= 22 ? routineRef : todoRef;
    const timer = setTimeout(() => {
      scrollTarget.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 700);
    return () => clearTimeout(timer);
  }, []);

  // ===== タイマー操作 =====
  const handleStartTimer = useCallback(async (todo: Todo) => {
    const today = getTodayString();
    const startedAt = Date.now();
    // Supabase にセッション作成
    let sessionId: number | null = null;
    try {
      const res = await fetch("/api/timer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          todo_id: todo.id,
          todo_title: todo.title,
          category: todo.category,
          started_at: new Date(startedAt).toISOString(),
          estimated_seconds: todo.estimated_minutes * 60,
        }),
      });
      const data = await res.json();
      sessionId = data.id ?? null;
    } catch {}

    const timer: ActiveTimer & { date: string } = {
      sessionId,
      todoId: todo.id,
      todoTitle: todo.title,
      category: todo.category,
      estimatedMinutes: todo.estimated_minutes,
      startedAt,
      date: today,
    };
    setActiveTimer(timer);
    try { localStorage.setItem(TIMER_LS_KEY, JSON.stringify(timer)); } catch {}
  }, []);

  const handleStopTimer = useCallback(async (durationSeconds: number, completed: boolean) => {
    if (!activeTimer) return;
    // ① タイムセッションを記録
    if (activeTimer.sessionId) {
      try {
        await fetch("/api/timer", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: activeTimer.sessionId,
            ended_at: new Date().toISOString(),
            duration_seconds: durationSeconds,
            completed,
          }),
        });
      } catch {}
    }
    // ② 完了ボタンの場合はTODOも完了にする
    if (completed && activeTimer.todoId) {
      try {
        await fetch(`/api/todos/${activeTimer.todoId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_completed: true }),
        });
      } catch {}
    }
    setActiveTimer(null);
    try { localStorage.removeItem(TIMER_LS_KEY); } catch {}
  }, [activeTimer]);

  const isReviewDay = new Date().getDay() === 0; // 日曜日

  return (
    <main className="min-h-screen bg-gray-950">
      {/* ヘッダー */}
      <header className="sticky top-0 z-50 bg-gray-950/90 backdrop-blur-sm border-b border-gray-800 px-4 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight">
              ⚡ Routine OS
            </h1>
            <p className="text-xs text-gray-500">スケジュール・ルーティン管理</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400">{date}</p>
            <p className="text-xs text-gray-500 flex items-center gap-1 justify-end">
              {dayType === "weekday" ? "平日" : dayType === "overtime" ? "残業" : "休日"}
              {isReviewDay && <span className="text-purple-400 font-bold ml-1">📊週次レビューの日</span>}
            </p>
          </div>
        </div>
      </header>

      {/* メインコンテンツ */}
      <div className="max-w-7xl mx-auto px-4 py-4 space-y-4 pb-20">

        {/* タブナビゲーション - 最上部 */}
        <div className="flex gap-2 border-b border-gray-700 mb-6">
          <button
            onClick={() => setCurrentTab("todo")}
            className={`px-4 py-2 font-semibold transition-colors ${
              currentTab === "todo"
                ? "text-blue-400 border-b-2 border-blue-400"
                : "text-gray-400 hover:text-gray-300"
            }`}
          >
            📝 TODO & 集中
          </button>
          <button
            onClick={() => setCurrentTab("other")}
            className={`px-4 py-2 font-semibold transition-colors ${
              currentTab === "other"
                ? "text-blue-400 border-b-2 border-blue-400"
                : "text-gray-400 hover:text-gray-300"
            }`}
          >
            🎯 目標 & その他
          </button>
        </div>


        {/* アクティブタイマー（実行中のみ表示） */}
        {activeTimer && (
          <TodoTimer
            timer={activeTimer}
            onComplete={(sec) => handleStopTimer(sec, true)}
            onStop={(sec) => handleStopTimer(sec, false)}
          />
        )}

        {/* ===== TODO & 集中 タブ ===== */}
        {currentTab === "todo" && (
          <>
            {/* 深く集中する - 独立セクション */}
            <div className="bg-gray-900 border border-gray-700 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-gray-800">
            <div className="flex items-center gap-3">
              <span className="text-2xl">⏱</span>
              <div className="flex-1">
                <p className="text-gray-200 font-semibold">深く集中する</p>
                <p className="text-xs text-gray-500">集中モードで不要な干渉を排除</p>
              </div>
              <Link href="/focus" title="集中モード">
                <FocusButton onClick={() => {}} />
              </Link>
            </div>
          </div>

          {/* シングルフォーカスセクション */}
          <div className="px-4 py-3">
            <button
              onClick={() => setShowFocusSelector(!showFocusSelector)}
              className="w-full text-left text-xs text-gray-400 hover:text-gray-300 transition-colors py-2"
            >
              {showFocusSelector ? "▲ シングルフォーカス" : "▼ シングルフォーカスを設定"}
            </button>

            {showFocusSelector && (
              <div className="mt-2">
                <FocusTaskSelector
                  onTaskSelect={setSelectedFocusTask}
                  selectedTask={selectedFocusTask}
                />
              </div>
            )}

            {selectedFocusTask && !showFocusSelector && (
              <div className="bg-red-600/20 border border-red-500/50 rounded-lg p-2.5 mt-2">
                <p className="text-xs text-red-300 mb-1">🎯 フォーカス対象</p>
                <p className="text-sm font-semibold text-red-100 truncate">
                  {selectedFocusTask.title}
                </p>
                <button
                  onClick={() => setShowFocusSelector(true)}
                  className="text-xs text-red-200/70 hover:text-red-200 mt-1 underline"
                >
                  変更
                </button>
              </div>
            )}
          </div>
            </div>

            {/* TODO リスト */}
            <div ref={todoRef}>
              <TodoList selectedFocusTask={selectedFocusTask} />
            </div>

            {/* 週間タスク表示 */}
            <div className="mt-6">
              <WeeklyTasksDisplay />
            </div>
          </>
        )}

        {/* ===== 目標 & その他 タブ ===== */}
        {currentTab === "other" && (
          <>
            {/* ビジョンボード */}
            <VisionBoard />

            {/* DayTypeSelector + 起床時刻 */}
            <DayTypeSelector
              value={dayType}
              onChange={handleDayTypeChange}
              date={date}
              onDateChange={setDate}
              wakeTime={wakeTime}
              onWakeTimeChange={handleWakeTimeChange}
            />

            {/* 日曜日：週次レビューを最上部に強調表示 */}
            {isReviewDay && <WeeklyReviewPanel featured={true} />}

            {/* Today's Mission */}
            <TodayMission
              onStartTimer={handleStartTimer}
              activeTimerTodoId={activeTimer?.todoId ?? null}
            />

            {/* デイリールーティン */}
            <div ref={routineRef}>
              <DailyRoutinePanel wakeTime={wakeTime} dayType={dayType} />
            </div>

            {/* GoalPanel */}
            <GoalPanel />

            {/* ShoppingListPanel */}
            <ShoppingListPanel />

            {/* WeeklyReviewPanel */}
            {!isReviewDay && <WeeklyReviewPanel />}

            {/* 時間記録・統計 */}
            <TimeStatsPanel />

            {/* 使い方ガイド */}
            <HowToPanel />

            {/* 天気 */}
            <WeatherPanel city="Tokyo" />
          </>
        )}
      </div>
    </main>
  );
}
