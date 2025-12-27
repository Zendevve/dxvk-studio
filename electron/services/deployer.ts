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
  DxvkConfig,
  VKD3D_DLLS
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
export function checkIntegrity(gamePath: string, component?: 'dxvk' | 'vkd3d'): 'ok' | 'corrupt' | 'missing' | 'not_installed' {
  const manifest = readManifest(gamePath)

  if (!manifest) {
    return 'not_installed'
  }

  // If component specified, check only its DLLs
  // If no component, check ALL manifest DLLs

  const vkd3dNames = ['d3d12.dll', 'd3d12core.dll']
  const isTargetDll = (name: string) => {
    if (!component) return true
    if (component === 'vkd3d') return vkd3dNames.includes(name.toLowerCase())
    return !vkd3dNames.includes(name.toLowerCase())
  }

  const targetDlls = manifest.dlls.filter(d => isTargetDll(d.name))

  if (component && targetDlls.length === 0) {
    // Manifest exists but no DLLs for this component -> likely not installed
    // Check if it's in components list?
    if (manifest.components && !manifest.components[component]) return 'not_installed'
    // If in components but no DLLs? weird.
    return 'not_installed'
  }

  for (const dll of targetDlls) {
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
/**
 * Install DXVK/VKD3D to a game directory
 */
export function installEngine(
  gamePath: string,
  gameId: string,
  fork: DxvkFork,
  version: string,
  architecture: Architecture
): DeploymentManifest {
  if (architecture === 'unknown') {
    throw new Error('Cannot install engine: unknown architecture')
  }

  const componentType = fork === 'vkd3d' ? 'vkd3d' : 'dxvk'
  const sourceDlls = getEngineDlls(fork, version, architecture)

  if (sourceDlls.length === 0) {
    throw new Error(`No DLLs found for ${fork} ${version} (${architecture}-bit)`)
  }

  // Read existing manifest or create new
  let manifest = readManifest(gamePath) || {
    gameId,
    engineVersion: version, // Legacy compat (will be overwritten if exists, but kept for types)
    engineFork: fork,       // Legacy compat
    architecture,
    installedAt: new Date().toISOString(),
    dlls: [],
    components: {}
  }

  // Migrate legacy manifest if needed
  if (!manifest.components) {
    manifest.components = {}
    // If it was a valid legacy manifest, assume it was DXVK (VKD3D didn't exist)
    if (manifest.engineVersion && manifest.engineFork) {
      manifest.components.dxvk = {
        version: manifest.engineVersion,
        fork: manifest.engineFork
      }
    }
  }

  // Update component info
  manifest.components[componentType] = {
    version,
    fork
  }

  // Update legacy top-level fields for backward compatibility (points to last installed)
  manifest.engineVersion = version
  manifest.engineFork = fork

  // Filter out OLD DLLs for this component from manifest.dlls
  // We identify DLLs by name.
  // VKD3D DLLs: d3d12.dll, d3d12core.dll
  // DXVK DLLs: d3d9, d3d10*, d3d11, dxgi

  const vkd3dNames = ['d3d12.dll', 'd3d12core.dll']

  // Identify which DLLs belong to the component we are installing
  // If installing VKD3D, we want to replace/update d3d12*.
  // If installing DXVK, we want to replace/update d3d9/10/11/dxgi.

  const isTargetDll = (name: string) => {
    if (componentType === 'vkd3d') return vkd3dNames.includes(name.toLowerCase())
    return !vkd3dNames.includes(name.toLowerCase()) // Assume everything else is DXVK
  }

  // Remove existing tracked DLLs for this component from list (we will re-add them)
  const otherDlls = manifest.dlls.filter(d => !isTargetDll(d.name))
  const deployedDlls: DeployedDll[] = []

  for (const sourceDll of sourceDlls) {
    const dllName = basename(sourceDll)
    const targetPath = join(gamePath, dllName)
    const backupPath = join(gamePath, `${dllName}.bak_dxvk_studio`)

    // Backup existing DLL if it exists and isn't already a tracked DLL
    if (existsSync(targetPath)) {
      const isTracked = manifest.dlls.some(d => d.name === dllName)

      // If it's not tracked, back it up.
      // If it IS tracked but belongs to this component (which we are updating), we technically don't need to re-backup if we already have one?
      // But simpler to ensure backup exists.

      if (!existsSync(backupPath) && !isTracked) {
        renameSync(targetPath, backupPath)
      } else if (isTracked) {
        // It's already ours, we are overwriting it. We trust the existing backup if any.
        // Pass
      }
    }

    // Copy new DLL
    // Using copyFileSync overwrites
    copyFileSync(sourceDll, targetPath)

    deployedDlls.push({
      name: dllName,
      hash: hashFile(targetPath),
      backupPath: existsSync(backupPath) ? backupPath : undefined
    })
  }

  // Update manifest DLLs
  manifest.dlls = [...otherDlls, ...deployedDlls]
  manifest.installedAt = new Date().toISOString() // Update timestamp

  writeManifest(gamePath, manifest)

  return manifest
}

/**
 * Uninstall DXVK from a game directory
 */
/**
 * Uninstall engine from a game directory
 */
export function uninstallEngine(gamePath: string, component?: 'dxvk' | 'vkd3d'): boolean {
  const manifest = readManifest(gamePath)

  if (!manifest) {
    return false
  }

  const vkd3dNames = ['d3d12.dll', 'd3d12core.dll']
  const isTargetDll = (name: string) => {
    if (!component) return true
    if (component === 'vkd3d') return vkd3dNames.includes(name.toLowerCase())
    return !vkd3dNames.includes(name.toLowerCase())
  }

  const dllsToRemove = manifest.dlls.filter(d => isTargetDll(d.name))
  const dllsToKeep = manifest.dlls.filter(d => !isTargetDll(d.name))

  // Remove DLLs and restore backups
  for (const dll of dllsToRemove) {
    const dllPath = join(gamePath, dll.name)
    const backupPath = dll.backupPath

    // Remove DLL
    if (existsSync(dllPath)) {
      rmSync(dllPath)
    }

    // Restore backup if exists
    if (backupPath && existsSync(backupPath)) {
      renameSync(backupPath, dllPath)
    }
  }

  // Handle manifest updates
  if (component && manifest.components) {
    delete manifest.components[component]

    // If we removed the last component, or if we removed headers?
    // Determine if anything is left.
    if (Object.keys(manifest.components).length === 0) {
      // All gone
      // Remove dxvk.conf if we created it (and if we are uninstalling everything?)
      // Note: config usually shared. If we uninstall one, we might keep config?
      // If all components gone, remove config.
      const confPath = join(gamePath, 'dxvk.conf')
      if (existsSync(confPath) && manifest.configPath === confPath) {
        rmSync(confPath)
      }
      rmSync(getManifestPath(gamePath))
    } else {
      // Still some components left
      manifest.dlls = dllsToKeep
      // Update legacy fields if we removed the one it pointed to?
      // Just leave them or clear them?
      // If we removed what engineVersion pointed to, it might be misleading.
      // But engineVersion points to *last installed*.
      // Let's just update timestamp.
      manifest.installedAt = new Date().toISOString()
      writeManifest(gamePath, manifest)
    }
  } else {
    // Uninstalling everything
    const confPath = join(gamePath, 'dxvk.conf')
    if (existsSync(confPath) && manifest.configPath === confPath) {
      rmSync(confPath)
    }
    rmSync(getManifestPath(gamePath))
  }

  return true
}

/**
 * Update engine to a new version
 */
export function updateEngine(
  gamePath: string,
  gameId: string,
  newFork: DxvkFork,
  newVersion: string,
  architecture: Architecture
): DeploymentManifest {
  // Just reinstall/overwrite
  return installEngine(gamePath, gameId, newFork, newVersion, architecture)
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
        case 'DXVK_HUD': {
          const items = value.split(',').map(s => s.trim()).filter(s => s.length > 0)
          const scaleItem = items.find(s => s.startsWith('scale='))

          if (scaleItem) {
            const scaleVal = parseFloat(scaleItem.split('=')[1])
            if (!isNaN(scaleVal)) {
              config.hudScale = scaleVal
            }
          }

          config.hud = items.filter(s => !s.startsWith('scale='))
          break
        }
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

  const hudItems = [...(config.hud || [])]
  if (config.hudScale !== undefined) {
    hudItems.push(`scale=${config.hudScale}`)
  }

  if (hudItems.length > 0) {
    lines.push(`DXVK_HUD = ${hudItems.join(',')}`)
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
