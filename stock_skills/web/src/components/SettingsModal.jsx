import { useState, useEffect } from 'react'
import { getApiBase, setApiBase, resetApiBase } from '../hooks/useApi'

export default function SettingsModal({ open, onClose }) {
  const [url, setUrl]         = useState('')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState(null) // null | 'ok' | 'error'

  useEffect(() => {
    if (open) {
      setUrl(getApiBase())
      setTestResult(null)
    }
  }, [open])

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const base = url.trim().replace(/\/+$/, '')
      const res = await fetch(`${base}/health`, { signal: AbortSignal.timeout(5000) })
      const json = await res.json()
      setTestResult(json.status === 'ok' ? 'ok' : 'error')
    } catch {
      setTestResult('error')
    } finally {
      setTesting(false)
    }
  }

  const handleSave = () => {
    setApiBase(url)
    onClose(true) // true = saved
  }

  const handleReset = () => {
    resetApiBase()
    setUrl('/api')
    setTestResult(null)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      {/* オーバーレイ */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => onClose(false)}
      />

      {/* モーダル本体 */}
      <div className="relative w-full max-w-md bg-gray-900 rounded-t-2xl sm:rounded-2xl border border-gray-700 shadow-2xl p-6 pb-8">
        {/* ヘッダー */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            ⚙️ バックエンド接続設定
          </h2>
          <button
            onClick={() => onClose(false)}
            className="text-gray-400 hover:text-white text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* 説明 */}
        <div className="bg-blue-900/30 border border-blue-700/40 rounded-xl p-4 mb-5 text-sm text-blue-300">
          <p className="font-semibold mb-1">📱 スマホからリアルタイムデータを見るには</p>
          <ol className="list-decimal list-inside space-y-1 text-blue-400">
            <li>自宅PCで <code className="bg-blue-900/50 px-1 rounded">./start.sh</code> を実行</li>
            <li>表示された ngrok URL を下に入力</li>
            <li>「接続テスト」→「保存」</li>
          </ol>
        </div>

        {/* URL 入力 */}
        <label className="block text-sm text-gray-400 mb-2">
          バックエンド API URL
        </label>
        <input
          type="text"
          value={url}
          onChange={e => { setUrl(e.target.value); setTestResult(null) }}
          placeholder="https://xxxx.ngrok-free.app/api"
          className="w-full bg-gray-800 border border-gray-600 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-blue-500 mb-3"
        />

        {/* 接続テスト結果 */}
        {testResult === 'ok' && (
          <p className="text-green-400 text-sm mb-3 flex items-center gap-2">
            ✅ 接続成功！バックエンドが動いています
          </p>
        )}
        {testResult === 'error' && (
          <p className="text-red-400 text-sm mb-3 flex items-center gap-2">
            ❌ 接続できません。URLを確認するか、PC で ./start.sh を実行してください
          </p>
        )}

        {/* ボタン群 */}
        <div className="flex gap-3 mt-4">
          <button
            onClick={handleTest}
            disabled={testing || !url.trim()}
            className="flex-1 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 text-white rounded-xl py-3 text-sm font-medium transition"
          >
            {testing ? '確認中...' : '🔌 接続テスト'}
          </button>
          <button
            onClick={handleSave}
            className="flex-1 bg-blue-600 hover:bg-blue-500 text-white rounded-xl py-3 text-sm font-bold transition"
          >
            💾 保存
          </button>
        </div>

        {/* リセット */}
        <button
          onClick={handleReset}
          className="w-full mt-3 text-gray-500 hover:text-gray-300 text-xs py-2 transition"
        >
          デフォルトにリセット (/api)
        </button>

        {/* 現在の設定 */}
        <div className="mt-4 pt-4 border-t border-gray-700">
          <p className="text-xs text-gray-500">
            現在の設定: <span className="text-gray-400 font-mono">{getApiBase()}</span>
          </p>
        </div>
      </div>
    </div>
  )
}
