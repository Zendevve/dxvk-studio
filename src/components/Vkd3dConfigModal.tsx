import { useState, useEffect } from 'react'
import { X, Check, RefreshCw, AlertTriangle, Cpu, Gauge, Bug, Play } from 'lucide-react'
import type { Vkd3dConfig } from '../shared/types'

interface Vkd3dConfigModalProps {
  isOpen: boolean
  gamePath: string
  executable: string
  onClose: () => void
  onSave?: () => void
}

const DEBUG_LEVELS = [
  { value: 'none', label: 'None' },
  { value: 'err', label: 'Errors Only' },
  { value: 'warn', label: 'Warnings' },
  { value: 'fixme', label: 'Fixme' },
  { value: 'info', label: 'Info' },
  { value: 'trace', label: 'Trace (Verbose)' }
] as const

export function Vkd3dConfigModal({ isOpen, gamePath, executable, onClose, onSave }: Vkd3dConfigModalProps) {
  const [config, setConfig] = useState<Vkd3dConfig>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasLauncher, setHasLauncher] = useState(false)

  // Load config when modal opens
  useEffect(() => {
    if (isOpen) {
      loadConfig()
    }
  }, [isOpen, gamePath])

  const loadConfig = async () => {
    setLoading(true)
    setError(null)
    try {
      const [loaded, launcher] = await Promise.all([
        window.electronAPI.readVkd3dConfig(gamePath),
        window.electronAPI.hasVkd3dLauncher(gamePath)
      ])
      setConfig(loaded || {})
      setHasLauncher(launcher)
    } catch (err) {
      console.error('Failed to load VKD3D config:', err)
      setError('Failed to load configuration')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      const result = await window.electronAPI.saveVkd3dConfig(gamePath, executable, config)
      if (result.success) {
        setHasLauncher(true)
        onSave?.()
        onClose()
      } else {
        setError(result.error || 'Failed to save config')
      }
    } catch (err) {
      setError('An unexpected error occurred')
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 animate-fade-in">
      <div className="glass-card max-w-xl w-full mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-studio-700 flex justify-between items-center bg-studio-800/50">
          <div>
            <h3 className="text-xl font-semibold text-studio-100 flex items-center gap-2">
              <Cpu className="w-5 h-5 text-blue-400" />
              VKD3D-Proton Configuration
            </h3>
            <p className="text-sm text-studio-400 mt-1">
              Configure DirectX 12 translation settings
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-studio-400 hover:text-studio-200 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-studio-400">
              <RefreshCw className="w-8 h-8 animate-spin mb-4" />
              <p>Loading configuration...</p>
            </div>
          ) : (
            <>
              {error && (
                <div className="bg-accent-danger/10 border border-accent-danger/20 rounded-lg p-4 flex items-center gap-3 text-accent-danger">
                  <AlertTriangle className="w-5 h-5" />
                  <p>{error}</p>
                </div>
              )}

              {/* Launcher Info */}
              {hasLauncher && (
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-blue-400 mb-2">
                    <Play className="w-4 h-4" />
                    <span className="text-sm font-medium">Launcher Script Active</span>
                  </div>
                  <p className="text-xs text-studio-400">
                    A launcher script exists. Run <code className="bg-studio-800 px-1 rounded">dxvk_studio_vkd3d_launcher.bat</code> to launch with these settings.
                  </p>
                </div>
              )}

              {/* DXR Settings */}
              <section>
                <h4 className="text-sm font-semibold text-studio-300 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Cpu className="w-4 h-4" />
                  Ray Tracing (DXR)
                </h4>
                <div className="space-y-4">
                  <label className="flex items-start gap-3 p-3 rounded-lg bg-studio-800/50 border border-studio-700">
                    <div className="relative inline-flex items-center cursor-pointer mt-0.5">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={config.enableDxr ?? false}
                        onChange={(e) => setConfig({ ...config, enableDxr: e.target.checked, disableDxr: false })}
                      />
                      <div className="w-11 h-6 bg-studio-700 peer-focus:ring-2 peer-focus:ring-blue-400 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-studio-200">Force Enable DXR</span>
                      <p className="text-xs text-studio-500 mt-1">
                        Force enable ray tracing even if VKD3D considers it unsafe. Use if DXR isn't working.
                      </p>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 p-3 rounded-lg bg-studio-800/50 border border-studio-700">
                    <div className="relative inline-flex items-center cursor-pointer mt-0.5">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={config.disableDxr ?? false}
                        onChange={(e) => setConfig({ ...config, disableDxr: e.target.checked, enableDxr: false })}
                      />
                      <div className="w-11 h-6 bg-studio-700 peer-focus:ring-2 peer-focus:ring-blue-400 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-studio-200">Disable DXR</span>
                      <p className="text-xs text-studio-500 mt-1">
                        Completely disable ray tracing. Use for stability or performance.
                      </p>
                    </div>
                  </label>
                </div>
              </section>

              {/* Performance */}
              <section>
                <h4 className="text-sm font-semibold text-studio-300 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Gauge className="w-4 h-4" />
                  Performance
                </h4>

                <div className="space-y-4">
                  {/* NVIDIA Speed Hack */}
                  <label className="flex items-start gap-3 p-3 rounded-lg bg-studio-800/50 border border-studio-700">
                    <div className="relative inline-flex items-center cursor-pointer mt-0.5">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={config.forceStaticCbv ?? false}
                        onChange={(e) => setConfig({ ...config, forceStaticCbv: e.target.checked })}
                      />
                      <div className="w-11 h-6 bg-studio-700 peer-focus:ring-2 peer-focus:ring-green-400 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-studio-200">NVIDIA Static CBV</span>
                      <span className="ml-2 px-1.5 py-0.5 text-xs rounded bg-green-500/20 text-green-400">NVIDIA</span>
                      <p className="text-xs text-studio-500 mt-1">
                        Speed optimization for NVIDIA GPUs. May cause issues on some games.
                      </p>
                    </div>
                  </label>

                  {/* Frame Rate Limit */}
                  <div className="p-4 rounded-lg bg-studio-800/50 border border-studio-700">
                    <label className="block text-sm font-medium text-studio-200 mb-2">Frame Rate Limit</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        min="0"
                        max="500"
                        placeholder="0 (Unlimited)"
                        className="input-field flex-1"
                        value={config.maxFrameRate || ''}
                        onChange={(e) => setConfig({ ...config, maxFrameRate: e.target.value ? Number(e.target.value) : undefined })}
                      />
                      <span className="text-sm text-studio-500">FPS</span>
                    </div>
                    <p className="text-xs text-studio-500 mt-2">
                      Set to 0 or leave empty for unlimited. Useful for capping frame rate.
                    </p>
                  </div>
                </div>
              </section>

              {/* Debug & Logging */}
              <section>
                <h4 className="text-sm font-semibold text-studio-300 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Bug className="w-4 h-4" />
                  Debug & Logging
                </h4>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-studio-200 mb-2">VKD3D Debug Level</label>
                    <select
                      className="input-field"
                      value={config.debugLevel || 'none'}
                      onChange={(e) => setConfig({ ...config, debugLevel: e.target.value as Vkd3dConfig['debugLevel'] })}
                    >
                      {DEBUG_LEVELS.map(level => (
                        <option key={level.value} value={level.value}>{level.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-studio-200 mb-2">Shader Debug Level</label>
                    <select
                      className="input-field"
                      value={config.shaderDebugLevel || 'none'}
                      onChange={(e) => setConfig({ ...config, shaderDebugLevel: e.target.value as Vkd3dConfig['shaderDebugLevel'] })}
                    >
                      {DEBUG_LEVELS.map(level => (
                        <option key={level.value} value={level.value}>{level.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </section>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-studio-700 flex justify-end gap-3 bg-studio-800/50">
          <button
            onClick={onClose}
            className="btn-secondary"
            disabled={saving}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading || saving}
            className="btn-primary flex items-center gap-2"
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            {saving ? 'Saving...' : 'Save & Generate Launcher'}
          </button>
        </div>
      </div>
    </div>
  )
}
