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
  CircleAlert,
  Info,
  AlertCircle,
  Filter,
  ClipboardCopy
} from 'lucide-react'
import type { Game, DxvkFork } from './shared/types'

import { ContextMenu } from './components/ContextMenu'
import { ConfigEditorModal } from './components/ConfigEditorModal'

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
    } catch (error) {
      showNotification('error', 'Failed to scan Steam library')
      addLogEntry('error', 'Game scan failed', String(error))
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
              <p className="text-xs text-studio-500">v{__APP_VERSION__}</p>
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
        w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium
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
      <div className="flex items-center gap-4 mb-6 border-b border-studio-800">
        <button
          onClick={() => setActiveTab('cached')}
          className={`pb-3 px-1 text-sm font-medium transition-colors border-b-2 -mb-px ${activeTab === 'cached'
            ? 'text-accent-vulkan border-accent-vulkan'
            : 'text-studio-400 border-transparent hover:text-studio-200'
            }`}
        >
          Cached Engines
          {cachedEngines.length > 0 && (
            <span className="ml-2 px-1.5 py-0.5 text-xs rounded-full bg-studio-700 text-studio-300">
              {cachedEngines.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('available')}
          className={`pb-3 px-1 text-sm font-medium transition-colors border-b-2 -mb-px ${activeTab === 'available'
            ? 'text-accent-vulkan border-accent-vulkan'
            : 'text-studio-400 border-transparent hover:text-studio-200'
            }`}
        >
          Available Versions
        </button>

        {/* Fork selector (only for Available tab) */}
        {activeTab === 'available' && (
          <div className="ml-auto flex items-center gap-2 pb-3">
            <select
              value={selectedFork}
              onChange={(e) => setSelectedFork(e.target.value as DxvkFork)}
              className="input-field text-sm py-1.5"
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
              className="btn-icon"
              title="Refresh versions"
            >
              <RefreshCw className={`w-4 h-4 ${isLoadingAvailable ? 'animate-spin' : ''}`} />
            </button>
          </div>
        )}

        {/* Actions for Cached tab */}
        {activeTab === 'cached' && cachedEngines.length > 0 && (
          <div className="ml-auto flex items-center gap-2 pb-3">
            <button
              onClick={fetchCached}
              disabled={isLoadingCached}
              className="btn-icon"
              title="Refresh cache"
            >
              <RefreshCw className={`w-4 h-4 ${isLoadingCached ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={handleClearAll}
              disabled={isLoadingCached}
              className="btn-secondary text-sm flex items-center gap-1.5 text-accent-danger hover:bg-accent-danger/10"
            >
              <Trash2 className="w-4 h-4" />
              Clear All
            </button>
          </div>
        )}
      </div>

      {/* Cached Tab Content */}
      {activeTab === 'cached' && (
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
                          <div key={key} className="glass-card p-4 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className="w-10 h-10 rounded-lg bg-accent-vulkan/20 flex items-center justify-center">
                                <Check className="w-5 h-5 text-accent-success" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-accent-glow font-mono font-medium">v{engine.version}</span>
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
                                <Trash2 className="w-4 h-4" />
                              )}
                              Delete
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
      )}

      {/* Available Tab Content */}
      {activeTab === 'available' && (
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
                  <div key={engine.version} className="glass-card p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isCached ? 'bg-accent-success/20' : 'bg-studio-700'
                          }`}>
                          {isCached ? (
                            <Check className="w-5 h-5 text-accent-success" />
                          ) : (
                            <Download className="w-5 h-5 text-studio-400" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-accent-glow font-mono font-medium">v{engine.version}</span>
                            {index === 0 && (
                              <span className="px-1.5 py-0.5 text-xs rounded bg-accent-vulkan/20 text-accent-vulkan">
                                Latest
                              </span>
                            )}
                            {isCached && (
                              <span className="px-1.5 py-0.5 text-xs rounded bg-accent-success/20 text-accent-success">
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
                          className="btn-secondary flex items-center gap-2 text-accent-danger hover:bg-accent-danger/10"
                        >
                          {isDeleting === `${selectedFork}-${engine.version}` ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                          Delete
                        </button>
                      ) : (
                        <button
                          onClick={() => handleDownload(engine.version, engine.downloadUrl)}
                          disabled={isDownloading || !!downloadingVersion}
                          className="btn-primary flex items-center gap-2"
                        >
                          {isDownloading ? (
                            <>
                              <RefreshCw className="w-4 h-4 animate-spin" />
                              {downloadProgress > 0 ? `${downloadProgress}%` : 'Starting...'}
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

                    {/* Download Progress Bar */}
                    {isDownloading && downloadProgress > 0 && (
                      <div className="mt-3">
                        <div className="h-1.5 bg-studio-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-accent-vulkan transition-all duration-300"
                            style={{ width: `${downloadProgress}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// Settings View Component
function SettingsView({ onClearGames }: { onClearGames: () => void }) {
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
    nvapi: 'NVAPI (jp7677)',
    vkd3d: 'VKD3D-Proton (HansKristian)'
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

        {/* Data Management Section */}
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
        <p className="text-xs text-studio-500 truncate mt-1">
          {game.platform === 'steam' ? 'Steam' : game.platform === 'gog' ? 'GOG Galaxy' : game.platform === 'epic' ? 'Epic Games' : 'Manual'} • {game.executable || 'No executable'}
        </p>
      </div>
    </div>
  )
}

// Engine Management Card Component
function EngineManagementCard({
  game,
  type,
  onUpdate,
  isElectron,
  installDisabled = false
}: {
  game: Game
  type: 'dxvk' | 'vkd3d'
  onUpdate: (game: Game) => void
  isElectron: boolean
  installDisabled?: boolean
}) {
  const [isInstalling, setIsInstalling] = useState(false)
  const [installStatus, setInstallStatus] = useState('')
  const [selectedFork, setSelectedFork] = useState<DxvkFork>(
    type === 'vkd3d' ? 'vkd3d' : (game.dxvkFork && game.dxvkFork !== 'vkd3d' ? game.dxvkFork : 'official')
  )
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

  // Status and version from game object based on type
  const isActive = type === 'dxvk' ? game.dxvkStatus === 'active' : game.vkd3dStatus === 'active'


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
    setIsInstalling(true)
    setInstallStatus('Checking cache...')

    try {
      const isCached = await window.electronAPI.isEngineCached(selectedFork, selectedVersion)
      if (!isCached) {
        setInstallStatus(`Downloading ${type.toUpperCase()}...`)
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
        // Construct updated game object from manifest if possible?
        // For now, manually update local state to reflect success
        const updates: Partial<Game> = {}
        if (type === 'dxvk') {
          updates.dxvkStatus = 'active'
          updates.dxvkVersion = selectedVersion
          updates.dxvkFork = selectedFork
        } else {
          updates.vkd3dStatus = 'active'
          updates.vkd3dVersion = selectedVersion
          updates.vkd3dFork = selectedFork
        }

        onUpdate({ ...game, ...updates })
        setInstallStatus('✓ Installed successfully!')
        setTimeout(() => setInstallStatus(''), 3000)
        addLogEntry('info', `${type.toUpperCase()} ${selectedFork} v${selectedVersion} installed`, `Game: ${game.name}`)
      } else {
        throw new Error(result.error || 'Installation failed')
      }
    } catch (error) {
      console.error('Install failed:', error)
      setInstallStatus(`✗ ${(error as Error).message}`)
      addLogEntry('error', `${type.toUpperCase()} install failed`, String(error))
      setTimeout(() => setInstallStatus(''), 5000)
    } finally {
      setIsInstalling(false)
    }
  }

  const handleUninstall = async () => {
    if (!isElectron) return
    setIsInstalling(true)
    try {
      // Use the newly supported 'component' parameter if available or fallback
      // Assuming frontend wrapper sends args correctly to backend uninstallEngine(path, component)
      // Note: Backend ipc 'dxvk:uninstall' currently takes only gamePath.
      // I need to update IPC handler 'dxvk:uninstall' (which calls backend uninstallEngine) to support component?
      // Actually backend ipc 'dxvk:uninstall' calls `uninstallEngine(gamePath)`.
      // I need to update frontend electronAPI to support component first?
      // OR I can't support component specific uninstall from frontend yet without IPC update.
      // Wait, I updated IPC 'dxvk:uninstall' to call `uninstallEngine(gamePath)` without args?
      // No, `uninstallEngine` takes optional component.
      // I need to update IPC `dxvk:uninstall` to accept component.

      // Let's assume IPC update is incoming or I'll do it.
      // For now, send gamePath.

      const result = await window.electronAPI.uninstallDxvk(game.path, type) // Pass type to IPC

      if (result.success) {
        const updates: Partial<Game> = {}
        if (type === 'dxvk') {
          updates.dxvkStatus = 'inactive'
          updates.dxvkVersion = undefined
          updates.dxvkFork = undefined
        } else {
          updates.vkd3dStatus = 'inactive'
          updates.vkd3dVersion = undefined
          updates.vkd3dFork = undefined
        }
        onUpdate({ ...game, ...updates })
        addLogEntry('info', `${type.toUpperCase()} uninstalled`, `Game: ${game.name}`)
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

  return (
    <div className="glass-card p-6">
      <h3 className="text-lg font-semibold text-studio-200 mb-4">{type === 'dxvk' ? 'DXVK' : 'VKD3D'} Management</h3>

      {type === 'vkd3d' && (
        <div className="mb-6 p-4 rounded-lg bg-studio-800/50 border border-studio-700 flex items-start gap-3">
          <Info className="w-5 h-5 text-studio-400 mt-0.5 shrink-0" />
          <div className="text-sm text-studio-400">
            <p className="font-medium text-studio-300 mb-1">Note regarding VKD3D on Windows</p>
            VKD3D translates Direct3D 12 to Vulkan. On Windows 10/11, native D3D12 is usually faster.
            This is primarily useful for developers or legacy operating systems.
          </div>
        </div>
      )}

      {/* Fork/Version Selection */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm text-studio-400 mb-2">Fork</label>
          <select
            value={selectedFork}
            onChange={(e) => setSelectedFork(e.target.value as DxvkFork)}
            className="input-field"
            disabled={isActive || type === 'vkd3d'} // VKD3D only has one fork currently
          >
            {type === 'dxvk' ? (
              <>
                <option value="official">Official (doitsujin)</option>
                <option value="gplasync">GPL Async (Ph42oN)</option>
                <option value="nvapi">NVAPI (jp7677)</option>
              </>
            ) : (
              <option value="vkd3d">Proton (HansKristian)</option>
            )}
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

      {/* Cache/Predownload Controls (Simplified) */}
      {selectedVersion && availableEngines.find(e => e.version === selectedVersion) && (
        <div className="mb-6 p-4 rounded-lg bg-studio-800/50 border border-studio-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-accent-glow font-mono">v{selectedVersion}</span>
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

      {/* Actions */}
      <div className="flex gap-3">
        {isActive ? (
          <button onClick={handleUninstall} disabled={isInstalling} className="btn-secondary flex items-center gap-2">
            {isInstalling ? <RefreshCw className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
            Uninstall
          </button>
        ) : (
          <button
            onClick={handleInstall}
            disabled={isInstalling || installDisabled || game.architecture === 'unknown' || !selectedVersion}
            className="btn-primary flex items-center gap-2"
          >
            {isInstalling ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Install
          </button>
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

  // Anti-cheat detection state
  const [antiCheatWarning, setAntiCheatWarning] = useState<{
    hasAntiCheat: boolean
    highRisk: boolean
    detected: string[]
  } | null>(null)
  const [showAntiCheatOverride, setShowAntiCheatOverride] = useState(false)
  const [showConfigModal, setShowConfigModal] = useState(false)

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
            {(game.dxvkStatus === 'active' || game.vkd3dStatus === 'active') && (
              <button onClick={() => setShowConfigModal(true)} className="btn-secondary flex items-center gap-2">
                <Settings className="w-4 h-4" /> Configure (dxvk.conf)
              </button>
            )}
          </div>

          {/* Engines */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <EngineManagementCard game={game} type="dxvk" onUpdate={onUpdate} isElectron={isElectron} installDisabled={installDisabled} />
            <EngineManagementCard game={game} type="vkd3d" onUpdate={onUpdate} isElectron={isElectron} installDisabled={installDisabled} />
          </div>
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
            <h3 className="text-xl font-semibold text-studio-100 mb-4">Search Steam</h3>
            <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="input-field w-full mb-4" placeholder="Start typing to search..." autoFocus />
            <div className="flex-1 overflow-y-auto space-y-2 min-h-[200px]">
              {searchResults.length === 0 && !isSearching && (<p className="text-studio-500 text-center py-8">No results found</p>)}
              {searchResults.map(result => (
                <button key={result.id} onClick={() => { onUpdate({ ...game, name: result.name, steamAppId: result.id.toString(), updatedAt: new Date().toISOString() }); setShowSearchModal(false) }} className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-studio-700/50 text-left">
                  <img src={result.imageUrl} alt="" className="w-16 h-9 object-cover rounded" />
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
