"use client";

import { useState } from "react";

const APP_URL = "https://spe-daily-schedule.vercel.app";
const CRON_SECRET = "spe-cron-2026"; // 環境変数と一致させること

interface CronJob {
  label: string;
  desc: string;
  url: string;
  interval: string;
  emoji: string;
}

const CRON_JOBS: CronJob[] = [
  {
    emoji: "⚡",
    label: "朝のミッション通知",
    desc: "毎朝06:30にTOP3タスクを通知",
    url: `${APP_URL}/api/daily-setup?secret=${CRON_SECRET}`,
    interval: "毎日 06:30",
  },
  {
    emoji: "🔔",
    label: "タイムライン通知（平日）",
    desc: "5分おきにルーティン・ディープワーク・夜のワーク開始を通知",
    url: `${APP_URL}/api/cron/notify?secret=${CRON_SECRET}`,
    interval: "5分おき",
  },
  {
    emoji: "🏖",
    label: "タイムライン通知（休日）",
    desc: "5分おき・休日スケジュール用",
    url: `${APP_URL}/api/cron/notify?secret=${CRON_SECRET}&day_type=holiday`,
    interval: "5分おき（休日のみ有効化）",
  },
  {
    emoji: "🌙",
    label: "タイムライン通知（残業日）",
    desc: "残業の日は別クロンを有効化",
    url: `${APP_URL}/api/cron/notify?secret=${CRON_SECRET}&day_type=overtime`,
    interval: "5分おき（残業日のみ有効化）",
  },
];

const NOTIFICATION_SCHEDULE = [
  { time: "06:30", label: "⭐ 朝のミッション通知（TOP3タスク）", type: "morning" },
  { time: "06:30", label: "起床・水1杯・朝日", type: "routine" },
  { time: "06:35", label: "プランク＋ダンベル", type: "routine" },
  { time: "06:40", label: "プロテイン・食事", type: "routine" },
  { time: "06:50", label: "⚡ ディープワーク開始", type: "deep_work" },
  { time: "08:20", label: "身支度", type: "routine" },
  { time: "20:00", label: "夜のワーク開始", type: "task" },
  { time: "21:50", label: "入浴", type: "routine" },
  { time: "22:10", label: "ストレッチ", type: "routine" },
  { time: "22:25", label: "🌙 翌日TODO確認 + 完了率レビュー", type: "review" },
];

const TYPE_COLOR: Record<string, string> = {
  routine:   "text-blue-300",
  deep_work: "text-amber-300",
  task:      "text-indigo-300",
  morning:   "text-yellow-300",
  review:    "text-purple-300",
};

export default function NotifyPanel() {
  const [expanded, setExpanded] = useState(false);
  const [testLoading, setTestLoading] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const handleCopy = (url: string, label: string) => {
    navigator.clipboard.writeText(url);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleTest = async () => {
    setTestLoading(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/notify/test", { method: "POST" });
      const d = await res.json();
      setTestResult(d.ok ? "✅ テスト通知を送信しました" : `❌ ${d.error}`);
    } catch {
      setTestResult("❌ エラー");
    } finally {
      setTestLoading(false);
      setTimeout(() => setTestResult(null), 4000);
    }
  };

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">🔔</span>
          <span className="font-semibold text-gray-200">通知設定（Pushover）</span>
          <span className="text-xs bg-green-900/50 text-green-400 border border-green-800/50 px-1.5 py-0.5 rounded-full">
            科学的通知
          </span>
        </div>
        <span className="text-gray-500 text-xs">{expanded ? "▲" : "▼"}</span>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-gray-800 pt-3">

          {/* 今日の通知スケジュール */}
          <div>
            <p className="text-xs font-semibold text-gray-300 mb-2">📅 今日の通知スケジュール（平日）</p>
            <div className="space-y-1">
              {NOTIFICATION_SCHEDULE.map((item) => (
                <div key={item.time} className="flex items-center gap-2">
                  <span className="text-xs font-mono text-gray-500 w-12 shrink-0">{item.time}</span>
                  <span className={`text-xs ${TYPE_COLOR[item.type] ?? "text-gray-400"}`}>
                    {item.label}
                  </span>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-600 mt-1">※ If-Then形式で通知。通知タップ → SPEに直接遷移</p>
          </div>

          {/* cron-job.org 設定 */}
          <div>
            <p className="text-xs font-semibold text-gray-300 mb-1">
              ⚙ cron-job.org 設定
              <a
                href="https://cron-job.org"
                target="_blank"
                rel="noopener noreferrer"
                className="ml-2 text-blue-400 underline font-normal"
              >
                → cron-job.org を開く（無料）
              </a>
            </p>
            <p className="text-xs text-gray-500 mb-2">
              cron-job.orgは「指定したURLを定期的に自動で叩いてくれる無料サービス」です。
              これが通知のトリガーになります。以下のURLをcron-job.orgに登録してください。
            </p>

            <div className="space-y-2">
              {CRON_JOBS.map((job) => (
                <div key={job.label} className="bg-gray-800/50 rounded-lg p-2.5 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-300">
                      {job.emoji} {job.label}
                    </span>
                    <span className="text-xs text-gray-500">{job.interval}</span>
                  </div>
                  <p className="text-xs text-gray-500">{job.desc}</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-xs bg-gray-900 text-green-400 px-2 py-1 rounded font-mono break-all">
                      {job.url}
                    </code>
                    <button
                      onClick={() => handleCopy(job.url, job.label)}
                      className="shrink-0 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 px-2 py-1 rounded transition-colors"
                    >
                      {copied === job.label ? "✓" : "コピー"}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-2 bg-amber-950/20 border border-amber-900/30 rounded-lg p-2.5">
              <p className="text-xs font-semibold text-amber-300 mb-1">💡 残業日・休日の切り替え方</p>
              <p className="text-xs text-gray-400">
                曜日（土日）は自動で休日判定されます。残業の日だけ
                cron-job.orgで「残業日クロン」を有効化し、「平日クロン」を一時停止してください。
                翌日には元に戻します。
              </p>
            </div>
          </div>

          {/* テスト通知 */}
          <div className="flex gap-2 items-center">
            <button
              onClick={handleTest}
              disabled={testLoading}
              className="flex-1 py-2 bg-purple-900/60 hover:bg-purple-800/60 border border-purple-700/50 text-purple-300 text-sm rounded-lg transition-colors disabled:opacity-50"
            >
              {testLoading ? "送信中..." : "🔔 テスト通知を送る"}
            </button>
          </div>
          {testResult && (
            <p className="text-xs text-center text-gray-300">{testResult}</p>
          )}
        </div>
      )}
    </div>
  );
}
