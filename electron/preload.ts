import { contextBridge, ipcRenderer } from 'electron'
import type { DxvkFork, DxvkConfig, Vkd3dConfig, Game, DxvkEngine, PEAnalysisResult, DxvkProfile } from '../src/shared/types'

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
  // Window Controls
  // ============================================
  windowMinimize: () => ipcRenderer.invoke('window:minimize'),
  windowMaximize: () => ipcRenderer.invoke('window:maximize'),
  windowClose: () => ipcRenderer.invoke('window:close'),
  windowIsMaximized: () => ipcRenderer.invoke('window:isMaximized') as Promise<boolean>,

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
  scanAllGames: () => ipcRenderer.invoke('games:scanAll') as Promise<Partial<Game>[]>,
  checkSteamInstalled: () => ipcRenderer.invoke('games:checkSteam') as Promise<boolean>,
  searchMetadata: (term: string) => ipcRenderer.invoke('games:searchMetadata', term) as Promise<number | null>,
  searchMetadataMultiple: (term: string) => ipcRenderer.invoke('games:searchMetadataMultiple', term) as Promise<Array<{
    id: number
    name: string
    imageUrl: string
  }>>,

  // Deprecated - alias to scanAllGames
  scanSteamLibrary: () => ipcRenderer.invoke('games:scanAll') as Promise<Partial<Game>[]>,

  // ============================================
  // PE Analysis
  // ============================================
  analyzeExecutable: (path: string) =>
    ipcRenderer.invoke('pe:analyze', path) as Promise<PEAnalysisResult>,
  findExecutables: (gamePath: string) =>
    ipcRenderer.invoke('pe:findExecutables', gamePath) as Promise<string[]>,
  getVersionInfo: (path: string) =>
    ipcRenderer.invoke('pe:getVersionInfo', path) as Promise<{ ProductName?: string; FileDescription?: string }>,

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

  // Get all cached engines with size info
  getAllCachedEngines: () =>
    ipcRenderer.invoke('engines:getAllCached') as Promise<Array<{
      fork: DxvkFork
      version: string
      path: string
      sizeBytes: number
    }>>,

  // Delete a cached engine
  deleteEngine: (fork: DxvkFork, version: string) =>
    ipcRenderer.invoke('engines:delete', fork, version) as Promise<{ success: boolean; error?: string }>,

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

  uninstallDxvk: (gamePath: string, component?: 'dxvk' | 'vkd3d') =>
    ipcRenderer.invoke('dxvk:uninstall', gamePath, component) as Promise<{ success: boolean; error?: string }>,

  checkDxvkStatus: (gamePath: string) =>
    ipcRenderer.invoke('dxvk:checkStatus', gamePath) as Promise<{
      installed: boolean
      version?: string
      fork?: DxvkFork
      integrity?: string
    }>,

  detectManualInstallation: (gamePath: string) =>
    ipcRenderer.invoke('dxvk:detectManual', gamePath) as Promise<{
      detected: boolean
      dxvk: { found: boolean; dlls: string[] }
      vkd3d: { found: boolean; dlls: string[] }
    }>,

  // ============================================
  // Configuration
  // ============================================
  readConfig: (gamePath: string) =>
    ipcRenderer.invoke('config:read', gamePath) as Promise<DxvkConfig | null>,
  saveConfig: (gamePath: string, config: DxvkConfig) =>
    ipcRenderer.invoke('config:save', gamePath, config) as Promise<{ success: boolean; error?: string }>,

  // ============================================
  // VKD3D Configuration
  // ============================================
  readVkd3dConfig: (gamePath: string) =>
    ipcRenderer.invoke('vkd3d:readConfig', gamePath) as Promise<Vkd3dConfig | null>,
  saveVkd3dConfig: (gamePath: string, executable: string, config: Vkd3dConfig) =>
    ipcRenderer.invoke('vkd3d:saveConfig', gamePath, executable, config) as Promise<{ success: boolean; error?: string }>,
  hasVkd3dLauncher: (gamePath: string) =>
    ipcRenderer.invoke('vkd3d:hasLauncher', gamePath) as Promise<boolean>,

  // ============================================
  // Profiles
  // ============================================
  getAllProfiles: () => ipcRenderer.invoke('profiles:getAll') as Promise<DxvkProfile[]>,
  saveProfile: (profile: DxvkProfile) => ipcRenderer.invoke('profiles:save', profile) as Promise<{ success: boolean; profile?: DxvkProfile; error?: string }>,
  deleteProfile: (id: string) => ipcRenderer.invoke('profiles:delete', id) as Promise<{ success: boolean; error?: string }>,

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

  // ============================================
  // IGDB Integration
  // ============================================
  igdbGetCredentials: () => ipcRenderer.invoke('igdb:getCredentials') as Promise<any>, // Typed in global
  igdbSetCredentials: (creds: any) => ipcRenderer.invoke('igdb:setCredentials', creds) as Promise<{ success: boolean; error?: string }>,
  igdbClearCredentials: () => ipcRenderer.invoke('igdb:clearCredentials') as Promise<{ success: boolean; error?: string }>,
  igdbTestConnection: () => ipcRenderer.invoke('igdb:testConnection') as Promise<{ success: boolean; error?: string }>,
  igdbIsConfigured: () => ipcRenderer.invoke('igdb:isConfigured') as Promise<boolean>,
  igdbSearch: (query: string) => ipcRenderer.invoke('igdb:search', query) as Promise<Array<{ id: number; name: string; coverUrl?: string }>>,
  igdbGetDetails: (igdbId: number) => ipcRenderer.invoke('igdb:getDetails', igdbId) as Promise<any>, // Typed in global
  igdbMatchBySteamId: (steamAppId: string) => ipcRenderer.invoke('igdb:matchBySteamId', steamAppId) as Promise<any>
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
      scanAllGames: () => Promise<Partial<Game>[]>
      scanSteamLibrary: () => Promise<Partial<Game>[]> // Deprecated
      checkSteamInstalled: () => Promise<boolean>
      searchMetadata: (term: string) => Promise<number | null>
      searchMetadataMultiple: (term: string) => Promise<Array<{
        id: number
        name: string
        imageUrl: string
      }>>

      // PE Analysis
      analyzeExecutable: (path: string) => Promise<PEAnalysisResult>
      findExecutables: (gamePath: string) => Promise<string[]>
      getVersionInfo: (path: string) => Promise<{ ProductName?: string; FileDescription?: string }>

      // Engines
      getAvailableEngines: (fork: DxvkFork) => Promise<DxvkEngine[]>
      getCachedVersions: (fork: DxvkFork) => Promise<string[]>
      isEngineCached: (fork: DxvkFork, version: string) => Promise<boolean>
      downloadEngine: (fork: DxvkFork, version: string, url: string) => Promise<{ success: boolean; path?: string; error?: string }>
      onDownloadProgress: (callback: (progress: DownloadProgress) => void) => void
      removeDownloadProgressListener: () => void
      getAllCachedEngines: () => Promise<Array<{
        fork: DxvkFork
        version: string
        path: string
        sizeBytes: number
      }>>
      deleteEngine: (fork: DxvkFork, version: string) => Promise<{ success: boolean; error?: string }>

      // Deployment
      installDxvk: (gamePath: string, gameId: string, fork: DxvkFork, version: string, architecture: '32' | '64') =>
        Promise<{ success: boolean; manifest?: unknown; error?: string }>
      uninstallDxvk: (gamePath: string, component?: 'dxvk' | 'vkd3d') => Promise<{ success: boolean; error?: string }>
      checkDxvkStatus: (gamePath: string) => Promise<{
        installed: boolean
        version?: string
        fork?: DxvkFork
        integrity?: string
      }>
      detectManualInstallation: (gamePath: string) => Promise<{
        detected: boolean
        dxvk: { found: boolean; dlls: string[] }
        vkd3d: { found: boolean; dlls: string[] }
      }>

      // Config
      readConfig: (gamePath: string) => Promise<DxvkConfig | null>
      saveConfig: (gamePath: string, config: DxvkConfig) => Promise<{ success: boolean; error?: string }>

      // VKD3D Config
      readVkd3dConfig: (gamePath: string) => Promise<Vkd3dConfig | null>
      saveVkd3dConfig: (gamePath: string, executable: string, config: Vkd3dConfig) => Promise<{ success: boolean; error?: string }>
      hasVkd3dLauncher: (gamePath: string) => Promise<boolean>

      // Profiles
      getAllProfiles: () => Promise<DxvkProfile[]>
      saveProfile: (profile: DxvkProfile) => Promise<{ success: boolean; profile?: DxvkProfile; error?: string }>
      deleteProfile: (id: string) => Promise<{ success: boolean; error?: string }>

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

      // IGDB Integration
      igdbGetCredentials: () => Promise<{ clientId: string; clientSecret: string } | null>
      igdbSetCredentials: (creds: { clientId: string; clientSecret: string }) => Promise<{ success: boolean; error?: string }>
      igdbClearCredentials: () => Promise<{ success: boolean; error?: string }>
      igdbTestConnection: () => Promise<{ success: boolean; error?: string }>
      igdbIsConfigured: () => Promise<boolean>
      igdbSearch: (query: string) => Promise<Array<{ id: number; name: string; coverUrl?: string }>>
      igdbGetDetails: (igdbId: number) => Promise<{
        id: number
        name: string
        summary?: string
        coverUrl?: string
        genres?: string[]
        developers?: string[]
        publishers?: string[]
        releaseDate?: string
        rating?: number
      } | null>
      igdbMatchBySteamId: (steamAppId: string) => Promise<{
        id: number
        name: string
        summary?: string
        coverUrl?: string
        genres?: string[]
        developers?: string[]
        publishers?: string[]
        releaseDate?: string
        rating?: number
      } | null>
    }
  }
}

export { }
