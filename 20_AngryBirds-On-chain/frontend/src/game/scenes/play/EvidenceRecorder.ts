import Phaser from 'phaser'

import { playResultSound } from '../../audio'
import { buildClientBuildHash, buildEvidenceHash, buildRunId } from '../../replayHash'
import { SCENE_KEYS } from '../../sceneKeys'
import type { LaunchState } from '../../launchModel'
import type { LevelCatalogEntry, RunSummary } from '../../types'
import type { PlaySceneRuntime, RuntimeBird, RuntimePiece } from './runtime'

type EvidenceRecorderOptions = {
  scene: Phaser.Scene
  runtime: PlaySceneRuntime
  bridge: {
    publishRunSummary: (summary: RunSummary) => void
  }
  getLevel: () => LevelCatalogEntry | null
  buildSessionId: () => `0x${string}`
  onHideTrajectoryPreview: () => void
  shouldLogDebugState: boolean
}

export class EvidenceRecorder {
  private readonly scene: Phaser.Scene
  private readonly runtime: PlaySceneRuntime
  private readonly bridge: EvidenceRecorderOptions['bridge']
  private readonly getLevel: () => LevelCatalogEntry | null
  private readonly buildSessionId: () => `0x${string}`
  private readonly onHideTrajectoryPreview: () => void
  private readonly shouldLogDebugState: boolean

  constructor({
    scene,
    runtime,
    bridge,
    getLevel,
    buildSessionId,
    onHideTrajectoryPreview,
    shouldLogDebugState,
  }: EvidenceRecorderOptions) {
    this.scene = scene
    this.runtime = runtime
    this.bridge = bridge
    this.getLevel = getLevel
    this.buildSessionId = buildSessionId
    this.onHideTrajectoryPreview = onHideTrajectoryPreview
    this.shouldLogDebugState = shouldLogDebugState
  }

  // 记录每次发射参数，后续用于重放与上链证据校验。
  recordLaunch(bird: RuntimeBird, launchState: LaunchState) {
    const level = this.getLevel()
    if (!level) {
      return
    }

    this.runtime.launchEvents.push({
      birdIndex: bird.birdIndex,
      birdType: bird.birdType,
      launchAtMs: this.currentEventAtMs(),
      dragX: Number((launchState.clampedPoint.x - level.slingshot.anchorX).toFixed(2)),
      dragY: Number((launchState.clampedPoint.y - level.slingshot.anchorY).toFixed(2)),
    })
  }

  // 记录实体销毁事件，并在需要计分时累计击毁猪数量。
  recordDestroy(piece: RuntimePiece, trackRunStats: boolean) {
    if (!trackRunStats) {
      return
    }

    this.runtime.destroyEvents.push({
      entityId: piece.id,
      entityType: piece.entityType,
      atMs: this.currentEventAtMs(),
      cause: piece.entityType === 'pig' ? 'impact' : 'collapse',
    })

    if (piece.entityType === 'pig') {
      this.runtime.destroyedPigs += 1
    }
  }

  // 以固定节流间隔记录飞行轨迹采样点，控制证据体积。
  captureCheckpoint() {
    const currentBird = this.runtime.currentBird
    if (!currentBird || !currentBird.launched || this.runtime.runCompleted) {
      return
    }

    const now = this.currentEventAtMs()
    if (this.runtime.lastCheckpointAtMs !== 0 && now - this.runtime.lastCheckpointAtMs < 250) {
      return
    }

    const level = this.getLevel()
    if (!level) {
      return
    }

    const position = currentBird.body.getPosition()
    this.runtime.checkpointEvents.push({
      atMs: now,
      birdIndex: currentBird.birdIndex,
      x: Number((position.x * level.world.pixelsPerMeter).toFixed(2)),
      y: Number((position.y * level.world.pixelsPerMeter).toFixed(2)),
    })
    this.runtime.lastCheckpointAtMs = now
  }

  // 将场景运行时间转换为证据事件时间戳（毫秒）。
  currentEventAtMs() {
    return this.runtime.runStartedAtMs + Math.max(Math.round(this.runtime.runElapsedMs), 0)
  }

  // 回合结束时汇总证据并生成 runId/evidenceHash，再发布到桥接层。
  completeRun(cleared: boolean) {
    const level = this.getLevel()
    if (!level || this.runtime.runCompleted) {
      return
    }

    this.runtime.runCompleted = true
    this.runtime.isDraggingBird = false
    this.runtime.activePointerId = null
    this.onHideTrajectoryPreview()

    const durationMs = Math.max(Math.round(this.runtime.runElapsedMs), 1)
    const evidence = {
      sessionId: this.buildSessionId(),
      levelId: level.levelId,
      levelVersion: level.version,
      levelContentHash: level.manifest.contentHash,
      clientBuildHash: buildClientBuildHash(),
      startedAtMs: this.runtime.runStartedAtMs,
      finishedAtMs: this.runtime.runStartedAtMs + durationMs,
      summary: {
        birdsUsed: this.runtime.birdsUsed,
        destroyedPigs: this.runtime.destroyedPigs,
        durationMs,
        cleared,
      },
      launches: [...this.runtime.launchEvents],
      abilities: [],
      destroys: [...this.runtime.destroyEvents],
      checkpoints: [...this.runtime.checkpointEvents],
    } satisfies RunSummary['evidence']

    const evidenceHash = buildEvidenceHash(evidence)
    const summary: RunSummary = {
      runId: buildRunId(evidence.sessionId, level.levelId, level.version, evidenceHash),
      levelId: level.levelId,
      levelVersion: level.version,
      birdsUsed: this.runtime.birdsUsed,
      destroyedPigs: this.runtime.destroyedPigs,
      durationMs,
      evidenceHash,
      cleared,
      evidence,
    }

    if (this.shouldLogDebugState) {
      console.info('[angry-birds] run-summary', summary)
    }

    playResultSound(this.scene, cleared, this.scene.time.now)
    this.bridge.publishRunSummary(summary)
    this.scene.scene.launch(SCENE_KEYS.result)
    this.scene.scene.pause()
  }
}
