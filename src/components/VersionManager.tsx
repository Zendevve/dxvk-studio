import { useState, useEffect } from 'react'
import type { DxvkVersion } from '../App'
import './VersionManager.css'

interface VersionManagerProps {
  installedVersions: DxvkVersion[]
  onRefresh: () => void
}

interface AvailableVersion {
  tag: string
  url: string
}

type Variant = 'standard' | 'async' | 'gplasync'

export function VersionManager({ installedVersions, onRefresh }: VersionManagerProps) {
  const [availableVersions, setAvailableVersions] = useState<AvailableVersion[]>([])
  const [selectedVariant, setSelectedVariant] = useState<Variant>('standard')
  const [isLoading, setIsLoading] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadAvailableVersions()
  }, [selectedVariant])

  useEffect(() => {
    // Listen for download progress
    const unsubscribe = window.electronAPI.onProgress((progress: number) => {
      setDownloadProgress(progress)
    })
    return unsubscribe
  }, [])

  const loadAvailableVersions = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const versions = await window.electronAPI.getAvailableVersions(selectedVariant)
      setAvailableVersions(versions.slice(0, 10)) // Show last 10 versions
    } catch (err) {
      setError('Failed to fetch versions. Check your internet connection.')
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDownload = async (version: string) => {
    setIsLoading(true)
    setDownloadProgress(0)
    setError(null)
    try {
      await window.electronAPI.downloadDxvk(version, selectedVariant)
      onRefresh()
      setDownloadProgress(null)
    } catch (err) {
      setError('Download failed: ' + String(err))
    } finally {
      setIsLoading(false)
      setDownloadProgress(null)
    }
  }

  const isVersionInstalled = (tag: string) => {
    return installedVersions.some(v =>
      v.version === tag && v.variant === selectedVariant
    )
  }

  return (
    <div className="version-manager">
      <div className="version-manager-header">
        <h2>DXVK Versions</h2>
        <p className="text-secondary">
          Download and manage DXVK versions for installation
        </p>
      </div>

      <div className="variant-tabs">
        {(['standard', 'async', 'gplasync'] as Variant[]).map(variant => (
          <button
            key={variant}
            className={`variant-tab ${selectedVariant === variant ? 'active' : ''}`}
            onClick={() => setSelectedVariant(variant)}
          >
            {variant === 'standard' ? 'Standard' :
              variant === 'async' ? 'Async' : 'GPL Async'}
          </button>
        ))}
      </div>

      {error && (
        <div className="error-message">
          {error}
          <button onClick={() => setError(null)}>✕</button>
        </div>
      )}

      {downloadProgress !== null && (
        <div className="download-progress">
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${downloadProgress}%` }}
            />
          </div>
          <span className="progress-text">Downloading... {downloadProgress}%</span>
        </div>
      )}

      <div className="version-sections">
        <section className="version-section">
          <h3>Installed</h3>
          {installedVersions.filter(v => v.variant === selectedVariant).length === 0 ? (
            <p className="text-tertiary">No {selectedVariant} versions installed</p>
          ) : (
            <div className="version-list">
              {installedVersions
                .filter(v => v.variant === selectedVariant)
                .map(v => (
                  <div key={v.path} className="version-item installed">
                    <span className="version-name">{v.version}</span>
                    <span className="badge badge-success">Installed</span>
                  </div>
                ))}
            </div>
          )}
        </section>

        <section className="version-section">
          <h3>Available</h3>
          {isLoading && availableVersions.length === 0 ? (
            <div className="loading-state">
              <span className="spinner" />
              Loading versions...
            </div>
          ) : (
            <div className="version-list">
              {availableVersions.map(v => (
                <div key={v.tag} className="version-item">
                  <span className="version-name">{v.tag}</span>
                  {isVersionInstalled(v.tag) ? (
                    <span className="badge badge-success">Installed</span>
                  ) : (
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleDownload(v.tag)}
                      disabled={isLoading}
                    >
                      Download
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
