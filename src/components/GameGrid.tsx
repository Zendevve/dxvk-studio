import type { Game } from '../App'
import './GameGrid.css'

interface GameGridProps {
  games: Game[]
  selectedGame: Game | null
  onSelectGame: (game: Game) => void
  onAddGame: () => void
}

export function GameGrid({ games, selectedGame, onSelectGame, onAddGame }: GameGridProps) {
  if (games.length === 0) {
    return (
      <div className="game-grid-empty">
        <div className="empty-state">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="empty-icon">
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
          </svg>
          <h2>No Games Found</h2>
          <p className="text-secondary">
            Click "Scan Steam" to detect games, or add a game manually.
          </p>
          <button className="btn btn-primary" onClick={onAddGame}>
            Add Game Manually
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="game-grid">
      <div className="game-grid-header">
        <h2>Game Library</h2>
        <span className="text-secondary">{games.length} games</span>
      </div>
      <div className="game-grid-list">
        {games.map(game => (
          <GameCard
            key={game.id}
            game={game}
            isSelected={selectedGame?.id === game.id}
            onClick={() => onSelectGame(game)}
          />
        ))}
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
  return (
    <button
      className={`game-card card-interactive ${isSelected ? 'selected' : ''}`}
      onClick={onClick}
      aria-pressed={isSelected}
    >
      <div className="game-card-icon">
        {getStorefrontIcon(game.storefront)}
      </div>
      <div className="game-card-content">
        <h3 className="game-card-title">{game.name}</h3>
        <div className="game-card-meta">
          <span className="game-card-arch">{game.architecture}</span>
          {game.dxVersion && <span className="game-card-dx">DX{game.dxVersion}</span>}
        </div>
      </div>
      <div className="game-card-status">
        {game.dxvkInstalled ? (
          <span className="badge badge-success">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <polyline points="20,6 9,17 4,12" />
            </svg>
            DXVK
          </span>
        ) : (
          <span className="badge badge-neutral">Native</span>
        )}
      </div>
    </button>
  )
}

function getStorefrontIcon(storefront: Game['storefront']) {
  switch (storefront) {
    case 'steam':
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C6.48 2 2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15.2c-1.18-.59-2-1.82-2-3.2 0-2.21 1.79-4 4-4s4 1.79 4 4c0 1.38-.82 2.61-2 3.2v6.6c4.56-.93 8-4.96 8-9.8 0-5.52-4.48-10-10-10z" />
        </svg>
      )
    case 'epic':
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
          <path d="M3.537 0C2.165 0 1.66.506 1.66 1.879V18.12c0 1.373.505 1.879 1.877 1.879h16.926c1.372 0 1.877-.506 1.877-1.879V1.879C22.34.506 21.835 0 20.463 0H3.537zm5.123 5.1h5.68v1.73h-3.59v2.1h3.37v1.73h-3.37v2.18h3.71v1.73h-5.8V5.1z" />
        </svg>
      )
    default:
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M9 9h6v6H9z" />
        </svg>
      )
  }
}
