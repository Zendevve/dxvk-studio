// ============================================
// Game Types
// ============================================

export interface Game {
  id: string
  name: string
  path: string
  executable: string
  architecture: Architecture
  platform: Platform
  steamAppId?: string
  dxvkStatus: DxvkStatus
  dxvkVersion?: string
  dxvkFork?: DxvkFork

  vkd3dStatus: DxvkStatus
  vkd3dVersion?: string
  vkd3dFork?: DxvkFork

  lastPlayed?: Date | string
  createdAt: Date | string
  updatedAt: Date | string
}

export type Architecture = '32' | '64' | 'unknown'
export type Platform = 'steam' | 'manual' | 'gog' | 'epic'
export type DxvkStatus = 'active' | 'inactive' | 'outdated' | 'corrupt'
export type DxvkFork = 'official' | 'gplasync' | 'nvapi' | 'vkd3d'

// ============================================
// DXVK Engine Types
// ============================================

export interface DxvkEngine {
  id: string
  version: string
  fork: DxvkFork
  releaseDate: string
  downloadUrl: string
  localPath?: string
  cached: boolean
  changelog?: string
}

export interface DxvkRelease {
  tag_name: string
  published_at: string
  assets: Array<{
    name: string
    browser_download_url: string
  }>
  body: string
}

// ============================================
// Configuration Types
// ============================================

export interface DxvkConfig {
  // Performance
  enableAsync?: boolean
  numCompilerThreads?: number

  // Frame pacing
  maxFrameLatency?: number
  syncInterval?: number
  maxFrameRate?: number

  // Memory
  maxDeviceMemory?: number
  maxSharedMemory?: number

  // Hardware spoofing
  customVendorId?: string
  customDeviceId?: string

  // HDR
  enableHDR?: boolean

  // HUD
  hud?: string[]
  hudScale?: number

  // Debug
  logLevel?: 'none' | 'error' | 'warn' | 'info' | 'debug'
  logPath?: string
}

export const DEFAULT_DXVK_CONFIG: DxvkConfig = {
  enableAsync: true,
  maxFrameLatency: 1,
  logLevel: 'warn'
}


export interface DxvkProfile extends DxvkConfig {
  id: string
  name: string
  description?: string
  isBuiltin?: boolean
}

// ============================================
// PE Analysis Types
// ============================================

export interface PEAnalysisResult {
  architecture: Architecture
  machineType: number
  isValid: boolean
  error?: string
}

// Machine type constants from PE header
export const PE_MACHINE_I386 = 0x014c
export const PE_MACHINE_AMD64 = 0x8664

// ============================================
// Steam Types
// ============================================

export interface SteamLibrary {
  path: string
  apps: SteamApp[]
}

export interface SteamApp {
  appId: string
  name: string
  installDir: string
  fullPath: string
}

// ============================================
// Anti-Cheat Types
// ============================================

export interface AntiCheatSignature {
  name: string
  files: string[]
  riskLevel: 'high' | 'medium' | 'low'
  description: string
}

export const ANTI_CHEAT_SIGNATURES: AntiCheatSignature[] = [
  {
    name: 'EasyAntiCheat',
    files: ['EasyAntiCheat.exe', 'EasyAntiCheat_x64.dll', 'EasyAntiCheat_x86.dll'],
    riskLevel: 'high',
    description: 'Kernel-level anti-cheat. DXVK may trigger a ban.'
  },
  {
    name: 'BattlEye',
    files: ['BEService.exe', 'BEClient_x64.dll', 'BEClient.dll'],
    riskLevel: 'high',
    description: 'Kernel-level anti-cheat. DXVK may trigger a ban.'
  },
  {
    name: 'Vanguard',
    files: ['vgc.exe', 'vgk.sys'],
    riskLevel: 'high',
    description: 'Riot Vanguard. Do not use DXVK with Valorant.'
  },
  {
    name: 'PunkBuster',
    files: ['pbsvc.exe', 'PnkBstrA.exe', 'PnkBstrB.exe'],
    riskLevel: 'medium',
    description: 'Legacy anti-cheat. May or may not detect DXVK.'
  }
]

// ============================================
// Deployment Types
// ============================================

export interface DeploymentManifest {
  gameId: string
  engineVersion: string
  engineFork: DxvkFork
  architecture: Architecture
  installedAt: string
  dlls: DeployedDll[]
  configPath?: string
  components?: {
    dxvk?: {
      version: string
      fork: DxvkFork
    }
    vkd3d?: {
      version: string
      fork: DxvkFork
    }
  }
}

export interface DeployedDll {
  name: string
  hash: string
  backupPath?: string
}

export const VKD3D_DLLS = {
  d3d12: ['d3d12.dll', 'd3d12core.dll']
}
