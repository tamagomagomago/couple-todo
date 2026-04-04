import { useNavigate } from 'react-router-dom'
import { RefreshCw, TrendingUp, Eye } from 'lucide-react'
import { useApi } from '../hooks/useApi'
import { Card, Badge, SectionTitle, PnlText, PageHeader, ErrorMsg, EmptyState, Divider } from '../components/Card'
import { CardSkeleton, RowSkeleton } from '../components/Skeleton'

function fmt(n, currency = 'USD') {
  if (n == null) return 'N/A'
  if (currency === 'JPY') return `¥${Number(n).toLocaleString('ja-JP', { maximumFractionDigits: 0 })}`
  return `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function Dashboard() {
  const nav = useNavigate()
  const { data: pf, loading: pfLoading, error: pfError, refetch: pfRefetch } = useApi('/portfolio')
  const { data: wl, loading: wlLoading, error: wlError, refetch: wlRefetch } = useApi('/watchlist')

  const summary = pf?.summary ?? {}
  const holdings = pf?.holdings ?? []
  const watchlist = wl?.watchlist ?? []

  return (
    <div className="space-y-5">
      <PageHeader
        title="ダッシュボード"
        subtitle={new Date().toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' })}
        action={
          <button
            onClick={() => { pfRefetch(); wlRefetch() }}
            className="p-2 rounded-xl bg-slate-800 text-slate-400 active:bg-slate-700 no-tap"
          >
            <RefreshCw size={16} />
          </button>
        }
      />

      {/* ── ポートフォリオサマリー ── */}
      <section>
        <SectionTitle>ポートフォリオ</SectionTitle>
        {pfLoading ? (
          <CardSkeleton />
        ) : pfError ? (
          <ErrorMsg message={pfError} onRetry={pfRefetch} />
        ) : holdings.length === 0 ? (
          <Card>
            <EmptyState icon="💼" message="保有銘柄なし" sub="portfolio.csv に銘柄を追加してください" />
          </Card>
        ) : (
          <Card>
            <div className="flex justify-between items-start mb-3">
              <div>
                <p className="text-slate-400 text-xs">評価額</p>
                <p className="text-2xl font-bold text-slate-100">
                  {Number(summary.total_value ?? 0).toLocaleString()}
                </p>
              </div>
              <div className="text-right">
                <p className="text-slate-400 text-xs">損益</p>
                <p className="text-xl font-bold">
                  <PnlText value={summary.total_pnl_pct} />
                </p>
              </div>
            </div>
            <Divider />
            <div className="space-y-2">
              {holdings.map(h => (
                <button
                  key={h.ticker}
                  onClick={() => nav(`/report?ticker=${h.ticker}`)}
                  className="w-full flex items-center justify-between py-1 no-tap active:opacity-70"
                >
                  <div className="text-left">
                    <p className="text-sm font-medium text-slate-100">{h.ticker}</p>
                    <p className="text-xs text-slate-500">{h.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">{fmt(h.current_price)}</p>
                    <PnlText value={h.pnl_pct} />
                  </div>
                </button>
              ))}
            </div>
          </Card>
        )}
      </section>

      {/* ── ウォッチリスト ── */}
      <section>
        <SectionTitle>ウォッチリスト</SectionTitle>
        {wlLoading ? (
          <RowSkeleton rows={3} />
        ) : wlError ? (
          <ErrorMsg message={wlError} onRetry={wlRefetch} />
        ) : watchlist.length === 0 ? (
          <Card>
            <EmptyState icon="👀" message="ウォッチリスト空" sub="watchlist.json に銘柄を追加してください" />
          </Card>
        ) : (
          <div className="space-y-2">
            {watchlist.map(item => (
              <Card
                key={item.ticker}
                onClick={() => nav(`/report?ticker=${item.ticker}`)}
                className="flex items-center gap-3"
              >
                <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center shrink-0">
                  <Eye size={16} className="text-sky-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold text-slate-100">{item.ticker}</span>
                    {item.from_52w_high_pct != null && (
                      <Badge variant={item.from_52w_high_pct >= -5 ? 'up' : 'default'}>
                        高値比 <PnlText value={item.from_52w_high_pct} />
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-slate-500 truncate">{item.reason || item.name}</p>
                </div>
                {item.current_price != null && (
                  <p className="text-sm font-medium text-slate-200 shrink-0">
                    {fmt(item.current_price, item.market === 'JP' ? 'JPY' : 'USD')}
                  </p>
                )}
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* ── クイックスクリーニング ── */}
      <section>
        <SectionTitle>クイックスクリーニング</SectionTitle>
        <div className="grid grid-cols-3 gap-2">
          {[
            { preset: 'new_high_breakout', emoji: '🚀', label: '新高値' },
            { preset: 'dip_buying',        emoji: '📉', label: '押し目' },
            { preset: 'ai_growth',         emoji: '🤖', label: 'AI成長株' },
          ].map(({ preset, emoji, label }) => (
            <button
              key={preset}
              onClick={() => nav(`/screening?preset=${preset}`)}
              className="bg-slate-900 rounded-2xl py-4 flex flex-col items-center gap-1 no-tap active:bg-slate-800 transition-colors"
            >
              <span className="text-2xl">{emoji}</span>
              <span className="text-xs text-slate-300">{label}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}
