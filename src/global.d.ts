/// <reference types="../electron/preload" />

// Re-export the global Window interface extension from preload.ts
// This makes TypeScript aware of window.electronAPI in the renderer process

import type {
  Game,
  DxvkFork,
  DxvkEngine,
  DxvkConfig,
  Vkd3dConfig,
  PEAnalysisResult,
  DxvkProfile
} from './shared/types'

// Download progress type
interface DownloadProgress {
  fork: DxvkFork
  version: string
  percent: number
}

// Vite globals
declare const __APP_VERSION__: string

declare global {
  interface Window {
    electronAPI: {
      // Window Controls
      windowMinimize: () => Promise<void>
      windowMaximize: () => Promise<void>
      windowClose: () => Promise<void>
      windowIsMaximized: () => Promise<boolean>

      // Dialogs
      openFileDialog: () => Promise<string | null>
      openFolderDialog: () => Promise<string | null>

      // File System
      pathExists: (path: string) => Promise<boolean>
      openPath: (path: string) => Promise<string>

      // Game Discovery
      scanAllGames: () => Promise<Partial<Game>[]>
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
      getVersionInfo: (path: string) => Promise<{ ProductName?: string; FileDescription?: string; OriginalFilename?: string }>

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
      igdbSetCredentials: (creds: { clientId: string; clientSecret: string }) => Promise<boolean>
      igdbTestConnection: (creds?: { clientId: string; clientSecret: string }) => Promise<{ success: boolean; message: string }>
      igdbClearCredentials: () => Promise<boolean>
      igdbIsConfigured: () => Promise<boolean>
      igdbSearch: (term: string) => Promise<any[]>
      igdbGetDetails: (igdbId: number) => Promise<any>
    }
  }
}

export { }
