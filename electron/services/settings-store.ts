/**
 * Settings Store
 * Manages persistent application settings stored in AppData
 */

import { app } from 'electron'
import { join } from 'path'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'
import type { IgdbCredentials } from '../shared/types'

// ============================================
// Settings Types
// ============================================

interface AppSettings {
  igdbCredentials?: IgdbCredentials
  igdbAccessToken?: string
  igdbTokenExpiry?: number
}

// ============================================
// Path Management
// ============================================

function getSettingsDir(): string {
  return join(app.getPath('userData'), 'settings')
}

function getSettingsPath(): string {
  return join(getSettingsDir(), 'settings.json')
}

function ensureSettingsDir(): void {
  const dir = getSettingsDir()
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
}

// ============================================
// Settings Read/Write
// ============================================

function readSettings(): AppSettings {
  const path = getSettingsPath()
  if (!existsSync(path)) {
    return {}
  }

  try {
    const content = readFileSync(path, 'utf-8')
    return JSON.parse(content) as AppSettings
  } catch (error) {
    console.error('Failed to read settings:', error)
    return {}
  }
}

function writeSettings(settings: AppSettings): void {
  ensureSettingsDir()
  const path = getSettingsPath()

  try {
    writeFileSync(path, JSON.stringify(settings, null, 2), 'utf-8')
  } catch (error) {
    console.error('Failed to write settings:', error)
    throw error
  }
}

// ============================================
// IGDB Credentials
// ============================================

export function getIgdbCredentials(): IgdbCredentials | null {
  const settings = readSettings()
  return settings.igdbCredentials || null
}

export function setIgdbCredentials(credentials: IgdbCredentials): void {
  const settings = readSettings()
  settings.igdbCredentials = credentials
  // Clear cached token when credentials change
  delete settings.igdbAccessToken
  delete settings.igdbTokenExpiry
  writeSettings(settings)
}

export function clearIgdbCredentials(): void {
  const settings = readSettings()
  delete settings.igdbCredentials
  delete settings.igdbAccessToken
  delete settings.igdbTokenExpiry
  writeSettings(settings)
}

// ============================================
// IGDB Token Cache
// ============================================

export function getIgdbToken(): { token: string; expiry: number } | null {
  const settings = readSettings()
  if (settings.igdbAccessToken && settings.igdbTokenExpiry) {
    return {
      token: settings.igdbAccessToken,
      expiry: settings.igdbTokenExpiry
    }
  }
  return null
}

export function setIgdbToken(token: string, expiresIn: number): void {
  const settings = readSettings()
  settings.igdbAccessToken = token
  // Store expiry as timestamp, subtract 5 mins for safety margin
  settings.igdbTokenExpiry = Date.now() + (expiresIn * 1000) - (5 * 60 * 1000)
  writeSettings(settings)
}

export function isIgdbTokenValid(): boolean {
  const tokenData = getIgdbToken()
  if (!tokenData) return false
  return Date.now() < tokenData.expiry
}
