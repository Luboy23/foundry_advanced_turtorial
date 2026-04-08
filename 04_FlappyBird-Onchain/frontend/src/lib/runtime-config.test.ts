import { describe, expect, it } from 'vitest'
import { normalizeRuntimeConfig } from './runtime-config'

describe('normalizeRuntimeConfig', () => {
  it('falls back to defaults for invalid input', () => {
    expect(normalizeRuntimeConfig({})).toMatchObject({
      flappyScoreAddress: '0x0000000000000000000000000000000000000000',
      rpcUrl: 'http://127.0.0.1:8545',
      chainId: 31337,
    })
  })

  it('keeps valid runtime config values', () => {
    expect(
      normalizeRuntimeConfig({
        flappyScoreAddress: '0x1111111111111111111111111111111111111111',
        rpcUrl: 'http://127.0.0.1:9545',
        chainId: 999,
      })
    ).toMatchObject({
      flappyScoreAddress: '0x1111111111111111111111111111111111111111',
      rpcUrl: 'http://127.0.0.1:9545',
      chainId: 999,
    })
  })
})
