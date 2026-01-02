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
  Info,
  AlertCircle,
  Filter,
  ClipboardCopy
} from 'lucide-react'
import type { Game, DxvkFork } from './shared/types'

import {
  ContextMenu,
  ConfigEditorModal,
  Vkd3dConfigModal,
  OnboardingWizard,
  CommandPalette,
  TitleBar
} from './components'

// Check if running in Electron
const isElectron = typeof window !== 'undefined' && window.electronAPI !== undefined

// Log entry type
interface LogEntry {
  id: string
  timestamp: Date
  level: 'info' | 'warn' | 'error'
  message: string
  details?: string
}

// Global log store (shared across components)
let globalLogs: LogEntry[] = []
let logListeners: Array<() => void> = []

function addLogEntry(level: LogEntry['level'], message: string, details?: string) {
  const entry: LogEntry = {
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date(),
    level,
    message,
    details
  }
  globalLogs = [entry, ...globalLogs].slice(0, 500) // Keep max 500 entries
  logListeners.forEach(listener => listener())
}

function subscribeToLogs(listener: () => void) {
  logListeners.push(listener)
  return () => {
    logListeners = logListeners.filter(l => l !== listener)
  }
}

function clearLogs() {
  globalLogs = []
  logListeners.forEach(listener => listener())
}

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

  // Onboarding state - show wizard on first launch
  const [showOnboarding, setShowOnboarding] = useState(() => {
    return !localStorage.getItem('dxvk-studio-onboarded')
  })

  // Command Palette state
  const [showCommandPalette, setShowCommandPalette] = useState(false)

  // Global keyboard shortcut for Command Palette (Ctrl+K)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setShowCommandPalette(prev => !prev)
      }
    }
    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => window.removeEventListener('keydown', handleGlobalKeyDown)
  }, [])

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
  const handleScan = useCallback(async (): Promise<number> => {
    if (!isElectron) {
      showNotification('error', 'Not running in Electron')
      return 0
    }

    setIsScanning(true)
    try {
      const scannedGames = await window.electronAPI.scanAllGames()
      const newGames = scannedGames.map((g: Partial<Game>, i: number) => ({
        id: g.id || `unknown-${i}`,
        name: g.name || 'Unknown Game',
        path: g.path || '',
        executable: g.executable || '',
        architecture: g.architecture || 'unknown',
        platform: (g.platform as any) || 'manual',
        steamAppId: g.steamAppId,
        dxvkStatus: g.dxvkStatus || 'inactive',
        dxvkVersion: g.dxvkVersion,
        dxvkFork: g.dxvkFork,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      } as Game))

      // Merge: keep manual games, update/add scanned games
      setGames(prev => {
        const manualGames = prev.filter(g => g.platform === 'manual')

        // Update existing games or add new ones
        const updatedGames = newGames.map(newGame => {
          // specific check for steam games to preserve their ID stability if possible
          // but mostly we rely on the ID from backend
          const existing = prev.find(g => g.id === newGame.id || (g.path === newGame.path))
          if (existing) {
            return { ...existing, ...newGame, createdAt: existing.createdAt }
          }
          return newGame
        })

        return [...manualGames, ...updatedGames]
      })
      showNotification('success', `Found ${scannedGames.length} games`)
      addLogEntry('info', `Game scan completed`, `Found ${scannedGames.length} games from Steam, GOG, and Epic`)
      return scannedGames.length
    } catch (error) {
      showNotification('error', 'Failed to scan Steam library')
      addLogEntry('error', 'Game scan failed', String(error))
      console.error(error)
      return 0
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

      // 1. Try PE VersionInfo (Most accurate)
      try {
        const versionInfo = await window.electronAPI.getVersionInfo(exePath)
        if (versionInfo.ProductName && versionInfo.ProductName.trim().length > 2) {
          gameName = versionInfo.ProductName.trim()
        } else if (versionInfo.FileDescription && versionInfo.FileDescription.trim().length > 2) {
          gameName = versionInfo.FileDescription.trim().replace(/ Application$| Executable$/i, '')
        }
      } catch (e) {
        console.warn('Failed to read version info', e)
      }

      // 2. Smart Name Parsing: Use folder name if current name is generic or too short
      const genericNames = ['launcher', 'game', 'start', 'client', 'app', 'play', 'setup', 'updater', 'boot', 'shipping', 'main', 'run', 'steam', 'epic']
      const isGeneric = genericNames.some(n => gameName.toLowerCase().includes(n))
      const isTooShort = gameName.length <= 3

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
        vkd3dStatus: 'inactive',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }

      setGames(prev => [...prev, newGame])
      setSelectedGame(newGame) // Auto-select the new game

      if (steamId) {
        showNotification('success', `Added ${gameName} (Found Cover Art)`)
      } else {
        showNotification('success', `Added ${gameName} (${analysis.architecture}-bit). Click Search to find cover art.`)
      }
      addLogEntry('info', `Game added manually: ${gameName}`, `Path: ${gamePath}`)

    } catch (error) {
      showNotification('error', 'Failed to analyze/add game')
      addLogEntry('error', 'Failed to add game', String(error))
      console.error(error)
    }
  }, [showNotification])

  // Open game folder
  const handleOpenFolder = useCallback(async (game: Game) => {
    if (isElectron) {
      await window.electronAPI.openPath(game.path)
    }
  }, [])

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
    <div className="h-screen flex flex-col bg-studio-950">
      {/* Custom Title Bar */}
      <TitleBar />

      {/* Main Layout */}
      <div className="flex flex-1 overflow-hidden">
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
          <div className="p-6 border-b border-white/5 relative overflow-hidden">
            {/* Subtle red glow behind logo */}
            <div className="absolute top-0 left-0 w-full h-full bg-accent-vulkan/5 blur-xl pointer-events-none" />

            <div className="flex items-center gap-4 relative z-10">
              <div className="relative group">
                <div className="absolute inset-0 bg-accent-vulkan/20 blur-lg rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <img src="/icon.png" alt="Logo" className="w-12 h-12 rounded-xl shadow-elevation-2 relative transition-transform duration-300 group-hover:scale-105" />
              </div>
              <div>
                <h1 className="font-bold text-lg text-white tracking-tight">DXVK Studio</h1>
                <p className="text-xs text-studio-500 font-medium">
                  by{' '}
                  <button
                    onClick={() => window.open('https://guinto2.gumroad.com/l/dxvkstudio', '_blank')}
                    className="text-accent-vulkan hover:text-accent-vulkan/80 transition-colors underline decoration-accent-vulkan/30 hover:decoration-accent-vulkan/60"
                  >
                    Zendevve
                  </button>
                </p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-2">
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
          <div className="p-4 border-t border-white/5">
            <div className="glass-card p-4 space-y-3 bg-studio-900/40">
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
        <main className="main-content bg-mesh from-studio-950 to-studio-900">
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
                  disabled={isScanning}
                  className="btn-secondary flex items-center gap-2"
                  title="Scan all libraries (Steam, GOG, Epic)"
                >
                  <RefreshCw className={`w-4 h-4 ${isScanning ? 'animate-spin' : ''}`} />
                  {isScanning ? 'Scanning...' : 'Scan Games'}
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
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
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
                        Click "Scan Games" to detect installed games or "Add Game" to manually add a game.
                      </p>
                    </div>
                  )}

                  {/* Context Menu */}
                  {contextMenu && (
                    <ContextMenu
                      x={contextMenu.x}
                      y={contextMenu.y}
                      game={contextMenu.game}
                      onClose={() => setContextMenu(null)}
                      onOpenFolder={() => handleOpenFolder(contextMenu.game)}
                      onViewDetails={() => {
                        setSelectedGame(contextMenu.game)
                        setContextMenu(null)
                      }}
                      onRemove={() => {
                        if (window.confirm(`Remove "${contextMenu.game.name}" from library?`)) {
                          handleRemoveGame(contextMenu.game.id)
                        }
                      }}
                    />
                  )}
                </>
              )}
            </div>
          ) : activeView === 'settings' ? (
            <SettingsView onClearGames={() => { setGames([]); addLogEntry('info', 'Game library cleared') }} />
          ) : activeView === 'logs' ? (
            <LogsView />
          ) : null}
        </main>
      </div>

      {/* Onboarding Wizard - shown on first launch */}
      {showOnboarding && (
        <OnboardingWizard
          onComplete={() => setShowOnboarding(false)}
          onScanGames={handleScan}
        />
      )}

      {/* Command Palette - Ctrl+K */}
      <CommandPalette
        isOpen={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
        onNavigate={(view) => { setActiveView(view); setSelectedGame(null) }}
        onScanGames={handleScan}
        onAddGame={handleAddGame}
      />
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
        w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium
        transition-all duration-300 group relative overflow-hidden
        ${active
          ? 'bg-gradient-to-r from-accent-vulkan/20 to-transparent text-white shadow-inner-highlight border border-white/5'
          : 'text-studio-400 hover:text-white hover:bg-white/5 border border-transparent'
        }
      `}
    >
      {active && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-accent-vulkan rounded-r-full shadow-glow-sm shadow-accent-vulkan/50" />
      )}
      <span className={`transition-colors duration-200 ${active ? 'text-accent-vulkan' : 'group-hover:text-studio-200'}`}>
        {icon}
      </span>
      {label}
    </button>
  )
}

// Engine Manager View Component
function EngineManagerView() {
  // Tab state
  const [activeTab, setActiveTab] = useState<'cached' | 'available'>('cached')
  const [selectedFork, setSelectedFork] = useState<DxvkFork>('official')

  // Cached engines state
  const [cachedEngines, setCachedEngines] = useState<Array<{
    fork: DxvkFork
    version: string
    path: string
    sizeBytes: number
  }>>([])
  const [isLoadingCached, setIsLoadingCached] = useState(true)
  const [isDeleting, setIsDeleting] = useState<string | null>(null)

  // Available engines state
  const [availableEngines, setAvailableEngines] = useState<Array<{
    version: string
    cached: boolean
    downloadUrl: string
    releaseDate?: string
    changelog?: string
  }>>([])
  const [isLoadingAvailable, setIsLoadingAvailable] = useState(false)

  // Download state
  const [downloadingVersion, setDownloadingVersion] = useState<string | null>(null)
  const [downloadProgress, setDownloadProgress] = useState(0)

  // Fetch cached engines on mount
  const fetchCached = useCallback(async () => {
    if (!isElectron) return

    setIsLoadingCached(true)
    try {
      const engines = await window.electronAPI.getAllCachedEngines()
      setCachedEngines(engines)
    } catch (error) {
      console.error('Failed to fetch cached engines:', error)
    } finally {
      setIsLoadingCached(false)
    }
  }, [])

  useEffect(() => {
    fetchCached()
  }, [fetchCached])

  // Fetch available engines when fork changes or tab switches to available
  const fetchAvailable = useCallback(async () => {
    if (!isElectron) return

    setIsLoadingAvailable(true)
    try {
      const engines = await window.electronAPI.getAvailableEngines(selectedFork)
      setAvailableEngines(engines.map((e: { version: string; cached: boolean; downloadUrl: string; releaseDate?: string; changelog?: string }) => ({
        version: e.version,
        cached: e.cached,
        downloadUrl: e.downloadUrl,
        releaseDate: e.releaseDate,
        changelog: e.changelog
      })))
    } catch (error) {
      console.error('Failed to fetch available engines:', error)
      setAvailableEngines([])
    } finally {
      setIsLoadingAvailable(false)
    }
  }, [selectedFork])

  useEffect(() => {
    if (activeTab === 'available') {
      fetchAvailable()
    }
  }, [activeTab, selectedFork, fetchAvailable])

  // Download progress listener
  useEffect(() => {
    if (!isElectron) return

    const handleProgress = (progress: { fork: DxvkFork; version: string; percent: number }) => {
      if (progress.fork === selectedFork && progress.version === downloadingVersion) {
        setDownloadProgress(progress.percent)
      }
    }

    window.electronAPI.onDownloadProgress(handleProgress)

    return () => {
      window.electronAPI.removeDownloadProgressListener()
    }
  }, [selectedFork, downloadingVersion])

  // Handle download
  const handleDownload = async (version: string, downloadUrl: string) => {
    if (!isElectron || downloadingVersion) return

    setDownloadingVersion(version)
    setDownloadProgress(0)

    try {
      const result = await window.electronAPI.downloadEngine(selectedFork, version, downloadUrl)
      if (result.success) {
        // Update available engines to show as cached
        setAvailableEngines(prev => prev.map(e =>
          e.version === version ? { ...e, cached: true } : e
        ))
        // Refresh cached list
        await fetchCached()
        addLogEntry('info', `Engine downloaded: ${selectedFork} v${version}`)
      }
    } catch (error) {
      console.error('Download failed:', error)
      addLogEntry('error', `Engine download failed: ${selectedFork} v${version}`, String(error))
    } finally {
      setDownloadingVersion(null)
      setDownloadProgress(0)
    }
  }

  // Handle delete
  const handleDelete = async (fork: DxvkFork, version: string) => {
    if (!isElectron) return

    const confirmed = window.confirm(`Delete ${fork} v${version}? This will remove the cached engine files.`)
    if (!confirmed) return

    const key = `${fork}-${version}`
    setIsDeleting(key)

    try {
      const result = await window.electronAPI.deleteEngine(fork, version)
      if (result.success) {
        setCachedEngines(prev => prev.filter(e => !(e.fork === fork && e.version === version)))
        // Update available engines to show as not cached
        if (fork === selectedFork) {
          setAvailableEngines(prev => prev.map(e =>
            e.version === version ? { ...e, cached: false } : e
          ))
        }
      }
    } catch (error) {
      console.error('Failed to delete engine:', error)
    } finally {
      setIsDeleting(null)
    }
  }

  // Handle clear all
  const handleClearAll = async () => {
    if (!isElectron || cachedEngines.length === 0) return

    const confirmed = window.confirm(`Delete ALL ${cachedEngines.length} cached engines? This cannot be undone.`)
    if (!confirmed) return

    setIsLoadingCached(true)
    try {
      for (const engine of cachedEngines) {
        await window.electronAPI.deleteEngine(engine.fork, engine.version)
      }
      setCachedEngines([])
      // Refresh available to update cached status
      if (activeTab === 'available') {
        await fetchAvailable()
      }
    } catch (error) {
      console.error('Failed to clear cache:', error)
    } finally {
      setIsLoadingCached(false)
    }
  }

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
  }

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return ''
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
    } catch {
      return ''
    }
  }

  const totalSize = cachedEngines.reduce((acc, e) => acc + e.sizeBytes, 0)

  const forkLabels: Record<DxvkFork, string> = {
    official: 'Official (doitsujin)',
    gplasync: 'GPL Async (Ph42oN)',
    nvapi: 'NVAPI (jp7677)',
    vkd3d: 'Proton (HansKristian)'
  }



  // Group cached engines by fork
  const groupedCached = cachedEngines.reduce((acc, engine) => {
    if (!acc[engine.fork]) acc[engine.fork] = []
    acc[engine.fork].push(engine)
    return acc
  }, {} as Record<DxvkFork, typeof cachedEngines>)

  return (
    <div className="animate-fade-in p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-studio-100">Engine Manager</h2>
          <p className="text-studio-400 mt-1">Download and manage DXVK versions</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="glass-card px-4 py-2">
            <span className="text-sm text-studio-400">Cache: </span>
            <span className="text-sm font-medium text-studio-200">{formatSize(totalSize)}</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      {/* Tabs */}
      {/* Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 border-b border-white/5 pb-4">
        {/* Tabs */}
        <div className="flex items-center gap-2 p-1 bg-studio-900/50 backdrop-blur-sm rounded-xl border border-white/5 w-fit">
          <button
            onClick={() => setActiveTab('cached')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 relative overflow-hidden ${activeTab === 'cached'
              ? 'text-white shadow-lg shadow-black/20 ring-1 ring-white/10'
              : 'text-studio-400 hover:text-studio-200 hover:bg-white/5'
              }`}
          >
            {activeTab === 'cached' && (
              <div className="absolute inset-0 bg-studio-800 rounded-lg -z-10" />
            )}
            Cached Engines
            {cachedEngines.length > 0 && (
              <span className={`ml-2 px-1.5 py-0.5 text-xs rounded-full ${activeTab === 'cached' ? 'bg-accent-vulkan text-white shadow-glow-sm' : 'bg-studio-800 text-studio-400'}`}>
                {cachedEngines.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('available')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 relative overflow-hidden ${activeTab === 'available'
              ? 'text-white shadow-lg shadow-black/20 ring-1 ring-white/10'
              : 'text-studio-400 hover:text-studio-200 hover:bg-white/5'
              }`}
          >
            {activeTab === 'available' && (
              <div className="absolute inset-0 bg-studio-800 rounded-lg -z-10" />
            )}
            Available Versions
          </button>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3">
          {/* Fork selector (only for Available tab) */}
          {activeTab === 'available' && (
            <div className="flex items-center gap-2">
              <select
                value={selectedFork}
                onChange={(e) => setSelectedFork(e.target.value as DxvkFork)}
                className="input-field text-sm py-1.5 w-40"
                disabled={isLoadingAvailable}
              >
                <option value="official">Official (doitsujin)</option>
                <option value="gplasync">GPL Async (Ph42oN)</option>
                <option value="nvapi">NVAPI (jp7677)</option>
                <option value="vkd3d">Proton (HansKristian)</option>
              </select>
              <button
                onClick={fetchAvailable}
                disabled={isLoadingAvailable}
                className="btn-icon bg-studio-800/50 border border-white/5"
                title="Refresh versions"
              >
                <RefreshCw className={`w-4 h-4 ${isLoadingAvailable ? 'animate-spin' : ''}`} />
              </button>
            </div>
          )}

          {/* Actions for Cached tab */}
          {activeTab === 'cached' && cachedEngines.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                onClick={fetchCached}
                disabled={isLoadingCached}
                className="btn-icon bg-studio-800/50 border border-white/5"
                title="Refresh cache"
              >
                <RefreshCw className={`w-4 h-4 ${isLoadingCached ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={handleClearAll}
                disabled={isLoadingCached}
                className="btn-secondary text-sm flex items-center gap-1.5 text-accent-danger hover:bg-accent-danger/10 border-accent-danger/20"
              >
                <Trash2 className="w-4 h-4" />
                Clear All
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Cached Tab Content */}
      {
        activeTab === 'cached' && (
          <>
            {isLoadingCached ? (
              <div className="flex items-center justify-center py-20">
                <RefreshCw className="w-8 h-8 text-accent-vulkan animate-spin" />
              </div>
            ) : cachedEngines.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <Download className="w-16 h-16 text-studio-700 mb-4" />
                <h3 className="text-lg font-medium text-studio-400 mb-2">No cached engines</h3>
                <p className="text-studio-500 max-w-sm mb-6">
                  Download DXVK versions from the "Available Versions" tab, or they will be cached automatically when you install them to games.
                </p>
                <button
                  onClick={() => setActiveTab('available')}
                  className="btn-primary flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Browse Available Versions
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {(['official', 'gplasync', 'nvapi', 'vkd3d'] as DxvkFork[]).map(fork => {
                  const engines = groupedCached[fork]
                  if (!engines || engines.length === 0) return null

                  return (
                    <div key={fork}>
                      <h3 className="text-sm font-medium text-studio-400 mb-3 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-accent-vulkan"></span>
                        {forkLabels[fork]}
                        <span className="text-studio-500">({engines.length})</span>
                      </h3>
                      <div className="space-y-2">
                        {engines.map((engine) => {
                          const key = `${engine.fork}-${engine.version}`
                          const deleting = isDeleting === key

                          return (
                            <div key={key} className="glass-card hover:bg-studio-800/80 transition-colors p-4 flex items-center justify-between group">
                              <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-studio-800 to-studio-900 border border-white/5 flex items-center justify-center shadow-inner-highlight">
                                  <Check className="w-5 h-5 text-accent-success drop-shadow-md" />
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-white font-mono font-medium tracking-tight">v{engine.version}</span>
                                  </div>
                                  <p className="text-sm text-studio-500">{formatSize(engine.sizeBytes)}</p>
                                </div>
                              </div>
                              <button
                                onClick={() => handleDelete(engine.fork, engine.version)}
                                disabled={deleting}
                                className="btn-icon-subtle text-studio-400 hover:text-accent-danger hover:bg-accent-danger/10 hover:border-accent-danger/20 transition-all"
                                title="Delete cached version"
                              >
                                {deleting ? (
                                  <RefreshCw className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Trash2 className="w-4 h-4" />
                                )}
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )
      }

      {/* Available Tab Content */}
      {
        activeTab === 'available' && (
          <>
            {isLoadingAvailable ? (
              <div className="flex items-center justify-center py-20">
                <RefreshCw className="w-8 h-8 text-accent-vulkan animate-spin" />
              </div>
            ) : availableEngines.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <AlertTriangle className="w-16 h-16 text-accent-warning mb-4" />
                <h3 className="text-lg font-medium text-studio-400 mb-2">No versions available</h3>
                <p className="text-studio-500 max-w-sm">
                  Could not fetch releases. This may be due to API rate limiting. Try again later.
                </p>
                <button
                  onClick={fetchAvailable}
                  className="btn-secondary mt-4 flex items-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Retry
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {availableEngines.map((engine, index) => {
                  const isDownloading = downloadingVersion === engine.version
                  const isCached = engine.cached

                  return (
                    <div key={engine.version} className="glass-card hover:bg-studio-800/60 transition-colors p-4 group">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center shadow-inner-highlight border border-white/5 ${isCached ? 'bg-accent-success/10' : 'bg-studio-800'
                            }`}>
                            {isCached ? (
                              <Check className="w-5 h-5 text-accent-success drop-shadow-md" />
                            ) : (
                              <Download className="w-5 h-5 text-studio-400" />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-studio-100 font-mono font-medium">v{engine.version}</span>
                              {index === 0 && (
                                <span className="px-1.5 py-0.5 text-xs font-medium rounded bg-accent-vulkan/20 text-accent-vulkan border border-accent-vulkan/20 shadow-glow-sm">
                                  Latest
                                </span>
                              )}
                              {isCached && (
                                <span className="px-1.5 py-0.5 text-xs font-medium rounded bg-accent-success/10 text-accent-success border border-accent-success/20">
                                  Cached
                                </span>
                              )}
                            </div>
                            {engine.releaseDate && (
                              <p className="text-sm text-studio-500">{formatDate(engine.releaseDate)}</p>
                            )}
                          </div>
                        </div>

                        {isCached ? (
                          <button
                            onClick={() => handleDelete(selectedFork, engine.version)}
                            disabled={isDeleting === `${selectedFork}-${engine.version}`}
                            className="btn-icon-subtle text-studio-400 hover:text-accent-danger hover:bg-accent-danger/10 hover:border-accent-danger/20 transition-all"
                            title="Delete from cache"
                          >
                            {isDeleting === `${selectedFork}-${engine.version}` ? (
                              <RefreshCw className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </button>
                        ) : (
                          <button
                            onClick={() => handleDownload(engine.version, engine.downloadUrl)}
                            disabled={isDownloading || !!downloadingVersion}
                            className="btn-secondary hover:bg-accent-vulkan hover:text-white hover:border-accent-vulkan/50 group-hover:border-white/20 transition-all flex items-center gap-2"
                          >
                            {isDownloading ? (
                              <>
                                <RefreshCw className="w-4 h-4 animate-spin" />
                                <span className="w-12 text-left">{downloadProgress > 0 ? `${downloadProgress}%` : '...'}</span>
                              </>
                            ) : (
                              <>
                                <Download className="w-4 h-4" />
                                Download
                              </>
                            )}
                          </button>
                        )}
                      </div>

                      {/* Premium Progress Bar */}
                      {isDownloading && downloadProgress > 0 && (
                        <div className="mt-4 relative">
                          <div className="h-1 bg-studio-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-gradient-vulkan shadow-glow-sm transition-all duration-300 relative"
                              style={{ width: `${downloadProgress}%` }}
                            >
                              <div className="absolute top-0 right-0 bottom-0 w-20 bg-gradient-to-r from-transparent to-white/30" />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )
      }
    </div >
  )
}

// Settings View Component
function SettingsView({ onClearGames }: { onClearGames: () => void }) {
  const [activeTab, setActiveTab] = useState<'general' | 'integrations' | 'storage' | 'about'>('general')
  const [defaultFork, setDefaultFork] = useState<DxvkFork>('official')
  const [cacheSize, setCacheSize] = useState<string>('Calculating...')

  // IGDB State
  const [igdbClientId, setIgdbClientId] = useState('')
  const [igdbClientSecret, setIgdbClientSecret] = useState('')
  const [igdbStatus, setIgdbStatus] = useState<{ success?: boolean; message?: string }>({})
  const [isIgdbLoading, setIsIgdbLoading] = useState(false)

  // ... (Keep existing useEffects and handlers) ...
  useEffect(() => {
    if (!isElectron) return
    window.electronAPI.igdbGetCredentials().then(creds => {
      if (creds) {
        setIgdbClientId(creds.clientId)
        setIgdbClientSecret(creds.clientSecret)
      }
    })
  }, [])

  const handleSaveIgdb = async () => {
    setIsIgdbLoading(true)
    setIgdbStatus({})
    try {
      await window.electronAPI.igdbSetCredentials({ clientId: igdbClientId, clientSecret: igdbClientSecret })
      const test = await window.electronAPI.igdbTestConnection()
      if (test.success) {
        setIgdbStatus({ success: true, message: 'Connected to IGDB successfully!' })
      } else {
        setIgdbStatus({ success: false, message: 'Saved, but connection failed: ' + test.message })
      }
    } catch (e) {
      setIgdbStatus({ success: false, message: 'Error: ' + (e as Error).message })
    } finally {
      setIsIgdbLoading(false)
    }
  }



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
    nvapi: 'NVAPI (jp7677)',
    vkd3d: 'VKD3D-Proton (HansKristian)'
  }

  return (
    <div className="animate-fade-in p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-studio-100">Settings</h2>
        <p className="text-studio-400 mt-1">Configure DXVK Studio preferences</p>
      </div>

      {/* Settings Navigation Tabs */}
      <div className="flex items-center gap-2 mb-8 border-b border-white/5 pb-1 w-full overflow-x-auto">
        <button
          onClick={() => setActiveTab('general')}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-1.5 whitespace-nowrap ${activeTab === 'general'
            ? 'text-accent-vulkan border-accent-vulkan'
            : 'text-studio-400 border-transparent hover:text-studio-200'
            }`}
        >
          General
        </button>
        <button
          onClick={() => setActiveTab('integrations')}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-1.5 whitespace-nowrap ${activeTab === 'integrations'
            ? 'text-accent-vulkan border-accent-vulkan'
            : 'text-studio-400 border-transparent hover:text-studio-200'
            }`}
        >
          Integrations
        </button>
        <button
          onClick={() => setActiveTab('storage')}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-1.5 whitespace-nowrap ${activeTab === 'storage'
            ? 'text-accent-vulkan border-accent-vulkan'
            : 'text-studio-400 border-transparent hover:text-studio-200'
            }`}
        >
          Storage
        </button>
        <button
          onClick={() => setActiveTab('about')}
          className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-1.5 whitespace-nowrap ${activeTab === 'about'
            ? 'text-accent-vulkan border-accent-vulkan'
            : 'text-studio-400 border-transparent hover:text-studio-200'
            }`}
        >
          About & Support
        </button>
      </div>

      <div className="max-w-2xl mx-auto min-h-[400px]">
        {/* General Tab */}
        {activeTab === 'general' && (
          <div className="glass-card p-6 animate-fade-in">
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
        )}

        {/* Storage Tab */}
        {activeTab === 'storage' && (
          <div className="space-y-6 animate-fade-in">
            <div className="glass-card p-6">
              <h3 className="text-lg font-semibold text-studio-200 mb-4 flex items-center gap-2">
                <Download className="w-5 h-5 text-accent-vulkan" />
                Cache Storage
              </h3>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-studio-300">Cached Engines</p>
                  <p className="text-xs text-studio-500">Downloaded DXVK versions</p>
                </div>
                <span className="text-studio-200 font-medium">{cacheSize}</span>
              </div>
            </div>

            <div className="glass-card p-6">
              <h3 className="text-lg font-semibold text-studio-200 mb-4 flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-accent-vulkan" />
                Data Management
              </h3>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-studio-300">Clear Game Library</p>
                    <p className="text-xs text-studio-500">Remove all games from the library (keeps cache)</p>
                  </div>
                  <button
                    onClick={() => {
                      if (window.confirm('Remove all games from the library? This cannot be undone.')) {
                        onClearGames()
                      }
                    }}
                    className="btn-secondary text-sm text-accent-danger hover:bg-accent-danger/10"
                  >
                    Clear Library
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-studio-300">Open Cache Folder</p>
                    <p className="text-xs text-studio-500">View cached DXVK versions on disk</p>
                  </div>
                  <button
                    onClick={async () => {
                      if (isElectron) {
                        const engines = await window.electronAPI.getAllCachedEngines()
                        if (engines.length > 0) {
                          // Open parent folder of first cached engine
                          const path = engines[0].path
                          const parentPath = path.split('\\').slice(0, -1).join('\\')
                          window.electronAPI.openPath(parentPath)
                        }
                      }
                    }}
                    className="btn-secondary text-sm"
                  >
                    Open Folder
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Integrations Tab */}
        {activeTab === 'integrations' && (
          <div className="glass-card p-6 animate-fade-in">
            <h3 className="text-lg font-semibold text-studio-200 mb-4 flex items-center gap-2">
              <Gamepad2 className="w-5 h-5 text-accent-vulkan" />
              IGDB Integration
            </h3>

            <div className="space-y-4">
              <p className="text-sm text-studio-400">
                Connect to Internet Game Database (IGDB) to fetch game covers and metadata.
                You need a Twitch Developer account to get these credentials.
                <button
                  onClick={() => window.open('https://dev.twitch.tv/console/apps', '_blank')}
                  className="ml-1 text-accent-vulkan hover:underline focus:outline-none"
                >
                  Get Credentials
                </button>
              </p>

              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm text-studio-400 mb-2">Client ID</label>
                  <input
                    type="text"
                    value={igdbClientId}
                    onChange={(e) => setIgdbClientId(e.target.value)}
                    className="input-field w-full"
                    placeholder="Twitch App Client ID"
                  />
                </div>
                <div>
                  <label className="block text-sm text-studio-400 mb-2">Client Secret</label>
                  <input
                    type="password"
                    value={igdbClientSecret}
                    onChange={(e) => setIgdbClientSecret(e.target.value)}
                    className="input-field w-full"
                    placeholder="Twitch App Client Secret"
                  />
                </div>
              </div>

              {igdbStatus.message && (
                <div className={`p-3 rounded-lg text-sm flex items-start gap-2 ${igdbStatus.success ? 'bg-accent-success/10 text-accent-success' : 'bg-accent-danger/10 text-accent-danger'}`}>
                  {igdbStatus.success ? <Check className="w-4 h-4 mt-0.5" /> : <AlertTriangle className="w-4 h-4 mt-0.5" />}
                  {igdbStatus.message}
                </div>
              )}

              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={handleSaveIgdb}
                  disabled={isIgdbLoading || !igdbClientId || !igdbClientSecret}
                  className="btn-primary flex items-center gap-2"
                >
                  {isIgdbLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Save & Test
                </button>
                <button
                  onClick={async () => {
                    if (window.confirm('Clear IGDB credentials?')) {
                      await window.electronAPI.igdbClearCredentials()
                      setIgdbClientId('')
                      setIgdbClientSecret('')
                      setIgdbStatus({ success: true, message: 'Credentials cleared' })
                    }
                  }}
                  className="btn-secondary text-sm"
                >
                  Clear
                </button>
              </div>
            </div>
          </div>
        )}

        {/* About Tab */}
        {activeTab === 'about' && (
          <div className="space-y-6 animate-fade-in">
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
                  className="btn-secondary flex items-center gap-2"
                  title="Support development"
                >
                  <Heart className="w-4 h-4" />
                  Sponsor
                </button>
                <a
                  href="https://guinto2.gumroad.com/l/dxvkstudio"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary flex items-center gap-2"
                  title="Purchase official build"
                >
                  <ExternalLink className="w-4 h-4" />
                  Official Store
                </a>
                <a
                  href="https://guinto2.gumroad.com/l/dxvkstudio"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary flex items-center justify-center gap-2 py-3"
                >
                  <ExternalLink className="w-4 h-4" />
                  Official Store
                </a>
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

            <div className="glass-card p-6 border-accent-vulkan/20">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-studio-100 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-accent-vulkan" />
                    About DXVK Studio
                  </h3>
                  <p className="text-sm text-studio-400 mt-1">
                    Made by{' '}
                    <button
                      onClick={() => window.open('https://guinto2.gumroad.com/l/dxvkstudio', '_blank')}
                      className="text-accent-vulkan hover:text-accent-vulkan/80 font-medium transition-colors underline decoration-accent-vulkan/30 hover:decoration-accent-vulkan/60"
                    >
                      Zendevve
                    </button>
                  </p>
                </div>
                <a
                  href="https://guinto2.gumroad.com/l/dxvkstudio"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-secondary text-xs flex items-center gap-1.5 hover:border-accent-vulkan/50"
                >
                  <ExternalLink className="w-3 h-3" />
                  Official Store
                </a>
              </div>

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
                <div className="mt-4 pt-4 border-t border-studio-700/50">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-studio-600">
                      © 2024-2026{' '}
                      <button
                        onClick={() => window.open('https://guinto2.gumroad.com/l/dxvkstudio', '_blank')}
                        className="text-studio-400 hover:text-accent-vulkan font-medium transition-colors underline decoration-transparent hover:decoration-accent-vulkan/30"
                      >
                        Zendevve
                      </button>
                      . All rights reserved.
                    </p>
                    <a
                      href="https://guinto2.gumroad.com/l/dxvkstudio"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-accent-vulkan hover:text-accent-vulkan/80 transition-colors flex items-center gap-1"
                    >
                      Official builds only
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              </div>
            </div>

            <div className="glass-card p-6 border-accent-warning/30 bg-accent-warning/5">
              <h3 className="text-lg font-semibold text-studio-200 mb-4 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-accent-warning" />
                License &amp; Distribution Notice
              </h3>

              <div className="space-y-4">
                <div className="bg-accent-warning/10 border border-accent-warning/30 rounded-lg p-3">
                  <p className="text-sm font-semibold text-accent-warning">
                    Binary distribution is prohibited
                  </p>
                </div>

                <div className="space-y-2 text-sm text-studio-300">
                  <p>
                    <strong className="text-studio-100">AGPL-3.0 with Additional Terms</strong> (applies retroactively to all versions)
                  </p>
                  <p className="text-studio-400 leading-relaxed">
                    This software is open source for personal use only. You may not distribute
                    compiled binaries, installers, or executable files. Binary distribution rights
                    are exclusively reserved to the copyright holder.
                  </p>
                  <div className="bg-studio-800/50 border border-studio-700 rounded p-2 text-xs text-studio-400 space-y-1">
                    <p className="font-medium text-studio-300">Enforcement may include:</p>
                    <ul className="list-disc list-inside space-y-0.5 ml-2">
                      <li>DMCA takedown notices</li>
                      <li>Copyright infringement litigation</li>
                      <li>Statutory damages under applicable law</li>
                    </ul>
                  </div>
                  <p className="text-xs text-studio-400 pt-1">
                    If you distributed binaries before 2026-01-02, you must remove them within 7 days.
                  </p>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => window.open('https://github.com/Zendevve/dxvk-studio/blob/main/LICENSE.ADDITIONAL', '_blank')}
                    className="text-xs btn-secondary flex items-center gap-1.5"
                  >
                    <FileText className="w-3 h-3" />
                    Read Complete Terms
                  </button>
                  <button
                    onClick={() => window.open('https://guinto2.gumroad.com/l/dxvkstudio', '_blank')}
                    className="text-xs btn-secondary flex items-center gap-1.5"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Official Builds
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Logs View Component
function LogsView() {
  const [logs, setLogs] = useState<LogEntry[]>(globalLogs)
  const [filterLevel, setFilterLevel] = useState<'all' | 'info' | 'warn' | 'error'>('all')

  // Subscribe to log updates
  useEffect(() => {
    const unsubscribe = subscribeToLogs(() => {
      setLogs([...globalLogs])
    })
    return unsubscribe
  }, [])

  const filteredLogs = filterLevel === 'all'
    ? logs
    : logs.filter(log => log.level === filterLevel)

  const handleClear = () => {
    if (window.confirm('Clear all logs?')) {
      clearLogs()
    }
  }

  const handleExport = () => {
    const logText = logs.map(log =>
      `[${log.timestamp.toISOString()}] [${log.level.toUpperCase()}] ${log.message}${log.details ? `\n  ${log.details}` : ''}`
    ).join('\n')

    const blob = new Blob([logText], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `dxvk-studio-logs-${new Date().toISOString().slice(0, 10)}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  const getLevelIcon = (level: LogEntry['level']) => {
    switch (level) {
      case 'info': return <Info className="w-4 h-4 text-blue-400" />
      case 'warn': return <AlertTriangle className="w-4 h-4 text-accent-warning" />
      case 'error': return <AlertCircle className="w-4 h-4 text-accent-danger" />
    }
  }

  const getLevelClass = (level: LogEntry['level']) => {
    switch (level) {
      case 'info': return 'text-blue-400'
      case 'warn': return 'text-accent-warning'
      case 'error': return 'text-accent-danger'
    }
  }

  return (
    <div className="animate-fade-in p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-studio-100">Logs</h2>
          <p className="text-studio-400 mt-1">Application activity history</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-studio-400" />
            <select
              value={filterLevel}
              onChange={(e) => setFilterLevel(e.target.value as typeof filterLevel)}
              className="input-field text-sm py-1.5"
            >
              <option value="all">All Levels</option>
              <option value="info">Info Only</option>
              <option value="warn">Warnings Only</option>
              <option value="error">Errors Only</option>
            </select>
          </div>

          {/* Actions */}
          <button
            onClick={handleExport}
            disabled={logs.length === 0}
            className="btn-secondary text-sm flex items-center gap-1.5"
            title="Export logs to file"
          >
            <ClipboardCopy className="w-4 h-4" />
            Export
          </button>
          <button
            onClick={handleClear}
            disabled={logs.length === 0}
            className="btn-secondary text-sm flex items-center gap-1.5 text-accent-danger hover:bg-accent-danger/10"
          >
            <Trash2 className="w-4 h-4" />
            Clear
          </button>
        </div>
      </div>

      {/* Log Entries */}
      {filteredLogs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <FileText className="w-16 h-16 text-studio-700 mb-4" />
          <h3 className="text-lg font-medium text-studio-400 mb-2">
            {logs.length === 0 ? 'No logs yet' : 'No logs match filter'}
          </h3>
          <p className="text-studio-500 max-w-sm">
            {logs.length === 0
              ? 'Activity logs will appear here as you use the app.'
              : 'Try changing the filter to see more logs.'}
          </p>
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          <div className="max-h-[calc(100vh-280px)] overflow-y-auto">
            {filteredLogs.map((log) => (
              <div
                key={log.id}
                className="flex items-start gap-3 p-3 border-b border-studio-700/50 last:border-b-0 hover:bg-studio-800/50"
              >
                <div className="mt-0.5">{getLevelIcon(log.level)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-medium ${getLevelClass(log.level)}`}>
                      {log.level.toUpperCase()}
                    </span>
                    <span className="text-xs text-studio-500">
                      {formatTime(log.timestamp)}
                    </span>
                  </div>
                  <p className="text-sm text-studio-200 mt-0.5">{log.message}</p>
                  {log.details && (
                    <p className="text-xs text-studio-500 mt-1 font-mono">{log.details}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      {logs.length > 0 && (
        <div className="mt-4 text-center text-sm text-studio-500">
          Showing {filteredLogs.length} of {logs.length} log entries
        </div>
      )}
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
  const displayImageUrl = game.coverUrl || (game.steamAppId
    ? `https://cdn.cloudflare.steamstatic.com/steam/apps/${game.steamAppId}/header.jpg`
    : null)

  return (
    <div
      onClick={onClick}
      onContextMenu={(e) => {
        e.preventDefault()
        onContextMenu(e, game)
      }}
      className="glass-card group cursor-pointer overflow-hidden relative transition-all duration-300 hover:scale-[1.02] hover:shadow-glow-md hover:shadow-accent-vulkan/20 hover:border-accent-vulkan/30"
    >
      {/* Hover Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-accent-vulkan/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-10" />

      {/* Game Art */}
      <div className="relative aspect-[460/215] bg-studio-800 overflow-hidden">
        {displayImageUrl ? (
          <img
            src={displayImageUrl}
            alt={game.name}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none'
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-studio-900">
            <Gamepad2 className="w-12 h-12 text-studio-700" />
          </div>
        )}

        {/* Top Overlay Gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-transparent opacity-60" />

        {/* Architecture Badge */}
        <div className="absolute top-3 right-3 z-20">
          <span className={`${game.architecture === '32' ? 'badge-32bit' : game.architecture === '64' ? 'badge-64bit' : 'badge bg-studio-800/80 text-studio-400 border border-white/10'} backdrop-blur-md shadow-sm`}>
            {game.architecture === 'unknown' ? '?' : `${game.architecture}-bit`}
          </span>
        </div>

        {/* Status Indicator Area */}
        <div className="absolute bottom-0 left-0 w-full p-3 bg-gradient-to-t from-black/90 to-transparent z-20 flex items-center gap-2">
          {game.dxvkStatus === 'active' && (
            <span className="flex items-center gap-1.5 text-xs font-medium text-accent-success bg-accent-success/10 border border-accent-success/20 px-2 py-0.5 rounded-full backdrop-blur-sm shadow-glow-sm shadow-accent-success/20">
              <span className="w-1.5 h-1.5 rounded-full bg-accent-success shadow-glow-sm" />
              DXVK Active
            </span>
          )}
          {game.dxvkStatus === 'inactive' && (
            <span className="flex items-center gap-1.5 text-xs text-studio-400 bg-studio-900/60 border border-white/5 px-2 py-0.5 rounded-full backdrop-blur-sm">
              <div className="w-1.5 h-1.5 rounded-full bg-studio-600" />
              Not Installed
            </span>
          )}
          {(game.dxvkStatus === 'outdated' || game.dxvkStatus === 'corrupt') && (
            <span className="flex items-center gap-1.5 text-xs font-medium text-accent-warning bg-accent-warning/10 border border-accent-warning/20 px-2 py-0.5 rounded-full backdrop-blur-sm">
              <AlertTriangle className="w-3 h-3" />
              Attention
            </span>
          )}

          {/* Version Pill if active */}
          {(game.dxvkStatus === 'active' && game.dxvkVersion) && (
            <span className="text-xs font-mono text-studio-300 ml-auto bg-black/40 px-1.5 py-0.5 rounded border border-white/10">
              v{game.dxvkVersion}
            </span>
          )}
        </div>
      </div>

      {/* Game Info */}
      <div className="p-4 relative z-20">
        <h3 className="font-semibold text-studio-100 truncate group-hover:text-accent-vulkan transition-colors text-base">
          {game.name}
        </h3>
        <p className="text-xs text-studio-500 truncate mt-1 flex items-center gap-1.5">
          <span className="w-1 h-1 rounded-full bg-studio-600" />
          {game.platform === 'steam' ? 'Steam' : game.platform === 'gog' ? 'GOG Galaxy' : game.platform === 'epic' ? 'Epic Games' : 'Manual'}
        </p>
      </div>
    </div>
  )
}

// Unified Engine Management Card Component
function EngineManagementCard({
  game,
  onUpdate,
  isElectron,
  installDisabled = false
}: {
  game: Game
  onUpdate: (game: Game) => void
  isElectron: boolean
  installDisabled?: boolean
}) {
  const [isInstalling, setIsInstalling] = useState(false)
  const [installStatus, setInstallStatus] = useState('')

  // Determine initial fork from existing game state
  const getInitialFork = (): DxvkFork => {
    if (game.dxvkFork && game.dxvkFork !== 'vkd3d') return game.dxvkFork
    if (game.vkd3dFork) return 'vkd3d'
    return 'official'
  }

  const [selectedFork, setSelectedFork] = useState<DxvkFork>(getInitialFork())
  const [selectedVersion, setSelectedVersion] = useState('')
  const [availableEngines, setAvailableEngines] = useState<Array<{
    version: string
    cached: boolean
    downloadUrl: string
    releaseDate?: string
    changelog?: string
  }>>([])
  const [isLoadingEngines, setIsLoadingEngines] = useState(false)

  const [downloadProgress, setDownloadProgress] = useState(0)
  const [isPredownloading, setIsPredownloading] = useState(false)

  // Is this a VKD3D fork?
  const isVkd3d = selectedFork === 'vkd3d'

  // Check if currently active
  const isActive = isVkd3d
    ? game.vkd3dStatus === 'active'
    : game.dxvkStatus === 'active'

  // VKD3D doesn't support 32-bit
  const is32BitVkd3dBlocked = isVkd3d && game.architecture === '32'

  // Fetch available engines
  useEffect(() => {
    if (!isElectron) return
    const fetchEngines = async () => {
      setIsLoadingEngines(true)
      try {
        const engines = await window.electronAPI.getAvailableEngines(selectedFork)
        setAvailableEngines(engines.map((e: any) => ({
          version: e.version,
          cached: e.cached,
          downloadUrl: e.downloadUrl,
          releaseDate: e.releaseDate,
          changelog: e.changelog
        })))
        if (engines.length > 0) setSelectedVersion(engines[0].version)
        else setSelectedVersion('')
      } catch (error) {
        console.error('Failed to fetch engines:', error)
        setAvailableEngines([])
      } finally {
        setIsLoadingEngines(false)
      }
    }
    fetchEngines()
  }, [selectedFork, isElectron])

  const handleInstall = async () => {
    if (!isElectron || game.architecture === 'unknown') return
    if (is32BitVkd3dBlocked) return

    setIsInstalling(true)
    setInstallStatus('Checking cache...')

    try {
      const isCached = await window.electronAPI.isEngineCached(selectedFork, selectedVersion)
      if (!isCached) {
        setInstallStatus(`Downloading ${isVkd3d ? 'VKD3D' : 'DXVK'}...`)
        const engine = availableEngines.find(e => e.version === selectedVersion)
        if (engine) {
          const downloadResult = await window.electronAPI.downloadEngine(selectedFork, selectedVersion, engine.downloadUrl)
          if (!downloadResult.success) throw new Error(downloadResult.error || 'Download failed')
        } else {
          throw new Error('Version not found')
        }
      }

      setInstallStatus('Installing DLLs...')
      const result = await window.electronAPI.installDxvk(
        game.path,
        game.id,
        selectedFork,
        selectedVersion,
        game.architecture
      )

      if (result.success) {
        const updates: Partial<Game> = {}
        if (isVkd3d) {
          updates.vkd3dStatus = 'active'
          updates.vkd3dVersion = selectedVersion
          updates.vkd3dFork = selectedFork
        } else {
          updates.dxvkStatus = 'active'
          updates.dxvkVersion = selectedVersion
          updates.dxvkFork = selectedFork
        }

        onUpdate({ ...game, ...updates })
        setInstallStatus('✓ Installed successfully!')
        setTimeout(() => setInstallStatus(''), 3000)
        addLogEntry('info', `${isVkd3d ? 'VKD3D' : 'DXVK'} ${selectedFork} v${selectedVersion} installed`, `Game: ${game.name}`)
      } else {
        throw new Error(result.error || 'Installation failed')
      }
    } catch (error) {
      console.error('Install failed:', error)
      setInstallStatus(`✗ ${(error as Error).message}`)
      addLogEntry('error', `${isVkd3d ? 'VKD3D' : 'DXVK'} install failed`, String(error))
      setTimeout(() => setInstallStatus(''), 5000)
    } finally {
      setIsInstalling(false)
    }
  }

  const handleUninstall = async () => {
    if (!isElectron) return
    setIsInstalling(true)
    try {
      const component = isVkd3d ? 'vkd3d' : 'dxvk'
      const result = await window.electronAPI.uninstallDxvk(game.path, component)

      if (result.success) {
        const updates: Partial<Game> = {}
        if (isVkd3d) {
          updates.vkd3dStatus = 'inactive'
          updates.vkd3dVersion = undefined
          updates.vkd3dFork = undefined
        } else {
          updates.dxvkStatus = 'inactive'
          updates.dxvkVersion = undefined
          updates.dxvkFork = undefined
        }
        onUpdate({ ...game, ...updates })
        addLogEntry('info', `${isVkd3d ? 'VKD3D' : 'DXVK'} uninstalled`, `Game: ${game.name}`)
      }
    } catch (error) {
      console.error(error)
      addLogEntry('error', 'Uninstall failed', String(error))
    } finally {
      setIsInstalling(false)
    }
  }

  const handlePreDownload = async () => {
    if (!isElectron || isPredownloading) return
    setIsPredownloading(true)
    setDownloadProgress(0)

    const engine = availableEngines.find(e => e.version === selectedVersion)
    if (!engine) return

    const handleProgress = (p: any) => {
      if (p.fork === selectedFork && p.version === selectedVersion) {
        setDownloadProgress(p.percent)
      }
    }
    window.electronAPI.onDownloadProgress(handleProgress)

    try {
      const res = await window.electronAPI.downloadEngine(selectedFork, selectedVersion, engine.downloadUrl)
      if (res.success) {
        setAvailableEngines(prev => prev.map(e => e.version === selectedVersion ? { ...e, cached: true } : e))
        addLogEntry('info', `Downloaded ${selectedFork} v${selectedVersion}`)
      }
    } catch (e) {
      addLogEntry('error', 'Download failed', String(e))
    } finally {
      setIsPredownloading(false)
      window.electronAPI.removeDownloadProgressListener()
    }
  }

  const handleClearCache = async () => {
    if (!window.confirm(`Delete cached ${selectedFork} v${selectedVersion}?`)) return
    await window.electronAPI.deleteEngine(selectedFork, selectedVersion)
    setAvailableEngines(prev => prev.map(e => e.version === selectedVersion ? { ...e, cached: false } : e))
  }

  // Fork display names
  const getForkLabel = (fork: DxvkFork) => {
    switch (fork) {
      case 'official': return 'DXVK Official'
      case 'gplasync': return 'DXVK GPL Async'
      case 'nvapi': return 'DXVK NVAPI'
      case 'vkd3d': return 'VKD3D-Proton (D3D12)'
    }
  }

  return (
    <div className="glass-card p-6">
      <h3 className="text-lg font-semibold text-studio-200 mb-4">Engine Management</h3>

      {/* VKD3D Info Banner */}
      {isVkd3d && (
        <div className="mb-4 p-3 rounded-lg bg-studio-800/50 border border-studio-700 flex items-start gap-3">
          <Info className="w-4 h-4 text-studio-400 mt-0.5 shrink-0" />
          <div className="text-xs text-studio-400">
            <p className="font-medium text-studio-300">VKD3D-Proton translates D3D12 → Vulkan</p>
            <p className="mt-1">64-bit only. On Windows 10/11, native D3D12 is typically faster.</p>
          </div>
        </div>
      )}

      {/* 32-bit VKD3D Warning */}
      {is32BitVkd3dBlocked && (
        <div className="mb-4 p-3 rounded-lg bg-accent-warning/10 border border-accent-warning/30 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-accent-warning mt-0.5 shrink-0" />
          <p className="text-xs text-accent-warning">VKD3D-Proton does not support 32-bit games. Select a DXVK fork instead.</p>
        </div>
      )}

      {/* Fork/Version Selection */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm text-studio-400 mb-2">Engine</label>
          <select
            value={selectedFork}
            onChange={(e) => setSelectedFork(e.target.value as DxvkFork)}
            className="input-field"
            disabled={isActive}
          >
            <optgroup label="DXVK (D3D9/10/11 → Vulkan)">
              <option value="official">{getForkLabel('official')}</option>
              <option value="gplasync">{getForkLabel('gplasync')}</option>
              <option value="nvapi">{getForkLabel('nvapi')}</option>
            </optgroup>
            <optgroup label="VKD3D (D3D12 → Vulkan)">
              <option value="vkd3d" disabled={game.architecture === '32'}>{getForkLabel('vkd3d')}{game.architecture === '32' ? ' (64-bit only)' : ''}</option>
            </optgroup>
          </select>
        </div>
        <div>
          <label className="block text-sm text-studio-400 mb-2">Version</label>
          <select
            value={selectedVersion}
            onChange={(e) => setSelectedVersion(e.target.value)}
            className="input-field"
            disabled={isActive || isLoadingEngines}
          >
            {isLoadingEngines ? <option>Loading...</option> :
              availableEngines.length === 0 ? <option>No versions</option> :
                availableEngines.map(e => (
                  <option key={e.version} value={e.version}>
                    {e.version}{e.cached ? ' ✓' : ''}
                  </option>
                ))}
          </select>
        </div>
      </div>

      {/* Cache/Predownload Controls */}
      {selectedVersion && availableEngines.find(e => e.version === selectedVersion) && (
        <div className="mb-6 p-4 rounded-lg bg-studio-800/50 border border-studio-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-accent-vulkan font-mono">v{selectedVersion}</span>
              {availableEngines.find(e => e.version === selectedVersion)?.cached ?
                <span className="text-xs bg-accent-success/20 text-accent-success px-1.5 py-0.5 rounded">Cached</span> :
                <span className="text-xs bg-studio-700 text-studio-400 px-1.5 py-0.5 rounded">Not Cached</span>
              }
            </div>
            {!isActive && (
              <div className="flex gap-2">
                {!availableEngines.find(e => e.version === selectedVersion)?.cached && (
                  <button onClick={handlePreDownload} disabled={isPredownloading} className="btn-secondary text-xs">
                    {isPredownloading ? `${downloadProgress}%` : <Download className="w-3.5 h-3.5" />}
                  </button>
                )}
                {availableEngines.find(e => e.version === selectedVersion)?.cached && (
                  <button onClick={handleClearCache} className="btn-secondary text-xs text-accent-danger">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Compatibility Warning */}
      {!isActive && (
        <div className="mb-4 p-3 rounded-lg bg-studio-800/50 border border-studio-700 flex items-start gap-3">
          <AlertCircle className="w-4 h-4 text-studio-400 mt-0.5 shrink-0" />
          <div className="text-xs text-studio-400">
            <p className="font-medium text-studio-300">Compatibility Notice</p>
            <p className="mt-1">
              DXVK/VKD3D may cause white screens or crashes in some games. If issues occur, simply click
              <span className="font-medium text-white mx-1">Uninstall</span>
              to restore original files.
            </p>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        {isActive ? (
          <button onClick={handleUninstall} disabled={isInstalling} className="btn-secondary flex items-center gap-2">
            {isInstalling ? <RefreshCw className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
            Uninstall
          </button>
        ) : (
          <>
            {game.steamAppId && (
              <button
                onClick={() => window.electronAPI.openExternal(`https://www.protondb.com/app/${game.steamAppId}`)}
                className="btn-secondary flex items-center gap-2"
                title="Check compatibility on ProtonDB, the best source for DXVK reports"
              >
                <ExternalLink className="w-4 h-4" />
                ProtonDB
              </button>
            )}
            <button
              onClick={handleInstall}
              disabled={isInstalling || installDisabled || game.architecture === 'unknown' || !selectedVersion || is32BitVkd3dBlocked}
              className="btn-primary flex items-center gap-2"
            >
              {isInstalling ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Install
            </button>
          </>
        )}
      </div>

      {installStatus && <p className="text-sm mt-3 text-studio-300">{installStatus}</p>}
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

  // Edit mode state
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState(game.name)

  // Steam search modal state
  const [showSearchModal, setShowSearchModal] = useState(false)
  const [searchTerm, setSearchTerm] = useState(game.name)
  const [searchResults, setSearchResults] = useState<Array<{ id: number; name: string; imageUrl: string }>>([])
  const [isSearching, setIsSearching] = useState(false)
  const [searchSource, setSearchSource] = useState<'steam' | 'igdb'>('steam')
  const [isIgdbConfigured, setIsIgdbConfigured] = useState(false)

  // Anti-Cheat State
  const [antiCheatWarning, setAntiCheatWarning] = useState<{
    hasAntiCheat: boolean
    highRisk: boolean
    detected: string[]
  } | null>(null)
  const [showAntiCheatOverride, setShowAntiCheatOverride] = useState(false)

  // Config Modals
  const [showConfigModal, setShowConfigModal] = useState(false)
  const [showVkd3dConfigModal, setShowVkd3dConfigModal] = useState(false)

  // Check IGDB configuration
  useEffect(() => {
    if (!isElectron) return
    window.electronAPI.igdbIsConfigured().then(configured => {
      setIsIgdbConfigured(configured)
    })
  }, [])

  // Debounced live search
  useEffect(() => {
    if (!showSearchModal || !isElectron || searchTerm.length < 2) return

    const timer = setTimeout(async () => {
      setIsSearching(true)
      try {
        let results: Array<{ id: number; name: string; imageUrl: string }> = []

        if (searchSource === 'steam') {
          results = await window.electronAPI.searchMetadataMultiple(searchTerm)
        } else {
          // IGDB Search
          const igdbResults = await window.electronAPI.igdbSearch(searchTerm)
          results = igdbResults.map((r: any) => ({
            id: r.id,
            name: r.name,
            imageUrl: r.coverUrl || ''
          }))
        }
        setSearchResults(results)
      } catch (e) {
        setSearchResults([])
      } finally {
        setIsSearching(false)
      }
    }, 500)

    return () => clearTimeout(timer)
  }, [searchTerm, showSearchModal, searchSource])

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

  const steamIconUrl = game.steamAppId
    ? `https://cdn.cloudflare.steamstatic.com/steam/apps/${game.steamAppId}/header.jpg`
    : null

  const handleOpenFolder = async () => {
    if (isElectron) {
      await window.electronAPI.openPath(game.path)
    }
  }

  // Determine if installation should be disabled due to anti-cheat
  const installDisabled = antiCheatWarning?.highRisk && !showAntiCheatOverride

  return (
    <div className="animate-fade-in">
      <button
        onClick={onBack}
        className="text-studio-400 hover:text-studio-200 text-sm mb-4 py-2 px-3 -ml-3 rounded-lg hover:bg-studio-800/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-vulkan flex items-center gap-2 touch-target"
      >
        ← Back to Games
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-card overflow-hidden">
            <div className="relative h-48">
              {steamIconUrl ? (
                <img src={steamIconUrl} alt={game.name} className="w-full h-full object-cover" />
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
                    <button onClick={() => { onUpdate({ ...game, name: editName, updatedAt: new Date().toISOString() }); setIsEditing(false) }} className="p-2 bg-accent-success/20 hover:bg-accent-success/30 rounded-lg text-accent-success">
                      <Check className="w-5 h-5" />
                    </button>
                    <button onClick={() => { setEditName(game.name); setIsEditing(false) }} className="p-2 bg-studio-700/50 hover:bg-studio-700 rounded-lg text-studio-300">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <h2 className="text-2xl font-bold text-white">{game.name}</h2>
                    <button onClick={() => setIsEditing(true)} className="btn-icon-subtle" aria-label="Rename game">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => { setSearchTerm(game.name); setSearchResults([]); setShowSearchModal(true) }} className="btn-icon-subtle" aria-label="Search Steam for cover art">
                      <Search className="w-4 h-4" />
                    </button>
                  </div>
                )}
                <p className="text-studio-400 text-sm mt-1">{game.path}</p>
              </div>
            </div>
          </div>

          {/* Anti-Cheat Warning */}
          {antiCheatWarning?.hasAntiCheat && (
            <div className={`glass-card p-4 border ${antiCheatWarning.highRisk ? 'bg-accent-danger/10 border-accent-danger/30' : 'bg-accent-warning/10 border-accent-warning/30'}`}>
              <div className="flex items-start gap-3">
                <AlertTriangle className={`w-5 h-5 flex-shrink-0 mt-0.5 ${antiCheatWarning.highRisk ? 'text-accent-danger' : 'text-accent-warning'}`} />
                <div className="flex-1">
                  <h4 className={`font-semibold ${antiCheatWarning.highRisk ? 'text-accent-danger' : 'text-accent-warning'}`}>
                    {antiCheatWarning.highRisk ? '⚠️ High-Risk Anti-Cheat Detected' : '⚡ Anti-Cheat Detected'}
                  </h4>
                  <p className="text-sm text-studio-300 mt-1">Found: <strong>{antiCheatWarning.detected.join(', ')}</strong></p>
                  <p className="text-sm text-studio-400 mt-2">
                    {antiCheatWarning.highRisk ? 'Using DXVK/VKD3D with this game may result in a permanent ban.' : 'This game has anti-cheat software. Injection may be detected.'}
                  </p>
                  {antiCheatWarning.highRisk && (
                    <label className="flex items-center gap-2 mt-3 cursor-pointer">
                      <input type="checkbox" checked={showAntiCheatOverride} onChange={(e) => setShowAntiCheatOverride(e.target.checked)} className="w-4 h-4 rounded border-studio-600 bg-studio-800 text-accent-danger focus:ring-accent-danger" />
                      <span className="text-sm text-studio-300">I understand the risks and want to proceed anyway</span>
                    </label>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Global Actions */}
          <div className="flex gap-3">
            <button onClick={handleOpenFolder} className="btn-secondary flex items-center gap-2">
              <FolderOpen className="w-4 h-4" /> Open Folder
            </button>
            {game.dxvkStatus === 'active' && (
              <button onClick={() => setShowConfigModal(true)} className="btn-secondary flex items-center gap-2">
                <Settings className="w-4 h-4" /> DXVK Config
              </button>
            )}
            {game.vkd3dStatus === 'active' && (
              <button onClick={() => setShowVkd3dConfigModal(true)} className="btn-secondary flex items-center gap-2">
                <Settings className="w-4 h-4" /> VKD3D Config
              </button>
            )}
          </div>

          {/* About Section */}
          {(game.summary || game.genres) && (
            <div className="glass-card p-6">
              <h3 className="text-lg font-semibold text-studio-200 mb-4 flex items-center gap-2">
                <Info className="w-5 h-5 text-accent-vulkan" />
                About
              </h3>

              {game.summary && (
                <p className="text-studio-300 mb-4 leading-relaxed text-sm">
                  {game.summary}
                </p>
              )}

              <div className="flex flex-wrap gap-2">
                {game.genres?.map(genre => (
                  <span key={genre} className="px-2 py-1 rounded bg-studio-700 text-xs text-studio-300 border border-studio-600">
                    {genre}
                  </span>
                ))}
              </div>

              {game.developers && game.developers.length > 0 && (
                <div className="mt-4 pt-4 border-t border-studio-700 flex flex-col gap-1">
                  <span className="text-xs text-studio-500 uppercase tracking-wider">Developers</span>
                  <span className="text-studio-200 text-sm">{game.developers.join(', ')}</span>
                </div>
              )}
            </div>
          )}

          {/* Engine Management */}
          <EngineManagementCard game={game} onUpdate={onUpdate} isElectron={isElectron} installDisabled={installDisabled} />
        </div>

        {/* Right Column Status */}
        <div className="space-y-6">
          <div className="glass-card p-6">
            <h3 className="text-lg font-semibold text-studio-200 mb-4">Status</h3>
            <div className="space-y-4">
              <div className="border-b border-studio-700 pb-2 mb-2">
                <div className="flex justify-between mb-1">
                  <span className="text-studio-400">DXVK</span>
                  <span className={`font-medium ${game.dxvkStatus === 'active' ? 'text-accent-success' : 'text-studio-500'}`}>{game.dxvkStatus === 'active' ? 'Installed' : 'Inactive'}</span>
                </div>
                {game.dxvkVersion && <div className="flex justify-between text-sm"><span className="text-studio-500">Version</span><span className="text-studio-300">{game.dxvkVersion}</span></div>}
              </div>
              <div className="border-b border-studio-700 pb-2 mb-2">
                <div className="flex justify-between mb-1">
                  <span className="text-studio-400">VKD3D</span>
                  <span className={`font-medium ${game.vkd3dStatus === 'active' ? 'text-accent-success' : 'text-studio-500'}`}>{game.vkd3dStatus === 'active' ? 'Installed' : 'Inactive'}</span>
                </div>
                {game.vkd3dVersion && <div className="flex justify-between text-sm"><span className="text-studio-500">Version</span><span className="text-studio-300">{game.vkd3dVersion}</span></div>}
              </div>
              <div className="flex justify-between"><span className="text-studio-400">Arch</span><span className="text-studio-200">{game.architecture}</span></div>
              <div className="flex justify-between"><span className="text-studio-400">Platform</span><span className="text-studio-200 capitalize">{game.platform}</span></div>
            </div>
          </div>

          <div className="glass-card p-6 border-accent-danger/20">
            <h3 className="text-lg font-semibold text-accent-danger mb-4 flex items-center gap-2"><Trash2 className="w-5 h-5" /> Danger Zone</h3>
            <p className="text-sm text-studio-400 mb-4">Remove this game from your library. This won't delete game files.</p>
            <button onClick={() => setShowRemoveConfirm(true)} className="btn-secondary text-accent-danger hover:bg-accent-danger/10 border-accent-danger/30 flex items-center gap-2">
              <Trash2 className="w-4 h-4" /> Remove from Library
            </button>
          </div>
        </div>
      </div>

      <ConfigEditorModal isOpen={showConfigModal} gamePath={game.path} onClose={() => setShowConfigModal(false)} onSave={() => console.log('Config saved')} />
      <Vkd3dConfigModal isOpen={showVkd3dConfigModal} gamePath={game.path} executable={game.executable} onClose={() => setShowVkd3dConfigModal(false)} onSave={() => console.log('VKD3D config saved')} />

      {showRemoveConfirm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 animate-fade-in">
          <div className="glass-card max-w-md w-full mx-4 p-6">
            <h3 className="text-xl font-semibold text-studio-100 mb-4">Remove Game?</h3>
            <p className="text-studio-400 mb-6">Are you sure you want to remove <strong className="text-studio-200">{game.name}</strong> from your library?</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setShowRemoveConfirm(false)} className="btn-secondary">Cancel</button>
              <button onClick={() => { setShowRemoveConfirm(false); onRemove() }} className="btn-primary bg-accent-danger border-accent-danger hover:bg-accent-danger/80">Remove</button>
            </div>
          </div>
        </div>
      )}

      {showSearchModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 animate-fade-in">
          <div className="glass-card max-w-lg w-full mx-4 p-6 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-semibold text-studio-100">Search Metadata</h3>
              {isIgdbConfigured && (
                <div className="flex bg-studio-800 p-1 rounded-lg">
                  <button
                    onClick={() => { setSearchSource('steam'); setSearchResults([]) }}
                    className={`px-3 py-1 rounded text-sm transition-colors ${searchSource === 'steam' ? 'bg-studio-600 text-white' : 'text-studio-400 hover:text-studio-200'}`}
                  >
                    Steam
                  </button>
                  <button
                    onClick={() => { setSearchSource('igdb'); setSearchResults([]) }}
                    className={`px-3 py-1 rounded text-sm transition-colors ${searchSource === 'igdb' ? 'bg-accent-vulkan text-white' : 'text-studio-400 hover:text-studio-200'}`}
                  >
                    IGDB
                  </button>
                </div>
              )}
            </div>

            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field w-full mb-4"
              placeholder={`Search ${searchSource === 'steam' ? 'Steam' : 'IGDB'}...`}
              autoFocus
            />

            <div className="flex-1 overflow-y-auto space-y-2 min-h-[200px]">
              {searchResults.length === 0 && !isSearching && (<p className="text-studio-500 text-center py-8">No results found</p>)}
              {isSearching && (
                <div className="flex justify-center py-8">
                  <RefreshCw className="w-8 h-8 text-studio-500 animate-spin" />
                </div>
              )}
              {searchResults.map(result => (
                <button
                  key={result.id}
                  onClick={async () => {
                    if (searchSource === 'steam') {
                      onUpdate({ ...game, name: result.name, steamAppId: result.id.toString(), updatedAt: new Date().toISOString() });
                      setShowSearchModal(false);
                    } else {
                      // IGDB Fetch Details
                      setIsSearching(true);
                      try {
                        const details = await window.electronAPI.igdbGetDetails(result.id)
                        if (details) {
                          onUpdate({
                            ...game,
                            name: details.name,
                            igdbId: details.id,
                            summary: details.summary,
                            coverUrl: details.coverUrl,
                            genres: details.genres,
                            developers: details.developers,
                            updatedAt: new Date().toISOString()
                          })
                        }
                      } catch (e) {
                        console.error('Failed to fetch details', e)
                      } finally {
                        setIsSearching(false);
                        setShowSearchModal(false);
                      }
                    }
                  }}
                  className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-studio-700/50 text-left"
                >
                  {result.imageUrl ? (
                    <img src={result.imageUrl} alt="" className="w-16 h-9 object-cover rounded" />
                  ) : (
                    <div className="w-16 h-9 bg-studio-800 rounded flex items-center justify-center">
                      <Gamepad2 className="w-4 h-4 text-studio-600" />
                    </div>
                  )}
                  <span className="text-studio-200 flex-1 truncate">{result.name}</span>
                </button>
              ))}
            </div>
            <div className="flex justify-end pt-4 border-t border-studio-700">
              <button onClick={() => setShowSearchModal(false)} className="btn-secondary">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


import { ErrorBoundary } from './components/ErrorBoundary'

// Wrap App with Error Boundary
export default function AppWrapper() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  )
}
