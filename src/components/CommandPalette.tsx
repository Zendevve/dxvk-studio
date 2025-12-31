import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  Gamepad2,
  Settings,
  Download,
  FolderPlus,
  RefreshCw,
  FileText,
  Command
} from 'lucide-react'

interface CommandItem {
  id: string
  label: string
  description?: string
  icon: React.ReactNode
  action: () => void
  shortcut?: string
}

interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
  onNavigate: (view: 'games' | 'engines' | 'settings' | 'logs') => void
  onScanGames: () => void
  onAddGame: () => void
}

export function CommandPalette({
  isOpen,
  onClose,
  onNavigate,
  onScanGames,
  onAddGame
}: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const commands: CommandItem[] = [
    {
      id: 'games',
      label: 'Go to Games',
      description: 'View your game library',
      icon: <Gamepad2 className="w-4 h-4" />,
      action: () => { onNavigate('games'); onClose() },
      shortcut: 'G'
    },
    {
      id: 'engines',
      label: 'Go to Engine Manager',
      description: 'Download and manage DXVK versions',
      icon: <Download className="w-4 h-4" />,
      action: () => { onNavigate('engines'); onClose() },
      shortcut: 'E'
    },
    {
      id: 'settings',
      label: 'Go to Settings',
      description: 'Configure preferences',
      icon: <Settings className="w-4 h-4" />,
      action: () => { onNavigate('settings'); onClose() },
      shortcut: ','
    },
    {
      id: 'logs',
      label: 'View Logs',
      description: 'Application activity history',
      icon: <FileText className="w-4 h-4" />,
      action: () => { onNavigate('logs'); onClose() },
      shortcut: 'L'
    },
    {
      id: 'scan',
      label: 'Scan for Games',
      description: 'Detect Steam and GOG games',
      icon: <RefreshCw className="w-4 h-4" />,
      action: () => { onScanGames(); onClose() },
      shortcut: 'S'
    },
    {
      id: 'add',
      label: 'Add Game Manually',
      description: 'Add a game from folder',
      icon: <FolderPlus className="w-4 h-4" />,
      action: () => { onAddGame(); onClose() },
      shortcut: 'A'
    },
  ]

  // Fuzzy filter
  const filteredCommands = commands.filter(cmd => {
    if (!query) return true
    const q = query.toLowerCase()
    return (
      cmd.label.toLowerCase().includes(q) ||
      cmd.description?.toLowerCase().includes(q)
    )
  })

  // Reset state when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen])

  // Keyboard navigation
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isOpen) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(prev => (prev + 1) % filteredCommands.length)
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(prev => (prev - 1 + filteredCommands.length) % filteredCommands.length)
        break
      case 'Enter':
        e.preventDefault()
        if (filteredCommands[selectedIndex]) {
          filteredCommands[selectedIndex].action()
        }
        break
      case 'Escape':
        e.preventDefault()
        onClose()
        break
    }
  }, [isOpen, filteredCommands, selectedIndex, onClose])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-studio-950/80 backdrop-blur-sm" />

      {/* Palette */}
      <div
        className="relative w-full max-w-lg mx-4 glass-card overflow-hidden shadow-2xl animate-scale-in"
        onClick={e => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5">
          <Command className="w-5 h-5 text-accent-vulkan" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command or search..."
            className="flex-1 bg-transparent text-white placeholder:text-studio-500 focus:outline-none text-base"
          />
          <kbd className="hidden sm:inline-flex px-2 py-1 text-xs font-mono text-studio-400 bg-studio-800 rounded">
            esc
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto p-2">
          {filteredCommands.length === 0 ? (
            <div className="px-4 py-8 text-center text-studio-500">
              No commands found
            </div>
          ) : (
            filteredCommands.map((cmd, index) => (
              <button
                key={cmd.id}
                onClick={cmd.action}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${index === selectedIndex
                  ? 'bg-accent-vulkan/20 text-white'
                  : 'text-studio-300 hover:bg-white/5'
                  }`}
              >
                <span className={`${index === selectedIndex ? 'text-accent-vulkan' : 'text-studio-500'}`}>
                  {cmd.icon}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{cmd.label}</p>
                  {cmd.description && (
                    <p className="text-xs text-studio-500 truncate">{cmd.description}</p>
                  )}
                </div>
                {cmd.shortcut && (
                  <kbd className="px-1.5 py-0.5 text-xs font-mono text-studio-400 bg-studio-800 rounded">
                    {cmd.shortcut}
                  </kbd>
                )}
              </button>
            ))
          )}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2 border-t border-white/5 flex items-center gap-4 text-xs text-studio-500">
          <span className="flex items-center gap-1">
            <kbd className="px-1 bg-studio-800 rounded">↑↓</kbd> Navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 bg-studio-800 rounded">↵</kbd> Select
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 bg-studio-800 rounded">esc</kbd> Close
          </span>
        </div>
      </div>
    </div>
  )
}
