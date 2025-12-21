import { useState, useEffect, useCallback } from 'react'
import {
  Gamepad2,
  Settings,
  Download,
  FileText,
  Plus,
  Search,
  RefreshCw,
  FolderOpen,
  AlertTriangle,
  Check,
  X
} from 'lucide-react'
import type { Game, DxvkFork } from './shared/types'

// Check if running in Electron
const isElectron = typeof window !== 'undefined' && window.electronAPI !== undefined

function App() {
  const [games, setGames] = useState<Game[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [isScanning, setIsScanning] = useState(false)
  const [activeView, setActiveView] = useState<'games' | 'engines' | 'settings' | 'logs'>('games')
  const [selectedGame, setSelectedGame] = useState<Game | null>(null)
  const [steamInstalled, setSteamInstalled] = useState<boolean | null>(null)
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null)

  // Check if Steam is installed on mount
  useEffect(() => {
    if (isElectron) {
      window.electronAPI.checkSteamInstalled().then(setSteamInstalled)
    }
  }, [])

  // Show notification
  const showNotification = useCallback((type: 'success' | 'error' | 'info', message: string) => {
    setNotification({ type, message })
    setTimeout(() => setNotification(null), 4000)
  }, [])

  // Scan Steam library
  const handleScan = useCallback(async () => {
    if (!isElectron) {
      showNotification('error', 'Not running in Electron')
      return
    }

    setIsScanning(true)
    try {
      const scannedGames = await window.electronAPI.scanSteamLibrary()
      setGames(scannedGames.map((g, i) => ({
        id: g.id || `game-${i}`,
        name: g.name || 'Unknown Game',
        path: g.path || '',
        executable: g.executable || '',
        architecture: g.architecture || 'unknown',
        platform: g.platform || 'manual',
        steamAppId: g.steamAppId,
        dxvkStatus: g.dxvkStatus || 'inactive',
        dxvkVersion: g.dxvkVersion,
        dxvkFork: g.dxvkFork,
        createdAt: new Date(),
        updatedAt: new Date()
      } as Game)))
      showNotification('success', `Found ${scannedGames.length} games`)
    } catch (error) {
      showNotification('error', 'Failed to scan Steam library')
      console.error(error)
    } finally {
      setIsScanning(false)
    }
  }, [showNotification])

  // Add game manually
  const handleAddGame = useCallback(async () => {
    if (!isElectron) {
      showNotification('error', 'Not running in Electron')
      return
    }

    const exePath = await window.electronAPI.openFileDialog()
    if (!exePath) return

    try {
      const analysis = await window.electronAPI.analyzeExecutable(exePath)

      // Extract game name from path
      const pathParts = exePath.split('\\')
      const exeName = pathParts[pathParts.length - 1]
      const gameName = exeName.replace('.exe', '')
      const gamePath = pathParts.slice(0, -1).join('\\')

      const newGame: Game = {
        id: `manual-${Date.now()}`,
        name: gameName,
        path: gamePath,
        executable: exeName,
        architecture: analysis.architecture,
        platform: 'manual',
        dxvkStatus: 'inactive',
        createdAt: new Date(),
        updatedAt: new Date()
      }

      setGames(prev => [...prev, newGame])
      showNotification('success', `Added ${gameName} (${analysis.architecture}-bit)`)
    } catch (error) {
      showNotification('error', 'Failed to analyze executable')
      console.error(error)
    }
  }, [showNotification])

  const filteredGames = games.filter(game =>
    game.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="h-screen flex bg-studio-950">
      {/* Notification Toast */}
      {notification && (
        <div className={`
          fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg flex items-center gap-3
          animate-slide-up
          ${notification.type === 'success' ? 'bg-accent-success/20 border border-accent-success/30 text-accent-success' : ''}
          ${notification.type === 'error' ? 'bg-accent-danger/20 border border-accent-danger/30 text-accent-danger' : ''}
          ${notification.type === 'info' ? 'bg-accent-info/20 border border-accent-info/30 text-accent-info' : ''}
        `}>
          {notification.type === 'success' && <Check className="w-4 h-4" />}
          {notification.type === 'error' && <X className="w-4 h-4" />}
          {notification.type === 'info' && <AlertTriangle className="w-4 h-4" />}
          <span className="text-sm font-medium">{notification.message}</span>
        </div>
      )}

      {/* Sidebar */}
      <aside className="sidebar">
        {/* Logo */}
        <div className="p-4 border-b border-studio-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-accent-vulkan to-accent-glow flex items-center justify-center shadow-glow">
              <Gamepad2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-semibold text-studio-100">DXVK Studio</h1>
              <p className="text-xs text-studio-500">v1.0.0</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1">
          <NavItem
            icon={<Gamepad2 className="w-5 h-5" />}
            label="Games"
            active={activeView === 'games'}
            onClick={() => { setActiveView('games'); setSelectedGame(null) }}
          />
          <NavItem
            icon={<Download className="w-5 h-5" />}
            label="Engine Manager"
            active={activeView === 'engines'}
            onClick={() => setActiveView('engines')}
          />
          <NavItem
            icon={<FileText className="w-5 h-5" />}
            label="Logs"
            active={activeView === 'logs'}
            onClick={() => setActiveView('logs')}
          />
          <NavItem
            icon={<Settings className="w-5 h-5" />}
            label="Settings"
            active={activeView === 'settings'}
            onClick={() => setActiveView('settings')}
          />
        </nav>

        {/* Quick Stats */}
        <div className="p-4 border-t border-studio-800">
          <div className="glass-card p-3 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-studio-500">Games</span>
              <span className="text-studio-200 font-medium">{games.length}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-studio-500">DXVK Active</span>
              <span className="text-accent-success font-medium">
                {games.filter(g => g.dxvkStatus === 'active').length}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-studio-500">Steam</span>
              <span className={steamInstalled === null ? 'text-studio-500' : steamInstalled ? 'text-accent-success' : 'text-accent-warning'}>
                {steamInstalled === null ? '...' : steamInstalled ? 'Found' : 'Not Found'}
              </span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        {/* Header */}
        <header className="sticky top-0 z-10 bg-studio-950/80 backdrop-blur-md border-b border-studio-800 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 flex-1">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-studio-500" />
                <input
                  type="text"
                  placeholder="Search games..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="input-field pl-10"
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleScan}
                disabled={isScanning || !steamInstalled}
                className="btn-secondary flex items-center gap-2"
                title={!steamInstalled ? 'Steam not found' : undefined}
              >
                <RefreshCw className={`w-4 h-4 ${isScanning ? 'animate-spin' : ''}`} />
                {isScanning ? 'Scanning...' : 'Scan Steam'}
              </button>
              <button
                onClick={handleAddGame}
                className="btn-primary flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Game
              </button>
            </div>
          </div>
        </header>

        {/* Game Grid or Detail View */}
        <div className="p-6">
          {selectedGame ? (
            <GameDetailView
              game={selectedGame}
              onBack={() => setSelectedGame(null)}
              onUpdate={(updated) => {
                setGames(prev => prev.map(g => g.id === updated.id ? updated : g))
                setSelectedGame(updated)
              }}
            />
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
                {filteredGames.map(game => (
                  <GameCard
                    key={game.id}
                    game={game}
                    onClick={() => setSelectedGame(game)}
                  />
                ))}
              </div>

              {filteredGames.length === 0 && (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <Gamepad2 className="w-16 h-16 text-studio-700 mb-4" />
                  <h3 className="text-lg font-medium text-studio-400 mb-2">No games found</h3>
                  <p className="text-studio-500 max-w-sm">
                    {steamInstalled
                      ? 'Click "Scan Steam" to detect installed games or "Add Game" to manually add a game.'
                      : 'Steam not detected. Click "Add Game" to manually add games.'}
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  )
}

// Navigation Item Component
function NavItem({
  icon,
  label,
  active,
  onClick
}: {
  icon: React.ReactNode
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`
        w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
        transition-all duration-150
        ${active
          ? 'bg-accent-vulkan/20 text-accent-glow border border-accent-vulkan/30'
          : 'text-studio-400 hover:bg-studio-800 hover:text-studio-200'
        }
      `}
    >
      {icon}
      {label}
    </button>
  )
}

// Game Card Component
function GameCard({ game, onClick }: { game: Game; onClick: () => void }) {
  const steamIconUrl = game.steamAppId
    ? `https://cdn.cloudflare.steamstatic.com/steam/apps/${game.steamAppId}/header.jpg`
    : null

  return (
    <div
      onClick={onClick}
      className="glass-card-hover group cursor-pointer overflow-hidden"
    >
      {/* Game Art */}
      <div className="relative aspect-[460/215] bg-studio-800 overflow-hidden">
        {steamIconUrl ? (
          <img
            src={steamIconUrl}
            alt={game.name}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none'
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Gamepad2 className="w-12 h-12 text-studio-600" />
          </div>
        )}

        {/* Architecture Badge */}
        <div className="absolute top-2 right-2">
          <span className={game.architecture === '32' ? 'badge-32bit' : game.architecture === '64' ? 'badge-64bit' : 'badge'}>
            {game.architecture === 'unknown' ? '?' : `${game.architecture}-bit`}
          </span>
        </div>

        {/* Status Indicator */}
        <div className="absolute bottom-2 left-2 flex items-center gap-2">
          <span className={`
            ${game.dxvkStatus === 'active' ? 'status-active' : ''}
            ${game.dxvkStatus === 'inactive' ? 'status-inactive' : ''}
            ${game.dxvkStatus === 'outdated' || game.dxvkStatus === 'corrupt' ? 'status-warning' : ''}
          `} />
          {game.dxvkVersion && (
            <span className="text-xs text-white/80 bg-black/50 px-1.5 py-0.5 rounded">
              {game.dxvkVersion}
            </span>
          )}
        </div>
      </div>

      {/* Game Info */}
      <div className="p-3">
        <h3 className="font-medium text-studio-200 truncate group-hover:text-studio-100 transition-colors">
          {game.name}
        </h3>
        <p className="text-xs text-studio-500 truncate mt-0.5">
          {game.platform === 'steam' ? 'Steam' : 'Manual'} • {game.executable || 'No executable'}
        </p>
      </div>
    </div>
  )
}

// Game Detail View Component
function GameDetailView({
  game,
  onBack,
  onUpdate
}: {
  game: Game
  onBack: () => void
  onUpdate: (game: Game) => void
}) {
  const [isInstalling, setIsInstalling] = useState(false)
  const [selectedFork, setSelectedFork] = useState<DxvkFork>('official')
  const [selectedVersion, setSelectedVersion] = useState('')
  const [availableEngines, setAvailableEngines] = useState<Array<{
    version: string
    cached: boolean
    downloadUrl: string
  }>>([])
  const [isLoadingEngines, setIsLoadingEngines] = useState(false)

  // Anti-cheat detection state
  const [antiCheatWarning, setAntiCheatWarning] = useState<{
    hasAntiCheat: boolean
    highRisk: boolean
    detected: string[]
  } | null>(null)
  const [showAntiCheatOverride, setShowAntiCheatOverride] = useState(false)

  // Scan for anti-cheat on mount
  useEffect(() => {
    if (!isElectron) return

    const checkAntiCheat = async () => {
      try {
        const summary = await window.electronAPI.getAntiCheatSummary(game.path)
        setAntiCheatWarning(summary)
      } catch (error) {
        console.error('Failed to check anti-cheat:', error)
      }
    }

    checkAntiCheat()
  }, [game.path])

  // Fetch available engines when fork changes
  useEffect(() => {
    if (!isElectron) return

    const fetchEngines = async () => {
      setIsLoadingEngines(true)
      try {
        const engines = await window.electronAPI.getAvailableEngines(selectedFork)
        setAvailableEngines(engines.map(e => ({
          version: e.version,
          cached: e.cached,
          downloadUrl: e.downloadUrl
        })))
        // Auto-select first version if none selected
        if (engines.length > 0 && !selectedVersion) {
          setSelectedVersion(engines[0].version)
        }
      } catch (error) {
        console.error('Failed to fetch engines:', error)
        setAvailableEngines([])
      } finally {
        setIsLoadingEngines(false)
      }
    }

    fetchEngines()
  }, [selectedFork])

  const steamIconUrl = game.steamAppId
    ? `https://cdn.cloudflare.steamstatic.com/steam/apps/${game.steamAppId}/header.jpg`
    : null

  const handleInstall = async () => {
    if (!isElectron || game.architecture === 'unknown') return

    setIsInstalling(true)
    try {
      // Check if version is cached, if not download it
      const isCached = await window.electronAPI.isEngineCached(selectedFork, selectedVersion)

      if (!isCached) {
        // Get available engines to find download URL
        const engines = await window.electronAPI.getAvailableEngines(selectedFork)
        const engine = engines.find(e => e.version === selectedVersion)

        if (engine) {
          await window.electronAPI.downloadEngine(selectedFork, selectedVersion, engine.downloadUrl)
        }
      }

      // Install DXVK
      const result = await window.electronAPI.installDxvk(
        game.path,
        game.id,
        selectedFork,
        selectedVersion,
        game.architecture
      )

      if (result.success) {
        onUpdate({
          ...game,
          dxvkStatus: 'active',
          dxvkVersion: selectedVersion,
          dxvkFork: selectedFork
        })
      }
    } catch (error) {
      console.error('Install failed:', error)
    } finally {
      setIsInstalling(false)
    }
  }

  const handleUninstall = async () => {
    if (!isElectron) return

    setIsInstalling(true)
    try {
      const result = await window.electronAPI.uninstallDxvk(game.path)

      if (result.success) {
        onUpdate({
          ...game,
          dxvkStatus: 'inactive',
          dxvkVersion: undefined,
          dxvkFork: undefined
        })
      }
    } catch (error) {
      console.error('Uninstall failed:', error)
    } finally {
      setIsInstalling(false)
    }
  }

  const handleOpenFolder = async () => {
    if (isElectron) {
      await window.electronAPI.openPath(game.path)
    }
  }

  return (
    <div className="animate-fade-in">
      {/* Back button and header */}
      <button
        onClick={onBack}
        className="text-studio-400 hover:text-studio-200 text-sm mb-4 flex items-center gap-2"
      >
        ← Back to Games
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column - Game info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Header card */}
          <div className="glass-card overflow-hidden">
            <div className="relative h-48">
              {steamIconUrl ? (
                <img
                  src={steamIconUrl}
                  alt={game.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-studio-800 flex items-center justify-center">
                  <Gamepad2 className="w-20 h-20 text-studio-600" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-studio-900/90 to-transparent" />
              <div className="absolute bottom-4 left-4">
                <h2 className="text-2xl font-bold text-white">{game.name}</h2>
                <p className="text-studio-400 text-sm mt-1">{game.path}</p>
              </div>
            </div>
          </div>

          {/* DXVK Control */}
          <div className="glass-card p-6">
            <h3 className="text-lg font-semibold text-studio-200 mb-4">DXVK Management</h3>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm text-studio-400 mb-2">Fork</label>
                <select
                  value={selectedFork}
                  onChange={(e) => setSelectedFork(e.target.value as DxvkFork)}
                  className="input-field"
                  disabled={game.dxvkStatus === 'active'}
                >
                  <option value="official">Official (doitsujin)</option>
                  <option value="gplasync">GPL Async (Ph42oN)</option>
                  <option value="nvapi">NVAPI (jp7677)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-studio-400 mb-2">Version</label>
                <select
                  value={selectedVersion}
                  onChange={(e) => setSelectedVersion(e.target.value)}
                  className="input-field"
                  disabled={game.dxvkStatus === 'active' || isLoadingEngines}
                >
                  {isLoadingEngines ? (
                    <option value="">Loading versions...</option>
                  ) : availableEngines.length === 0 ? (
                    <option value="">No versions available</option>
                  ) : (
                    availableEngines.map((engine, index) => (
                      <option key={engine.version} value={engine.version}>
                        {engine.version}{index === 0 ? ' (Latest)' : ''}{engine.cached ? ' ✓' : ''}
                      </option>
                    ))
                  )}
                </select>
              </div>
            </div>

            {/* Anti-Cheat Warning Banner */}
            {antiCheatWarning?.hasAntiCheat && game.dxvkStatus !== 'active' && (
              <div className={`rounded-lg p-4 mb-6 border ${antiCheatWarning.highRisk
                ? 'bg-accent-danger/10 border-accent-danger/30'
                : 'bg-accent-warning/10 border-accent-warning/30'
                }`}>
                <div className="flex items-start gap-3">
                  <AlertTriangle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${antiCheatWarning.highRisk ? 'text-accent-danger' : 'text-accent-warning'
                    }`} />
                  <div className="flex-1">
                    <h4 className={`font-semibold ${antiCheatWarning.highRisk ? 'text-accent-danger' : 'text-accent-warning'
                      }`}>
                      {antiCheatWarning.highRisk ? '⚠️ High-Risk Anti-Cheat Detected' : '⚡ Anti-Cheat Detected'}
                    </h4>
                    <p className="text-sm text-studio-300 mt-1">
                      Found: <strong>{antiCheatWarning.detected.join(', ')}</strong>
                    </p>
                    <p className="text-sm text-studio-400 mt-2">
                      {antiCheatWarning.highRisk
                        ? 'Using DXVK with this game may result in a permanent ban. Only proceed if this is a single-player game or you understand the risks.'
                        : 'This game has anti-cheat software. DXVK may or may not be detected. Proceed with caution.'}
                    </p>

                    {antiCheatWarning.highRisk && (
                      <label className="flex items-center gap-2 mt-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={showAntiCheatOverride}
                          onChange={(e) => setShowAntiCheatOverride(e.target.checked)}
                          className="w-4 h-4 rounded border-studio-600 bg-studio-800 text-accent-danger focus:ring-accent-danger"
                        />
                        <span className="text-sm text-studio-300">
                          I understand the risks and want to proceed anyway
                        </span>
                      </label>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              {game.dxvkStatus === 'active' ? (
                <button
                  onClick={handleUninstall}
                  disabled={isInstalling}
                  className="btn-secondary flex items-center gap-2"
                >
                  {isInstalling ? <RefreshCw className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                  Uninstall DXVK
                </button>
              ) : (
                <button
                  onClick={handleInstall}
                  disabled={
                    isInstalling ||
                    game.architecture === 'unknown' ||
                    (antiCheatWarning?.highRisk && !showAntiCheatOverride)
                  }
                  className="btn-primary flex items-center gap-2"
                >
                  {isInstalling ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  Install DXVK
                </button>
              )}

              <button
                onClick={handleOpenFolder}
                className="btn-secondary flex items-center gap-2"
              >
                <FolderOpen className="w-4 h-4" />
                Open Folder
              </button>
            </div>

            {game.architecture === 'unknown' && (
              <p className="text-accent-warning text-sm mt-4">
                ⚠️ Could not determine game architecture. Please select the correct executable.
              </p>
            )}
          </div>
        </div>

        {/* Right column - Status */}
        <div className="space-y-6">
          <div className="glass-card p-6">
            <h3 className="text-lg font-semibold text-studio-200 mb-4">Status</h3>

            <div className="space-y-4">
              <div className="flex justify-between">
                <span className="text-studio-400">DXVK</span>
                <span className={`font-medium ${game.dxvkStatus === 'active' ? 'text-accent-success' : 'text-studio-500'}`}>
                  {game.dxvkStatus === 'active' ? 'Installed' : 'Not Installed'}
                </span>
              </div>

              {game.dxvkVersion && (
                <div className="flex justify-between">
                  <span className="text-studio-400">Version</span>
                  <span className="text-studio-200">{game.dxvkVersion}</span>
                </div>
              )}

              {game.dxvkFork && (
                <div className="flex justify-between">
                  <span className="text-studio-400">Fork</span>
                  <span className="text-studio-200 capitalize">{game.dxvkFork}</span>
                </div>
              )}

              <div className="flex justify-between">
                <span className="text-studio-400">Architecture</span>
                <span className={game.architecture === '32' ? 'badge-32bit' : game.architecture === '64' ? 'badge-64bit' : 'text-studio-500'}>
                  {game.architecture === 'unknown' ? 'Unknown' : `${game.architecture}-bit`}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-studio-400">Platform</span>
                <span className="text-studio-200 capitalize">{game.platform}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-studio-400">Executable</span>
                <span className="text-studio-200 text-sm truncate max-w-[150px]" title={game.executable}>
                  {game.executable || 'None'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App
