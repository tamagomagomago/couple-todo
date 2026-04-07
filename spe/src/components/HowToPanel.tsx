"use client";

import { useState } from "react";

const STEPS = [
  {
    emoji: "1️⃣",
    title: "今日のTODOを設定",
    desc: "マスターリストから「今日へ」で今日リストに移すか、「+今日のタスク追加」で直接入力。優先度と期限を設定。",
  },
  {
    emoji: "2️⃣",
    title: "時間順に実行",
    desc: "「タイムライン」を確認して、スケジュール順にタスクをこなす。完了時は完了チェックをタップ。",
  },
  {
    emoji: "3️⃣",
    title: "集中が必要な時は",
    desc: "「深く集中する」セクションから集中モードへ。シングルフォーカスでやることに集中。",
  },
];

export default function HowToPanel() {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">📖</span>
          <span className="font-semibold text-gray-200">使い方ガイド</span>
          <span className="text-xs text-gray-500">忘れたら開く</span>
        </div>
        <span className="text-gray-500 text-xs">{expanded ? "▲" : "▼"}</span>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 border-t border-gray-800 pt-3">
          <div className="space-y-2">
            {STEPS.map((step) => (
              <div key={step.emoji} className="flex gap-3 items-start">
                <span className="text-base shrink-0">{step.emoji}</span>
                <div>
                  <p className="text-sm font-semibold text-gray-200">{step.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
