import type { Game } from '../App'

interface GameGridProps {
  games: Game[]
  selectedGame: Game | null
  onSelectGame: (game: Game) => void
  onAddGame: () => void
  onScanGames?: () => void
}

// Generate a gradient based on game name for placeholder covers
function generateGradient(name: string): string {
  const hash = name.split('').reduce((acc, char) => char.charCodeAt(0) + acc, 0)
  const hue1 = hash % 360
  const hue2 = (hash * 7) % 360
  return `linear-gradient(135deg, hsl(${hue1}, 60%, 30%) 0%, hsl(${hue2}, 70%, 20%) 100%)`
}

// Format playtime from minutes to readable string
function formatPlaytime(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  if (hours === 0) return `${mins}m`
  return `${hours}h ${mins}m`
}

// Format last played date to relative time
function formatLastPlayed(dateStr: string | null): string {
  if (!dateStr) return 'Never'
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 60) return `${diffMins} minutes ago`
  if (diffHours < 24) return `${diffHours} hours ago`
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`
  return 'Months ago'
}

export function GameGrid({ games, selectedGame, onSelectGame, onAddGame, onScanGames }: GameGridProps) {
  if (games.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-10">
        <div className="flex flex-col items-center text-center max-w-md animate-in fade-in duration-500">
          <div className="size-20 flex items-center justify-center bg-white/5 rounded-2xl mb-6">
            <span className="material-symbols-outlined text-[40px] text-slate-500">sports_esports</span>
          </div>
          <h2 className="text-white text-2xl font-bold mb-2">No Games Found</h2>
          <p className="text-slate-400 text-base mb-6 leading-relaxed">
            Click "Add Game" to manually add a game, or scan your folders for games.
          </p>
          <button
            onClick={onAddGame}
            className="flex items-center gap-2 rounded-xl h-10 px-5 bg-primary hover:bg-blue-600 text-white text-sm font-bold shadow-[0_0_20px_rgba(0,123,255,0.3)] hover:shadow-[0_0_25px_rgba(0,123,255,0.5)] transition-all border border-white/10"
          >
            <span className="material-symbols-outlined text-[20px]">add_circle</span>
            Add Game Manually
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto px-10 pb-10">
      {/* Game Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {games.map(game => (
          <GameCard
            key={game.id}
            game={game}
            isSelected={selectedGame?.id === game.id}
            onClick={() => onSelectGame(game)}
          />
        ))}
      </div>

      {/* Scan for games button */}
      <div className="mt-10 flex justify-center pb-8">
        <button
          onClick={onScanGames}
          className="glass-card px-8 py-4 rounded-full flex items-center gap-3 text-slate-400 hover:text-white hover:bg-white/10 group transition-all"
        >
          <span className="material-symbols-outlined group-hover:animate-spin">sync</span>
          <span className="font-medium text-sm">Scan folders for new games</span>
        </button>
      </div>
    </div>
  )
}

interface GameCardProps {
  game: Game
  isSelected: boolean
  onClick: () => void
}

function GameCard({ game, isSelected, onClick }: GameCardProps) {
  const coverStyle = game.coverUrl
    ? { backgroundImage: `url(${game.coverUrl})` }
    : { background: generateGradient(game.name) }

  return (
    <button
      onClick={onClick}
      className={`glass-card rounded-2xl p-4 flex flex-col gap-4 group relative overflow-hidden text-left transition-all
        ${isSelected ? 'ring-2 ring-primary shadow-[0_0_20px_rgba(0,123,255,0.3)]' : ''}
      `}
      aria-pressed={isSelected}
    >
      {/* Status Badge */}
      <div className="absolute top-4 right-4 z-10">
        {game.hasUpdate ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/20 px-2.5 py-1 text-xs font-semibold text-amber-400 border border-amber-500/20 backdrop-blur-md shadow-lg">
            <span className="material-symbols-outlined text-[14px]">update</span>
            Update
          </span>
        ) : game.dxvkInstalled ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-green-500/20 px-2.5 py-1 text-xs font-semibold text-green-400 border border-green-500/20 backdrop-blur-md shadow-lg">
            <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
            Installed
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-500/20 px-2.5 py-1 text-xs font-semibold text-slate-400 border border-slate-500/20 backdrop-blur-md shadow-lg">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
            Not Installed
          </span>
        )}
      </div>

      {/* Cover Image */}
      <div className={`relative aspect-video w-full overflow-hidden rounded-xl bg-slate-800 ${!game.dxvkInstalled ? 'grayscale opacity-80 group-hover:grayscale-0 group-hover:opacity-100' : ''} transition-all`}>
        <div
          className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-105"
          style={coverStyle}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-60" />

        {/* Hover Overlay */}
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-black/40 backdrop-blur-[2px]">
          {game.dxvkInstalled ? (
            <button className="bg-white text-black rounded-full p-3 hover:scale-110 transition-transform shadow-xl">
              <span className="material-symbols-outlined text-[32px] ml-1">play_arrow</span>
            </button>
          ) : (
            <button className="px-4 py-2 bg-white/90 text-black rounded-lg text-sm font-bold hover:scale-105 transition-transform shadow-xl">
              Install DXVK
            </button>
          )}
        </div>
      </div>

      {/* Game Info */}
      <div className="flex flex-col gap-2">
        <div className="flex justify-between items-start">
          <h3 className={`text-white text-lg font-bold leading-tight transition-colors line-clamp-2 ${game.hasUpdate ? 'group-hover:text-amber-400' : 'group-hover:text-primary'}`}>
            {game.name}
          </h3>
          <div className="flex gap-1 shrink-0">
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-white/10 text-slate-300 border border-white/5">
              {game.architecture === 'x86' ? 'x32' : 'x64'}
            </span>
            {game.dxVersion && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-white/10 text-slate-300 border border-white/5">
                DX{game.dxVersion}
              </span>
            )}
          </div>
        </div>

        <div className="h-px bg-white/10 w-full my-1" />

        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex flex-col">
            <span className="text-slate-500">Playtime</span>
            <span className="text-slate-200 font-medium">{formatPlaytime(game.playtime || 0)}</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-slate-500">Last Played</span>
            <span className="text-slate-200 font-medium">{formatLastPlayed(game.lastPlayed)}</span>
          </div>
        </div>
      </div>
    </button>
  )
}
