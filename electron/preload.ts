import { contextBridge, ipcRenderer } from 'electron'
import type { DxvkFork, DxvkConfig, Game, DxvkEngine, PEAnalysisResult } from '../src/shared/types'

// Type for download progress events
export interface DownloadProgress {
  fork: DxvkFork
  version: string
  percent: number
}

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // ============================================
  // File Dialogs
  // ============================================
  openFileDialog: () => ipcRenderer.invoke('dialog:openFile') as Promise<string | null>,
  openFolderDialog: () => ipcRenderer.invoke('dialog:openFolder') as Promise<string | null>,

  // ============================================
  // File System
  // ============================================
  pathExists: (path: string) => ipcRenderer.invoke('fs:exists', path) as Promise<boolean>,
  openPath: (path: string) => ipcRenderer.invoke('shell:openPath', path) as Promise<string>,

  // ============================================
  // Game Discovery
  // ============================================
  scanSteamLibrary: () => ipcRenderer.invoke('games:scanSteam') as Promise<Partial<Game>[]>,
  checkSteamInstalled: () => ipcRenderer.invoke('games:checkSteam') as Promise<boolean>,

  // ============================================
  // PE Analysis
  // ============================================
  analyzeExecutable: (path: string) =>
    ipcRenderer.invoke('pe:analyze', path) as Promise<PEAnalysisResult>,
  findExecutables: (gamePath: string) =>
    ipcRenderer.invoke('pe:findExecutables', gamePath) as Promise<string[]>,

  // ============================================
  // DXVK Engines
  // ============================================
  getAvailableEngines: (fork: DxvkFork) =>
    ipcRenderer.invoke('engines:getAvailable', fork) as Promise<DxvkEngine[]>,
  getCachedVersions: (fork: DxvkFork) =>
    ipcRenderer.invoke('engines:getCached', fork) as Promise<string[]>,
  isEngineCached: (fork: DxvkFork, version: string) =>
    ipcRenderer.invoke('engines:isCached', fork, version) as Promise<boolean>,
  downloadEngine: (fork: DxvkFork, version: string, url: string) =>
    ipcRenderer.invoke('engines:download', fork, version, url) as Promise<{ success: boolean; path?: string; error?: string }>,

  // Listen for download progress
  onDownloadProgress: (callback: (progress: DownloadProgress) => void) => {
    ipcRenderer.on('engines:downloadProgress', (_, progress) => callback(progress))
  },
  removeDownloadProgressListener: () => {
    ipcRenderer.removeAllListeners('engines:downloadProgress')
  },

  // ============================================
  // DXVK Deployment
  // ============================================
  installDxvk: (
    gamePath: string,
    gameId: string,
    fork: DxvkFork,
    version: string,
    architecture: '32' | '64'
  ) => ipcRenderer.invoke('dxvk:install', gamePath, gameId, fork, version, architecture) as
    Promise<{ success: boolean; manifest?: unknown; error?: string }>,

  uninstallDxvk: (gamePath: string) =>
    ipcRenderer.invoke('dxvk:uninstall', gamePath) as Promise<{ success: boolean; error?: string }>,

  checkDxvkStatus: (gamePath: string) =>
    ipcRenderer.invoke('dxvk:checkStatus', gamePath) as Promise<{
      installed: boolean
      version?: string
      fork?: DxvkFork
      integrity?: string
    }>,

  // ============================================
  // Configuration
  // ============================================
  saveConfig: (gamePath: string, config: DxvkConfig) =>
    ipcRenderer.invoke('config:save', gamePath, config) as Promise<{ success: boolean; error?: string }>,

  // ============================================
  // Anti-Cheat Detection
  // ============================================
  detectAntiCheat: (gamePath: string) =>
    ipcRenderer.invoke('anticheat:detect', gamePath) as Promise<Array<{
      name: string
      files: string[]
      riskLevel: 'high' | 'medium' | 'low'
      description: string
      foundFiles: string[]
    }>>,
  getAntiCheatSummary: (gamePath: string) =>
    ipcRenderer.invoke('anticheat:summary', gamePath) as Promise<{
      hasAntiCheat: boolean
      highRisk: boolean
      detected: string[]
    }>,
})

// TypeScript declarations for the exposed API
declare global {
  interface Window {
    electronAPI: {
      // Dialogs
      openFileDialog: () => Promise<string | null>
      openFolderDialog: () => Promise<string | null>

      // File System
      pathExists: (path: string) => Promise<boolean>
      openPath: (path: string) => Promise<string>

      // Game Discovery
      scanSteamLibrary: () => Promise<Partial<Game>[]>
      checkSteamInstalled: () => Promise<boolean>

      // PE Analysis
      analyzeExecutable: (path: string) => Promise<PEAnalysisResult>
      findExecutables: (gamePath: string) => Promise<string[]>

      // Engines
      getAvailableEngines: (fork: DxvkFork) => Promise<DxvkEngine[]>
      getCachedVersions: (fork: DxvkFork) => Promise<string[]>
      isEngineCached: (fork: DxvkFork, version: string) => Promise<boolean>
      downloadEngine: (fork: DxvkFork, version: string, url: string) => Promise<{ success: boolean; path?: string; error?: string }>
      onDownloadProgress: (callback: (progress: DownloadProgress) => void) => void
      removeDownloadProgressListener: () => void

      // Deployment
      installDxvk: (gamePath: string, gameId: string, fork: DxvkFork, version: string, architecture: '32' | '64') =>
        Promise<{ success: boolean; manifest?: unknown; error?: string }>
      uninstallDxvk: (gamePath: string) => Promise<{ success: boolean; error?: string }>
      checkDxvkStatus: (gamePath: string) => Promise<{
        installed: boolean
        version?: string
        fork?: DxvkFork
        integrity?: string
      }>

      // Config
      saveConfig: (gamePath: string, config: DxvkConfig) => Promise<{ success: boolean; error?: string }>

      // Anti-Cheat
      detectAntiCheat: (gamePath: string) => Promise<Array<{
        name: string
        files: string[]
        riskLevel: 'high' | 'medium' | 'low'
        description: string
        foundFiles: string[]
      }>>
      getAntiCheatSummary: (gamePath: string) => Promise<{
        hasAntiCheat: boolean
        highRisk: boolean
        detected: string[]
      }>
    }
  }
}

export { }
