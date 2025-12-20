import { useState, useEffect } from 'react'
import './ConfigEditor.css'

interface ConfigEditorProps {
  gamePath: string
}

interface DxvkConfig {
  // Frame Rate
  'dxgi.maxFrameRate'?: number
  'd3d9.maxFrameRate'?: number

  // HUD
  'dxvk.hud'?: string

  // Async
  'dxvk.enableAsync'?: boolean
  'dxvk.gplAsyncCache'?: boolean

  // Latency
  'dxvk.latencySleep'?: boolean

  // Display
  'dxgi.enableHDR'?: boolean
  'dxvk.tearFree'?: string

  // Memory
  'dxgi.maxDeviceMemory'?: number
  'd3d9.maxAvailableMemory'?: number

  [key: string]: string | number | boolean | undefined
}

const HUD_OPTIONS = [
  { key: 'fps', label: 'FPS Counter' },
  { key: 'frametimes', label: 'Frame Time Graph' },
  { key: 'memory', label: 'Memory Usage' },
  { key: 'gpuload', label: 'GPU Load' },
  { key: 'devinfo', label: 'Device Info' },
  { key: 'version', label: 'DXVK Version' },
  { key: 'api', label: 'API Version' },
  { key: 'compiler', label: 'Shader Compiler' },
]

const PRESETS = {
  performance: {
    'dxvk.enableAsync': true,
    'dxvk.gplAsyncCache': true,
    'dxvk.latencySleep': false,
    'dxvk.hud': 'fps',
    'dxvk.tearFree': 'false',
  },
  balanced: {
    'dxvk.enableAsync': true,
    'dxvk.gplAsyncCache': true,
    'dxvk.latencySleep': true,
    'dxvk.hud': 'fps,frametimes',
    'dxvk.tearFree': 'auto',
  },
  quality: {
    'dxvk.enableAsync': false,
    'dxvk.gplAsyncCache': false,
    'dxvk.latencySleep': true,
    'dxvk.hud': 'fps,frametimes,memory',
    'dxvk.tearFree': 'true',
    'dxgi.enableHDR': true,
  }
}

export function ConfigEditor({ gamePath }: ConfigEditorProps) {
  const [config, setConfig] = useState<DxvkConfig>({})
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle')

  // Load config on mount
  useEffect(() => {
    loadConfig()
  }, [gamePath])

  const loadConfig = async () => {
    setIsLoading(true)
    try {
      const loadedConfig = await window.electronAPI.getConfig(gamePath)
      setConfig(loadedConfig)
    } catch (err) {
      console.error('Failed to load config:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const saveConfig = async () => {
    setIsSaving(true)
    setSaveStatus('idle')
    try {
      await window.electronAPI.saveConfig(gamePath, config)
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2000)
    } catch (err) {
      console.error('Failed to save config:', err)
      setSaveStatus('error')
    } finally {
      setIsSaving(false)
    }
  }

  const updateConfig = (key: string, value: string | number | boolean | undefined) => {
    setConfig(prev => ({
      ...prev,
      [key]: value
    }))
  }

  const applyPreset = (presetName: keyof typeof PRESETS) => {
    setConfig(prev => ({
      ...prev,
      ...PRESETS[presetName]
    }))
  }

  // Parse HUD options from string
  const hudOptions = (config['dxvk.hud'] || '').split(',').filter(Boolean)

  const toggleHudOption = (option: string) => {
    const current = new Set(hudOptions)
    if (current.has(option)) {
      current.delete(option)
    } else {
      current.add(option)
    }
    updateConfig('dxvk.hud', Array.from(current).join(',') || undefined)
  }

  if (isLoading) {
    return (
      <div className="config-loading">
        <span className="spinner" />
        Loading configuration...
      </div>
    )
  }

  return (
    <div className="config-editor">
      {/* Presets */}
      <section className="config-section">
        <h3>Presets</h3>
        <div className="preset-buttons">
          <button className="btn btn-sm btn-secondary" onClick={() => applyPreset('performance')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
            Performance
          </button>
          <button className="btn btn-sm btn-secondary" onClick={() => applyPreset('balanced')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12" y2="16" />
            </svg>
            Balanced
          </button>
          <button className="btn btn-sm btn-secondary" onClick={() => applyPreset('quality')}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
            Quality
          </button>
        </div>
      </section>

      {/* Frame Rate */}
      <section className="config-section">
        <h3>Frame Rate</h3>
        <div className="config-row">
          <label htmlFor="maxFrameRate">Max Frame Rate</label>
          <input
            id="maxFrameRate"
            type="number"
            min="0"
            max="500"
            placeholder="Unlimited"
            value={config['dxgi.maxFrameRate'] || ''}
            onChange={e => updateConfig('dxgi.maxFrameRate', e.target.value ? Number(e.target.value) : undefined)}
          />
        </div>
      </section>

      {/* Async Compilation */}
      <section className="config-section">
        <h3>Shader Compilation</h3>
        <div className="config-row">
          <label>
            <input
              type="checkbox"
              checked={config['dxvk.enableAsync'] === true}
              onChange={e => updateConfig('dxvk.enableAsync', e.target.checked || undefined)}
            />
            Enable Async Shader Compilation
          </label>
        </div>
        <div className="config-row">
          <label>
            <input
              type="checkbox"
              checked={config['dxvk.gplAsyncCache'] === true}
              onChange={e => updateConfig('dxvk.gplAsyncCache', e.target.checked || undefined)}
            />
            GPL Async Pipeline Cache
          </label>
        </div>
      </section>

      {/* Display */}
      <section className="config-section">
        <h3>Display</h3>
        <div className="config-row">
          <label htmlFor="tearFree">Tear-Free Mode</label>
          <select
            id="tearFree"
            value={config['dxvk.tearFree'] || 'auto'}
            onChange={e => updateConfig('dxvk.tearFree', e.target.value)}
          >
            <option value="auto">Auto</option>
            <option value="true">Enabled</option>
            <option value="false">Disabled</option>
          </select>
        </div>
        <div className="config-row">
          <label>
            <input
              type="checkbox"
              checked={config['dxgi.enableHDR'] === true}
              onChange={e => updateConfig('dxgi.enableHDR', e.target.checked || undefined)}
            />
            Enable HDR
          </label>
        </div>
        <div className="config-row">
          <label>
            <input
              type="checkbox"
              checked={config['dxvk.latencySleep'] === true}
              onChange={e => updateConfig('dxvk.latencySleep', e.target.checked || undefined)}
            />
            Latency Sleep (reduce input lag)
          </label>
        </div>
      </section>

      {/* HUD Options */}
      <section className="config-section">
        <h3>HUD Elements</h3>
        <div className="hud-grid">
          {HUD_OPTIONS.map(opt => (
            <label key={opt.key} className="hud-option">
              <input
                type="checkbox"
                checked={hudOptions.includes(opt.key)}
                onChange={() => toggleHudOption(opt.key)}
              />
              {opt.label}
            </label>
          ))}
        </div>
      </section>

      {/* Save Button */}
      <div className="config-actions">
        <button
          className="btn btn-primary"
          onClick={saveConfig}
          disabled={isSaving}
        >
          {isSaving ? 'Saving...' : saveStatus === 'saved' ? '✓ Saved!' : 'Save Configuration'}
        </button>
        <button className="btn btn-secondary" onClick={loadConfig}>
          Reset
        </button>
      </div>

      {saveStatus === 'error' && (
        <p className="text-danger">Failed to save configuration</p>
      )}
    </div>
  )
}
