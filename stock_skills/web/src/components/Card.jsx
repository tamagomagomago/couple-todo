import clsx from 'clsx'

export function Card({ children, className, onClick }) {
  return (
    <div
      onClick={onClick}
      className={clsx(
        'bg-slate-900 rounded-2xl p-4',
        onClick && 'cursor-pointer active:bg-slate-800 transition-colors no-tap',
        className
      )}
    >
      {children}
    </div>
  )
}

export function Badge({ children, variant = 'default' }) {
  const variants = {
    default:  'bg-slate-800 text-slate-300',
    up:       'bg-emerald-900/60 text-emerald-400',
    down:     'bg-rose-900/60 text-rose-400',
    hot:      'bg-orange-900/60 text-orange-400',
    info:     'bg-sky-900/60 text-sky-400',
    warning:  'bg-amber-900/60 text-amber-400',
  }
  return (
    <span className={clsx('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium', variants[variant])}>
      {children}
    </span>
  )
}

export function Divider() {
  return <div className="border-t border-slate-800 my-3" />
}

export function StatRow({ label, value, valueClass }) {
  return (
    <div className="flex justify-between items-center py-1.5">
      <span className="text-slate-400 text-sm">{label}</span>
      <span className={clsx('text-sm font-medium', valueClass ?? 'text-slate-100')}>{value ?? 'N/A'}</span>
    </div>
  )
}

export function SectionTitle({ children }) {
  return (
    <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest px-1 mb-2">{children}</h2>
  )
}

export function PageHeader({ title, subtitle, action }) {
  return (
    <div className="flex items-start justify-between mb-4">
      <div>
        <h1 className="text-xl font-bold text-slate-100">{title}</h1>
        {subtitle && <p className="text-sm text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

export function PnlText({ value, suffix = '%' }) {
  if (value == null) return <span className="text-slate-400">N/A</span>
  const n = Number(value)
  return (
    <span className={n > 0 ? 'text-emerald-400' : n < 0 ? 'text-rose-400' : 'text-slate-400'}>
      {n > 0 ? '+' : ''}{n.toFixed(1)}{suffix}
    </span>
  )
}

export function ErrorMsg({ message, onRetry }) {
  return (
    <div className="bg-rose-950/50 border border-rose-800 rounded-2xl p-4 text-center">
      <p className="text-rose-300 text-sm">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="mt-2 text-xs text-rose-400 underline">
          再読み込み
        </button>
      )}
    </div>
  )
}

export function EmptyState({ icon, message, sub }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="text-5xl mb-3">{icon}</div>
      <p className="text-slate-300 font-medium">{message}</p>
      {sub && <p className="text-slate-500 text-sm mt-1">{sub}</p>}
    </div>
  )
}
