import { describe, expect, it } from 'vitest'
import {
  CHARACTER_ANIMATION_KEYS,
  getBirdAnimationKey,
  getPigAnimationKey,
  resolveBirdVisualState,
  resolvePigVisualState,
} from './characterAnimations'

describe('characterAnimations', () => {
  it('maps bird gameplay states to the expected animation keys', () => {
    expect(getBirdAnimationKey('idle')).toBe(CHARACTER_ANIMATION_KEYS.birdIdle)
    expect(getBirdAnimationKey('aim')).toBe(CHARACTER_ANIMATION_KEYS.birdAim)
    expect(getBirdAnimationKey('launch')).toBe(CHARACTER_ANIMATION_KEYS.birdLaunch)
  })

  it('maps pig gameplay states to the expected animation keys', () => {
    expect(getPigAnimationKey('idle')).toBe(CHARACTER_ANIMATION_KEYS.pigIdle)
    expect(getPigAnimationKey('hit')).toBe(CHARACTER_ANIMATION_KEYS.pigHit)
    expect(getPigAnimationKey('defeat')).toBe(CHARACTER_ANIMATION_KEYS.pigDefeat)
  })

  it('resolves bird visual state from drag and launch state', () => {
    expect(resolveBirdVisualState({ isDragging: false, launched: false })).toBe('idle')
    expect(resolveBirdVisualState({ isDragging: true, launched: false })).toBe('aim')
    expect(resolveBirdVisualState({ isDragging: true, launched: true })).toBe('launch')
  })

  it('resolves pig visual state from hit timing', () => {
    expect(resolvePigVisualState({ hitUntilMs: 300, nowMs: 120 })).toBe('hit')
    expect(resolvePigVisualState({ hitUntilMs: 120, nowMs: 120 })).toBe('idle')
    expect(resolvePigVisualState({ hitUntilMs: 119, nowMs: 120 })).toBe('idle')
  })
})
