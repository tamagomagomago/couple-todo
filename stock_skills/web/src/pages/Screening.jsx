import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Search, Flame } from 'lucide-react'
import { apiGet } from '../hooks/useApi'
import { Card, Badge, SectionTitle, PageHeader, ErrorMsg, EmptyState } from '../components/Card'
import { RowSkeleton } from '../components/Skeleton'

const PRESETS = [
  { id: 'new_high_breakout', emoji: '🚀', label: '新高値ブレイク', desc: '52週高値95%以上+出来高急増' },
  { id: 'dip_buying',        emoji: '📉', label: '押し目買い',     desc: 'RSI 30〜45 + 200日MA上' },
  { id: 'ai_growth',         emoji: '🤖', label: 'AI成長株',       desc: '売上成長15%+ 粗利50%+' },
]

function fmt(n, currency = 'USD') {
  if (n == null) return 'N/A'
  if (currency === 'JPY') return `¥${Number(n).toLocaleString('ja-JP', { maximumFractionDigits: 0 })}`
  return `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
}

function ResultCard({ r, preset, onClick }) {
  const currency = r.currency ?? 'USD'
  return (
    <Card onClick={onClick} className="space-y-2">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-semibold text-slate-100">{r.ticker}</span>
            {r.is_hot && <Badge variant="hot"><Flame size={10} className="mr-0.5" />注目 {r.screening_hit_count}回</Badge>}
            {r.value_score != null && (
              <Badge variant={r.value_score >= 60 ? 'up' : r.value_score >= 40 ? 'info' : 'default'}>
                スコア {r.value_score}
              </Badge>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">{r.name}</p>
        </div>
        <p className="text-sm font-bold text-slate-100 shrink-0">{fmt(r.current_price, currency)}</p>
      </div>

      <div className="flex flex-wrap gap-2 text-xs text-slate-400">
        {preset === 'new_high_breakout' && <>
          <span>高値比 <span className="text-emerald-400">+{((r.price_to_52w_ratio - 1) * 100).toFixed(1)}%</span></span>
          <span>出来高 <span className="text-sky-400">{r.volume_ratio}x</span></span>
        </>}
        {preset === 'dip_buying' && <>
          <span>RSI <span className="text-amber-400">{r.rsi}</span></span>
          <span>PER <span className="text-slate-300">{r.per?.toFixed(1)}</span></span>
          {r.dividend_yield && <span>配当 <span className="text-emerald-400">{(r.dividend_yield * 100).toFixed(1)}%</span></span>}
        </>}
        {preset === 'ai_growth' && <>
          <span>売上成長 <span className="text-emerald-400">+{r.revenue_growth}%</span></span>
          <span>粗利率 <span className="text-sky-400">{r.gross_margin}%</span></span>
        </>}
        <span className="text-slate-600">{r.sector}</span>
      </div>
    </Card>
  )
}

export default function Screening() {
  const nav = useNavigate()
  const [params] = useSearchParams()
  const defaultPreset = params.get('preset') ?? ''

  const [preset, setPreset] = useState(defaultPreset)
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState(null)

  async function runScreen(p) {
    setPreset(p)
    setResults(null)
    setError(null)
    setLoading(true)
    try {
      const data = await apiGet(`/screen/${p}`)
      setResults(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader title="スクリーニング" subtitle="条件に合う銘柄を自動抽出" />

      {/* プリセット選択 */}
      <div className="space-y-2">
        {PRESETS.map(p => (
          <button
            key={p.id}
            onClick={() => runScreen(p.id)}
            className={`w-full flex items-center gap-3 p-3 rounded-2xl border no-tap transition-all ${
              preset === p.id
                ? 'border-sky-500 bg-sky-950/50'
                : 'border-slate-800 bg-slate-900 active:bg-slate-800'
            }`}
          >
            <span className="text-2xl w-8">{p.emoji}</span>
            <div className="text-left flex-1">
              <p className="font-medium text-slate-100 text-sm">{p.label}</p>
              <p className="text-xs text-slate-500">{p.desc}</p>
            </div>
            {preset === p.id && !loading && results && (
              <Badge variant="info">{results.count}件</Badge>
            )}
          </button>
        ))}
      </div>

      {/* 結果 */}
      {loading && (
        <div className="space-y-3">
          <p className="text-xs text-slate-500 text-center animate-pulse">スクリーニング中... (20〜60秒)</p>
          <RowSkeleton rows={4} />
        </div>
      )}

      {error && <ErrorMsg message={error} onRetry={() => runScreen(preset)} />}

      {results && !loading && (
        <section>
          <SectionTitle>{results.count}件ヒット</SectionTitle>
          {results.count === 0 ? (
            <EmptyState icon="🔍" message="該当銘柄なし" sub="条件を緩めるか銘柄リストを増やしてください" />
          ) : (
            <div className="space-y-2">
              {results.results.map(r => (
                <ResultCard
                  key={r.ticker}
                  r={r}
                  preset={preset}
                  onClick={() => nav(`/report?ticker=${r.ticker}`)}
                />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  )
}
