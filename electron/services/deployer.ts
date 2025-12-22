/**
 * DXVK Deployer
 * Handles installing and uninstalling DXVK DLLs to game directories
 */

import { existsSync, copyFileSync, rmSync, readFileSync, writeFileSync, renameSync } from 'fs'
import { join, basename } from 'path'
import { createHash } from 'crypto'
import type {
  DeploymentManifest,
  DeployedDll,
  DxvkFork,
  Architecture,
  DxvkConfig
} from '../shared/types'
import { getEngineDlls } from './engine-manager'

// DLLs that DXVK provides for different DirectX versions
const DXVK_DLLS = {
  d3d9: ['d3d9.dll'],
  d3d10: ['d3d10.dll', 'd3d10_1.dll', 'd3d10core.dll'],
  d3d11: ['d3d11.dll', 'dxgi.dll'],
  dxgi: ['dxgi.dll']
}

/**
 * Calculate SHA-256 hash of a file
 */
function hashFile(filePath: string): string {
  const content = readFileSync(filePath)
  return createHash('sha256').update(content).digest('hex')
}

/**
 * Get the manifest path for a game
 */
function getManifestPath(gamePath: string): string {
  return join(gamePath, 'dxvk_studio_manifest.json')
}

/**
 * Read deployment manifest from game directory
 */
export function readManifest(gamePath: string): DeploymentManifest | null {
  const manifestPath = getManifestPath(gamePath)

  if (!existsSync(manifestPath)) {
    return null
  }

  try {
    const content = readFileSync(manifestPath, 'utf-8')
    return JSON.parse(content) as DeploymentManifest
  } catch {
    return null
  }
}

/**
 * Write deployment manifest to game directory
 */
function writeManifest(gamePath: string, manifest: DeploymentManifest): void {
  const manifestPath = getManifestPath(gamePath)
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))
}

/**
 * Check if DXVK is installed in a game directory
 */
export function isDxvkInstalled(gamePath: string): boolean {
  return readManifest(gamePath) !== null
}

/**
 * Get the installed DXVK version for a game
 */
export function getInstalledVersion(gamePath: string): { version: string; fork: DxvkFork } | null {
  const manifest = readManifest(gamePath)

  if (!manifest) {
    return null
  }

  return {
    version: manifest.engineVersion,
    fork: manifest.engineFork
  }
}

/**
 * Check integrity of installed DLLs
 */
export function checkIntegrity(gamePath: string): 'ok' | 'corrupt' | 'missing' | 'not_installed' {
  const manifest = readManifest(gamePath)

  if (!manifest) {
    return 'not_installed'
  }

  for (const dll of manifest.dlls) {
    const dllPath = join(gamePath, dll.name)

    if (!existsSync(dllPath)) {
      return 'missing'
    }

    const currentHash = hashFile(dllPath)
    if (currentHash !== dll.hash) {
      return 'corrupt'
    }
  }

  return 'ok'
}

/**
 * Install DXVK to a game directory
 */
export function installDxvk(
  gamePath: string,
  gameId: string,
  fork: DxvkFork,
  version: string,
  architecture: Architecture
): DeploymentManifest {
  if (architecture === 'unknown') {
    throw new Error('Cannot install DXVK: unknown architecture')
  }

  // Get DLLs from engine
  const sourceDlls = getEngineDlls(fork, version, architecture)

  if (sourceDlls.length === 0) {
    throw new Error(`No DLLs found for ${fork} ${version} (${architecture}-bit)`)
  }

  const deployedDlls: DeployedDll[] = []

  for (const sourceDll of sourceDlls) {
    const dllName = basename(sourceDll)
    const targetPath = join(gamePath, dllName)
    const backupPath = join(gamePath, `${dllName}.bak_dxvk_studio`)

    // Backup existing DLL if it exists and isn't already a DXVK DLL
    if (existsSync(targetPath)) {
      const manifest = readManifest(gamePath)
      const isOurDll = manifest?.dlls.some(d => d.name === dllName)

      if (!isOurDll) {
        renameSync(targetPath, backupPath)
      }
    }

    // Copy new DLL
    copyFileSync(sourceDll, targetPath)

    deployedDlls.push({
      name: dllName,
      hash: hashFile(targetPath),
      backupPath: existsSync(backupPath) ? backupPath : undefined
    })
  }

  // Create manifest
  const manifest: DeploymentManifest = {
    gameId,
    engineVersion: version,
    engineFork: fork,
    architecture,
    installedAt: new Date().toISOString(),
    dlls: deployedDlls
  }

  writeManifest(gamePath, manifest)

  return manifest
}

/**
 * Uninstall DXVK from a game directory
 */
export function uninstallDxvk(gamePath: string): boolean {
  const manifest = readManifest(gamePath)

  if (!manifest) {
    return false
  }

  // Remove DLLs and restore backups
  for (const dll of manifest.dlls) {
    const dllPath = join(gamePath, dll.name)
    const backupPath = dll.backupPath

    // Remove DXVK DLL
    if (existsSync(dllPath)) {
      rmSync(dllPath)
    }

    // Restore backup if exists
    if (backupPath && existsSync(backupPath)) {
      renameSync(backupPath, dllPath)
    }
  }

  // Remove dxvk.conf if we created it
  const confPath = join(gamePath, 'dxvk.conf')
  if (existsSync(confPath) && manifest.configPath === confPath) {
    rmSync(confPath)
  }

  // Remove manifest
  rmSync(getManifestPath(gamePath))

  return true
}

/**
 * Update DXVK to a new version
 */
export function updateDxvk(
  gamePath: string,
  gameId: string,
  newFork: DxvkFork,
  newVersion: string,
  architecture: Architecture
): DeploymentManifest {
  // First uninstall (but keep backups)
  const oldManifest = readManifest(gamePath)

  if (oldManifest) {
    // Only remove DLLs, not backups
    for (const dll of oldManifest.dlls) {
      const dllPath = join(gamePath, dll.name)
      if (existsSync(dllPath)) {
        rmSync(dllPath)
      }
    }
    rmSync(getManifestPath(gamePath))
  }

  // Install new version
  return installDxvk(gamePath, gameId, newFork, newVersion, architecture)
}

/**
 * Parse dxvk.conf content into config object
 */
export function parseConfigFile(content: string): DxvkConfig {
  const config: DxvkConfig = {}
  const lines = content.split('\n')

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const match = trimmed.match(/^([^=]+)=(.*)$/)
    if (match) {
      const key = match[1].trim()
      const value = match[2].trim()

      switch (key) {
        case 'dxvk.enableAsync':
        case 'dxvk.gplAsyncCache':
          config.enableAsync = value === 'true'
          break
        case 'dxgi.maxFrameRate':
          config.maxFrameRate = Number(value)
          break
        case 'dxgi.syncInterval':
          config.syncInterval = Number(value)
          break
        case 'dxgi.maxFrameLatency':
          config.maxFrameLatency = Number(value)
          break
        case 'dxvk.numCompilerThreads':
          config.numCompilerThreads = Number(value)
          break
        case 'dxvk.hud':
        case 'DXVK_HUD':
          config.hud = value.split(',').map(s => s.trim()).filter(s => s.length > 0)
          break
        case 'dxgi.customVendorId':
          config.customVendorId = value
          break
        case 'dxgi.customDeviceId':
          config.customDeviceId = value
          break
        case 'DXVK_LOG_LEVEL':
          config.logLevel = value as any // 'none' | 'error' | 'warn' | 'info' | 'debug'
          break
      }
    }
  }
  return config
}

/**
 * Read dxvk.conf from game directory
 */
export function readConfig(gamePath: string): DxvkConfig | null {
  const confPath = join(gamePath, 'dxvk.conf')

  if (!existsSync(confPath)) {
    return null
  }

  try {
    const content = readFileSync(confPath, 'utf-8')
    return parseConfigFile(content)
  } catch {
    return null
  }
}

/**
 * Generate dxvk.conf content from config object
 */
export function generateConfigFile(config: DxvkConfig): string {
  const lines: string[] = [
    '# DXVK Configuration',
    '# Generated by DXVK Studio',
    ''
  ]

  if (config.enableAsync !== undefined) {
    lines.push(`dxvk.enableAsync = ${config.enableAsync}`)
  }

  if (config.numCompilerThreads !== undefined) {
    lines.push(`dxvk.numCompilerThreads = ${config.numCompilerThreads}`)
  }

  if (config.maxFrameLatency !== undefined) {
    lines.push(`dxgi.maxFrameLatency = ${config.maxFrameLatency}`)
  }

  if (config.syncInterval !== undefined) {
    lines.push(`dxgi.syncInterval = ${config.syncInterval}`)
  }

  if (config.maxFrameRate !== undefined) {
    lines.push(`dxgi.maxFrameRate = ${config.maxFrameRate}`)
  }

  if (config.maxDeviceMemory !== undefined) {
    lines.push(`dxgi.maxDeviceMemory = ${config.maxDeviceMemory}`)
  }

  if (config.customVendorId) {
    lines.push(`dxgi.customVendorId = ${config.customVendorId}`)
  }

  if (config.customDeviceId) {
    lines.push(`dxgi.customDeviceId = ${config.customDeviceId}`)
  }

  if (config.enableHDR !== undefined) {
    lines.push(`dxgi.enableHDR = ${config.enableHDR}`)
  }

  if (config.hud && config.hud.length > 0) {
    lines.push(`DXVK_HUD = ${config.hud.join(',')}`)
  }

  if (config.logLevel) {
    lines.push(`DXVK_LOG_LEVEL = ${config.logLevel}`)
  }

  return lines.join('\n')
}

/**
 * Write dxvk.conf to game directory
 */
export function writeConfig(gamePath: string, config: DxvkConfig): void {
  const confPath = join(gamePath, 'dxvk.conf')
  const content = generateConfigFile(config)
  writeFileSync(confPath, content)

  // Update manifest if it exists
  const manifest = readManifest(gamePath)
  if (manifest) {
    manifest.configPath = confPath
    writeManifest(gamePath, manifest)
  }
}
