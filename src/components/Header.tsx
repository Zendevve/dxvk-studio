import './Header.css'

interface HeaderProps {
  onScan: () => void
  onAddGame: () => void
  isLoading: boolean
  gameCount: number
}

export function Header({ onScan, onAddGame, isLoading, gameCount }: HeaderProps) {
  return (
    <header className="header glass">
      <div className="header-left">
        <div className="header-logo">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M2 17L12 22L22 17" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M2 12L12 17L22 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h1 className="header-title">DXVK Studio</h1>
        <span className="badge badge-neutral">v1.0.0 MVP</span>
        {gameCount > 0 && (
          <span className="badge badge-success">{gameCount} games</span>
        )}
      </div>
      <div className="header-right">
        <button
          className="btn btn-secondary"
          onClick={onAddGame}
          disabled={isLoading}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add Game
        </button>
        <button
          className="btn btn-primary"
          onClick={onScan}
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <span className="spinner" />
              Scanning...
            </>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Scan Steam
            </>
          )}
        </button>
      </div>
    </header>
  )
}
