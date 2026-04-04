import { useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import BottomNav    from './components/BottomNav'
import SettingsModal from './components/SettingsModal'
import Dashboard    from './pages/Dashboard'
import Screening    from './pages/Screening'
import Report       from './pages/Report'
import Lessons      from './pages/Lessons'
import Snapshots    from './pages/Snapshots'
import { getApiBase } from './hooks/useApi'

export default function App() {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [apiBase, setApiBaseDisplay] = useState(getApiBase())

  const handleSettingsClose = (saved) => {
    setSettingsOpen(false)
    if (saved) {
      setApiBaseDisplay(getApiBase())
      // ページをリロードして全コンポーネントのAPIベースを更新
      window.location.reload()
    }
  }

  const isLocalApi = apiBase === '/api' || apiBase.includes('localhost')

  return (
    <div className="min-h-screen bg-slate-950">
      {/* ヘッダーバー */}
      <div className="sticky top-0 z-30 bg-slate-950/90 backdrop-blur border-b border-slate-800">
        <div className="max-w-lg mx-auto px-4 h-12 flex items-center justify-between">
          <span className="text-white font-bold text-sm flex items-center gap-2">
            📈 投資分析
          </span>
          <div className="flex items-center gap-3">
            {/* 接続状態インジケーター */}
            <span className={`text-xs px-2 py-1 rounded-full ${
              isLocalApi
                ? 'bg-yellow-900/50 text-yellow-400 border border-yellow-700/50'
                : 'bg-green-900/50 text-green-400 border border-green-700/50'
            }`}>
              {isLocalApi ? '⚡ ローカル' : '🌐 リモート'}
            </span>
            {/* 設定ボタン */}
            <button
              onClick={() => setSettingsOpen(true)}
              className="text-gray-400 hover:text-white text-xl transition"
              title="バックエンド接続設定"
            >
              ⚙️
            </button>
          </div>
        </div>
      </div>

      {/* メインコンテンツ */}
      <main className="max-w-lg mx-auto px-4 pt-4 pb-28">
        <Routes>
          <Route path="/"           element={<Dashboard />} />
          <Route path="/screening"  element={<Screening />} />
          <Route path="/report"     element={<Report />} />
          <Route path="/lessons"    element={<Lessons />} />
          <Route path="/snapshots"  element={<Snapshots />} />
        </Routes>
      </main>

      <BottomNav />

      {/* 設定モーダル */}
      <SettingsModal
        open={settingsOpen}
        onClose={handleSettingsClose}
      />
    </div>
  )
}
