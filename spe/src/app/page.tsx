"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { DayType, Todo } from "@/types";
import DayTypeSelector from "@/components/DayTypeSelector";
import GoalPanel from "@/components/GoalPanel";
import DailyTimeline from "@/components/DailyTimeline";
import TodoList from "@/components/TodoList";
import WeatherPanel from "@/components/WeatherPanel";
import NotifyPanel from "@/components/NotifyPanel";
import HowToPanel from "@/components/HowToPanel";
import WeeklyReviewPanel from "@/components/WeeklyReviewPanel";
import VisionBoard from "@/components/VisionBoard";
import TodayMission from "@/components/TodayMission";
import DailyRoutinePanel from "@/components/DailyRoutinePanel";
import TodoTimer, { ActiveTimer } from "@/components/TodoTimer";
import TimeStatsPanel from "@/components/TimeStatsPanel";

const TIMER_LS_KEY = "spe-active-timer";

function getTodayString(): string {
  return new Date().toISOString().split("T")[0];
}

export default function Home() {
  const [dayType, setDayType] = useState<DayType>("weekday");
  const [date, setDate] = useState(getTodayString());
  const [wakeTime, setWakeTime] = useState("06:30");

  // ===== タイマー状態 =====
  const [activeTimer, setActiveTimer] = useState<ActiveTimer | null>(null);

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

        {/* 日曜日：週次レビューを最上部に強調表示 */}
        {isReviewDay && <WeeklyReviewPanel featured={true} />}

        {/* ビジョンボード */}
        <VisionBoard />

        {/* 使い方ガイド */}
        <HowToPanel />

        {/* DayTypeSelector + 起床時刻 */}
        <DayTypeSelector
          value={dayType}
          onChange={handleDayTypeChange}
          date={date}
          onDateChange={setDate}
          wakeTime={wakeTime}
          onWakeTimeChange={handleWakeTimeChange}
        />

        {/* アクティブタイマー（実行中のみ表示） */}
        {activeTimer && (
          <TodoTimer
            timer={activeTimer}
            onComplete={(sec) => handleStopTimer(sec, true)}
            onStop={(sec) => handleStopTimer(sec, false)}
          />
        )}

        {/* Today's Mission */}
        <TodayMission
          onStartTimer={handleStartTimer}
          activeTimerTodoId={activeTimer?.todoId ?? null}
        />

        {/* デイリールーティン ← スクロール対象（朝・夜） */}
        <div ref={routineRef}>
          <DailyRoutinePanel wakeTime={wakeTime} dayType={dayType} />
        </div>

        {/* GoalPanel */}
        <GoalPanel />

        {/* WeeklyReviewPanel（日曜以外は通常位置） */}
        {!isReviewDay && <WeeklyReviewPanel />}

        {/* TODO + タイムライン ← スクロール対象（日中） */}
        <div ref={todoRef} className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <TodoList
            onStartTimer={handleStartTimer}
            activeTimerTodoId={activeTimer?.todoId ?? null}
          />
          <DailyTimeline date={date} dayType={dayType} wakeTime={wakeTime} />
        </div>

        {/* 時間記録・統計 */}
        <TimeStatsPanel />

        {/* 天気 + 通知設定 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <WeatherPanel city="Tokyo" />
          <NotifyPanel />
        </div>
      </div>
    </main>
  );
}
