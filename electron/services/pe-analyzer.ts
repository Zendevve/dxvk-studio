/**
 * PE (Portable Executable) Header Analyzer
 * Reads the Machine Type from PE headers to determine 32-bit vs 64-bit
 */

import { openSync, readSync, closeSync } from 'fs'
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

/**
 * Find executable files in a game directory
 * Returns the most likely main executable
 */
export function findGameExecutables(gamePath: string): string[] {
  const { readdirSync, statSync } = require('fs')
  const { join, extname } = require('path')

  const executables: string[] = []

  try {
    const entries = readdirSync(gamePath)

    for (const entry of entries) {
      const fullPath = join(gamePath, entry)

      try {
        const stat = statSync(fullPath)

        if (stat.isFile() && extname(entry).toLowerCase() === '.exe') {
          // Skip common non-game executables
          const lowerName = entry.toLowerCase()
          if (
            !lowerName.includes('unins') &&
            !lowerName.includes('redist') &&
            !lowerName.includes('vcredist') &&
            !lowerName.includes('dxsetup') &&
            !lowerName.includes('directx') &&
            !lowerName.includes('crash') &&
            !lowerName.includes('report') &&
            !lowerName.includes('launcher') ||
            lowerName === 'launcher.exe' // Keep main launchers
          ) {
            executables.push(entry)
          }
        }
      } catch {
        // Skip files we can't read
      }
    }
  } catch (error) {
    console.error(`Failed to scan directory ${gamePath}:`, error)
  }

  return executables
}

import { exec } from 'child_process'
import { promisify } from 'util'
const execAsync = promisify(exec)

export interface PeVersionInfo {
  ProductName?: string
  FileDescription?: string
  OriginalFilename?: string
}

export async function getPeVersionInfo(exePath: string): Promise<PeVersionInfo> {
  try {
    // Sanitize path for PowerShell
    const safePath = exePath.replace(/'/g, "''")
    const command = `powershell -NoProfile -Command "(Get-Item '${safePath}').VersionInfo | Select-Object ProductName, FileDescription, OriginalFilename | ConvertTo-Json"`

    const { stdout } = await execAsync(command)
    if (!stdout.trim()) return {}

    // PowerShell might return a single object or array, validation needed or try/catch parsing
    return JSON.parse(stdout)
  } catch (error) {
    // Silently fail if PowerShell fails or property missing
    return {}
  }
}
