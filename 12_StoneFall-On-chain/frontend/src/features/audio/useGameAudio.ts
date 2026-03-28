/**
 * 模块职责：封装游戏音频引擎与 React Hook，统一管理 BGM 与音效生命周期。
 * 说明：本文件注释以“业务意图 + 关键约束”为主，便于后续维护与教学阅读。
 */

import { useCallback, useEffect, useMemo } from 'react'

type SfxType = 'start' | 'countdown' | 'collision' | 'button'
const BGM_SOURCE = '/audio/wuxia-main.mp3'
const GAMEOVER_SFX_SOURCE = '/audio/gameover.mp3'

/**
 * 纯音频引擎：
 * - 与 React 生命周期解耦
 * - 在浏览器环境中懒初始化 AudioContext 与 HTMLAudioElement
 * - 在测试环境（jsdom）中尽可能降级为无副作用
 */
class GameAudioEngine {
  private context: AudioContext | null = null
  private bgmAudio: HTMLAudioElement | null = null
  private gameoverSfxAudio: HTMLAudioElement | null = null

  private musicEnabled = true
  private sfxEnabled = true
  private bgmRunning = false

  private isJsdomEnv(): boolean {
    return typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent)
  }

  /**
   * 激活音频上下文。
   * 说明：浏览器通常要求用户手势后才允许播放，这里在每次交互入口都可重试激活。
   */
  activate(): void {
    if (typeof window === 'undefined') {
      return
    }

    if (typeof AudioContext !== 'undefined' && !this.context) {
      this.context = new AudioContext()
    }

    if (this.context?.state === 'suspended') {
      void this.context.resume()
    }

    this.ensureBgmAudio()
    this.ensureGameoverSfxAudio()
    this.tryStartBgm()
  }

  setSettings(musicEnabled: boolean, sfxEnabled: boolean): void {
    this.musicEnabled = musicEnabled
    this.sfxEnabled = sfxEnabled

    if (!musicEnabled) {
      this.stopBgm()
      return
    }

    this.tryStartBgm()
  }

  setBgmRunning(running: boolean): void {
    this.bgmRunning = running

    if (!running || !this.musicEnabled) {
      this.stopBgm()
      return
    }

    this.activate()
    this.tryStartBgm()
  }

  playSfx(type: SfxType): void {
    if (!this.sfxEnabled) {
      return
    }

    if (type === 'collision') {
      this.playGameoverSfx()
      return
    }

    this.activate()
    if (!this.context) {
      return
    }

    const { frequency, durationMs, volume, wave } = this.resolveSfxConfig(type)

    // 非碰撞音效使用振荡器合成，避免请求额外音频资源。
    const gain = this.context.createGain()
    gain.gain.setValueAtTime(volume, this.context.currentTime)
    gain.gain.exponentialRampToValueAtTime(
      0.0001,
      this.context.currentTime + durationMs / 1000,
    )
    gain.connect(this.context.destination)

    const oscillator = this.context.createOscillator()
    oscillator.type = wave
    oscillator.frequency.setValueAtTime(frequency, this.context.currentTime)
    oscillator.connect(gain)
    oscillator.start()
    oscillator.stop(this.context.currentTime + durationMs / 1000)
  }

  destroy(): void {
    this.stopBgm()
    if (this.bgmAudio) {
      this.bgmAudio.src = ''
      if (!this.isJsdomEnv()) {
        this.bgmAudio.load()
      }
      this.bgmAudio = null
    }
    if (this.gameoverSfxAudio) {
      this.gameoverSfxAudio.src = ''
      if (!this.isJsdomEnv()) {
        this.gameoverSfxAudio.load()
      }
      this.gameoverSfxAudio = null
    }

    if (this.context) {
      void this.context.close()
      this.context = null
    }
  }

  private stopBgm(): void {
    if (this.bgmAudio) {
      if (!this.isJsdomEnv()) {
        this.bgmAudio.pause()
        this.bgmAudio.currentTime = 0
      }
    }
  }

  private ensureBgmAudio(): HTMLAudioElement | null {
    if (this.bgmAudio) {
      return this.bgmAudio
    }

    if (typeof window === 'undefined' || typeof Audio === 'undefined') {
      return null
    }

    const audio = new Audio(BGM_SOURCE)
    audio.loop = true
    audio.preload = 'auto'
    audio.volume = 0.42
    this.bgmAudio = audio
    return audio
  }

  private ensureGameoverSfxAudio(): HTMLAudioElement | null {
    if (this.gameoverSfxAudio) {
      return this.gameoverSfxAudio
    }

    if (typeof window === 'undefined' || typeof Audio === 'undefined') {
      return null
    }

    const audio = new Audio(GAMEOVER_SFX_SOURCE)
    audio.loop = false
    audio.preload = 'auto'
    audio.volume = 0.88
    this.gameoverSfxAudio = audio
    return audio
  }

  private tryStartBgm(): void {
    if (!this.musicEnabled || !this.bgmRunning) {
      return
    }
    if (this.isJsdomEnv()) {
      return
    }

    const audio = this.ensureBgmAudio()
    if (!audio || !audio.paused) {
      return
    }

    try {
      const maybePromise = audio.play()
      if (maybePromise && typeof maybePromise.catch === 'function') {
        void maybePromise.catch(() => {
          // 保留英文注释并补充中文：浏览器自动播放限制会拒绝本次播放，后续用户交互会再次触发。
        })
      }
    } catch {
      // 保留英文注释并补充中文：在不支持环境中静默降级，避免阻断主流程。
    }
  }

  private playGameoverSfx(): void {
    if (this.isJsdomEnv()) {
      return
    }

    const audio = this.ensureGameoverSfxAudio()
    if (!audio) {
      return
    }

    try {
      audio.currentTime = 0
      const maybePromise = audio.play()
      if (maybePromise && typeof maybePromise.catch === 'function') {
        void maybePromise.catch(() => {
          // 保留英文注释并补充中文：受自动播放策略限制时忽略异常，由下一次交互重试。
        })
      }
    } catch {
      // 保留英文注释并补充中文：不支持播放的运行环境直接跳过。
    }
  }

  private resolveSfxConfig(type: SfxType): {
    frequency: number
    durationMs: number
    volume: number
    wave: OscillatorType
  } {
    if (type === 'start') {
      return { frequency: 440, durationMs: 100, volume: 0.05, wave: 'triangle' }
    }

    if (type === 'countdown') {
      return { frequency: 520, durationMs: 70, volume: 0.04, wave: 'square' }
    }

    if (type === 'collision') {
      return { frequency: 180, durationMs: 180, volume: 0.08, wave: 'sawtooth' }
    }

    return { frequency: 360, durationMs: 50, volume: 0.03, wave: 'triangle' }
  }
}

/**
 * 对外暴露音频 Hook。
 * @param musicEnabled 背景音乐开关
 * @param sfxEnabled 音效开关
 * @returns 激活音频、播放音效、切换 BGM 运行态的控制函数
 */
export const useGameAudio = (musicEnabled: boolean, sfxEnabled: boolean) => {
  const engine = useMemo(() => new GameAudioEngine(), [])

  useEffect(() => {
    engine.setSettings(musicEnabled, sfxEnabled)
  }, [engine, musicEnabled, sfxEnabled])

  useEffect(() => {
    return () => {
      engine.destroy()
    }
  }, [engine])

  const activateAudio = useCallback(() => {
    engine.activate()
  }, [engine])

  const playSfx = useCallback((type: SfxType) => {
    engine.playSfx(type)
  }, [engine])

  const setBgmRunning = useCallback((running: boolean) => {
    engine.setBgmRunning(running)
  }, [engine])

  return {
    activateAudio,
    playSfx,
    setBgmRunning,
  }
}
