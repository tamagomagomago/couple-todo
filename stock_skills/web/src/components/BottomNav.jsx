import { NavLink } from 'react-router-dom'
import { LayoutDashboard, Search, FileText, BookOpen, Camera } from 'lucide-react'

const tabs = [
  { to: '/',           icon: LayoutDashboard, label: 'ホーム'      },
  { to: '/screening',  icon: Search,           label: 'スクリーン'  },
  { to: '/report',     icon: FileText,          label: 'レポート'   },
  { to: '/lessons',    icon: BookOpen,          label: 'レッスン'   },
  { to: '/snapshots',  icon: Camera,            label: '記録'       },
]

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-slate-900 border-t border-slate-800 safe-bottom">
      <div className="flex">
        {tabs.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center py-2 pt-3 no-tap transition-colors ${
                isActive
                  ? 'text-sky-400'
                  : 'text-slate-500 active:text-slate-300'
              }`
            }
          >
            <Icon size={22} strokeWidth={1.8} />
            <span className="text-[10px] mt-0.5 tracking-wide">{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
