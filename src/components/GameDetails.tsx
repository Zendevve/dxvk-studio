import { useState, useEffect } from 'react'
import type { Game, DxvkVersion } from '../App'
import { ConfigEditor } from './ConfigEditor'
import './GameDetails.css'

interface GameDetailsProps {
  game: Game
  installedVersions: DxvkVersion[]
  onInstall: (versionPath: string) => void
  onRemove: () => void
  onClose: () => void
  onDelete: () => void
  isLoading: boolean
}

type DetailsView = 'info' | 'config'

export function GameDetails({
  game,
  installedVersions,
  onInstall,
  onRemove,
  onClose,
  onDelete,
  isLoading
}: GameDetailsProps) {
  const [view, setView] = useState<DetailsView>('info')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  // Reset view when game changes
  useEffect(() => {
    setView('info')
    setShowDeleteConfirm(false)
  }, [game.id])

  // ESC key to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showDeleteConfirm) {
          setShowDeleteConfirm(false)
        } else {
          onClose()
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose, showDeleteConfirm])

  const formatArchitecture = (arch: string) => {
    if (arch === 'x86') return '32-bit'
    if (arch === 'x64') return '64-bit'
    return 'Unknown'
  }

  const handleDelete = () => {
    if (showDeleteConfirm) {
      onDelete()
      setShowDeleteConfirm(false)
    } else {
      setShowDeleteConfirm(true)
    }
  }

  return (
    <div className="game-details animate-slide-up">
      {/* Header with close button */}
      <div className="game-details-header">
        <h2 className="game-details-title">{game.name}</h2>
        <button
          className="btn-icon"
          onClick={onClose}
          aria-label="Close game details"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {/* Tab switcher */}
      <div className="detail-tabs">
        <button
          className={`detail-tab ${view === 'info' ? 'active' : ''}`}
          onClick={() => setView('info')}
          aria-label="View game info"
        >
          Info
        </button>
        {game.dxvkInstalled && (
          <button
            className={`detail-tab ${view === 'config' ? 'active' : ''}`}
            onClick={() => setView('config')}
            aria-label="Configure DXVK settings"
          >
            Config
          </button>
        )}
      </div>

      {view === 'info' ? (
        <>
          <div className="game-details-section">
            <h3 className="text-secondary">Status</h3>
            <div className="badge-group">
              <span className={`badge ${game.dxvkInstalled ? 'badge-success' : 'badge-neutral'}`}>
                {game.dxvkInstalled ? `DXVK ${game.dxvkVersion || 'Installed'}` : 'No DXVK'}
              </span>
              <span className="badge badge-neutral">{formatArchitecture(game.architecture)}</span>
              {game.dxVersion && (
                <span className="badge badge-neutral">DX{game.dxVersion}</span>
              )}
            </div>
          </div>

          <div className="game-details-section">
            <h3 className="text-secondary">Storefront</h3>
            <span className="storefront-badge">
              {getStorefrontIcon(game.storefront)}
              {game.storefront.charAt(0).toUpperCase() + game.storefront.slice(1)}
            </span>
          </div>

          <div className="game-details-section">
            <h3 className="text-secondary">Path</h3>
            <code className="game-path font-mono text-tertiary">{game.path}</code>
          </div>

          <div className="game-details-actions">
            {game.dxvkInstalled ? (
              <>
                <button
                  className="btn btn-secondary"
                  onClick={() => setView('config')}
                  aria-label="Open DXVK configuration"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <circle cx="12" cy="12" r="3" />
                    <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
                  </svg>
                  Configure DXVK
                </button>
                <button
                  className="btn btn-danger"
                  onClick={onRemove}
                  disabled={isLoading}
                  aria-label="Remove DXVK from this game"
                >
                  {isLoading ? 'Removing...' : 'Remove DXVK'}
                </button>
              </>
            ) : (
              <div className="install-section">
                {installedVersions.length > 0 ? (
                  <>
                    <h3 className="text-secondary">Install DXVK</h3>
                    <div className="version-buttons">
                      {installedVersions.slice(0, 3).map(v => (
                        <button
                          key={v.path}
                          className="btn btn-primary"
                          onClick={() => onInstall(v.path)}
                          disabled={isLoading || !game.exePath}
                          aria-label={`Install ${v.variant} ${v.version}`}
                        >
                          {isLoading ? 'Installing...' : `${v.variant} ${v.version}`}
                        </button>
                      ))}
                    </div>
                    {!game.exePath && (
                      <p className="text-warning">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" style={{ verticalAlign: 'middle', marginRight: '4px' }}>
                          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                          <line x1="12" y1="9" x2="12" y2="13" />
                          <line x1="12" y1="17" x2="12.01" y2="17" />
                        </svg>
                        Executable not found. Cannot install DXVK.
                      </p>
                    )}
                  </>
                ) : (
                  <div className="no-versions">
                    <p className="text-secondary">No DXVK versions installed.</p>
                    <p className="text-tertiary">Go to "DXVK Versions" to download.</p>
                  </div>
                )}
              </div>
            )}

            {/* Delete game - only for manual games */}
            {game.storefront === 'manual' && (
              <button
                className={`btn ${showDeleteConfirm ? 'btn-danger' : 'btn-secondary'}`}
                onClick={handleDelete}
                aria-label={showDeleteConfirm ? 'Confirm delete' : 'Delete game from library'}
              >
                {showDeleteConfirm ? 'Click again to confirm' : 'Remove from Library'}
              </button>
            )}
          </div>
        </>
      ) : (
        <ConfigEditor gamePath={game.path} />
      )}
    </div>
  )
}

function getStorefrontIcon(storefront: Game['storefront']) {
  switch (storefront) {
    case 'steam':
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="storefront-icon" aria-hidden="true">
          <path d="M12 2C6.48 2 2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15.2c-1.18-.59-2-1.82-2-3.2 0-2.21 1.79-4 4-4s4 1.79 4 4c0 1.38-.82 2.61-2 3.2v6.6c4.56-.93 8-4.96 8-9.8 0-5.52-4.48-10-10-10z" />
        </svg>
      )
    default:
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="storefront-icon" aria-hidden="true">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M9 9h6v6H9z" />
        </svg>
      )
  }
}
