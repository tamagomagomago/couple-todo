import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search, AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react'
import { apiGet } from '../hooks/useApi'
import { Card, Badge, StatRow, SectionTitle, Divider, PnlText, ErrorMsg, PageHeader } from '../components/Card'
import { CardSkeleton } from '../components/Skeleton'

const FRESHNESS_LABEL = {
  new:    { text: '最新',    cls: 'text-emerald-400' },
  recent: { text: '最近',    cls: 'text-amber-400'   },
  old:    { text: '要更新',  cls: 'text-rose-400'    },
  none:   { text: 'データなし', cls: 'text-slate-500' },
}
const RELATION_LABEL = {
  holding:         '💼 保有中',
  thesis_outdated: '⏰ 保有（90日超）',
  watchlist:       '👀 ウォッチ',
  screening_hot:   '🔥 頻出',
  new:             '🆕 初見',
}

function fmt(n, currency = 'USD') {
  if (n == null) return 'N/A'
  if (currency === 'JPY') return `¥${Number(n).toLocaleString('ja-JP', { maximumFractionDigits: 0 })}`
  return `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
function fmtPct(n) { return n != null ? `${(n * 100).toFixed(1)}%` : 'N/A' }

export default function Report() {
  const [params] = useSearchParams()
  const [ticker, setTicker] = useState(params.get('ticker') ?? '')
  const [input, setInput]   = useState(params.get('ticker') ?? '')
  const [data, setData]     = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState(null)

  async function fetchReport(t) {
    if (!t) return
    const cleaned = t.trim().toUpperCase()
    setTicker(cleaned)
    setData(null)
    setError(null)
    setLoading(true)
    try {
      const res = await apiGet(`/report/${encodeURIComponent(cleaned)}`)
      setData(res)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const ctx  = data?.context ?? {}
  const tech = data?.technicals ?? {}
  const fund = data?.fundamentals ?? {}
  const anal = data?.analyst ?? {}
  const diff = data?.diff ?? {}
  const currency = data?.currency ?? 'USD'

  const priceDiff = diff['current_price']

  return (
    <div className="space-y-4">
      <PageHeader title="個別レポート" />

      {/* 検索バー */}
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value.toUpperCase())}
          onKeyDown={e => e.key === 'Enter' && fetchReport(input)}
          placeholder="ティッカー例: NVDA / 7203.T"
          className="flex-1 bg-slate-800 rounded-xl px-4 py-3 text-slate-100 placeholder-slate-500
                     text-sm outline-none focus:ring-1 focus:ring-sky-500"
        />
        <button
          onClick={() => fetchReport(input)}
          className="bg-sky-500 hover:bg-sky-400 active:bg-sky-600 text-white rounded-xl px-4 no-tap transition-colors"
        >
          <Search size={18} />
        </button>
      </div>

      {/* ローディング */}
      {loading && (
        <div className="space-y-3">
          <p className="text-xs text-slate-500 text-center animate-pulse">データ取得中...</p>
          <CardSkeleton />
          <CardSkeleton />
        </div>
      )}

      {error && <ErrorMsg message={error} onRetry={() => fetchReport(ticker)} />}

      {data && !loading && (
        <>
          {/* コンテキストバー */}
          <div className="flex items-center gap-2 flex-wrap">
            {ctx.relationship && <Badge variant="info">{RELATION_LABEL[ctx.relationship]}</Badge>}
            {ctx.freshness && (
              <Badge variant="default">
                <span className={FRESHNESS_LABEL[ctx.freshness]?.cls}>
                  {FRESHNESS_LABEL[ctx.freshness]?.text}
                </span>
              </Badge>
            )}
            {ctx.fetch_mode === 'skip' && <span className="text-xs text-emerald-500">キャッシュ利用</span>}
          </div>

          {/* メインカード */}
          <Card>
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs text-slate-500">{data.sector} / {data.industry}</p>
                <h2 className="text-lg font-bold text-slate-100">{data.ticker}</h2>
                <p className="text-xs text-slate-400">{data.name}</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-slate-100">{fmt(data.current_price, currency)}</p>
                {priceDiff && (
                  <div className="flex items-center justify-end gap-1 text-xs mt-0.5">
                    {priceDiff.change_pct >= 0
                      ? <TrendingUp size={12} className="text-emerald-400" />
                      : <TrendingDown size={12} className="text-rose-400" />
                    }
                    <PnlText value={priceDiff.change_pct} />
                    <span className="text-slate-500">前回比</span>
                  </div>
                )}
              </div>
            </div>
          </Card>

          {/* テクニカル */}
          <Card>
            <SectionTitle>テクニカル</SectionTitle>
            <StatRow label="52週高値" value={fmt(tech.week52_high, currency)} />
            <StatRow label="52週安値" value={fmt(tech.week52_low, currency)} />
            <Divider />
            <StatRow label="MA50"  value={fmt(tech.ma50, currency)} />
            <StatRow label="MA200" value={fmt(tech.ma200, currency)} />
            <Divider />
            <StatRow
              label="RSI (14)"
              value={tech.rsi_14 != null ? tech.rsi_14 : 'N/A'}
              valueClass={
                tech.rsi_14 > 70 ? 'text-rose-400' :
                tech.rsi_14 < 30 ? 'text-emerald-400' : 'text-slate-100'
              }
            />
          </Card>

          {/* ファンダメンタルズ */}
          <Card>
            <SectionTitle>ファンダメンタルズ</SectionTitle>
            <StatRow label="PER (実績)"  value={fund.per?.toFixed(1) ?? 'N/A'} />
            <StatRow label="PER (予想)"  value={fund.forward_per?.toFixed(1) ?? 'N/A'} />
            <StatRow label="PBR"         value={fund.pbr?.toFixed(2) ?? 'N/A'} />
            <StatRow label="ROE"         value={fmtPct(fund.roe)} />
            <Divider />
            <StatRow label="配当利回り"   value={fund.dividend_yield != null ? `${(fund.dividend_yield * 100).toFixed(2)}%` : 'N/A'} />
            <StatRow label="売上成長率"   value={fmtPct(fund.revenue_growth)} valueClass={fund.revenue_growth > 0.15 ? 'text-emerald-400' : 'text-slate-100'} />
            <StatRow label="粗利率"       value={fmtPct(fund.gross_margins)} valueClass={fund.gross_margins > 0.5 ? 'text-emerald-400' : 'text-slate-100'} />
          </Card>

          {/* アナリスト */}
          <Card>
            <SectionTitle>アナリスト ({anal.count ?? 0}名)</SectionTitle>
            {anal.count < 3 && (
              <div className="flex items-center gap-1.5 text-amber-400 text-xs mb-2">
                <AlertTriangle size={12} />
                <span>アナリスト数少なめ — 目標価格の信頼性に注意</span>
              </div>
            )}
            <StatRow label="推奨"         value={anal.recommendation ?? 'N/A'} />
            <StatRow label="目標株価(平均)" value={fmt(anal.target_mean, currency)} />
            <StatRow label="目標株価(高)"  value={fmt(anal.target_high, currency)} valueClass="text-emerald-400" />
            <StatRow label="目標株価(低)"  value={fmt(anal.target_low, currency)}  valueClass="text-rose-400" />
          </Card>

          {/* 過去レッスン警告 */}
          {data.lessons?.length > 0 && (
            <Card className="border border-amber-800/60">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle size={14} className="text-amber-400" />
                <SectionTitle>過去レッスン警告</SectionTitle>
              </div>
              <div className="space-y-3">
                {data.lessons.map((l, i) => (
                  <div key={i} className="text-sm">
                    <p className={`font-medium ${l.severity === 'high' ? 'text-rose-400' : 'text-amber-400'}`}>
                      [{l.date}] {l.trigger}
                    </p>
                    <p className="text-slate-300 mt-0.5">→ {l.lesson}</p>
                    {l.next_action && <p className="text-slate-500 text-xs mt-0.5">対応: {l.next_action}</p>}
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* 概要 */}
          {data.description && (
            <Card>
              <SectionTitle>事業概要</SectionTitle>
              <p className="text-xs text-slate-400 leading-relaxed">{data.description}...</p>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
