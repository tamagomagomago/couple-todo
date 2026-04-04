import { useState } from 'react'
import { Trash2, Plus, X } from 'lucide-react'
import { useApi, apiPost, apiDelete } from '../hooks/useApi'
import { Card, Badge, SectionTitle, PageHeader, ErrorMsg, EmptyState } from '../components/Card'
import { RowSkeleton } from '../components/Skeleton'

export default function Lessons() {
  const { data, loading, error, refetch } = useApi('/lessons')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ ticker: '', trigger: '', lesson: '', next_action: '' })
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')

  const lessons = data?.lessons ?? []

  async function handleAdd(e) {
    e.preventDefault()
    if (!form.ticker || !form.trigger || !form.lesson) {
      setFormError('銘柄・トリガー・学びは必須です')
      return
    }
    setSaving(true)
    setFormError('')
    try {
      await apiPost('/lessons', form)
      setForm({ ticker: '', trigger: '', lesson: '', next_action: '' })
      setShowForm(false)
      refetch()
    } catch (e) {
      setFormError(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id) {
    if (!confirm('このレッスンを削除しますか？')) return
    try {
      await apiDelete(`/lessons/${id}`)
      refetch()
    } catch (e) {
      alert(e.message)
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="レッスン"
        subtitle="失敗パターンを記録して繰り返しを防ぐ"
        action={
          <button
            onClick={() => setShowForm(v => !v)}
            className="flex items-center gap-1.5 bg-sky-500 text-white rounded-xl px-3 py-2 text-sm no-tap active:bg-sky-600"
          >
            {showForm ? <X size={16} /> : <Plus size={16} />}
            {showForm ? '閉じる' : '追加'}
          </button>
        }
      />

      {/* 追加フォーム */}
      {showForm && (
        <Card>
          <form onSubmit={handleAdd} className="space-y-3">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">銘柄 *</label>
              <input
                value={form.ticker}
                onChange={e => setForm(f => ({ ...f, ticker: e.target.value.toUpperCase() }))}
                placeholder="例: NVDA, 7974.T"
                className="w-full bg-slate-800 rounded-xl px-3 py-2.5 text-sm text-slate-100 outline-none focus:ring-1 focus:ring-sky-500 placeholder-slate-500"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">トリガー（失敗のきっかけ）*</label>
              <input
                value={form.trigger}
                onChange={e => setForm(f => ({ ...f, trigger: e.target.value }))}
                placeholder="例: RSI70超で高値掴み"
                className="w-full bg-slate-800 rounded-xl px-3 py-2.5 text-sm text-slate-100 outline-none focus:ring-1 focus:ring-sky-500 placeholder-slate-500"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">学んだこと *</label>
              <textarea
                value={form.lesson}
                onChange={e => setForm(f => ({ ...f, lesson: e.target.value }))}
                placeholder="例: 次はRSI60以下でエントリーする"
                rows={2}
                className="w-full bg-slate-800 rounded-xl px-3 py-2.5 text-sm text-slate-100 outline-none focus:ring-1 focus:ring-sky-500 placeholder-slate-500 resize-none"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">次回対応（省略可）</label>
              <input
                value={form.next_action}
                onChange={e => setForm(f => ({ ...f, next_action: e.target.value }))}
                placeholder="例: 同銘柄でRSI70超が出たら自動警告"
                className="w-full bg-slate-800 rounded-xl px-3 py-2.5 text-sm text-slate-100 outline-none focus:ring-1 focus:ring-sky-500 placeholder-slate-500"
              />
            </div>
            {formError && <p className="text-rose-400 text-xs">{formError}</p>}
            <button
              type="submit"
              disabled={saving}
              className="w-full bg-sky-500 text-white rounded-xl py-2.5 text-sm font-medium no-tap active:bg-sky-600 disabled:opacity-50"
            >
              {saving ? '保存中...' : '記録する'}
            </button>
          </form>
        </Card>
      )}

      {/* レッスン一覧 */}
      {loading && <RowSkeleton rows={3} />}
      {error && <ErrorMsg message={error} onRetry={refetch} />}

      {!loading && lessons.length === 0 && (
        <EmptyState icon="📚" message="レッスンなし" sub="失敗を記録して同じ過ちを繰り返さない" />
      )}

      {!loading && lessons.length > 0 && (
        <section>
          <SectionTitle>{lessons.length}件</SectionTitle>
          <div className="space-y-2">
            {lessons.map(l => (
              <Card key={l.id} className="space-y-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-slate-100 text-sm">{l.ticker_raw}</span>
                    <Badge variant={l.trigger?.includes('高値掴み') || l.trigger?.includes('損切り') ? 'down' : 'warning'}>
                      {l.trigger?.includes('高値掴み') ? '🔴' : '🟡'} {l.trigger}
                    </Badge>
                  </div>
                  <button
                    onClick={() => handleDelete(l.id)}
                    className="p-1.5 text-slate-600 active:text-rose-400 no-tap transition-colors shrink-0"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <p className="text-sm text-slate-300">→ {l.lesson}</p>
                {l.next_action && (
                  <p className="text-xs text-slate-500">対応: {l.next_action}</p>
                )}
                <p className="text-xs text-slate-600">{l.date}</p>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
