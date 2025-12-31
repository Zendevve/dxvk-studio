import { useState, useEffect } from 'react'
import { X, Check, RefreshCw, AlertTriangle, Monitor, Zap, Gauge, FileText } from 'lucide-react'
import type { DxvkConfig, DxvkProfile } from '../shared/types'

interface ConfigEditorModalProps {
  isOpen: boolean
  gamePath: string
  onClose: () => void
  onSave?: () => void
}

const HUD_OPTIONS = [
  { value: 'fps', label: 'FPS Counter' },
  { value: 'frametimes', label: 'Frame Times' },
  { value: 'gpuload', label: 'GPU Load' },
  { value: 'version', label: 'DXVK Version' },
  { value: 'api', label: 'API Version' },
  { value: 'memory', label: 'Video Memory' },
  { value: 'compiler', label: 'Shader Compiler' }
]

export function ConfigEditorModal({ isOpen, gamePath, onClose, onSave }: ConfigEditorModalProps) {
  const [config, setConfig] = useState<DxvkConfig>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [profiles, setProfiles] = useState<DxvkProfile[]>([])
  const [showSaveProfile, setShowSaveProfile] = useState(false)
  const [newProfileName, setNewProfileName] = useState('')

  // Load config and profiles when modal opens
  useEffect(() => {
    if (isOpen) {
      loadConfig()
      loadProfiles()
    }
  }, [isOpen, gamePath])

  const loadProfiles = async () => {
    try {
      const userProfiles = await window.electronAPI.getAllProfiles()
      setProfiles(userProfiles)
    } catch (err) {
      console.error('Failed to load profiles:', err)
      setProfiles([])
    }
  }

  const loadConfig = async () => {
    setLoading(true)
    setError(null)
    try {
      const loaded = await window.electronAPI.readConfig(gamePath)
      setConfig(loaded || {}) // Default to empty if no config
    } catch (err) {
      console.error('Failed to load config:', err)
      setError('Failed to load configuration file')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const result = await window.electronAPI.saveConfig(gamePath, config)
      if (result.success) {
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

  const toggleHudOption = (option: string) => {
    const currentHud = config.hud || []
    const newHud = currentHud.includes(option)
      ? currentHud.filter(o => o !== option)
      : [...currentHud, option]
    setConfig({ ...config, hud: newHud })
  }

  const handleApplyProfile = (profileId: string) => {
    if (!profileId) return
    const profile = profiles.find(p => p.id === profileId)
    if (profile) {
      // Create a config object without profile metadata
      const { id, name, description, isBuiltin, ...configOnly } = profile
      setConfig(prev => ({ ...prev, ...configOnly }))
    }
  }

  const handleSaveProfile = async () => {
    if (!newProfileName.trim()) return
    try {
      const { id, name, description, isBuiltin, ...currentConfig } = (config as any)

      const newProfile: DxvkProfile = {
        ...currentConfig,
        id: '',
        name: newProfileName,
        isBuiltin: false
      }

      const result = await window.electronAPI.saveProfile(newProfile)
      if (result.success) {
        setNewProfileName('')
        setShowSaveProfile(false)
        loadProfiles()
      }
    } catch (err) {
      console.error('Failed to save profile', err)
    }
  }

  const handleDeleteProfile = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    // In a real app we'd use a better dialog, but this works for MVP
    if (window.confirm('Delete this profile?')) {
      await window.electronAPI.deleteProfile(id)
      loadProfiles()
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 animate-fade-in">
      <div className="glass-card max-w-2xl w-full mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-studio-700 flex justify-between items-center bg-studio-800/50">
          <div>
            <h3 className="text-xl font-semibold text-studio-100 flex items-center gap-2">
              <FileText className="w-5 h-5 text-accent-vulkan" />
              DXVK Configuration
            </h3>
            <p className="text-sm text-studio-400 mt-1">
              Configure settings for this specific game
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
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-8">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 text-studio-400">
              <RefreshCw className="w-8 h-8 animate-spin mb-4" />
              <p>Loading configuration...</p>
            </div>
          ) : (
            <>
              {/* Profiles Section */}
              <div className="bg-studio-800/50 rounded-lg p-4 border border-studio-700">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-sm font-medium text-studio-200">Configuration Profile</h4>
                  {showSaveProfile ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={newProfileName}
                        onChange={(e) => setNewProfileName(e.target.value)}
                        placeholder="Profile Name"
                        className="bg-studio-900 border border-studio-700 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-accent-vulkan w-40"
                        autoFocus
                      />
                      <button onClick={handleSaveProfile} className="text-green-500 hover:text-green-400">
                        <Check className="w-4 h-4" />
                      </button>
                      <button onClick={() => setShowSaveProfile(false)} className="text-red-500 hover:text-red-400">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowSaveProfile(true)}
                      className="text-xs text-accent-vulkan hover:text-accent-vulkan/80"
                    >
                      Save Current as Profile
                    </button>
                  )}
                </div>

                <select
                  className="w-full bg-studio-900 border border-studio-700 rounded-md px-3 py-2 text-studio-100 focus:outline-none focus:border-accent-vulkan"
                  onChange={(e) => handleApplyProfile(e.target.value)}
                  value=""
                >
                  <option value="" disabled>Select a profile to apply...</option>
                  {profiles.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.isBuiltin ? '(Built-in)' : ''}
                    </option>
                  ))}
                </select>

                {profiles.some(p => !p.isBuiltin) && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {profiles.filter(p => !p.isBuiltin).map(p => (
                      <div key={p.id} className="group flex items-center gap-2 bg-studio-900 px-2 py-1 rounded text-xs text-studio-300 border border-studio-800">
                        {p.name}
                        <button onClick={(e) => handleDeleteProfile(p.id, e)} className="text-studio-500 hover:text-red-400">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {error && (
                <div className="bg-accent-danger/10 border border-accent-danger/20 rounded-lg p-4 flex items-center gap-3 text-accent-danger">
                  <AlertTriangle className="w-5 h-5" />
                  <p>{error}</p>
                </div>
              )}

              {/* HUD Settings */}
              <section>
                <h4 className="text-sm font-semibold text-studio-300 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Monitor className="w-4 h-4" />
                  Heads-Up Display (HUD)
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {HUD_OPTIONS.map(option => (
                    <label
                      key={option.value}
                      className={`
                        flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all
                        ${(config.hud || []).includes(option.value)
                          ? 'bg-accent-vulkan/20 border-accent-vulkan/50 text-studio-100'
                          : 'bg-studio-800/50 border-studio-700 text-studio-400 hover:border-studio-600'}
                      `}
                    >
                      <input
                        type="checkbox"
                        className="w-4 h-4 rounded border-studio-600 bg-studio-800 text-accent-vulkan focus:ring-accent-vulkan"
                        checked={(config.hud || []).includes(option.value)}
                        onChange={() => toggleHudOption(option.value)}
                      />
                      <span className="text-sm font-medium">{option.label}</span>
                    </label>
                  ))}
                </div>

                {/* HUD Scale */}
                <div className="mt-4 bg-studio-800/50 p-4 rounded-lg border border-studio-700">
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-sm font-medium text-studio-200">HUD Scale</label>
                    <span className="text-sm text-accent-vulkan font-mono">
                      {(config.hudScale ?? 1.0).toFixed(1)}x
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="2.0"
                    step="0.1"
                    value={config.hudScale ?? 1.0}
                    onChange={(e) => setConfig({ ...config, hudScale: parseFloat(e.target.value) })}
                    className="w-full accent-accent-vulkan h-2 bg-studio-700 rounded-lg appearance-none cursor-pointer"
                  />
                  <div className="flex justify-between text-xs text-studio-500 mt-1">
                    <span>0.5x</span>
                    <span>1.0x</span>
                    <span>2.0x</span>
                  </div>
                </div>
              </section>

              {/* Performance Settings */}
              <section>
                <h4 className="text-sm font-semibold text-studio-300 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Zap className="w-4 h-4" />
                  Performance & Sync
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {/* Async */}
                  <div className="space-y-2">
                    <label className="flex items-center gap-3">
                      <div className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={config.enableAsync ?? false}
                          onChange={(e) => setConfig({ ...config, enableAsync: e.target.checked })}
                        />
                        <div className="w-11 h-6 bg-studio-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-accent-vulkan rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent-vulkan"></div>
                        <span className="ml-3 text-sm font-medium text-studio-200">Async Pipeline Compilation</span>
                      </div>
                    </label>
                    <p className="text-xs text-studio-500 ml-14">
                      Reduces shader compilation stutter, but may be considered cheating in some online games.
                    </p>
                  </div>

                  {/* VSync */}
                  <div className="space-y-2">
                    <label className="flex items-center gap-3">
                      <div className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={(config.syncInterval || 0) > 0}
                          onChange={(e) => setConfig({ ...config, syncInterval: e.target.checked ? 1 : 0 })}
                        />
                        <div className="w-11 h-6 bg-studio-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-accent-vulkan rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent-vulkan"></div>
                        <span className="ml-3 text-sm font-medium text-studio-200">Vertical Sync (VSync)</span>
                      </div>
                    </label>
                    <p className="text-xs text-studio-500 ml-14">
                      Synchronizes frame rate to monitor refresh rate to prevent screen tearing.
                    </p>
                  </div>
                </div>
              </section>

              {/* Limits */}
              <section>
                <h4 className="text-sm font-semibold text-studio-300 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Gauge className="w-4 h-4" />
                  Limits
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-studio-300 mb-2">Max Frame Rate</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        placeholder="0 (Unlimited)"
                        className="input-field"
                        value={config.maxFrameRate || ''}
                        onChange={(e) => setConfig({ ...config, maxFrameRate: e.target.value ? Number(e.target.value) : undefined })}
                      />
                      <span className="text-sm text-studio-500">FPS</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-studio-300 mb-2">Max Device Memory</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        placeholder="0 (Auto)"
                        className="input-field"
                        value={config.maxDeviceMemory || ''}
                        onChange={(e) => setConfig({ ...config, maxDeviceMemory: e.target.value ? Number(e.target.value) : undefined })}
                      />
                      <span className="text-sm text-studio-500">MB</span>
                    </div>
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
            {saving ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>
      </div>
    </div>
  )
}
