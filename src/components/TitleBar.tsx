import { useState, useEffect } from 'react'
import { Minus, Square, X, Maximize2 } from 'lucide-react'

const isElectron = typeof window !== 'undefined' && window.electronAPI !== undefined

export function TitleBar() {
  const [isMaximized, setIsMaximized] = useState(false)

  // Check maximized state on mount
  useEffect(() => {
    if (!isElectron) return

    const checkMaximized = async () => {
      const maximized = await window.electronAPI.windowIsMaximized()
      setIsMaximized(maximized)
    }

    checkMaximized()

    // Listen for window state changes (optional: add event listener if needed)
    const interval = setInterval(checkMaximized, 500)
    return () => clearInterval(interval)
  }, [])

  const handleMinimize = () => {
    if (isElectron) window.electronAPI.windowMinimize()
  }

  const handleMaximize = () => {
    if (isElectron) window.electronAPI.windowMaximize()
    setIsMaximized(!isMaximized)
  }

  const handleClose = () => {
    if (isElectron) window.electronAPI.windowClose()
  }

  if (!isElectron) return null

  return (
    <div className="flex items-center justify-between h-10 bg-studio-950 border-b border-studio-800/50 select-none">
      {/* Draggable area - takes most of the space */}
      <div className="flex-1 h-full titlebar-drag flex items-center px-4">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-gradient-vulkan shadow-glow-sm shadow-accent-vulkan/30" />
          <span className="text-sm font-medium text-studio-300">DXVK Studio</span>
        </div>
      </div>

      {/* Window controls */}
      <div className="flex items-center h-full titlebar-no-drag">
        <button
          onClick={handleMinimize}
          className="w-12 h-full flex items-center justify-center text-studio-400 hover:bg-white/5 hover:text-studio-200 transition-colors"
          title="Minimize"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={handleMaximize}
          className="w-12 h-full flex items-center justify-center text-studio-400 hover:bg-white/5 hover:text-studio-200 transition-colors"
          title={isMaximized ? 'Restore' : 'Maximize'}
        >
          {isMaximized ? (
            <Maximize2 className="w-3.5 h-3.5" />
          ) : (
            <Square className="w-3 h-3" />
          )}
        </button>

        <button
          onClick={handleClose}
          className="w-12 h-full flex items-center justify-center text-studio-400 hover:bg-accent-danger hover:text-white transition-colors"
          title="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
