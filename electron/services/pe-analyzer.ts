/**
 * PE (Portable Executable) Header Analyzer
 * Reads the Machine Type from PE headers to determine 32-bit vs 64-bit
 */

import { openSync, readSync, closeSync, readdirSync, statSync, existsSync } from 'fs'
import { join, extname, basename } from 'path'
import { spawn } from 'child_process'
import type { PEAnalysisResult, Architecture } from '../shared/types'
import { PE_MACHINE_I386, PE_MACHINE_AMD64 } from '../shared/types'

/**
 * Read bytes from a file at a specific offset
 */
function readBytesAt(fd: number, offset: number, length: number): Buffer {
  const buffer = Buffer.alloc(length)
  readSync(fd, buffer, 0, length, offset)
  return buffer
}

/**
 * Analyze a PE executable to determine its architecture
 *
 * PE Format:
 * 1. DOS Header starts at offset 0, e_lfanew at offset 0x3C points to PE signature
 * 2. PE Signature "PE\0\0" at e_lfanew
 * 3. COFF File Header immediately follows, Machine field at offset +4 from signature
 *
 * Machine Types:
 * - 0x014c = IMAGE_FILE_MACHINE_I386 (32-bit)
 * - 0x8664 = IMAGE_FILE_MACHINE_AMD64 (64-bit)
 */
export function analyzeExecutable(exePath: string): PEAnalysisResult {
  let fd: number | null = null

  try {
    fd = openSync(exePath, 'r')

    // Read DOS header magic number (MZ)
    const dosHeader = readBytesAt(fd, 0, 2)
    if (dosHeader.toString('ascii') !== 'MZ') {
      return {
        architecture: 'unknown',
        machineType: 0,
        isValid: false,
        error: 'Not a valid PE file (missing MZ signature)'
      }
    }

    // Read e_lfanew (PE header offset) at 0x3C
    const lfanewBuffer = readBytesAt(fd, 0x3C, 4)
    const peOffset = lfanewBuffer.readUInt32LE(0)

    // Sanity check on PE offset
    if (peOffset < 64 || peOffset > 1024) {
      return {
        architecture: 'unknown',
        machineType: 0,
        isValid: false,
        error: 'Invalid PE header offset'
      }
    }

    // Read PE signature
    const peSignature = readBytesAt(fd, peOffset, 4)
    if (peSignature.toString('ascii') !== 'PE\0\0') {
      return {
        architecture: 'unknown',
        machineType: 0,
        isValid: false,
        error: 'Invalid PE signature'
      }
    }

    // Read Machine type (2 bytes after PE signature)
    const machineBuffer = readBytesAt(fd, peOffset + 4, 2)
    const machineType = machineBuffer.readUInt16LE(0)

    // Determine architecture
    let architecture: Architecture = 'unknown'

    if (machineType === PE_MACHINE_I386) {
      architecture = '32'
    } else if (machineType === PE_MACHINE_AMD64) {
      architecture = '64'
    }

    return {
      architecture,
      machineType,
      isValid: true
    }

  } catch (error) {
    return {
      architecture: 'unknown',
      machineType: 0,
      isValid: false,
      error: error instanceof Error ? error.message : 'Unknown error reading file'
    }
  } finally {
    if (fd !== null) {
      closeSync(fd)
    }
  }
}

// Executables to skip - not game executables
const SKIP_PATTERNS = [
  'unins', 'redist', 'vcredist', 'dxsetup', 'directx',
  'crash', 'report', 'updater', 'setup', 'installer',
  'dotnet', 'vc_redist', 'oalinst', 'physx', 'easyanticheat',
  'battleye', 'dxwebsetup', 'support', 'benchmark'
]

// Common subfolders where game executables are found
const GAME_SUBFOLDERS = [
  '', // root
  'bin', 'Bin', 'BIN',
  'binaries', 'Binaries', 'BINARIES',
  'bin64', 'Bin64', 'bin_x64',
  'bin32', 'Bin32', 'bin_x86',
  'win64', 'Win64', 'x64',
  'win32', 'Win32', 'x86',
  'game', 'Game',
  'engine', 'Engine',
  'retail', 'Retail'
]

interface ExecutableInfo {
  path: string       // full path to executable
  name: string       // just the filename
  relativePath: string // path relative to game root
  score: number      // higher = more likely to be main exe
  architecture: Architecture
}

/**
 * Find executable files in a game directory
 * Scans common subfolders and scores executables to find the main one
 */
export function findGameExecutables(gamePath: string): string[] {
  const executables: ExecutableInfo[] = []

  for (const subfolder of GAME_SUBFOLDERS) {
    const searchPath = subfolder ? join(gamePath, subfolder) : gamePath

    if (!existsSync(searchPath)) continue

    try {
      const entries = readdirSync(searchPath)

      for (const entry of entries) {
        const fullPath = join(searchPath, entry)

        try {
          const stat = statSync(fullPath)

          if (stat.isFile() && extname(entry).toLowerCase() === '.exe') {
            const lowerName = entry.toLowerCase()

            // Skip known non-game executables
            if (SKIP_PATTERNS.some(pattern => lowerName.includes(pattern))) {
              continue
            }

            // Calculate score for this executable
            let score = 0

            // Prefer executables in root folder
            if (!subfolder) score += 10

            // Prefer larger files (more likely to be main game)
            if (stat.size > 10 * 1024 * 1024) score += 5  // >10MB
            if (stat.size > 50 * 1024 * 1024) score += 5  // >50MB

            // Prefer names that match game launcher patterns
            if (lowerName === 'game.exe' || lowerName === 'launcher.exe') score += 3
            if (lowerName.includes('game')) score += 2
            if (lowerName.includes('play')) score += 2
            if (lowerName.includes('start')) score += 1

            // Penalize known 32-bit indicators in name
            if (lowerName.includes('_32') || lowerName.includes('x86')) score -= 2

            // Prefer 64-bit executables (more common for modern games)
            const analysis = analyzeExecutable(fullPath)
            if (analysis.architecture === '64') score += 3
            if (analysis.architecture === '32') score += 1 // still valid

            executables.push({
              path: fullPath,
              name: entry,
              relativePath: subfolder ? join(subfolder, entry) : entry,
              score,
              architecture: analysis.architecture
            })
          }
        } catch {
          // Skip files we can't read
        }
      }
    } catch {
      // Skip directories we can't read
    }
  }

  // Sort by score descending, return filenames only
  executables.sort((a, b) => b.score - a.score)

  // Return relative paths to executables
  return executables.map(e => e.relativePath)
}

/**
 * Find the best executable for a game, analyzing architecture
 */
export function findBestExecutable(gamePath: string): { executable: string; architecture: Architecture } {
  const executables = findGameExecutables(gamePath)

  if (executables.length === 0) {
    return { executable: '', architecture: 'unknown' }
  }

  const bestExe = executables[0]
  const fullPath = join(gamePath, bestExe)
  const analysis = analyzeExecutable(fullPath)

  return {
    executable: bestExe,
    architecture: analysis.architecture
  }
}

export interface PeVersionInfo {
  ProductName?: string
  FileDescription?: string
  OriginalFilename?: string
}

export async function getPeVersionInfo(exePath: string): Promise<PeVersionInfo> {
  return new Promise((resolve) => {
    try {
      // Use spawn with args array to avoid shell interpolation (command injection prevention)
      const script = `(Get-Item -LiteralPath '${exePath.replace(/'/g, "''")}').VersionInfo | Select-Object ProductName, FileDescription, OriginalFilename | ConvertTo-Json`

      const ps = spawn('powershell', ['-NoProfile', '-Command', script], {
        shell: false,
        windowsHide: true
      })

      let stdout = ''

      ps.stdout.on('data', (data) => { stdout += data.toString() })
      ps.stderr.on('data', () => { })

      ps.on('close', (code) => {
        if (code !== 0 || !stdout.trim()) {
          resolve({})
          return
        }

        try {
          resolve(JSON.parse(stdout))
        } catch {
          resolve({})
        }
      })

      ps.on('error', () => resolve({}))
    } catch {
      resolve({})
    }
  })
}
