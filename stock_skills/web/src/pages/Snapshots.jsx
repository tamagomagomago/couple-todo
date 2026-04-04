import { useState } from 'react'
import { Camera, ArrowRight, TrendingUp, TrendingDown } from 'lucide-react'
import { useApi, apiPost, apiGet } from '../hooks/useApi'
import { Card, Badge, SectionTitle, StatRow, Divider, PnlText, PageHeader, ErrorMsg, EmptyState } from '../components/Card'
import { CardSkeleton } from '../components/Skeleton'

export default function Snapshots() {
  const { data: snapsData, loading, error, refetch } = useApi('/snapshots')
  const [comparison, setComparison] = useState(null)
  const [comparing, setComparing]   = useState(false)
  const [saving, setSaving]         = useState(false)

  const snapshots = snapsData?.snapshots ?? []

  async function handleSave() {
    setSaving(true)
    try {
      await apiPost('/snapshots')
      refetch()
    } catch (e) {
      alert(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleCompare() {
    setComparing(true)
    try {
      const data = await apiGet('/snapshots/compare')
      setComparison(data)
    } catch (e) {
      alert(e.message)
    } finally {
      setComparing(false)
    }
  }

  const comp = comparison?.comparison

  return (
    <div className="space-y-4">
      <PageHeader title="スナップショット" subtitle="ポートフォリオの時系列記録" />

      {/* アクションボタン */}
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 flex items-center justify-center gap-2 bg-sky-500 text-white rounded-xl py-3 text-sm font-medium no-tap active:bg-sky-600 disabled:opacity-50"
        >
          <Camera size={16} />
          {saving ? '保存中...' : '今すぐ保存'}
        </button>
        <button
          onClick={handleCompare}
          disabled={comparing || snapshots.length < 2}
          className="flex-1 flex items-center justify-center gap-2 bg-slate-800 text-slate-200 rounded-xl py-3 text-sm font-medium no-tap active:bg-slate-700 disabled:opacity-40"
        >
          <ArrowRight size={16} />
          {comparing ? '比較中...' : '週次比較'}
        </button>
      </div>

      {/* 比較結果 */}
      {comp && (
        <Card>
          <SectionTitle>比較: {comp.period}</SectionTitle>

          {/* サマリー差分 */}
          {comp.summary_diff?.total_value && (
            <StatRow
              label="評価額変化"
              value={
                <span className="flex items-center gap-1">
                  <PnlText value={comp.summary_diff.total_value.delta_pct} />
                  <span className="text-xs text-slate-500">
                    ({comp.summary_diff.total_value.delta >= 0 ? '+' : ''}{Number(comp.summary_diff.total_value.delta).toLocaleString()})
                  </span>
                </span>
              }
            />
          )}
          {comp.summary_diff?.total_pnl_pct && (
            <StatRow
              label="損益率変化"
              value={
                <span>
                  {comp.summary_diff.total_pnl_pct.old?.toFixed(1)}% → {comp.summary_diff.total_pnl_pct.new?.toFixed(1)}%
                </span>
              }
            />
          )}

          {/* 個別銘柄変化 */}
          {comp.holdings_diff?.length > 0 && (
            <>
              <Divider />
              <p className="text-xs text-slate-500 mb-2">個別銘柄</p>
              <div className="space-y-1.5">
                {comp.holdings_diff.map(h => (
                  <div key={h.ticker} className="flex items-center justify-between">
                    <span className="text-sm text-slate-300">{h.ticker} <span className="text-xs text-slate-500">{h.name}</span></span>
                    <div className="flex items-center gap-1">
                      {h.price_change_pct >= 0
                        ? <TrendingUp size={12} className="text-emerald-400" />
                        : <TrendingDown size={12} className="text-rose-400" />
                      }
                      <PnlText value={h.price_change_pct} />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* 新規追加・除外 */}
          {comp.added?.length > 0 && (
            <>
              <Divider />
              <p className="text-xs text-emerald-400 mb-1">+ 新規追加</p>
              {comp.added.map(h => <p key={h.ticker} className="text-sm text-slate-300">{h.ticker} {h.name}</p>)}
            </>
          )}
          {comp.removed?.length > 0 && (
            <>
              <Divider />
              <p className="text-xs text-rose-400 mb-1">− 売却・除外</p>
              {comp.removed.map(h => <p key={h.ticker} className="text-sm text-slate-300">{h.ticker} {h.name}</p>)}
            </>
          )}
        </Card>
      )}

      {/* スナップショット一覧 */}
      {loading && <CardSkeleton />}
      {error && <ErrorMsg message={error} onRetry={refetch} />}

      {!loading && snapshots.length === 0 && (
        <EmptyState icon="📸" message="スナップショットなし" sub="「今すぐ保存」でポートフォリオを記録できます" />
      )}

      {!loading && snapshots.length > 0 && (
        <section>
          <SectionTitle>{snapshots.length}件の記録</SectionTitle>
          <div className="space-y-2">
            {snapshots.map(s => (
              <Card key={s.label} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-100">{s.date} <span className="text-slate-500 text-xs">{s.time}</span></p>
                  <p className="text-xs text-slate-500">{s.count}銘柄</p>
                </div>
                <div className="text-right">
                  {s.total_value != null && (
                    <p className="text-sm text-slate-200">{Number(s.total_value).toLocaleString()}</p>
                  )}
                  {s.total_pnl_pct != null && <PnlText value={s.total_pnl_pct} />}
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
