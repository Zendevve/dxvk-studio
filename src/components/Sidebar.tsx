type View = 'library' | 'settings' | 'downloads'

interface SidebarProps {
  currentView: View
  onViewChange: (view: View) => void
  installedVersions: number
}

const navItems: { id: View; label: string; icon: string }[] = [
  { id: 'library', label: 'Library', icon: 'grid_view' },
  { id: 'downloads', label: 'Downloads', icon: 'download' },
  { id: 'settings', label: 'Settings', icon: 'settings' }
]

export function Sidebar({ currentView, onViewChange, installedVersions }: SidebarProps) {
  return (
    <aside className="glass-panel w-[280px] h-full flex flex-col z-20 shrink-0 relative border-r border-r-white/5">
      {/* Logo Section */}
      <div className="p-6 pb-2">
        <div className="flex items-center gap-4 mb-8">
          <div className="flex items-center justify-center size-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg shadow-blue-500/30 ring-1 ring-white/10">
            <span
              className="material-symbols-outlined text-white text-[28px]"
              style={{ fontVariationSettings: "'FILL' 1, 'wght' 600" }}
            >
              layers
            </span>
          </div>
          <div className="flex flex-col">
            <h1 className="text-white text-lg font-bold tracking-tight">DXVK Studio</h1>
            <p className="text-slate-400 text-xs font-medium bg-white/5 px-2 py-0.5 rounded-full w-fit">v2.4.0 Tahoe</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex flex-col gap-2">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all group ${currentView === item.id
                  ? 'bg-primary/20 text-white border border-primary/20 shadow-[0_0_15px_rgba(0,123,255,0.2)]'
                  : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'
                }`}
              aria-current={currentView === item.id ? 'page' : undefined}
            >
              <span
                className="material-symbols-outlined group-hover:scale-110 transition-transform"
                style={{
                  fontVariationSettings: currentView === item.id
                    ? "'FILL' 1, 'wght' 400"
                    : "'FILL' 0, 'wght' 400"
                }}
              >
                {item.icon}
              </span>
              <span className={`text-sm ${currentView === item.id ? 'font-semibold' : 'font-medium'}`}>
                {item.label}
              </span>
            </button>
          ))}

          {/* Logs - extra nav item */}
          <button className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-colors group border border-transparent">
            <span
              className="material-symbols-outlined group-hover:scale-110 transition-transform"
              style={{ fontVariationSettings: "'FILL' 0, 'wght' 400" }}
            >
              history
            </span>
            <span className="text-sm font-medium">Logs</span>
          </button>
        </nav>
      </div>

      {/* User Profile Footer */}
      <div className="mt-auto p-6 border-t border-white/5">
        <div className="glass-card p-3 rounded-xl flex items-center gap-3 cursor-pointer hover:bg-white/10 transition-colors">
          <div className="flex items-center justify-center size-9 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 ring-2 ring-primary/30">
            <span className="material-symbols-outlined text-white text-[18px]">person</span>
          </div>
          <div className="flex flex-col flex-1 min-w-0">
            <p className="text-white text-sm font-medium truncate">Local User</p>
            <p className="text-slate-400 text-xs">{installedVersions} DXVK versions</p>
          </div>
          <span className="material-symbols-outlined text-slate-500 text-sm">more_vert</span>
        </div>
      </div>
    </aside>
  )
}
