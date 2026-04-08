/**
 * 游戏音频 Hook。
 * React 只负责驱动开关和生命周期，具体 Web Audio / HTMLAudio 细节收口在引擎类里。
 */
import { useCallback, useEffect, useMemo } from 'react'

type SfxType = 'start' | 'countdown' | 'collision' | 'button'
const BGM_SOURCE = '/audio/wuxia-main.mp3'

class GameAudioEngine {
  private context: AudioContext | null = null
  private bgmAudio: HTMLAudioElement | null = null
  private screamNoiseBuffer: AudioBuffer | null = null

  private musicEnabled = true
  private sfxEnabled = true
  private bgmRunning = false

  // jsdom 下很多音频 API 都是半实现，测试环境需要主动绕开。
  private isJsdomEnv(): boolean {
    return typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent)
  }

  // 首次用户交互后再激活音频上下文，兼容浏览器自动播放限制。
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
    this.tryStartBgm()
  }

  // UI 设置切换只更新开关，不直接负责管理页面生命周期。
  setSettings(musicEnabled: boolean, sfxEnabled: boolean): void {
    this.musicEnabled = musicEnabled
    this.sfxEnabled = sfxEnabled

    if (!musicEnabled) {
      this.stopBgm()
      return
    }

    this.tryStartBgm()
  }

  // 游戏进入 running 才真正拉起 BGM，菜单和结算态默认保持静默。
  setBgmRunning(running: boolean): void {
    this.bgmRunning = running

    if (!running || !this.musicEnabled) {
      this.stopBgm()
      return
    }

    this.activate()
    this.tryStartBgm()
  }

  // 简单音效直接用振荡器合成，避免为少量提示音引入额外音频资源。
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

  // React 卸载时统一回收 AudioContext / Audio 元素，避免热重载残留。
  destroy(): void {
    this.stopBgm()
    if (this.bgmAudio) {
      this.bgmAudio.src = ''
      if (!this.isJsdomEnv()) {
        this.bgmAudio.load()
      }
      this.bgmAudio = null
    }
    this.screamNoiseBuffer = null

    if (this.context) {
      void this.context.close()
      this.context = null
    }
  }

  // 停止 BGM 时把时间归零，确保下一局从片头重新开始。
  private stopBgm(): void {
    if (this.bgmAudio) {
      if (!this.isJsdomEnv()) {
        this.bgmAudio.pause()
        this.bgmAudio.currentTime = 0
      }
    }
  }

  // HTMLAudio 只初始化一次，后续播放/暂停都复用同一元素。
  private ensureBgmAudio(): HTMLAudioElement | null {
    if (this.bgmAudio) {
      return this.bgmAudio
    }

    if (typeof window === 'undefined' || typeof Audio === 'undefined') {
      return null
    }

    const audio = new Audio(BGM_SOURCE)
    audio.loop = true
    audio.preload = 'metadata'
    audio.volume = 0.42
    this.bgmAudio = audio
    return audio
  }

  // 自动播放失败不视为错误，等待下一次点击/触控重新激活即可。
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
          // 浏览器自动播放被拒绝时不报错，等待下一次用户交互再重试。
        })
      }
    } catch {
      // 在不支持的环境里静默失败，避免把音频问题升级成主流程错误。
    }
  }

  // 结算音效使用更夸张的合成方案，与普通提示音区分开。
  private playGameoverSfx(): void {
    if (this.isJsdomEnv()) {
      return
    }
    this.activate()
    if (!this.context) {
      return
    }

    this.playScreamLikeGameOver(this.context)
  }

  // 死亡音效不依赖素材文件，而是用振荡器 + 噪声实时合成“惨叫感”。
  private playScreamLikeGameOver(context: AudioContext): void {
    const now = context.currentTime
    const durationSec = 0.82
    const endAt = now + durationSec

    const masterGain = context.createGain()
    masterGain.gain.setValueAtTime(0.0001, now)
    masterGain.gain.exponentialRampToValueAtTime(0.18, now + 0.04)
    masterGain.gain.exponentialRampToValueAtTime(0.11, now + 0.24)
    masterGain.gain.exponentialRampToValueAtTime(0.0001, endAt)
    masterGain.connect(context.destination)

    const bandPass = context.createBiquadFilter()
    bandPass.type = 'bandpass'
    bandPass.frequency.setValueAtTime(1900, now)
    bandPass.frequency.exponentialRampToValueAtTime(760, endAt)
    bandPass.Q.setValueAtTime(6.5, now)
    bandPass.connect(masterGain)

    const lead = context.createOscillator()
    lead.type = 'sawtooth'
    lead.frequency.setValueAtTime(980, now)
    lead.frequency.exponentialRampToValueAtTime(260, endAt)
    lead.connect(bandPass)

    const layer = context.createOscillator()
    layer.type = 'triangle'
    layer.frequency.setValueAtTime(700, now)
    layer.frequency.exponentialRampToValueAtTime(180, endAt)
    const layerGain = context.createGain()
    layerGain.gain.setValueAtTime(0.42, now)
    layer.connect(layerGain)
    layerGain.connect(bandPass)

    const vibrato = context.createOscillator()
    vibrato.type = 'sine'
    vibrato.frequency.setValueAtTime(16, now)
    const vibratoGain = context.createGain()
    vibratoGain.gain.setValueAtTime(34, now)
    vibrato.connect(vibratoGain)
    vibratoGain.connect(lead.detune)
    vibratoGain.connect(layer.detune)

    const noiseBuffer = this.ensureScreamNoiseBuffer(context, durationSec)
    if (noiseBuffer) {
      const noise = context.createBufferSource()
      noise.buffer = noiseBuffer
      const noiseFilter = context.createBiquadFilter()
      noiseFilter.type = 'highpass'
      noiseFilter.frequency.setValueAtTime(980, now)
      const noiseGain = context.createGain()
      noiseGain.gain.setValueAtTime(0.05, now)
      noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45)
      noise.connect(noiseFilter)
      noiseFilter.connect(noiseGain)
      noiseGain.connect(masterGain)
      noise.start(now)
      noise.stop(now + 0.48)
    }

    lead.start(now)
    layer.start(now)
    vibrato.start(now)
    lead.stop(endAt)
    layer.stop(endAt)
    vibrato.stop(endAt)
  }

  // 噪声缓存只生成一次，后续复用，避免每次死亡都重新分配大块音频数据。
  private ensureScreamNoiseBuffer(context: AudioContext, durationSec: number): AudioBuffer | null {
    if (this.screamNoiseBuffer) {
      return this.screamNoiseBuffer
    }

    try {
      const frameCount = Math.max(1, Math.floor(context.sampleRate * durationSec))
      const buffer = context.createBuffer(1, frameCount, context.sampleRate)
      const channelData = buffer.getChannelData(0)
      for (let index = 0; index < frameCount; index += 1) {
        const progress = index / frameCount
        channelData[index] = (Math.random() * 2 - 1) * (1 - progress * 0.9)
      }
      this.screamNoiseBuffer = buffer
      return buffer
    } catch {
      return null
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
