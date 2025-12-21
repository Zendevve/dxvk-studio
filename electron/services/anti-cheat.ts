/**
 * Anti-Cheat Detection Service
 * Scans game directories for known anti-cheat files
 */

import { existsSync, readdirSync } from 'fs'
import { join } from 'path'
import { ANTI_CHEAT_SIGNATURES, type AntiCheatSignature } from '../shared/types'

/**
 * Recursively search for files matching anti-cheat patterns
 * Limited depth to avoid excessive scanning
 */
function findFilesRecursive(
  dir: string,
  targetFiles: string[],
  maxDepth: number = 3,
  currentDepth: number = 0
): string[] {
  if (currentDepth > maxDepth) return []

  const foundFiles: string[] = []

  try {
    const entries = readdirSync(dir, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = join(dir, entry.name)

      if (entry.isFile()) {
        const lowerName = entry.name.toLowerCase()
        if (targetFiles.some(target => lowerName === target.toLowerCase())) {
          foundFiles.push(fullPath)
        }
      } else if (entry.isDirectory()) {
        // Skip common non-game directories
        const skipDirs = ['node_modules', '.git', '__pycache__', 'logs', 'saves']
        if (!skipDirs.includes(entry.name.toLowerCase())) {
          foundFiles.push(...findFilesRecursive(fullPath, targetFiles, maxDepth, currentDepth + 1))
        }
      }
    }
  } catch {
    // Skip directories we can't read
  }

  return foundFiles
}

/**
 * Detect anti-cheat software in a game directory
 * Returns array of detected anti-cheat signatures with found files
 */
export function detectAntiCheat(gamePath: string): Array<AntiCheatSignature & { foundFiles: string[] }> {
  if (!existsSync(gamePath)) {
    return []
  }

  const detected: Array<AntiCheatSignature & { foundFiles: string[] }> = []

  for (const signature of ANTI_CHEAT_SIGNATURES) {
    const foundFiles = findFilesRecursive(gamePath, signature.files)

    if (foundFiles.length > 0) {
      detected.push({
        ...signature,
        foundFiles
      })
    }
  }

  return detected
}

/**
 * Check if any high-risk anti-cheat is detected
 */
export function hasHighRiskAntiCheat(gamePath: string): boolean {
  const detected = detectAntiCheat(gamePath)
  return detected.some(ac => ac.riskLevel === 'high')
}

/**
 * Get a summary of anti-cheat status for a game
 */
export function getAntiCheatSummary(gamePath: string): {
  hasAntiCheat: boolean
  highRisk: boolean
  detected: string[]
} {
  const detected = detectAntiCheat(gamePath)

  return {
    hasAntiCheat: detected.length > 0,
    highRisk: detected.some(ac => ac.riskLevel === 'high'),
    detected: detected.map(ac => ac.name)
  }
}
