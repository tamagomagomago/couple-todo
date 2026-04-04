"use client";

import { DayType } from "@/types";

interface Props {
  value: DayType;
  onChange: (v: DayType) => void;
  date: string;
  onDateChange: (d: string) => void;
  wakeTime: string;
  onWakeTimeChange: (t: string) => void;
}

const TYPES: { value: DayType; label: string; emoji: string }[] = [
  { value: "weekday",  label: "平日",  emoji: "💼" },
  { value: "overtime", label: "残業",  emoji: "🌙" },
  { value: "holiday",  label: "休日",  emoji: "🌴" },
];

const WAKE_PRESETS = ["05:30", "06:00", "06:30", "07:00", "07:30", "08:00"];

export default function DayTypeSelector({
  value, onChange, date, onDateChange, wakeTime, onWakeTimeChange,
}: Props) {
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-4 space-y-3">
      {/* 日付 + 曜日タイプ */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">TODAY</h2>
        <input
          type="date"
          value={date}
          onChange={(e) => onDateChange(e.target.value)}
          className="bg-gray-800 text-gray-200 text-sm rounded-lg px-3 py-1.5 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="grid grid-cols-3 gap-2">
        {TYPES.map((t) => (
          <button
            key={t.value}
            onClick={() => onChange(t.value)}
            className={`flex flex-col items-center justify-center py-3 rounded-xl border transition-all ${
              value === t.value
                ? "border-blue-500 bg-blue-900/40 text-blue-300"
                : "border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-500"
            }`}
          >
            <span className="text-xl mb-1">{t.emoji}</span>
            <span className="text-sm font-medium">{t.label}</span>
          </button>
        ))}
      </div>

      {/* 起床時刻 */}
      <div className="flex items-center gap-3 pt-1 border-t border-gray-800">
        <span className="text-xs text-gray-400 shrink-0">🌅 起床時刻</span>
        <div className="flex gap-1.5 flex-wrap flex-1">
          {WAKE_PRESETS.map((t) => (
            <button
              key={t}
              onClick={() => onWakeTimeChange(t)}
              className={`text-xs px-2.5 py-1 rounded-lg border transition-all ${
                wakeTime === t
                  ? "border-amber-500 bg-amber-900/40 text-amber-300"
                  : "border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-500"
              }`}
            >
              {t}
            </button>
          ))}
          {/* カスタム時刻入力 */}
          <input
            type="time"
            value={wakeTime}
            onChange={(e) => onWakeTimeChange(e.target.value)}
            className="text-xs bg-gray-800 text-gray-200 rounded-lg px-2 py-1 border border-gray-600 focus:outline-none focus:ring-1 focus:ring-amber-500 w-24"
          />
        </div>
      </div>
    </div>
  );
}
