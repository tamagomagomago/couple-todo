"use client";

import { useState, useEffect } from "react";
import { DayType } from "@/types";

// 曜日別朝トレ（0=日〜6=土）
const MORNING_EXERCISE: Record<number, string> = {
  1: "プランク＋サイドレイズ 3セット",
  2: "プランク＋ハンマーカール 3セット",
  3: "プランク＋サイドレイズ 3セット",
  4: "プランク＋ダンベルカール 3セット",
  5: "プランク＋リストカール 3セット",
  6: "プランク＋サイドレイズ 3セット",
  0: "プランク＋サイドレイズ 3セット",
};

interface RoutineItem {
  time: string;
  title: string;
}

function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + minutes;
  return `${String(Math.floor(total / 60) % 24).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function getMorningRoutine(wakeTime: string, dayType: DayType): RoutineItem[] {
  const exercise = MORNING_EXERCISE[new Date().getDay()];
  const t0 = wakeTime;
  const t1 = addMinutes(t0, 5);   // プロテイン開始（起床5分後）
  const t2 = addMinutes(t0, 10);  // ダンベルトレ開始（プロテイン5分）
  const t3 = addMinutes(t0, 30);  // 朝ごはん開始（トレ20分）
  const t4 = addMinutes(t0, 45);  // ディープワーク開始（朝ごはん15分）
  // 平日・残業は08:30まで深作業、休日は12:00まで
  const deepEnd = dayType === "holiday" ? "12:00" : "08:30";

  const items: RoutineItem[] = [
    { time: `${t0}〜${t1}`, title: "起床・水1杯・朝日を浴びる" },
    { time: `${t1}〜${t2}`, title: "🥛 プロテイン" },
    { time: `${t2}〜${t3}`, title: `💪 ダンベルトレ — ${exercise}` },
    { time: `${t3}〜${t4}`, title: "🍳 朝ごはん・エビオス・身支度準備完了" },
    { time: `${t4}〜${deepEnd}`, title: "⚡ ディープワーク（出勤前集中時間）" },
  ];
  // 平日・残業のみ通勤ブロックを追加
  if (dayType !== "holiday") {
    items.push(
      { time: "08:30〜09:10", title: "🚃 通勤中 — 今日の筋トレメニュー確認（重さ・セット決め）＋集中アプリ記録＋技術士勉強（〜7月）" },
    );
  }
  return items;
}

const EVENING_ROUTINE: RoutineItem[] = [
  { time: "19:00〜19:30", title: "🚃 帰宅中 — 集中アプリ記録＋技術士勉強（〜7月）" },
  { time: "19:30〜21:50", title: "単純作業（メール・SNS・軽タスク）" },
  { time: "21:50〜22:00", title: "翌日TODO確認・プロテイン＋マルデキ" },
  { time: "22:00〜22:20", title: "🚿 シャワー（20分）" },
  { time: "22:20〜22:55", title: "📚 技術士の勉強" },
  { time: "22:55〜23:00", title: "胸・首ストレッチ" },
  { time: "23:00〜", title: "就寝" },
];

function RoutineSection({
  emoji,
  title,
  items,
  borderColor,
  bgColor,
  textColor,
  storageKey,
  defaultOpen = false,
}: {
  emoji: string;
  title: string;
  items: RoutineItem[];
  borderColor: string;
  bgColor: string;
  textColor: string;
  storageKey: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [checked, setChecked] = useState<Record<number, boolean>>({});

  const today = new Date().toISOString().split("T")[0];
  const lsKey = `${storageKey}-${today}`;

  useEffect(() => {
    try {
      const saved = localStorage.getItem(lsKey);
      if (saved) setChecked(JSON.parse(saved));
    } catch {}
  }, [lsKey]);

  const toggleCheck = (i: number) => {
    const updated = { ...checked, [i]: !checked[i] };
    setChecked(updated);
    try { localStorage.setItem(lsKey, JSON.stringify(updated)); } catch {}
  };

  const doneCount = items.filter((_, i) => checked[i]).length;
  const allDone = doneCount === items.length;

  return (
    <div className={`border rounded-lg overflow-hidden ${borderColor} ${bgColor}`}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2.5 text-left"
      >
        <div className="flex items-center gap-2">
          <span>{emoji}</span>
          <span className={`font-semibold text-sm ${textColor}`}>{title}</span>
          {allDone && (
            <span className="text-xs text-green-400 font-medium">✓ 完了</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">
            {doneCount}/{items.length}
          </span>
          <div className="w-12 h-1 bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 transition-all duration-300"
              style={{ width: `${(doneCount / items.length) * 100}%` }}
            />
          </div>
          <span className="text-gray-500 text-xs">{open ? "▲" : "▼"}</span>
        </div>
      </button>

      {open && (
        <div className="border-t border-gray-700/40">
          {items.map((item, i) => (
            <div
              key={i}
              className={`flex items-start gap-3 px-3 py-2 transition-colors ${
                i > 0 ? "border-t border-gray-800/60" : ""
              } ${checked[i] ? "opacity-50" : ""}`}
            >
              <button
                onClick={() => toggleCheck(i)}
                className={`mt-0.5 w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center transition-colors ${
                  checked[i]
                    ? "border-green-500 bg-green-500"
                    : "border-gray-600 hover:border-green-400"
                }`}
              >
                {checked[i] && (
                  <span className="text-white text-[10px] leading-none">✓</span>
                )}
              </button>
              <div className="flex-1 min-w-0">
                <span className="text-[11px] font-mono text-gray-500">
                  {item.time}
                </span>
                <p
                  className={`text-sm leading-snug mt-0.5 ${
                    checked[i] ? "line-through text-gray-500" : "text-gray-200"
                  }`}
                >
                  {item.title}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function DailyRoutinePanel({
  wakeTime = "06:30",
  dayType = "weekday",
}: {
  wakeTime?: string;
  dayType?: DayType;
}) {
  const morningItems = getMorningRoutine(wakeTime, dayType);
  const dayNames = ["日", "月", "火", "水", "木", "金", "土"];
  const dayName = dayNames[new Date().getDay()];
  const hour = new Date().getHours();
  const isMorning = hour < 12;

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <span className="text-lg">🔄</span>
          <span className="font-semibold text-gray-200">デイリールーティン</span>
          <span className="text-xs text-gray-500 bg-gray-800 px-1.5 py-0.5 rounded">
            {dayName}曜日
          </span>
        </div>
      </div>
      <div className="p-3 space-y-2">
        <RoutineSection
          emoji="🌅"
          title="朝のルーティン"
          items={morningItems}
          borderColor="border-amber-900/50"
          bgColor="bg-amber-950/10"
          textColor="text-amber-300"
          storageKey="morning-routine"
          defaultOpen={isMorning}
        />
        <RoutineSection
          emoji="🌙"
          title="夜のルーティン"
          items={EVENING_ROUTINE}
          borderColor="border-indigo-900/50"
          bgColor="bg-indigo-950/10"
          textColor="text-indigo-300"
          storageKey="evening-routine"
          defaultOpen={!isMorning && hour >= 21}
        />
      </div>
    </div>
  );
}
