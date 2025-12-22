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
  X,
  Heart,
  ExternalLink,
  Trash2,
  Pencil,
  Circle,
  CircleDot,
  CircleAlert
} from 'lucide-react'
import type { Game, DxvkFork } from './shared/types'

// Check if running in Electron
const isElectron = typeof window !== 'undefined' && window.electronAPI !== undefined

function App() {
  // Load games from localStorage on init
  const [games, setGames] = useState<Game[]>(() => {
    try {
      const saved = localStorage.getItem('dxvk-studio-games')
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })
  const [searchQuery, setSearchQuery] = useState('')
  const [isScanning, setIsScanning] = useState(false)
  const [activeView, setActiveView] = useState<'games' | 'engines' | 'settings' | 'logs'>('games')
  const [selectedGame, setSelectedGame] = useState<Game | null>(null)
  const [steamInstalled, setSteamInstalled] = useState<boolean | null>(null)
  const [notification, setNotification] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null)

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    game: Game
  } | null>(null)

  // Save games to localStorage when they change
  useEffect(() => {
    localStorage.setItem('dxvk-studio-games', JSON.stringify(games))
  }, [games])

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
      const scannedGames = await window.electronAPI.scanAllGames()
      const newSteamGames = scannedGames.map((g: Partial<Game>, i: number) => ({
        id: g.id || `steam-${i}`,
        name: g.name || 'Unknown Game',
        path: g.path || '',
        executable: g.executable || '',
        architecture: g.architecture || 'unknown',
        platform: 'steam' as const,
        steamAppId: g.steamAppId,
        dxvkStatus: g.dxvkStatus || 'inactive',
        dxvkVersion: g.dxvkVersion,
        dxvkFork: g.dxvkFork,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      } as Game))

      // Merge: keep manual games, update/add steam games
      setGames(prev => {
        const manualGames = prev.filter(g => g.platform === 'manual')

        // Update existing steam games or add new ones
        const updatedSteamGames = newSteamGames.map(newGame => {
          const existing = prev.find(g => g.steamAppId === newGame.steamAppId)
          if (existing) {
            return { ...existing, ...newGame, createdAt: existing.createdAt }
          }
          return newGame
        })

        return [...manualGames, ...updatedSteamGames]
      })
      showNotification('success', `Found ${scannedGames.length} Steam games`)
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
      let gameName = exeName.replace('.exe', '')
      const gamePath = pathParts.slice(0, -1).join('\\')

      // Get folder context
      const parentFolder = pathParts[pathParts.length - 2] || ''
      const grandParentFolder = pathParts[pathParts.length - 3] || ''
      const folderContext = (parentFolder.toLowerCase() === 'bin' || parentFolder.toLowerCase() === 'binaries' || parentFolder.toLowerCase() === 'x64' || parentFolder.toLowerCase() === 'x86')
        ? grandParentFolder
        : parentFolder

      // Smart Name Parsing: Use folder name if exe is generic or too short
      const genericNames = ['launcher', 'game', 'start', 'client', 'app', 'play', 'setup', 'updater', 'boot', 'shipping', 'main', 'run']
      const isGeneric = genericNames.some(n => gameName.toLowerCase().includes(n))
      const isTooShort = gameName.length <= 4 // Short names like "wow", "ue4", "dx11" are ambiguous

      if ((isGeneric || isTooShort) && folderContext) {
        gameName = folderContext
      }

      // Metadata Fetching: Try game name first, then folder context as fallback
      showNotification('info', `Analyzed ${analysis.architecture}-bit. Searching metadata...`)
      let steamId = await window.electronAPI.searchMetadata(gameName)

      // If no match and folder context is different, try folder name
      if (!steamId && folderContext && folderContext !== gameName) {
        steamId = await window.electronAPI.searchMetadata(folderContext)
      }

      const newGame: Game = {
        id: `manual-${Date.now()}`,
        name: gameName,
        path: gamePath,
        executable: exeName,
        architecture: analysis.architecture,
        platform: 'manual',
        steamAppId: steamId ? steamId.toString() : undefined, // Add Steam ID if found
        dxvkStatus: 'inactive',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }

      setGames(prev => [...prev, newGame])

      if (steamId) {
        showNotification('success', `Added ${gameName} (Found Cover Art)`)
      } else {
        showNotification('success', `Added ${gameName} (${analysis.architecture}-bit)`)
      }

    } catch (error) {
      showNotification('error', 'Failed to analyze/add game')
      console.error(error)
    }
  }, [showNotification])

  // Remove game from library
  const handleRemoveGame = useCallback((gameId: string) => {
    setGames(prev => prev.filter(g => g.id !== gameId))
    setSelectedGame(null)
    showNotification('success', 'Game removed from library')
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
          animate-slide-up backdrop-blur-sm
          ${notification.type === 'success' ? 'bg-accent-success border border-accent-success/50 text-white' : ''}
          ${notification.type === 'error' ? 'bg-accent-danger border border-accent-danger/50 text-white' : ''}
          ${notification.type === 'info' ? 'bg-accent-info border border-accent-info/50 text-white' : ''}
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

        {/* Main Content - View Switching */}
        {activeView === 'engines' ? (
          <EngineManagerView />
        ) : activeView === 'games' ? (
          <div className="p-6">
            {selectedGame ? (
              <GameDetailView
                game={selectedGame}
                onBack={() => setSelectedGame(null)}
                onUpdate={(updated) => {
                  setGames(prev => prev.map(g => g.id === updated.id ? updated : g))
                  setSelectedGame(updated)
                }}
                onRemove={() => handleRemoveGame(selectedGame.id)}
              />
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
                  {filteredGames.map(game => (
                    <GameCard
                      key={game.id}
                      game={game}
                      onClick={() => setSelectedGame(game)}
                      onContextMenu={(e, g) => setContextMenu({ x: e.clientX, y: e.clientY, game: g })}
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

                {/* Context Menu */}
                {contextMenu && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setContextMenu(null)}
                    />
                    <div
                      className="fixed z-50 glass-card py-1 min-w-[160px] shadow-xl animate-fade-in"
                      style={{ left: contextMenu.x, top: contextMenu.y }}
                    >
                      <button
                        onClick={async () => {
                          if (isElectron) {
                            await window.electronAPI.openPath(contextMenu.game.path)
                          }
                          setContextMenu(null)
                        }}
                        className="w-full px-3 py-3 min-h-[44px] text-left text-sm text-studio-200 hover:bg-studio-700/50 flex items-center gap-2 focus-visible:outline-none focus-visible:bg-studio-700/50"
                      >
                        <FolderOpen className="w-4 h-4" />
                        Open Folder
                      </button>
                      <button
                        onClick={() => {
                          setSelectedGame(contextMenu.game)
                          setContextMenu(null)
                        }}
                        className="w-full px-3 py-3 min-h-[44px] text-left text-sm text-studio-200 hover:bg-studio-700/50 flex items-center gap-2 focus-visible:outline-none focus-visible:bg-studio-700/50"
                      >
                        <Gamepad2 className="w-4 h-4" />
                        View Details
                      </button>
                      <div className="border-t border-studio-700 my-1" />
                      <button
                        onClick={() => {
                          if (window.confirm(`Remove "${contextMenu.game.name}" from library?`)) {
                            handleRemoveGame(contextMenu.game.id)
                          }
                          setContextMenu(null)
                        }}
                        className="w-full px-3 py-3 min-h-[44px] text-left text-sm text-accent-danger hover:bg-accent-danger/10 flex items-center gap-2 focus-visible:outline-none focus-visible:bg-accent-danger/10"
                      >
                        <Trash2 className="w-4 h-4" />
                        Remove from Library
                      </button>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        ) : activeView === 'settings' ? (
          <SettingsView />
        ) : (
          <div className="p-6 flex flex-col items-center justify-center py-20 text-center">
            <FileText className="w-16 h-16 text-studio-700 mb-4" />
            <h3 className="text-lg font-medium text-studio-400 mb-2">Coming Soon</h3>
            <p className="text-studio-500">This view is under development.</p>
          </div>
        )}
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

// Engine Manager View Component
function EngineManagerView() {
  const [cachedEngines, setCachedEngines] = useState<Array<{
    fork: DxvkFork
    version: string
    path: string
    sizeBytes: number
  }>>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDeleting, setIsDeleting] = useState<string | null>(null)

  useEffect(() => {
    if (!isElectron) return

    const fetchCached = async () => {
      setIsLoading(true)
      try {
        const engines = await window.electronAPI.getAllCachedEngines()
        setCachedEngines(engines)
      } catch (error) {
        console.error('Failed to fetch cached engines:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchCached()
  }, [])

  const handleDelete = async (fork: DxvkFork, version: string) => {
    if (!isElectron) return

    // Confirmation dialog
    const confirmed = window.confirm(`Delete ${fork} ${version}? This will remove the cached engine files.`)
    if (!confirmed) return

    const key = `${fork}-${version}`
    setIsDeleting(key)

    try {
      const result = await window.electronAPI.deleteEngine(fork, version)
      if (result.success) {
        setCachedEngines(prev => prev.filter(e => !(e.fork === fork && e.version === version)))
      }
    } catch (error) {
      console.error('Failed to delete engine:', error)
    } finally {
      setIsDeleting(null)
    }
  }

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
  }

  const totalSize = cachedEngines.reduce((acc, e) => acc + e.sizeBytes, 0)

  const forkLabels: Record<DxvkFork, string> = {
    official: 'Official',
    gplasync: 'GPL Async',
    nvapi: 'NVAPI'
  }

  return (
    <div className="animate-fade-in p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-studio-100">Engine Manager</h2>
          <p className="text-studio-400 mt-1">Manage cached DXVK versions</p>
        </div>
        <div className="glass-card px-4 py-2">
          <span className="text-sm text-studio-400">Total Cache: </span>
          <span className="text-sm font-medium text-studio-200">{formatSize(totalSize)}</span>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="w-8 h-8 text-accent-vulkan animate-spin" />
        </div>
      ) : cachedEngines.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Download className="w-16 h-16 text-studio-700 mb-4" />
          <h3 className="text-lg font-medium text-studio-400 mb-2">No cached engines</h3>
          <p className="text-studio-500 max-w-sm">
            DXVK versions will be cached here when you install them to games.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {cachedEngines.map((engine) => {
            const key = `${engine.fork}-${engine.version}`
            const deleting = isDeleting === key

            return (
              <div key={key} className="glass-card p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-accent-vulkan/20 flex items-center justify-center">
                    <Download className="w-5 h-5 text-accent-vulkan" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-studio-200">{forkLabels[engine.fork]}</span>
                      <span className="text-accent-glow font-mono">v{engine.version}</span>
                    </div>
                    <p className="text-sm text-studio-500">{formatSize(engine.sizeBytes)}</p>
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(engine.fork, engine.version)}
                  disabled={deleting}
                  className="btn-secondary flex items-center gap-2 text-accent-danger hover:bg-accent-danger/10"
                >
                  {deleting ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <X className="w-4 h-4" />
                  )}
                  Delete
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// Settings View Component
function SettingsView() {
  const [defaultFork, setDefaultFork] = useState<DxvkFork>('official')
  const [cacheSize, setCacheSize] = useState<string>('Calculating...')

  useEffect(() => {
    if (!isElectron) return

    const fetchCacheSize = async () => {
      try {
        const engines = await window.electronAPI.getAllCachedEngines()
        const totalBytes = engines.reduce((acc: number, e: { sizeBytes: number }) => acc + e.sizeBytes, 0)

        if (totalBytes === 0) {
          setCacheSize('0 B')
        } else {
          const k = 1024
          const sizes = ['B', 'KB', 'MB', 'GB']
          const i = Math.floor(Math.log(totalBytes) / Math.log(k))
          setCacheSize(`${parseFloat((totalBytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`)
        }
      } catch {
        setCacheSize('Unknown')
      }
    }

    fetchCacheSize()
  }, [])

  const forkLabels: Record<DxvkFork, string> = {
    official: 'Official (doitsujin)',
    gplasync: 'GPL Async (Ph42oN)',
    nvapi: 'NVAPI (jp7677)'
  }

  return (
    <div className="animate-fade-in p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-studio-100">Settings</h2>
        <p className="text-studio-400 mt-1">Configure DXVK Studio preferences</p>
      </div>

      <div className="space-y-6 max-w-2xl mx-auto">
        {/* Preferences Section */}
        <div className="glass-card p-6">
          <h3 className="text-lg font-semibold text-studio-200 mb-4 flex items-center gap-2">
            <Settings className="w-5 h-5 text-accent-vulkan" />
            Preferences
          </h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm text-studio-400 mb-2">Default DXVK Fork</label>
              <select
                value={defaultFork}
                onChange={(e) => setDefaultFork(e.target.value as DxvkFork)}
                className="input-field max-w-xs"
              >
                {Object.entries(forkLabels).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
              <p className="text-xs text-studio-500 mt-1">
                Fork to use by default when installing DXVK
              </p>
            </div>
          </div>
        </div>

        {/* Storage Section */}
        <div className="glass-card p-6">
          <h3 className="text-lg font-semibold text-studio-200 mb-4 flex items-center gap-2">
            <Download className="w-5 h-5 text-accent-vulkan" />
            Storage
          </h3>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-studio-300">Cached Engines</p>
                <p className="text-xs text-studio-500">Downloaded DXVK versions</p>
              </div>
              <span className="text-studio-200 font-medium">{cacheSize}</span>
            </div>
          </div>
        </div>

        {/* Support Section */}
        <div className="glass-card p-6 bg-gradient-to-br from-accent-vulkan/10 to-transparent border-accent-vulkan/20">
          <h3 className="text-lg font-semibold text-studio-100 mb-4 flex items-center gap-2">
            <Heart className="w-5 h-5 text-accent-danger fill-accent-danger" />
            Support Project
          </h3>

          <p className="text-studio-300 transform mb-6">
            DXVK Studio is open source and free. If you enjoy using it, consider supporting development!
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={() => window.open('https://github.com/sponsors/Zendevve', '_blank')}
              className="btn-primary flex items-center justify-center gap-2 py-3"
            >
              <Heart className="w-4 h-4" />
              GitHub Sponsors
            </button>
            <button
              onClick={() => window.open('https://ko-fi.com', '_blank')}
              className="btn-secondary flex items-center justify-center gap-2 py-3"
            >
              <ExternalLink className="w-4 h-4" />
              Donate via Ko-fi
            </button>
          </div>

          <div className="mt-4 text-center">
            <button
              onClick={() => window.open('https://github.com/Zendevve/dxvk-studio', '_blank')}
              className="text-xs text-studio-500 hover:text-accent-vulkan transition-colors"
            >
              Star on GitHub
            </button>
          </div>
        </div>


        {/* About Section */}
        <div className="glass-card p-6">
          <h3 className="text-lg font-semibold text-studio-200 mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-accent-vulkan" />
            About
          </h3>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-studio-300">Version</p>
              <span className="text-studio-200 font-mono">1.0.0</span>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-studio-300">Platform</p>
              <span className="text-studio-200">Windows</span>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-studio-300">Framework</p>
              <span className="text-studio-200">Electron 33</span>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-studio-700">
            <p className="text-sm text-studio-500">
              DXVK Studio helps you manage DXVK installations across your game library.
              Built with Electron, React, and TypeScript.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// Config Editor Modal Component
function ConfigEditorModal({
  isOpen,
  gamePath,
  onClose,
  onSave
}: {
  isOpen: boolean
  gamePath: string
  onClose: () => void
  onSave: () => void
}) {
  const [config, setConfig] = useState({
    enableAsync: true,
    numCompilerThreads: 0,
    maxFrameLatency: 1,
    enableHDR: false,
    logLevel: 'warn' as 'none' | 'error' | 'warn' | 'info' | 'debug'
  })
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async () => {
    if (!isElectron) return

    setIsSaving(true)
    try {
      await window.electronAPI.saveConfig(gamePath, config)
      onSave()
      onClose()
    } catch (error) {
      console.error('Failed to save config:', error)
    } finally {
      setIsSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 animate-fade-in">
      <div className="glass-card max-w-lg w-full mx-4 p-6 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-studio-100">Configure DXVK</h3>
          <button
            onClick={onClose}
            className="btn-icon"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-6">
          {/* Performance Section */}
          <div>
            <h4 className="text-sm font-medium text-accent-vulkan mb-3 uppercase tracking-wider">Performance</h4>
            <div className="space-y-4">
              <label className="flex items-center justify-between">
                <div>
                  <p className="text-studio-200">Async Shader Compilation</p>
                  <p className="text-xs text-studio-500">Compile shaders in background (may cause stuttering)</p>
                </div>
                <input
                  type="checkbox"
                  checked={config.enableAsync}
                  onChange={(e) => setConfig({ ...config, enableAsync: e.target.checked })}
                  className="w-5 h-5 rounded border-studio-600 bg-studio-800 text-accent-vulkan focus:ring-accent-vulkan"
                />
              </label>

              <div>
                <label className="block text-studio-200 mb-1">Compiler Threads</label>
                <p className="text-xs text-studio-500 mb-2">0 = auto (recommended)</p>
                <input
                  type="number"
                  min="0"
                  max="16"
                  value={config.numCompilerThreads}
                  onChange={(e) => setConfig({ ...config, numCompilerThreads: parseInt(e.target.value) || 0 })}
                  className="input-field w-24"
                />
              </div>
            </div>
          </div>

          {/* Frame Pacing Section */}
          <div>
            <h4 className="text-sm font-medium text-accent-vulkan mb-3 uppercase tracking-wider">Frame Pacing</h4>
            <div className="space-y-4">
              <div>
                <label className="block text-studio-200 mb-1">Max Frame Latency</label>
                <p className="text-xs text-studio-500 mb-2">Lower = less input lag, higher = smoother frames</p>
                <select
                  value={config.maxFrameLatency}
                  onChange={(e) => setConfig({ ...config, maxFrameLatency: parseInt(e.target.value) })}
                  className="input-field w-32"
                >
                  <option value={1}>1 (Low latency)</option>
                  <option value={2}>2</option>
                  <option value={3}>3 (Smooth)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Display Section */}
          <div>
            <h4 className="text-sm font-medium text-accent-vulkan mb-3 uppercase tracking-wider">Display</h4>
            <div className="space-y-4">
              <label className="flex items-center justify-between">
                <div>
                  <p className="text-studio-200">Enable HDR</p>
                  <p className="text-xs text-studio-500">Requires HDR-capable display</p>
                </div>
                <input
                  type="checkbox"
                  checked={config.enableHDR}
                  onChange={(e) => setConfig({ ...config, enableHDR: e.target.checked })}
                  className="w-5 h-5 rounded border-studio-600 bg-studio-800 text-accent-vulkan focus:ring-accent-vulkan"
                />
              </label>
            </div>
          </div>

          {/* Debug Section */}
          <div>
            <h4 className="text-sm font-medium text-accent-vulkan mb-3 uppercase tracking-wider">Debug</h4>
            <div className="space-y-4">
              <div>
                <label className="block text-studio-200 mb-1">Log Level</label>
                <select
                  value={config.logLevel}
                  onChange={(e) => setConfig({ ...config, logLevel: e.target.value as typeof config.logLevel })}
                  className="input-field w-40"
                >
                  <option value="none">None</option>
                  <option value="error">Error</option>
                  <option value="warn">Warning</option>
                  <option value="info">Info</option>
                  <option value="debug">Debug</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-studio-700">
          <button onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="btn-primary flex items-center gap-2"
          >
            {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Save Config
          </button>
        </div>
      </div>
    </div>
  )
}

// Game Card Component
function GameCard({
  game,
  onClick,
  onContextMenu
}: {
  game: Game
  onClick: () => void
  onContextMenu: (e: React.MouseEvent, game: Game) => void
}) {
  const steamIconUrl = game.steamAppId
    ? `https://cdn.cloudflare.steamstatic.com/steam/apps/${game.steamAppId}/header.jpg`
    : null

  return (
    <div
      onClick={onClick}
      onContextMenu={(e) => {
        e.preventDefault()
        onContextMenu(e, game)
      }}
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

        {/* Status Indicator with Icon Badge (HIG: not color-only) */}
        <div className="absolute bottom-2 left-2 flex items-center gap-2">
          {game.dxvkStatus === 'active' && (
            <span className="flex items-center gap-1 text-xs text-white/90 bg-accent-success/80 px-1.5 py-0.5 rounded" title="DXVK Active">
              <CircleDot className="w-3 h-3" aria-hidden="true" />
              <span className="sr-only">DXVK Active</span>
            </span>
          )}
          {game.dxvkStatus === 'inactive' && (
            <span className="flex items-center gap-1 text-xs text-white/70 bg-studio-600/80 px-1.5 py-0.5 rounded" title="DXVK Not Installed">
              <Circle className="w-3 h-3" aria-hidden="true" />
              <span className="sr-only">DXVK Not Installed</span>
            </span>
          )}
          {(game.dxvkStatus === 'outdated' || game.dxvkStatus === 'corrupt') && (
            <span className="flex items-center gap-1 text-xs text-white/90 bg-accent-warning/80 px-1.5 py-0.5 rounded" title="DXVK Needs Attention">
              <CircleAlert className="w-3 h-3" aria-hidden="true" />
              <span className="sr-only">DXVK Needs Attention</span>
            </span>
          )}
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
          {game.platform === 'steam' ? 'Steam' : game.platform === 'gog' ? 'GOG Galaxy' : game.platform === 'epic' ? 'Epic Games' : 'Manual'} • {game.executable || 'No executable'}
        </p>
      </div>
    </div>
  )
}

// Game Detail View Component
function GameDetailView({
  game,
  onBack,
  onUpdate,
  onRemove
}: {
  game: Game
  onBack: () => void
  onUpdate: (game: Game) => void
  onRemove: () => void
}) {
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false)
  const [isInstalling, setIsInstalling] = useState(false)
  const [installStatus, setInstallStatus] = useState('')
  const [selectedFork, setSelectedFork] = useState<DxvkFork>('official')
  const [selectedVersion, setSelectedVersion] = useState('')
  const [availableEngines, setAvailableEngines] = useState<Array<{
    version: string
    cached: boolean
    downloadUrl: string
  }>>([])
  const [isLoadingEngines, setIsLoadingEngines] = useState(false)

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState(game.name)

  // Steam search modal state
  const [showSearchModal, setShowSearchModal] = useState(false)
  const [searchTerm, setSearchTerm] = useState(game.name)
  const [searchResults, setSearchResults] = useState<Array<{ id: number; name: string; imageUrl: string }>>([])
  const [isSearching, setIsSearching] = useState(false)

  // Debounced live search
  useEffect(() => {
    if (!showSearchModal || !isElectron || searchTerm.length < 2) return

    const timer = setTimeout(async () => {
      setIsSearching(true)
      try {
        const results = await window.electronAPI.searchMetadataMultiple(searchTerm)
        setSearchResults(results)
      } finally {
        setIsSearching(false)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [searchTerm, showSearchModal])

  // Anti-cheat detection state
  const [antiCheatWarning, setAntiCheatWarning] = useState<{
    hasAntiCheat: boolean
    highRisk: boolean
    detected: string[]
  } | null>(null)
  const [showAntiCheatOverride, setShowAntiCheatOverride] = useState(false)
  const [showConfigModal, setShowConfigModal] = useState(false)


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
        setAvailableEngines(engines.map((e: { version: string; cached: boolean; downloadUrl: string }) => ({
          version: e.version,
          cached: e.cached,
          downloadUrl: e.downloadUrl
        })))
        // Always select first version when fork changes (reset stale selection)
        if (engines.length > 0) {
          setSelectedVersion(engines[0].version)
        } else {
          setSelectedVersion('')
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
    setInstallStatus('Checking cache...')

    try {
      // Check if version is cached, if not download it
      const isCached = await window.electronAPI.isEngineCached(selectedFork, selectedVersion)

      if (!isCached) {
        setInstallStatus('Downloading DXVK...')
        // Use locally cached engines instead of refetching (avoids rate limit issues)
        const engine = availableEngines.find(e => e.version === selectedVersion)

        if (engine) {
          const downloadResult = await window.electronAPI.downloadEngine(selectedFork, selectedVersion, engine.downloadUrl)
          if (!downloadResult.success) {
            throw new Error(downloadResult.error || 'Download failed')
          }
        } else {
          throw new Error(`Engine version ${selectedVersion} not found in available engines`)
        }
      }

      setInstallStatus('Installing DLLs...')

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
        setInstallStatus('✓ Installed successfully!')
        setTimeout(() => setInstallStatus(''), 3000)
      } else {
        throw new Error(result.error || 'Installation failed')
      }
    } catch (error) {
      console.error('Install failed:', error)
      setInstallStatus(`✗ ${(error as Error).message}`)
      setTimeout(() => setInstallStatus(''), 5000)
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
        className="text-studio-400 hover:text-studio-200 text-sm mb-4 py-2 px-3 -ml-3 rounded-lg hover:bg-studio-800/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-vulkan flex items-center gap-2 touch-target"
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
              <div className="absolute bottom-4 left-4 right-4">
                {isEditing ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="input-field text-xl font-bold bg-studio-900/80 flex-1"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          onUpdate({ ...game, name: editName, updatedAt: new Date().toISOString() })
                          setIsEditing(false)
                        } else if (e.key === 'Escape') {
                          setEditName(game.name)
                          setIsEditing(false)
                        }
                      }}
                    />
                    <button
                      onClick={() => {
                        onUpdate({ ...game, name: editName, updatedAt: new Date().toISOString() })
                        setIsEditing(false)
                      }}
                      className="p-2 bg-accent-success/20 hover:bg-accent-success/30 rounded-lg text-accent-success"
                    >
                      <Check className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => {
                        setEditName(game.name)
                        setIsEditing(false)
                      }}
                      className="p-2 bg-studio-700/50 hover:bg-studio-700 rounded-lg text-studio-300"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <h2 className="text-2xl font-bold text-white">{game.name}</h2>
                    <button
                      onClick={() => setIsEditing(true)}
                      className="btn-icon-subtle"
                      aria-label="Rename game"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => {
                        setSearchTerm(game.name)
                        setSearchResults([])
                        setShowSearchModal(true)
                      }}
                      className="btn-icon-subtle"
                      aria-label="Search Steam for cover art"
                    >
                      <Search className="w-4 h-4" />
                    </button>
                  </div>
                )}
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
                    !selectedVersion ||
                    (antiCheatWarning?.highRisk && !showAntiCheatOverride)
                  }
                  className="btn-primary flex items-center gap-2"
                >
                  {isInstalling ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  {isInstalling ? installStatus || 'Installing...' : 'Install DXVK'}
                </button>
              )}

              <button
                onClick={handleOpenFolder}
                className="btn-secondary flex items-center gap-2"
              >
                <FolderOpen className="w-4 h-4" />
                Open Folder
              </button>

              {game.dxvkStatus === 'active' && (
                <button
                  onClick={() => setShowConfigModal(true)}
                  className="btn-secondary flex items-center gap-2"
                >
                  <Settings className="w-4 h-4" />
                  Configure
                </button>
              )}
            </div>

            {/* Install Status Message */}
            {installStatus && !isInstalling && (
              <p className={`text-sm mt-3 font-medium ${installStatus.startsWith('✓') ? 'text-accent-success' :
                installStatus.startsWith('✗') ? 'text-accent-danger' :
                  'text-studio-400'
                }`}>
                {installStatus}
              </p>
            )}

            {game.architecture === 'unknown' && (
              <p className="text-accent-warning text-sm mt-4">
                ⚠️ Could not determine game architecture. Please select the correct executable.
              </p>
            )}
          </div>
        </div>

        {/* Config Editor Modal */}
        <ConfigEditorModal
          isOpen={showConfigModal}
          gamePath={game.path}
          onClose={() => setShowConfigModal(false)}
          onSave={() => console.log('Config saved')}
        />

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

          {/* Danger Zone */}
          <div className="glass-card p-6 border-accent-danger/20">
            <h3 className="text-lg font-semibold text-accent-danger mb-4 flex items-center gap-2">
              <Trash2 className="w-5 h-5" />
              Danger Zone
            </h3>
            <p className="text-sm text-studio-400 mb-4">
              Remove this game from your library. This won't delete game files.
            </p>
            <button
              onClick={() => setShowRemoveConfirm(true)}
              className="btn-secondary text-accent-danger hover:bg-accent-danger/10 border-accent-danger/30 flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Remove from Library
            </button>
          </div>
        </div>
      </div>

      {/* Remove Confirmation Modal */}
      {showRemoveConfirm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 animate-fade-in">
          <div className="glass-card max-w-md w-full mx-4 p-6">
            <h3 className="text-xl font-semibold text-studio-100 mb-4">Remove Game?</h3>
            <p className="text-studio-400 mb-6">
              Are you sure you want to remove <strong className="text-studio-200">{game.name}</strong> from your library?
              This won't delete any game files from your computer.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowRemoveConfirm(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowRemoveConfirm(false)
                  onRemove()
                }}
                className="btn-primary bg-accent-danger border-accent-danger hover:bg-accent-danger/80 flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Steam Search Modal */}
      {showSearchModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 animate-fade-in">
          <div className="glass-card max-w-lg w-full mx-4 p-6 max-h-[80vh] flex flex-col">
            <h3 className="text-xl font-semibold text-studio-100 mb-4">Search Steam</h3>
            <div className="mb-4">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="input-field w-full"
                placeholder="Start typing to search..."
                autoFocus
              />
            </div>
            <div className="flex-1 overflow-y-auto space-y-2 min-h-[200px]">
              {searchResults.length === 0 && !isSearching && searchTerm.length >= 2 && (
                <p className="text-studio-500 text-center py-8">No results found</p>
              )}
              {searchResults.length === 0 && !isSearching && searchTerm.length < 2 && (
                <p className="text-studio-500 text-center py-8">Type at least 2 characters to search</p>
              )}
              {isSearching && (
                <p className="text-studio-400 text-center py-8">Searching...</p>
              )}
              {searchResults.map((result) => (
                <button
                  key={result.id}
                  onClick={() => {
                    onUpdate({
                      ...game,
                      name: result.name,
                      steamAppId: result.id.toString(),
                      updatedAt: new Date().toISOString()
                    })
                    setShowSearchModal(false)
                  }}
                  className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-studio-700/50 transition-colors text-left"
                >
                  <img
                    src={result.imageUrl}
                    alt={result.name}
                    className="w-16 h-9 object-cover rounded"
                  />
                  <span className="text-studio-200 flex-1 truncate">{result.name}</span>
                  <span className="text-studio-500 text-xs">ID: {result.id}</span>
                </button>
              ))}
            </div>
            <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-studio-700">
              <button
                onClick={() => setShowSearchModal(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
