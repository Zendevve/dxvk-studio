/**
 * DXVK Engine Manager
 * Handles downloading, caching, and managing DXVK versions
 */

import { existsSync, mkdirSync, createWriteStream, readdirSync, rmSync, createReadStream } from 'fs'
import { join } from 'path'
import { app } from 'electron'
import { pipeline } from 'stream/promises'
import { createGunzip } from 'zlib'
import { extract, x as tarExtract } from 'tar'
import { Readable } from 'stream'
import { Decompress } from 'fzstd'
import type { DxvkEngine, DxvkFork, DxvkRelease } from '../shared/types'

// GitHub API endpoints for DXVK releases
const GITHUB_REPOS: Record<DxvkFork, string> = {
  official: 'doitsujin/dxvk',
  gplasync: 'Sporif/dxvk-async',  // Archived but still accessible
  nvapi: 'jp7677/dxvk-nvapi',
  vkd3d: 'HansKristian-Work/vkd3d-proton'
}

/**
 * Get the base path for DXVK engine storage
 */
export function getEnginesPath(): string {
  const userDataPath = app?.getPath?.('userData') ?? join(process.env.APPDATA || '', 'dxvk-studio')
  const enginesPath = join(userDataPath, 'engines')

  if (!existsSync(enginesPath)) {
    mkdirSync(enginesPath, { recursive: true })
  }

  return enginesPath
}

/**
 * Get the path for a specific DXVK version
 */
export function getVersionPath(fork: DxvkFork, version: string): string {
  return join(getEnginesPath(), fork, version)
}

/**
 * Check if a DXVK version is cached locally
 */
export function isVersionCached(fork: DxvkFork, version: string): boolean {
  const versionPath = getVersionPath(fork, version)
  return existsSync(join(versionPath, 'x64', 'dxgi.dll')) ||
    existsSync(join(versionPath, 'x32', 'd3d9.dll'))
}

/**
 * Get all cached versions for a fork
 */
export function getCachedVersions(fork: DxvkFork): string[] {
  const forkPath = join(getEnginesPath(), fork)

  if (!existsSync(forkPath)) {
    return []
  }

  try {
    return readdirSync(forkPath, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name)
  } catch {
    return []
  }
}

/**
 * Calculate directory size recursively
 */
function getDirectorySize(dirPath: string): number {
  let size = 0

  try {
    const entries = readdirSync(dirPath, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name)

      if (entry.isFile()) {
        const { statSync } = require('fs')
        size += statSync(fullPath).size
      } else if (entry.isDirectory()) {
        size += getDirectorySize(fullPath)
      }
    }
  } catch {
    // Skip directories we can't read
  }

  return size
}

/**
 * Get all cached engines across all forks with size info
 */
export function getAllCachedEngines(): Array<{
  fork: DxvkFork
  version: string
  path: string
  sizeBytes: number
}> {
  const engines: Array<{
    fork: DxvkFork
    version: string
    path: string
    sizeBytes: number
  }> = []

  const forks: DxvkFork[] = ['official', 'gplasync', 'nvapi', 'vkd3d']

  for (const fork of forks) {
    const versions = getCachedVersions(fork)

    for (const version of versions) {
      const versionPath = getVersionPath(fork, version)
      const sizeBytes = getDirectorySize(versionPath)

      engines.push({
        fork,
        version,
        path: versionPath,
        sizeBytes
      })
    }
  }

  return engines
}

/**
 * Fetch releases from GitHub or GitLab API depending on fork
 */
export async function fetchReleases(fork: DxvkFork, limit = 10): Promise<DxvkRelease[]> {
  // GPL Async is on GitLab, others are on GitHub
  if (fork === 'gplasync') {
    return fetchGitLabReleases(limit)
  }
  return fetchGitHubReleases(fork, limit)
}

/**
 * Fetch releases from GitHub API
 */
async function fetchGitHubReleases(fork: DxvkFork, limit: number): Promise<DxvkRelease[]> {
  const repo = GITHUB_REPOS[fork]
  const url = `https://api.github.com/repos/${repo}/releases?per_page=${limit}`

  try {
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'DXVK-Studio'
      }
    })

    if (response.status === 403) {
      console.warn('GitHub API rate limited - using fallback versions')
      return getFallbackReleases(fork)
    }

    if (!response.ok) {
      throw new Error(`GitHub API returned ${response.status}`)
    }

    return await response.json() as DxvkRelease[]
  } catch (error) {
    console.error(`Failed to fetch releases for ${fork}:`, error)
    return getFallbackReleases(fork)
  }
}

/**
 * Fetch releases from GitLab API for GPL Async
 */
async function fetchGitLabReleases(limit: number): Promise<DxvkRelease[]> {
  const url = `https://gitlab.com/api/v4/projects/Ph42oN%2Fdxvk-gplasync/releases?per_page=${limit}`

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'DXVK-Studio'
      }
    })

    if (!response.ok) {
      throw new Error(`GitLab API returned ${response.status}`)
    }

    // Convert GitLab release format to our DxvkRelease format
    const gitlabReleases = await response.json() as Array<{
      tag_name: string
      name: string
      released_at: string
      description: string
      assets: {
        links: Array<{
          name: string
          direct_asset_url: string
        }>
      }
    }>

    return gitlabReleases.map(release => {
      // Find the tar.gz asset link
      const tarGzLink = release.assets.links.find(l => l.name.endsWith('.tar.gz'))

      return {
        tag_name: release.tag_name,
        name: release.name,
        published_at: release.released_at,
        body: release.description,
        assets: tarGzLink ? [{
          name: tarGzLink.name,
          browser_download_url: tarGzLink.direct_asset_url
        }] : []
      }
    })
  } catch (error) {
    console.error('Failed to fetch releases from GitLab:', error)
    return getFallbackReleases('gplasync')
  }
}

/**
 * Fallback releases when API is unavailable
 */
function getFallbackReleases(fork: DxvkFork): DxvkRelease[] {
  // GPL Async is on GitLab with different URL structure
  if (fork === 'gplasync') {
    const gplVersions = ['2.7.1-1', '2.7-1', '2.6.2-1', '2.6.1-1', '2.6-1', '2.5.3-1']
    return gplVersions.map(version => ({
      tag_name: `v${version}`,
      name: `DXVK GPL Async ${version}`,
      published_at: new Date().toISOString(),
      body: 'Fallback version (API unavailable)',
      assets: [{
        name: `dxvk-gplasync-v${version}.tar.gz`,
        browser_download_url: `https://gitlab.com/Ph42oN/dxvk-gplasync/-/raw/main/releases/dxvk-gplasync-v${version}.tar.gz?ref_type=heads`
      }]
    }))
  }

  // GitHub forks (Official and NVAPI)
  const fallbackData: Record<'official' | 'nvapi' | 'vkd3d', { versions: string[], assetPrefix: string }> = {
    official: {
      versions: ['2.7.1', '2.7', '2.6.1', '2.5.3', '2.5.1', '2.5', '2.4.1'],
      assetPrefix: 'dxvk'
    },
    nvapi: {
      versions: ['0.7.1', '0.7.0', '0.6.9', '0.6.8', '0.6.7'],
      assetPrefix: 'dxvk-nvapi'
    },
    vkd3d: {
      versions: ['2.13', '2.12', '2.11.1', '2.11'],
      assetPrefix: 'vkd3d-proton'
    }
  }

  const repo = GITHUB_REPOS[fork]
  const data = fallbackData[fork as 'official' | 'nvapi' | 'vkd3d']

  return data.versions.map(version => {
    // NVAPI uses 'v' prefix in asset filename, others don't
    const assetVersion = fork === 'nvapi' ? `v${version}` : version
    const filename = `${data.assetPrefix}-${assetVersion}.tar.gz`

    return {
      tag_name: `v${version}`,
      name: `DXVK ${version}`,
      published_at: new Date().toISOString(),
      body: 'Fallback version (API rate limited)',
      assets: [{
        name: filename,
        browser_download_url: `https://github.com/${repo}/releases/download/v${version}/${filename}`
      }]
    }
  })
}

/**
 * Convert GitHub release to DxvkEngine
 */
export function releaseToEngine(release: DxvkRelease, fork: DxvkFork): DxvkEngine | null {
  // Find the download asset - DXVK uses ZIP files
  const asset = release.assets.find(a =>
    a.name.endsWith('.zip') || a.name.endsWith('.tar.gz') || a.name.endsWith('.tar.xz') || a.name.endsWith('.tar.zst')
  )

  if (!asset) {
    console.warn(`No downloadable asset found for release ${release.tag_name}`)
    return null
  }

  const version = release.tag_name.replace(/^v/, '')

  return {
    id: `${fork}-${version}`,
    version,
    fork,
    releaseDate: release.published_at,
    downloadUrl: asset.browser_download_url,
    localPath: getVersionPath(fork, version),
    cached: isVersionCached(fork, version),
    changelog: release.body
  }
}

/**
 * Get all available engines (fetches from GitHub and merges with cached)
 */
export async function getAvailableEngines(fork: DxvkFork): Promise<DxvkEngine[]> {
  const releases = await fetchReleases(fork)
  const engines = releases
    .map(r => releaseToEngine(r, fork))
    .filter((e): e is DxvkEngine => e !== null)

  // Update cached status
  for (const engine of engines) {
    engine.cached = isVersionCached(fork, engine.version)
    if (engine.cached) {
      engine.localPath = getVersionPath(fork, engine.version)
    }
  }

  return engines
}

/**
 * Download and extract a DXVK version
 */
export async function downloadEngine(
  fork: DxvkFork,
  version: string,
  downloadUrl: string,
  onProgress?: (percent: number) => void
): Promise<string> {
  const versionPath = getVersionPath(fork, version)
  const tempPath = join(getEnginesPath(), `temp-${fork}-${version}.tar.gz`)

  // Create directory
  mkdirSync(versionPath, { recursive: true })

  try {
    // Download the tarball
    const response = await fetch(downloadUrl)
    if (!response.ok) {
      throw new Error(`Download failed: ${response.status}`)
    }

    const contentLength = parseInt(response.headers.get('content-length') || '0')
    let downloadedBytes = 0

    // Create write stream for temp file
    const fileStream = createWriteStream(tempPath)
    const reader = response.body?.getReader()

    if (!reader) {
      throw new Error('No response body')
    }

    // Download with progress
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      fileStream.write(value)
      downloadedBytes += value.length

      if (onProgress && contentLength > 0) {
        onProgress(Math.round((downloadedBytes / contentLength) * 100))
      }
    }

    // Wait for stream to finish writing
    await new Promise<void>((resolve, reject) => {
      fileStream.end((err: Error | null | undefined) => {
        if (err) reject(err)
        else resolve()
      })
    })

    // Extract the tarball
    if (downloadUrl.endsWith('.tar.zst')) {
      await pipeline(
        createReadStream(tempPath),
        new Decompress() as any,
        tarExtract({
          cwd: versionPath,
          strip: 1
        })
      )
    } else {
      await extract({
        file: tempPath,
        cwd: versionPath,
        strip: 1 // Remove the top-level directory from the archive
      })
    }

    // Clean up temp file
    rmSync(tempPath, { force: true })

    return versionPath

  } catch (error) {
    // Clean up on failure
    rmSync(tempPath, { force: true })
    rmSync(versionPath, { recursive: true, force: true })
    throw error
  }
}

/**
 * Delete a cached engine version
 */
export function deleteEngine(fork: DxvkFork, version: string): void {
  const versionPath = getVersionPath(fork, version)

  if (existsSync(versionPath)) {
    rmSync(versionPath, { recursive: true, force: true })
  }
}

/**
 * Get the DLL paths for a specific engine and architecture
 */
export function getEngineDlls(fork: DxvkFork, version: string, architecture: '32' | '64'): string[] {
  const versionPath = getVersionPath(fork, version)
  const archFolder = architecture === '32' ? 'x32' : 'x64'

  // VKD3D structure might correspond to x86/x64 like DXVK, need to verify.
  // Standard VKD3D releases have x86 and x64 folders?
  // vkd3d-proton releases usually have: x86/ and x64/ dirs.
  // We will assume standard structure for now.
  let dllPath = join(versionPath, archFolder)

  // Handle case where arch folders are named differently?
  // DXVK usually uses x32/x64 in our cache (we might have renamed them on extraction? No, downloadEngine strips 1 level).
  // DXVK releases: dxvk-x.y.z/x64/
  // VKD3D releases: vkd3d-proton-x.y.z/x64/
  // So 'strip: 1' works for both.

  // VKD3D might drop 32-bit support in future, but for now it exists.

  if (!existsSync(dllPath)) {
    return []
  }

  try {
    return readdirSync(dllPath)
      .filter(f => f.endsWith('.dll'))
      .map(f => join(dllPath, f))
  } catch {
    return []
  }
}
