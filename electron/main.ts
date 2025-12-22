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
  installDxvk,
  uninstallDxvk,
  isDxvkInstalled,
  getInstalledVersion,
  checkIntegrity,
  writeConfig,
  readConfig
} from './services/deployer'
import { detectAntiCheat, getAntiCheatSummary } from './services/anti-cheat'
import type { Game, DxvkFork, DxvkConfig } from '../src/shared/types'

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
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false
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
  return existsSync(path)
})

ipcMain.handle('shell:openPath', async (_, path: string) => {
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

    // Helper to analyze a game
    const analyze = (gamePath: string, mainExe: string) => {
      const exePath = mainExe ? join(gamePath, mainExe) : ''

      // Detect architecture
      let architecture: '32' | '64' | 'unknown' = 'unknown'
      if (exePath && existsSync(exePath)) {
        const analysis = analyzeExecutable(exePath)
        architecture = analysis.architecture
      }

      // Check DXVK status
      let dxvkStatus: 'active' | 'inactive' | 'outdated' | 'corrupt' = 'inactive'
      let dxvkVersion: string | undefined
      let dxvkFork: DxvkFork | undefined

      if (isDxvkInstalled(gamePath)) {
        const installed = getInstalledVersion(gamePath)
        const integrity = checkIntegrity(gamePath)

        if (installed) {
          dxvkVersion = installed.version
          dxvkFork = installed.fork
        }
        dxvkStatus = integrity === 'ok' ? 'active' : integrity as any
      }

      return { architecture, dxvkStatus, dxvkVersion, dxvkFork }
    }

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
          ...game, // Already has id, name, path
          executable: mainExe,
          architecture: analysis.architecture,
          dxvkStatus: analysis.dxvkStatus,
          dxvkVersion: analysis.dxvkVersion,
          dxvkFork: analysis.dxvkFork
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
          dxvkFork: analysis.dxvkFork
        } as Game
      })
    )

    return [...processedSteam, ...processedGog, ...processedEpic]
  } catch (error) {
    console.error('Failed to scan games:', error)
    return []
  }
})

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
  return analyzeExecutable(exePath)
})

ipcMain.handle('pe:findExecutables', async (_, gamePath: string) => {
  return findGameExecutables(gamePath)
})

ipcMain.handle('pe:getVersionInfo', async (_, exePath: string) => {
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
  try {
    const manifest = installDxvk(gamePath, gameId, fork, version, architecture)
    return { success: true, manifest }
  } catch (error) {
    return { success: false, error: (error as Error).message }
  }
})

ipcMain.handle('dxvk:uninstall', async (_, gamePath: string) => {
  try {
    const result = uninstallDxvk(gamePath)
    return { success: result }
  } catch (error) {
    return { success: false, error: (error as Error).message }
  }
})

ipcMain.handle('dxvk:checkStatus', async (_, gamePath: string) => {
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

// ============================================
// IPC Handlers - Configuration
// ============================================

ipcMain.handle('config:save', async (_, gamePath: string, config: DxvkConfig) => {
  try {
    writeConfig(gamePath, config)
    return { success: true }
  } catch (error) {
    return { success: false, error: (error as Error).message }
  }
})

ipcMain.handle('config:read', async (_, gamePath: string) => {
  return readConfig(gamePath)
})

// ============================================
// IPC Handlers - Anti-Cheat Detection
// ============================================

ipcMain.handle('anticheat:detect', async (_, gamePath: string) => {
  return detectAntiCheat(gamePath)
})

ipcMain.handle('anticheat:summary', async (_, gamePath: string) => {
  return getAntiCheatSummary(gamePath)
})

