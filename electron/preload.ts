import { contextBridge, ipcRenderer } from 'electron'

/**
 * Secure API exposed to the renderer process via contextBridge
 * All communication with the main process goes through this interface
 */
const electronAPI = {
  // Game Library
  scanSteamLibrary: () => ipcRenderer.invoke('scan-steam-library'),
  getGames: () => ipcRenderer.invoke('get-games'),

  // DXVK Management
  installDxvk: (gamePath: string, exePath: string, versionPath: string) =>
    ipcRenderer.invoke('install-dxvk', gamePath, exePath, versionPath),
  removeDxvk: (gamePath: string) =>
    ipcRenderer.invoke('remove-dxvk', gamePath),
  getDxvkStatus: (gamePath: string) =>
    ipcRenderer.invoke('get-dxvk-status', gamePath),

  // Configuration
  getConfig: (gamePath: string) =>
    ipcRenderer.invoke('get-config', gamePath),
  saveConfig: (gamePath: string, config: object) =>
    ipcRenderer.invoke('save-config', gamePath, config),

  // Version Management
  downloadDxvk: (version: string, variant: string) =>
    ipcRenderer.invoke('download-dxvk', version, variant),
  getAvailableVersions: (variant?: string) =>
    ipcRenderer.invoke('get-available-versions', variant),
  getInstalledVersions: () =>
    ipcRenderer.invoke('get-installed-versions'),
  getVersionsDir: () =>
    ipcRenderer.invoke('get-versions-dir'),

  // PE Analysis
  analyzeExecutable: (exePath: string) =>
    ipcRenderer.invoke('analyze-executable', exePath),

  // Dialogs
  selectDirectory: () =>
    ipcRenderer.invoke('select-directory'),
  selectExecutable: () =>
    ipcRenderer.invoke('select-executable'),

  // Events
  onProgress: (callback: (progress: number) => void) => {
    const handler = (_event: any, progress: number) => callback(progress)
    ipcRenderer.on('progress', handler)
    return () => {
      ipcRenderer.removeListener('progress', handler)
    }
  }
}

// Expose the API to the renderer
contextBridge.exposeInMainWorld('electronAPI', electronAPI)

// Type definition for TypeScript
export type ElectronAPI = typeof electronAPI
