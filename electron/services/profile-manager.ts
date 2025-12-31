
import { app } from 'electron'
import { join } from 'path'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { DxvkProfile } from '../../src/shared/types'
import { v4 as uuidv4 } from 'uuid'

const PROFILES_FILE = 'profiles.json'

function getProfilesPath(): string {
  return join(app.getPath('userData'), PROFILES_FILE)
}


function validateProfile(profile: any): profile is DxvkProfile {
  return (
    typeof profile === 'object' &&
    profile !== null &&
    typeof profile.id === 'string' &&
    typeof profile.name === 'string' &&
    (profile.isBuiltin === undefined || typeof profile.isBuiltin === 'boolean')
    // We can add more checks here if needed, but this covers the basics
  )
}

function loadUserProfiles(): DxvkProfile[] {
  const path = getProfilesPath()
  if (!existsSync(path)) {
    return []
  }

  try {
    const data = readFileSync(path, 'utf-8')
    const parsed = JSON.parse(data)

    if (!Array.isArray(parsed)) {
      console.warn('Invalid profiles format: not an array')
      return []
    }

    const validProfiles = parsed.filter(validateProfile)

    if (validProfiles.length < parsed.length) {
      console.warn(`Skipped ${parsed.length - validProfiles.length} invalid profiles`)
    }

    return validProfiles
  } catch (error) {
    console.error('Failed to load profiles:', error)
    return []
  }
}

function saveUserProfiles(profiles: DxvkProfile[]): void {
  const path = getProfilesPath()
  try {
    writeFileSync(path, JSON.stringify(profiles, null, 2))
  } catch (error) {
    console.error('Failed to save profiles:', error)
    throw error
  }
}

export function getAllProfiles(): DxvkProfile[] {
  return loadUserProfiles()
}

export function saveProfile(profile: Omit<DxvkProfile, 'id'> & { id?: string }): DxvkProfile {
  const userProfiles = loadUserProfiles()

  // If it's a new profile or doesn't have an ID
  const id = profile.id || uuidv4()

  const newProfile: DxvkProfile = {
    ...profile,
    id,
    isBuiltin: false
  }

  const existingIndex = userProfiles.findIndex(p => p.id === id)

  if (existingIndex >= 0) {
    // Update existing
    userProfiles[existingIndex] = newProfile
  } else {
    // Add new
    userProfiles.push(newProfile)
  }

  saveUserProfiles(userProfiles)
  return newProfile
}

export function deleteProfile(id: string): boolean {
  const userProfiles = loadUserProfiles()
  const filtered = userProfiles.filter(p => p.id !== id)

  if (filtered.length === userProfiles.length) {
    return false // Not found
  }

  saveUserProfiles(filtered)
  return true
}
