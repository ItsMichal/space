import { afterEach, describe, expect, it, vi } from 'vitest'
import { guard } from '../server/guard'

const req = (headers: Record<string, string>) => new Request('http://localhost:3000/api/write/posts', { headers })

afterEach(() => vi.unstubAllEnvs())

describe('api guard', () => {
  it('refuses everything outside development', () => {
    vi.stubEnv('NODE_ENV', 'production')
    expect(guard(req({ host: 'localhost:3000' }))?.status).toBe(404)
  })

  it('allows loopback same-origin requests in development', () => {
    vi.stubEnv('NODE_ENV', 'development')
    expect(guard(req({ host: 'localhost:3000' }))).toBeNull()
    expect(guard(req({ host: '127.0.0.1:3000', origin: 'http://127.0.0.1:3000' }))).toBeNull()
    expect(guard(req({ host: '[::1]:3000', 'sec-fetch-site': 'same-origin' }))).toBeNull()
  })

  it('refuses non-local hosts (DNS rebinding) and cross-origin callers', () => {
    vi.stubEnv('NODE_ENV', 'development')
    expect(guard(req({ host: 'evil.example' }))?.status).toBe(403)
    expect(guard(req({ host: 'localhost:3000', origin: 'https://evil.example' }))?.status).toBe(403)
    expect(guard(req({ host: 'localhost:3000', 'sec-fetch-site': 'cross-site' }))?.status).toBe(403)
  })
})
