import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import { join, dirname, basename } from 'path'
import { existsSync } from 'fs'

// Services
import { getAllSteamGames, findSteamPath, searchSteamStore, searchSteamStoreMultiple } from './services/steam-scanner'
import { findGogGames } from './services/gog-scanner'
import { findEpicGames } from './services/epic-scanner'
import { analyzeExecutable, findGameExecutables, getPeVersionInfo } from './services/pe-analyzer'
import {
  getAvailableEngines,
  downloadEngine,
  isVersionCached,
  getCachedVersions,
  getAllCachedEngines,
  deleteEngine
} from './services/engine-manager'
import {
  installEngine,
  uninstallEngine,
  updateEngine,
  isDxvkInstalled,
  getInstalledVersion,
  checkIntegrity,
  writeConfig,
  readConfig,
  readManifest,
  detectManualInstallation,
  readVkd3dConfig,
  writeVkd3dConfig,
  hasVkd3dLauncher
} from './services/deployer'
import { detectAntiCheat, getAntiCheatSummary } from './services/anti-cheat'
import { getAllProfiles, saveProfile, deleteProfile } from './services/profile-manager'
import {
  getIgdbCredentials,
  setIgdbCredentials,
  clearIgdbCredentials
} from './services/settings-store'
import {
  testConnection as igdbTestConnection,
  isIgdbConfigured,
  searchGames as igdbSearchGames,
  getGameDetails as igdbGetGameDetails,
  getGameBySteamId
} from './services/igdb-service'
import type { Game, DxvkFork, DxvkConfig, DxvkProfile, DxvkStatus, Vkd3dConfig, IgdbCredentials } from '../src/shared/types'

// ============================================
// Build Paths
// ============================================

process.env.DIST = join(__dirname, '../dist')
process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : join(process.env.DIST, '../public')

let mainWindow: BrowserWindow | null = null
const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']

// ============================================
// Window Management
// ============================================

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    icon: join(process.env.VITE_PUBLIC!, 'icon.png'),
    backgroundColor: '#0a0a0b',
    show: false,
    frame: false, // Frameless for custom chrome
    titleBarStyle: 'hidden', // Hide native title bar
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true
    }
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  if (VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(join(process.env.DIST!, 'index.html'))
  }

  // Open external links in default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:') || url.startsWith('http:')) {
      shell.openExternal(url)
    }
    return { action: 'deny' }
  })
}

// ============================================
// App Lifecycle
// ============================================

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    mainWindow = null
  }
})

// ============================================
// IPC Handlers - Window Controls
// ============================================

ipcMain.handle('window:minimize', () => {
  mainWindow?.minimize()
})

ipcMain.handle('window:maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize()
  } else {
    mainWindow?.maximize()
  }
})

ipcMain.handle('window:close', () => {
  mainWindow?.close()
})

ipcMain.handle('window:isMaximized', () => {
  return mainWindow?.isMaximized() ?? false
})

// ============================================
// Security Helpers
// ============================================

import { resolve } from 'path'

/**
 * Validate that a path is safe to access
 * Ensures we don't access system files or escape intended directories
 */
function isValidGamePath(path: string): boolean {
  if (!path) return false

  try {
    const normalized = resolve(path)

    // Only block actual Windows system directories, NOT Program Files
    // (Steam and most games install to Program Files!)
    const blockList = [
      'C:\\Windows',
      'C:\\Windows\\System32',
      'C:\\Windows\\SysWOW64',
      '/bin',
      '/usr',
      '/etc',
      '/System'
    ]

    // Check if path matches or is inside a blocked directory
    if (blockList.some(blocked =>
      normalized.toLowerCase().startsWith(blocked.toLowerCase()) &&
      (normalized.length === blocked.length || normalized[blocked.length] === '\\' || normalized[blocked.length] === '/')
    )) {
      return false
    }

    // Must exist
    return existsSync(normalized)
  } catch {
    return false
  }
}

// ============================================
// IPC Handlers - File Dialogs
// ============================================

ipcMain.handle('dialog:openFile', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    title: 'Select Game Executable',
    filters: [{ name: 'Executables', extensions: ['exe'] }],
    properties: ['openFile']
  })
  return result.canceled ? null : result.filePaths[0]
})

ipcMain.handle('dialog:openFolder', async () => {
  const result = await dialog.showOpenDialog(mainWindow!, {
    title: 'Select Game Folder',
    properties: ['openDirectory']
  })
  return result.canceled ? null : result.filePaths[0]
})

// ============================================
// IPC Handlers - File System
// ============================================

ipcMain.handle('fs:exists', async (_, path: string) => {
  if (!isValidGamePath(path)) return false
  return existsSync(path)
})

ipcMain.handle('shell:openPath', async (_, path: string) => {
  if (!isValidGamePath(path)) return 'Invalid path'
  return shell.openPath(path)
})

// ============================================
// IPC Handlers - Game Discovery
// ============================================

ipcMain.handle('games:scanAll', async () => {
  try {
    const steamApps = getAllSteamGames()
    const gogGames = await findGogGames()
    const epicGames = findEpicGames()

    // Process Steam Apps
    const processedSteam = await Promise.all(
      steamApps.map(async (app) => {
        const executables = findGameExecutables(app.fullPath)
        const mainExe = executables[0] || ''
        const analysis = analyze(app.fullPath, mainExe)

        return {
          id: `steam-${app.appId}`,
          name: app.name,
          path: app.fullPath,
          executable: mainExe,
          architecture: analysis.architecture,
          platform: 'steam' as const,
          steamAppId: app.appId,
          dxvkStatus: analysis.dxvkStatus,
          dxvkVersion: analysis.dxvkVersion,
          dxvkFork: analysis.dxvkFork,
          vkd3dStatus: analysis.vkd3dStatus,
          vkd3dVersion: analysis.vkd3dVersion,
          vkd3dFork: analysis.vkd3dFork,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        } as Game
      })
    )

    // Process GOG Games
    const processedGog = await Promise.all(
      gogGames.map(async (game) => {
        const mainExe = game.executable ? basename(game.executable) : ''
        const analysis = analyze(game.path, mainExe)

        return {
          ...game,
          executable: mainExe,
          architecture: analysis.architecture,
          dxvkStatus: analysis.dxvkStatus,
          dxvkVersion: analysis.dxvkVersion,
          dxvkFork: analysis.dxvkFork,
          vkd3dStatus: analysis.vkd3dStatus,
          vkd3dVersion: analysis.vkd3dVersion,
          vkd3dFork: analysis.vkd3dFork
        } as Game
      })
    )

    // Process Epic Games
    const processedEpic = await Promise.all(
      epicGames.map(async (game) => {
        const mainExe = game.executable ? basename(game.executable) : ''
        const analysis = analyze(game.path, mainExe)

        return {
          ...game,
          executable: mainExe,
          architecture: analysis.architecture,
          dxvkStatus: analysis.dxvkStatus,
          dxvkVersion: analysis.dxvkVersion,
          dxvkFork: analysis.dxvkFork,
          vkd3dStatus: analysis.vkd3dStatus,
          vkd3dVersion: analysis.vkd3dVersion,
          vkd3dFork: analysis.vkd3dFork
        } as Game
      })
    )

    return [...processedSteam, ...processedGog, ...processedEpic]
  } catch (error) {
    console.error('Failed to scan games:', error)
    return []
  }
})

function analyze(gamePath: string, mainExe: string) {
  const exePath = mainExe ? join(gamePath, mainExe) : join(gamePath, 'unknown.exe') // fallback
  let architecture: '32' | '64' | 'unknown' = 'unknown'

  if (mainExe && existsSync(exePath)) {
    architecture = analyzeExecutable(exePath).architecture
  }

  const manifest = readManifest(gamePath)

  // DXVK Status
  let dxvkStatus: DxvkStatus = 'inactive'
  let dxvkVersion = undefined
  let dxvkFork: DxvkFork | undefined = undefined

  // VKD3D Status
  let vkd3dStatus: DxvkStatus = 'inactive'
  let vkd3dVersion = undefined
  let vkd3dFork: DxvkFork | undefined = undefined

  if (manifest) {
    // Check DXVK
    if (manifest.components?.dxvk) {
      dxvkVersion = manifest.components.dxvk.version
      dxvkFork = manifest.components.dxvk.fork

      const integrity = checkIntegrity(gamePath, 'dxvk')
      if (integrity === 'ok') dxvkStatus = 'active'
      else if (integrity === 'corrupt') dxvkStatus = 'corrupt'
      else if (integrity === 'missing') dxvkStatus = 'inactive'
    } else if (manifest.engineVersion && manifest.engineFork !== 'vkd3d') {
      // Legacy/Fallback for pure DXVK manifest
      dxvkVersion = manifest.engineVersion
      dxvkFork = manifest.engineFork
      const integrity = checkIntegrity(gamePath) // check all
      dxvkStatus = integrity === 'ok' ? 'active' : (integrity === 'corrupt' ? 'corrupt' : 'inactive')
    }

    // Check VKD3D
    if (manifest.components?.vkd3d) {
      vkd3dVersion = manifest.components.vkd3d.version
      vkd3dFork = manifest.components.vkd3d.fork

      const integrity = checkIntegrity(gamePath, 'vkd3d')
      if (integrity === 'ok') vkd3dStatus = 'active'
      else if (integrity === 'corrupt') vkd3dStatus = 'corrupt'
      else if (integrity === 'missing') vkd3dStatus = 'inactive'
    } else if (manifest.engineFork === 'vkd3d') {
      // Fallback if top level is vkd3d
      vkd3dVersion = manifest.engineVersion
      vkd3dFork = manifest.engineFork
      const integrity = checkIntegrity(gamePath)
      vkd3dStatus = integrity === 'ok' ? 'active' : 'inactive'
    }
  } else {
    // No manifest - check for manually installed DLLs
    const manualStatus = detectManualInstallation(gamePath)

    if (manualStatus.dxvk.found) {
      dxvkStatus = 'manual'
    }

    if (manualStatus.vkd3d.found) {
      vkd3dStatus = 'manual'
    }
  }

  return {
    architecture,
    dxvkStatus,
    dxvkVersion,
    dxvkFork,
    vkd3dStatus,
    vkd3dVersion,
    vkd3dFork
  }
}

ipcMain.handle('games:searchMetadata', async (_, term: string) => {
  return searchSteamStore(term)
})

ipcMain.handle('games:searchMetadataMultiple', async (_, term: string) => {
  return searchSteamStoreMultiple(term)
})

ipcMain.handle('games:checkSteam', async () => {
  return findSteamPath() !== null
})

// ============================================
// IPC Handlers - PE Analysis
// ============================================

ipcMain.handle('pe:analyze', async (_, exePath: string) => {
  if (!isValidGamePath(exePath)) return { architecture: 'unknown', machineType: 0, isValid: false, error: 'Invalid path' }
  return analyzeExecutable(exePath)
})

ipcMain.handle('pe:findExecutables', async (_, gamePath: string) => {
  if (!isValidGamePath(gamePath)) return []
  return findGameExecutables(gamePath)
})

ipcMain.handle('pe:getVersionInfo', async (_, exePath: string) => {
  if (!isValidGamePath(exePath)) return {}
  return getPeVersionInfo(exePath)
})

// ============================================
// IPC Handlers - DXVK Engines
// ============================================

ipcMain.handle('engines:getAvailable', async (_, fork: DxvkFork) => {
  return getAvailableEngines(fork)
})

ipcMain.handle('engines:getCached', async (_, fork: DxvkFork) => {
  return getCachedVersions(fork)
})

ipcMain.handle('engines:isCached', async (_, fork: DxvkFork, version: string) => {
  return isVersionCached(fork, version)
})

ipcMain.handle('engines:download', async (_, fork: DxvkFork, version: string, url: string) => {
  try {
    const path = await downloadEngine(fork, version, url, (percent) => {
      mainWindow?.webContents.send('engines:downloadProgress', { fork, version, percent })
    })
    return { success: true, path }
  } catch (error) {
    return { success: false, error: (error as Error).message }
  }
})

ipcMain.handle('engines:getAllCached', async () => {
  return getAllCachedEngines()
})

ipcMain.handle('engines:delete', async (_, fork: DxvkFork, version: string) => {
  try {
    deleteEngine(fork, version)
    return { success: true }
  } catch (error) {
    return { success: false, error: (error as Error).message }
  }
})

// ============================================
// IPC Handlers - DXVK Deployment
// ============================================

ipcMain.handle('dxvk:install', async (
  _,
  gamePath: string,
  gameId: string,
  fork: DxvkFork,
  version: string,
  architecture: '32' | '64'
) => {
  if (!isValidGamePath(gamePath)) return { success: false, error: 'Invalid game path' }
  try {
    const manifest = installEngine(gamePath, gameId, fork, version, architecture)
    return { success: true, manifest }
  } catch (error) {
    return { success: false, error: (error as Error).message }
  }
})

ipcMain.handle('dxvk:update', async (
  _,
  gamePath: string,
  gameId: string,
  newFork: DxvkFork,
  newVersion: string,
  architecture: '32' | '64'
) => {
  if (!isValidGamePath(gamePath)) return { success: false, error: 'Invalid game path' }
  try {
    const manifest = updateEngine(gamePath, gameId, newFork, newVersion, architecture)
    return { success: true, manifest }
  } catch (error) {
    return { success: false, error: (error as Error).message }
  }
})

ipcMain.handle('dxvk:uninstall', async (_, gamePath: string, component?: 'dxvk' | 'vkd3d') => {
  if (!isValidGamePath(gamePath)) return { success: false, error: 'Invalid game path' }
  try {
    const success = await uninstallEngine(gamePath, component)
    return { success }
  } catch (error) {
    return { success: false, error: (error as Error).message }
  }
})

ipcMain.handle('dxvk:checkStatus', async (_, gamePath: string) => {
  if (!isValidGamePath(gamePath)) return { installed: false }

  const installed = isDxvkInstalled(gamePath)
  if (!installed) {
    return { installed: false }
  }

  const version = getInstalledVersion(gamePath)
  const integrity = checkIntegrity(gamePath)

  return {
    installed: true,
    version: version?.version,
    fork: version?.fork,
    integrity
  }
})

// Detect existing DXVK/VKD3D DLLs that weren't installed by DXVK Studio
ipcMain.handle('dxvk:detectManual', async (_, gamePath: string) => {
  if (!isValidGamePath(gamePath)) {
    return { detected: false, dxvk: { found: false, dlls: [] }, vkd3d: { found: false, dlls: [] } }
  }
  return detectManualInstallation(gamePath)
})

// ============================================
// IPC Handlers - Configuration
// ============================================

ipcMain.handle('config:save', async (_, gamePath: string, config: DxvkConfig) => {
  if (!isValidGamePath(gamePath)) return { success: false, error: 'Invalid game path' }
  try {
    writeConfig(gamePath, config)
    return { success: true }
  } catch (error) {
    return { success: false, error: (error as Error).message }
  }
})


ipcMain.handle('config:read', async (_, gamePath: string) => {
  if (!isValidGamePath(gamePath)) return null
  return readConfig(gamePath)
})

// ============================================
// IPC Handlers - VKD3D Configuration
// ============================================

ipcMain.handle('vkd3d:readConfig', async (_, gamePath: string) => {
  if (!isValidGamePath(gamePath)) return null
  return readVkd3dConfig(gamePath)
})

ipcMain.handle('vkd3d:saveConfig', async (_, gamePath: string, executable: string, config: Vkd3dConfig) => {
  if (!isValidGamePath(gamePath)) return { success: false, error: 'Invalid game path' }
  try {
    writeVkd3dConfig(gamePath, config, executable)
    return { success: true }
  } catch (error) {
    return { success: false, error: (error as Error).message }
  }
})

ipcMain.handle('vkd3d:hasLauncher', async (_, gamePath: string) => {
  if (!isValidGamePath(gamePath)) return false
  return hasVkd3dLauncher(gamePath)
})

// ============================================
// IPC Handlers - Profiles
// ============================================

ipcMain.handle('profiles:getAll', async () => {
  return getAllProfiles()
})

ipcMain.handle('profiles:save', async (_, profile: DxvkProfile) => {
  try {
    const saved = saveProfile(profile)
    return { success: true, profile: saved }
  } catch (error) {
    return { success: false, error: (error as Error).message }
  }
})

ipcMain.handle('profiles:delete', async (_, id: string) => {
  try {
    const success = deleteProfile(id)
    return { success }
  } catch (error) {
    return { success: false, error: (error as Error).message }
  }
})

// ============================================
// IPC Handlers - Anti-Cheat Detection
// ============================================

ipcMain.handle('anticheat:detect', async (_, gamePath: string) => {
  if (!isValidGamePath(gamePath)) return []
  return detectAntiCheat(gamePath)
})

ipcMain.handle('anticheat:summary', async (_, gamePath: string) => {
  if (!isValidGamePath(gamePath)) return { hasAntiCheat: false, highRisk: false, detected: [] }
  return getAntiCheatSummary(gamePath)
})

// ============================================
// IPC Handlers - IGDB Integration
// ============================================

ipcMain.handle('igdb:getCredentials', async () => {
  return getIgdbCredentials()
})

ipcMain.handle('igdb:setCredentials', async (_, credentials: IgdbCredentials) => {
  try {
    setIgdbCredentials(credentials)
    return { success: true }
  } catch (error) {
    return { success: false, error: (error as Error).message }
  }
})

ipcMain.handle('igdb:clearCredentials', async () => {
  try {
    clearIgdbCredentials()
    return { success: true }
  } catch (error) {
    return { success: false, error: (error as Error).message }
  }
})

ipcMain.handle('igdb:testConnection', async () => {
  return igdbTestConnection()
})

ipcMain.handle('igdb:isConfigured', async () => {
  return isIgdbConfigured()
})

ipcMain.handle('igdb:search', async (_, query: string) => {
  return igdbSearchGames(query)
})

ipcMain.handle('igdb:getDetails', async (_, igdbId: number) => {
  return igdbGetGameDetails(igdbId)
})

ipcMain.handle('igdb:matchBySteamId', async (_, steamAppId: string) => {
  return getGameBySteamId(steamAppId)
})

