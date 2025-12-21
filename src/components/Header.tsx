import { useState } from 'react'

type FilterType = 'all' | 'installed' | 'update' | 'favorites'

interface HeaderProps {
  onScan: () => void
  onAddGame: () => void
  isLoading: boolean
  gameCount: number
  installedCount?: number
  updateCount?: number
  searchQuery?: string
  onSearchChange?: (query: string) => void
  activeFilter?: FilterType
  onFilterChange?: (filter: FilterType) => void
}

export function Header({
  onAddGame,
  gameCount,
  installedCount = 0,
  updateCount = 0,
  searchQuery = '',
  onSearchChange,
  activeFilter = 'all',
  onFilterChange
}: HeaderProps) {
  const [localSearch, setLocalSearch] = useState(searchQuery)

  const handleSearchChange = (value: string) => {
    setLocalSearch(value)
    onSearchChange?.(value)
  }

  return (
    <header className="flex flex-col pt-8 px-10 pb-4 shrink-0 gap-6">
      {/* Title and Actions Row */}
      <div className="flex justify-between items-end">
        <div className="flex flex-col gap-1">
          <h2 className="text-white text-4xl font-black tracking-tight drop-shadow-lg">My Library</h2>
          <p className="text-slate-400 text-base font-normal">Manage your DXVK installations and configs</p>
        </div>
        <div className="flex gap-4 items-center">
          {/* Search Bar */}
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <span className="material-symbols-outlined text-slate-400 group-focus-within:text-primary transition-colors">search</span>
            </div>
            <input
              type="text"
              className="block w-64 pl-10 pr-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:bg-white/10 transition-all text-sm backdrop-blur-md"
              placeholder="Find a game..."
              value={localSearch}
              onChange={(e) => handleSearchChange(e.target.value)}
            />
          </div>

          {/* Add Game Button */}
          <button
            onClick={onAddGame}
            className="flex items-center justify-center gap-2 rounded-xl h-10 px-5 bg-primary hover:bg-blue-600 text-white text-sm font-bold shadow-[0_0_20px_rgba(0,123,255,0.3)] hover:shadow-[0_0_25px_rgba(0,123,255,0.5)] transition-all border border-white/10"
          >
            <span className="material-symbols-outlined text-[20px]">add_circle</span>
            <span>Add Game</span>
          </button>
        </div>
      </div>

      {/* Filter Chips */}
      <div className="flex items-center gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
        <button
          onClick={() => onFilterChange?.('all')}
          className={`flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-medium border transition-colors whitespace-nowrap ${activeFilter === 'all'
              ? 'bg-white/10 text-white border-white/10 hover:bg-white/20'
              : 'bg-transparent text-slate-400 border-transparent hover:bg-white/5 hover:text-white'
            }`}
        >
          All Games
          <span className={`text-xs py-0.5 px-1.5 rounded-md ml-1 ${activeFilter === 'all' ? 'bg-white/20' : 'bg-white/5'}`}>
            {gameCount}
          </span>
        </button>

        <button
          onClick={() => onFilterChange?.('installed')}
          className={`flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-medium border transition-colors whitespace-nowrap ${activeFilter === 'installed'
              ? 'bg-white/10 text-white border-white/10'
              : 'bg-transparent text-slate-400 border-transparent hover:bg-white/5 hover:text-white'
            }`}
        >
          Installed
          <span className="bg-white/5 text-xs py-0.5 px-1.5 rounded-md ml-1">{installedCount}</span>
        </button>

        <button
          onClick={() => onFilterChange?.('update')}
          className={`flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-medium border transition-colors whitespace-nowrap ${activeFilter === 'update'
              ? 'bg-white/10 text-white border-white/10'
              : 'bg-transparent text-slate-400 border-transparent hover:bg-white/5 hover:text-white'
            }`}
        >
          Update Available
          <span className="bg-amber-500/20 text-amber-500 text-xs py-0.5 px-1.5 rounded-md ml-1">{updateCount}</span>
        </button>

        <button
          onClick={() => onFilterChange?.('favorites')}
          className={`flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-medium border transition-colors whitespace-nowrap ${activeFilter === 'favorites'
              ? 'bg-white/10 text-white border-white/10'
              : 'bg-transparent text-slate-400 border-transparent hover:bg-white/5 hover:text-white'
            }`}
        >
          Favorites
        </button>

        {/* Sort Dropdown */}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-slate-500 text-xs font-medium uppercase tracking-wider mr-2">Sort By</span>
          <button className="flex items-center gap-1 text-slate-300 hover:text-white text-sm font-medium transition-colors">
            Last Played
            <span className="material-symbols-outlined text-[18px]">arrow_drop_down</span>
          </button>
        </div>
      </div>
    </header>
  )
}
