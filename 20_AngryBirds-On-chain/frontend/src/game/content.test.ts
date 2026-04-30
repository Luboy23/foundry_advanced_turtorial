import { describe, expect, it } from 'vitest'
import { validateGameplayDefinition } from './content'

describe('validateGameplayDefinition', () => {
  it('rejects duplicate piece ids', () => {
    expect(() =>
      validateGameplayDefinition({
        levelId: 'level-dup',
        version: 1,
        world: { width: 100, height: 100, groundY: 80, gravityY: 10, pixelsPerMeter: 30 },
        camera: { minX: 0, maxX: 100, defaultZoom: 1 },
        slingshot: { anchorX: 10, anchorY: 10, maxDrag: 10, launchVelocityScale: 1 },
        birdQueue: ['red'],
        audioMaterials: {
          'crate-large': 'stone',
          'pig-basic': 'pig',
        },
        pieces: [
          { id: 'same', entityType: 'block', prefabKey: 'crate-large', x: 1, y: 1, rotation: 0 },
          { id: 'same', entityType: 'pig', prefabKey: 'pig-basic', x: 2, y: 2, rotation: 0 },
        ],
      }),
    ).toThrow(/duplicate piece id/)
  })

  it('rejects unsupported prefabs', () => {
    expect(() =>
      validateGameplayDefinition({
        levelId: 'level-bad-prefab',
        version: 1,
        world: { width: 100, height: 100, groundY: 80, gravityY: 10, pixelsPerMeter: 30 },
        camera: { minX: 0, maxX: 100, defaultZoom: 1 },
        slingshot: { anchorX: 10, anchorY: 10, maxDrag: 10, launchVelocityScale: 1 },
        birdQueue: ['red'],
        audioMaterials: {
          'crate-large': 'stone',
        },
        pieces: [
          { id: 'bad', entityType: 'block', prefabKey: 'crate-unknown', x: 1, y: 1, rotation: 0 },
        ],
      }),
    ).toThrow(/unsupported prefab/)
  })

  it('rejects pieces that are missing an audio material mapping', () => {
    expect(() =>
      validateGameplayDefinition({
        levelId: 'level-missing-audio-material',
        version: 1,
        world: { width: 100, height: 100, groundY: 80, gravityY: 10, pixelsPerMeter: 30 },
        camera: { minX: 0, maxX: 100, defaultZoom: 1 },
        slingshot: { anchorX: 10, anchorY: 10, maxDrag: 10, launchVelocityScale: 1 },
        birdQueue: ['red'],
        audioMaterials: {},
        pieces: [{ id: 'pig', entityType: 'pig', prefabKey: 'pig-basic', x: 1, y: 1, rotation: 0 }],
      }),
    ).toThrow(/missing audioMaterial mapping/)
  })
})
