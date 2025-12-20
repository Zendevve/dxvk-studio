import { useState, useEffect, useCallback } from 'react'
import { GameGrid } from './components/GameGrid'
import { Sidebar } from './components/Sidebar'
import { Header } from './components/Header'
import { VersionManager } from './components/VersionManager'
import { GameDetails } from './components/GameDetails'
import { AddGameModal } from './components/AddGameModal'
import { SettingsPage } from './components/SettingsPage'
import './App.css'

export interface Game {
  id: string
  name: string
  path: string
  exePath: string | null
  architecture: 'x86' | 'x64' | 'unknown'
  dxVersion: 8 | 9 | 10 | 11 | null
  dxvkInstalled: boolean
  dxvkVersion: string | null
  storefront: 'steam' | 'epic' | 'gog' | 'manual'
}

export interface DxvkVersion {
  version: string
  variant: 'standard' | 'async' | 'gplasync'
  path: string
  installed: boolean
}

type View = 'library' | 'settings' | 'downloads'

function App() {
  const [games, setGames] = useState<Game[]>([])
  const [selectedGame, setSelectedGame] = useState<Game | null>(null)
  const [currentView, setCurrentView] = useState<View>('library')
  const [isLoading, setIsLoading] = useState(false)
  const [installedVersions, setInstalledVersions] = useState<DxvkVersion[]>([])
  const [showAddGame, setShowAddGame] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load games from localStorage on mount
  useEffect(() => {
    const savedGames = localStorage.getItem('dxvk-studio-games')
    if (savedGames) {
      try {
        const parsed = JSON.parse(savedGames)
        setGames(parsed)
      } catch (e) {
        console.error('Failed to parse saved games:', e)
      }
    }
    loadInstalledVersions()
  }, [])

  // Save games to localStorage whenever they change
  useEffect(() => {
    if (games.length > 0) {
      localStorage.setItem('dxvk-studio-games', JSON.stringify(games))
    }
  }, [games])

  // Auto-dismiss errors after 5 seconds
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [error])

  const loadInstalledVersions = async () => {
    try {
      const versions = await window.electronAPI.getInstalledVersions()
      setInstalledVersions(versions)
    } catch (err) {
      console.error('Failed to load versions:', err)
    }
  }

  // Scan Steam library - MERGE with existing manual games
  const handleScanLibrary = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const scannedGames = await window.electronAPI.scanSteamLibrary()
      // Map architecture format
      const mappedGames: Game[] = scannedGames.map((g: any) => ({
        ...g,
        architecture: g.architecture === 'x86' ? 'x86' :
          g.architecture === 'x64' ? 'x64' : 'unknown'
      }))

      // Preserve manually added games
      const manualGames = games.filter(g => g.storefront === 'manual')
      setGames([...mappedGames, ...manualGames])

      if (mappedGames.length === 0 && manualGames.length === 0) {
        setError('No Steam games found. Make sure Steam is installed.')
      }
    } catch (err) {
      console.error('Failed to scan library:', err)
      setError('Failed to scan Steam library. Check console for details.')
    } finally {
      setIsLoading(false)
    }
  }, [games])

  // Install DXVK to selected game
  const handleInstallDxvk = async (versionPath: string) => {
    if (!selectedGame || !selectedGame.exePath) return

    setIsLoading(true)
    try {
      const result = await window.electronAPI.installDxvk(
        selectedGame.path,
        selectedGame.exePath,
        versionPath
      )

      if (result.success) {
        // Update game state
        setGames(prev => prev.map(g =>
          g.id === selectedGame.id
            ? { ...g, dxvkInstalled: true, dxvkVersion: 'Installed' }
            : g
        ))
        setSelectedGame(prev => prev ? { ...prev, dxvkInstalled: true, dxvkVersion: 'Installed' } : null)
      } else {
        setError(result.error || 'Installation failed')
      }
    } catch (err) {
      setError('Installation failed: ' + String(err))
    } finally {
      setIsLoading(false)
    }
  }

  // Remove DXVK from selected game
  const handleRemoveDxvk = async () => {
    if (!selectedGame) return

    setIsLoading(true)
    try {
      const result = await window.electronAPI.removeDxvk(selectedGame.path)

      if (result.success) {
        // Update game state
        setGames(prev => prev.map(g =>
          g.id === selectedGame.id
            ? { ...g, dxvkInstalled: false, dxvkVersion: null }
            : g
        ))
        setSelectedGame(prev => prev ? { ...prev, dxvkInstalled: false, dxvkVersion: null } : null)
      } else {
        setError(result.error || 'Removal failed')
      }
    } catch (err) {
      setError('Removal failed: ' + String(err))
    } finally {
      setIsLoading(false)
    }
  }

  // Add game manually
  const handleAddGame = async () => {
    const exePath = await window.electronAPI.selectExecutable()
    if (!exePath) return

    setIsLoading(true)
    try {
      const analysis = await window.electronAPI.analyzeExecutable(exePath)
      const gamePath = exePath.substring(0, exePath.lastIndexOf('\\'))
      const gameName = gamePath.split('\\').pop() || 'Unknown Game'

      const newGame: Game = {
        id: `manual-${Date.now()}`,
        name: gameName,
        path: gamePath,
        exePath,
        architecture: analysis.architecture || 'unknown',
        dxVersion: analysis.dxVersion || null,
        dxvkInstalled: false,
        dxvkVersion: null,
        storefront: 'manual'
      }

      setGames(prev => [...prev, newGame])
      setShowAddGame(false)
    } catch (err) {
      setError('Failed to add game: ' + String(err))
    } finally {
      setIsLoading(false)
    }
  }

  // Delete a game from library
  const handleDeleteGame = (gameId: string) => {
    setGames(prev => prev.filter(g => g.id !== gameId))
    if (selectedGame?.id === gameId) {
      setSelectedGame(null)
    }
    // Clear localStorage if no games left
    if (games.length <= 1) {
      localStorage.removeItem('dxvk-studio-games')
    }
  }

  // Close game details panel
  const handleCloseDetails = () => {
    setSelectedGame(null)
  }

  return (
    <div className="app">
      <Header
        onScan={handleScanLibrary}
        onAddGame={() => setShowAddGame(true)}
        isLoading={isLoading}
        gameCount={games.length}
      />

      {error && (
        <div className="error-banner" onClick={() => setError(null)}>
          <span>{error}</span>
          <button className="error-dismiss" aria-label="Dismiss error">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}

      <div className="app-main">
        <Sidebar
          currentView={currentView}
          onViewChange={setCurrentView}
          installedVersions={installedVersions.length}
        />

        <main className="app-content">
          {currentView === 'library' && (
            <GameGrid
              games={games}
              selectedGame={selectedGame}
              onSelectGame={setSelectedGame}
              onAddGame={() => setShowAddGame(true)}
            />
          )}

          {currentView === 'settings' && (
            <SettingsPage />
          )}

          {currentView === 'downloads' && (
            <VersionManager
              installedVersions={installedVersions}
              onRefresh={loadInstalledVersions}
            />
          )}
        </main>

        {selectedGame && (
          <aside className="app-sidebar-right">
            <GameDetails
              game={selectedGame}
              installedVersions={installedVersions}
              onInstall={handleInstallDxvk}
              onRemove={handleRemoveDxvk}
              onClose={handleCloseDetails}
              onDelete={() => handleDeleteGame(selectedGame.id)}
              isLoading={isLoading}
            />
          </aside>
        )}
      </div>

      {showAddGame && (
        <AddGameModal
          onClose={() => setShowAddGame(false)}
          onSelectExecutable={handleAddGame}
        />
      )}
    </div>
  )
}

export default App
