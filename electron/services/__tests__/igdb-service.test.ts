import { describe, it, expect, vi, beforeEach } from 'vitest'
import { searchGames, getGameDetails, testConnection, transformCoverUrl } from '../igdb-service'
import * as settingsStore from '../settings-store'

// Mock settings-store
vi.mock('../settings-store', () => ({
  getIgdbCredentials: vi.fn(),
  getIgdbToken: vi.fn(),
  setIgdbToken: vi.fn(),
  isIgdbTokenValid: vi.fn()
}))

// Mock global fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('IGDB Service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockReset()
  })

  describe('transformCoverUrl', () => {
    it('should transform thumbnail url to big cover url', () => {
      const input = '//images.igdb.com/igdb/image/upload/t_thumb/co1r7x.jpg'
      const expected = 'https://images.igdb.com/igdb/image/upload/t_cover_big/co1r7x.jpg'
      expect(transformCoverUrl(input)).toBe(expected)
    })

    it('should return undefined for undefined input', () => {
      expect(transformCoverUrl(undefined)).toBeUndefined()
    })
  })

  describe('testConnection', () => {
    it('should return error if no credentials', async () => {
      vi.mocked(settingsStore.getIgdbCredentials).mockReturnValue(null)
      const result = await testConnection()
      expect(result.success).toBe(false)
      expect(result.error).toContain('No credentials')
    })

    it('should authenticate successfully', async () => {
      vi.mocked(settingsStore.getIgdbCredentials).mockReturnValue({
        clientId: 'test-id',
        clientSecret: 'test-secret'
      })
      vi.mocked(settingsStore.isIgdbTokenValid).mockReturnValue(false)

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'new-token',
          expires_in: 3600,
          token_type: 'bearer'
        })
      })

      const result = await testConnection()
      expect(result.success).toBe(true)
      expect(settingsStore.setIgdbToken).toHaveBeenCalledWith('new-token', 3600)
    })
  })

  describe('searchGames', () => {
    it('should return empty array for short query', async () => {
      const result = await searchGames('a')
      expect(result).toEqual([])
    })

    it('should return search results', async () => {
      vi.mocked(settingsStore.getIgdbCredentials).mockReturnValue({
        clientId: 'id',
        clientSecret: 'secret'
      })
      vi.mocked(settingsStore.getIgdbToken).mockReturnValue({ token: 'token', expiry: Date.now() + 10000 })
      vi.mocked(settingsStore.isIgdbTokenValid).mockReturnValue(true)

      const mockResponse = [
        {
          id: 1,
          name: 'Test Game',
          cover: { url: '//image/t_thumb/1.jpg' }
        }
      ]

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      })

      const result = await searchGames('Test')
      expect(result).toHaveLength(1)
      expect(result[0].name).toBe('Test Game')
      expect(result[0].coverUrl).toContain('t_cover_big')
    })
  })
})
