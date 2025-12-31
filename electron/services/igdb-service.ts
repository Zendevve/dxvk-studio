/**
 * IGDB Service
 * Handles authentication and API calls to the Internet Game Database
 *
 * IGDB is owned by Twitch, so authentication uses Twitch OAuth2
 * Users must register at https://dev.twitch.tv/console/apps
 */

import type { IgdbGame, IgdbSearchResult, IgdbCredentials } from '../shared/types'
import {
  getIgdbCredentials,
  getIgdbToken,
  setIgdbToken,
  isIgdbTokenValid
} from './settings-store'

// ============================================
// Constants
// ============================================

const TWITCH_AUTH_URL = 'https://id.twitch.tv/oauth2/token'
const IGDB_API_URL = 'https://api.igdb.com/v4'

// ============================================
// Authentication
// ============================================

async function authenticate(credentials: IgdbCredentials): Promise<string> {
  // Check cached token first
  if (isIgdbTokenValid()) {
    const cached = getIgdbToken()
    if (cached) return cached.token
  }

  const params = new URLSearchParams({
    client_id: credentials.clientId,
    client_secret: credentials.clientSecret,
    grant_type: 'client_credentials'
  })

  const response = await fetch(`${TWITCH_AUTH_URL}?${params.toString()}`, {
    method: 'POST'
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Twitch authentication failed: ${error}`)
  }

  const data = await response.json() as {
    access_token: string
    expires_in: number
    token_type: string
  }

  // Cache the token
  setIgdbToken(data.access_token, data.expires_in)
  return data.access_token
}

async function getAuthToken(): Promise<string | null> {
  const credentials = getIgdbCredentials()
  if (!credentials) return null

  try {
    return await authenticate(credentials)
  } catch (error) {
    console.error('IGDB authentication failed:', error)
    return null
  }
}

// ============================================
// API Helpers
// ============================================

async function igdbRequest<T>(
  endpoint: string,
  body: string
): Promise<T | null> {
  const credentials = getIgdbCredentials()
  if (!credentials) return null

  const token = await getAuthToken()
  if (!token) return null

  try {
    const response = await fetch(`${IGDB_API_URL}/${endpoint}`, {
      method: 'POST',
      headers: {
        'Client-ID': credentials.clientId,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'text/plain'
      },
      body
    })

    if (!response.ok) {
      const error = await response.text()
      console.error(`IGDB request failed: ${error}`)
      return null
    }

    return await response.json() as T
  } catch (error) {
    console.error('IGDB request error:', error)
    return null
  }
}

/**
 * Transform IGDB cover URL to high-resolution version
 * IGDB returns thumbnail URLs like //images.igdb.com/...t_thumb/...
 * We want the large cover: t_cover_big (264x374) or t_720p (720x1280)
 */
export function transformCoverUrl(url?: string): string | undefined {
  if (!url) return undefined
  // Ensure https protocol and use cover_big size
  return url
    .replace(/^\/\//, 'https://')
    .replace(/t_thumb/, 't_cover_big')
}

// ============================================
// Public API
// ============================================

/**
 * Test IGDB connection with current credentials
 */
export async function testConnection(): Promise<{ success: boolean; error?: string }> {
  const credentials = getIgdbCredentials()
  if (!credentials) {
    return { success: false, error: 'No credentials configured' }
  }

  try {
    await authenticate(credentials)
    return { success: true }
  } catch (error) {
    return { success: false, error: (error as Error).message }
  }
}

/**
 * Check if IGDB is configured and available
 */
export function isIgdbConfigured(): boolean {
  const credentials = getIgdbCredentials()
  return credentials !== null && !!credentials.clientId && !!credentials.clientSecret
}

/**
 * Search IGDB for games matching query
 */
export async function searchGames(query: string): Promise<IgdbSearchResult[]> {
  if (!query || query.length < 2) return []

  interface IgdbRawGame {
    id: number
    name: string
    cover?: {
      url?: string
    }
  }

  const body = `
    search "${query.replace(/"/g, '\\"')}";
    fields name, cover.url;
    limit 10;
  `

  const results = await igdbRequest<IgdbRawGame[]>('games', body)
  if (!results) return []

  return results.map(game => ({
    id: game.id,
    name: game.name,
    coverUrl: transformCoverUrl(game.cover?.url)
  }))
}

/**
 * Get full game details from IGDB
 */
export async function getGameDetails(igdbId: number): Promise<IgdbGame | null> {
  interface IgdbRawGameDetails {
    id: number
    name: string
    summary?: string
    cover?: { url?: string }
    genres?: Array<{ name: string }>
    involved_companies?: Array<{
      company: { name: string }
      developer?: boolean
      publisher?: boolean
    }>
    first_release_date?: number
    aggregated_rating?: number
  }

  const body = `
    fields name, summary, cover.url, genres.name,
           involved_companies.company.name, involved_companies.developer, involved_companies.publisher,
           first_release_date, aggregated_rating;
    where id = ${igdbId};
  `

  const results = await igdbRequest<IgdbRawGameDetails[]>('games', body)
  if (!results || results.length === 0) return null

  const game = results[0]

  const developers = game.involved_companies
    ?.filter(ic => ic.developer)
    .map(ic => ic.company.name) || []

  const publishers = game.involved_companies
    ?.filter(ic => ic.publisher)
    .map(ic => ic.company.name) || []

  return {
    id: game.id,
    name: game.name,
    summary: game.summary,
    coverUrl: transformCoverUrl(game.cover?.url),
    genres: game.genres?.map(g => g.name),
    developers,
    publishers,
    releaseDate: game.first_release_date
      ? new Date(game.first_release_date * 1000).toISOString().split('T')[0]
      : undefined,
    rating: game.aggregated_rating ? Math.round(game.aggregated_rating) : undefined
  }
}

/**
 * Search IGDB using Steam App ID
 * IGDB maintains external game mappings including Steam
 */
export async function getGameBySteamId(steamAppId: string): Promise<IgdbGame | null> {
  interface IgdbExternalGame {
    game: number
  }

  // Steam category in IGDB is 1
  const body = `
    fields game;
    where category = 1 & uid = "${steamAppId}";
    limit 1;
  `

  const results = await igdbRequest<IgdbExternalGame[]>('external_games', body)
  if (!results || results.length === 0) return null

  return getGameDetails(results[0].game)
}
