"use client";

import { useState } from "react";

const STEPS = [
  {
    emoji: "1️⃣",
    title: "今日のタイプを選ぶ",
    desc: "「平日 / 残業 / 休日」を選ぶと、スケジュールと通知が自動で切り替わる。土日は自動で休日判定。",
  },
  {
    emoji: "2️⃣",
    title: "今日のTODOを設定",
    desc: "マスターリストにTODOを追加 or「AIで生成」ボタンで目標を入力してTODOを自動生成。「今日へ」で今日リストに移す。",
  },
  {
    emoji: "3️⃣",
    title: "タイムラインで確認",
    desc: "TODOが優先度順に自動配置される。「🤖 AIで計画」でやりたいことを入力するとClaudeがブロックを組み直してくれる。",
  },
  {
    emoji: "4️⃣",
    title: "Pushover通知で動く",
    desc: "cron-job.orgが5分おきにサーバーを確認。ブロック開始5分前にIf-Then形式で通知が来る。朝6:30にTOP3ミッション通知。",
  },
  {
    emoji: "5️⃣",
    title: "目標をOKRで管理",
    desc: "年間目標 → 月次 → 週次の3階層で管理。年間目標の「🤖 AI分解」ボタンで月次・週次・TODOに自動ブレイクダウン。",
  },
  {
    emoji: "6️⃣",
    title: "週次レビュー",
    desc: "週次レビューパネルで今週の完了率・カテゴリ別進捗を確認。「AIに振り返りを生成」でClaudeが来週のアドバイスを出す。",
  },
];

const PANELS = [
  { key: "🎯 ビジョンボード", desc: "ページ最上部に全体ビジョン画像を貼れる。タップして画像をアップロード。" },
  { key: "🌤 天気・服装", desc: "今日の気温・体感温度と服装提案。毎朝確認して着替えに活かす。" },
  { key: "🔔 通知設定", desc: "cron-job.orgに登録するURLを確認・コピー。残業日のみ手動切替が必要。" },
  { key: "🤖 AIアドバイス", desc: "目標進捗データ＋プロフィールを読み込んで厳しめコンサル。ボタンを押した時だけ生成。" },
  { key: "📊 週次レビュー", desc: "今週の完了率・カテゴリ別集計・目標進捗サマリー。AIによる振り返りも生成可。" },
  { key: "🎯 目標管理（OKR）", desc: "年間→月次→週次の階層表示。各目標に📝メモを追加できる。AI分解で一気に下位目標を生成。" },
  { key: "📅 タイムライン ✏", desc: "ブロックをタップして詳細確認。タスクブロックはホバーで内容メモを入力できる。" },
  { key: "📋 TODO管理", desc: "マスターリスト（全TODO）と今日リストの2カラム。完了するとプログレスバーが進む。" },
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
        <div className="px-4 pb-4 space-y-4 border-t border-gray-800 pt-3">

          {/* 基本の流れ */}
          <div>
            <p className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">基本の流れ</p>
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

          {/* 各パネルの機能 */}
          <div>
            <p className="text-xs font-semibold text-gray-400 mb-2 uppercase tracking-wide">各パネルの機能</p>
            <div className="space-y-1.5">
              {PANELS.map((s) => (
                <div key={s.key} className="flex gap-2 text-xs">
                  <span className="text-blue-400 font-semibold shrink-0 w-40">{s.key}</span>
                  <span className="text-gray-500">{s.desc}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 通知の仕組み */}
          <div className="bg-amber-950/20 border border-amber-900/30 rounded-lg p-3">
            <p className="text-xs font-semibold text-amber-300 mb-1">🔔 通知の仕組み</p>
            <div className="space-y-1 text-xs text-gray-400">
              <p>• <span className="text-amber-300">cron-job.org</span> が5分おきにサーバーを叩く → 直後のブロックをPushoverへ送信</p>
              <p>• 06:30 → 朝のミッション通知（TOP3タスク・今日の作業ブロック）</p>
              <p>• 各ブロック開始時 → If-Then形式「〇〇時になったら◯◯開始」</p>
              <p>• 22:25 → 夜のレビュー通知（今日の完了率）</p>
              <p>• 残業の日 → cron-job.orgで「残業日クロン」を有効化・平日クロンを停止</p>
            </div>
          </div>

          {/* Claude APIコスト */}
          <div className="bg-gray-800/50 rounded-lg p-3">
            <p className="text-xs font-semibold text-gray-300 mb-1">💳 Claude APIのコスト目安</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-gray-500">
              <span>AIアドバイス</span><span className="text-gray-400">約$0.01〜0.02 / 回</span>
              <span>TODO自動生成</span><span className="text-gray-400">約$0.002〜0.005 / 回</span>
              <span>AIタイムライン計画</span><span className="text-gray-400">約$0.005〜0.01 / 回</span>
              <span>AI目標分解</span><span className="text-gray-400">約$0.01〜0.02 / 回</span>
              <span>週次レビュー生成</span><span className="text-gray-400">約$0.01〜0.02 / 回</span>
              <span>$5で</span><span className="text-gray-400">150〜400回以上</span>
            </div>
            <a
              href="https://console.anthropic.com/settings/billing"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-400 underline mt-1.5 block"
            >
              → 残高を確認する
            </a>
          </div>

          {/* ビジョンボード設定 */}
          <div className="bg-purple-950/20 border border-purple-900/30 rounded-lg p-3">
            <p className="text-xs font-semibold text-purple-300 mb-1">🎯 ビジョンボード設定</p>
            <p className="text-xs text-gray-400">
              画像アップロードを使うには Vercel → Storage → Blob を作成し、
              <code className="text-green-400 mx-1">BLOB_READ_WRITE_TOKEN</code>
              を環境変数に設定してください。設定前はセットアップ案内が表示されます。
            </p>
          </div>

        </div>
      )}
    </div>
  );
}
