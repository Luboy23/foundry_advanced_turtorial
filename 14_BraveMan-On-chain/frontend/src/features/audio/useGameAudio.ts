import { useCallback, useEffect, useMemo } from 'react'

export type SfxType = 'button' | 'attack' | 'death' | 'purchase' | 'start' | 'countdown'
const BGM_SOURCE = '/audio/wuxia-main.mp3'
const SFX_TYPES: readonly SfxType[] = ['button', 'attack', 'death', 'purchase', 'start', 'countdown']
const SFX_SOURCES: Record<SfxType, string> = {
  button: '/audio/button.mp3',
  attack: '/audio/attack.mp3',
  death: '/audio/death.mp3',
  purchase: '/audio/purchase.mp3',
  start: '/audio/start.mp3',
  countdown: '/audio/countdown.mp3',
}

/**
 * 游戏音频引擎：
 * - BGM 使用独立 Audio 元素并按运行态启停；
 * - SFX 优先读取 public/audio 下的真实音频文件；
 * - 若文件缺失或播放失败，则回退到原有 Web Audio 合成方案。
 */
class GameAudioEngine {
  private context: AudioContext | null = null
  private bgmAudio: HTMLAudioElement | null = null
  private screamNoiseBuffer: AudioBuffer | null = null
  private sfxTemplates = new Map<SfxType, HTMLAudioElement>()
  private activeSfx = new Set<HTMLAudioElement>()
  private musicEnabled = true
  private sfxEnabled = true
  private bgmRunning = false

  private isJsdomEnv(): boolean {
    return typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent)
  }

  // 激活音频上下文：首次创建，或从 suspended 恢复。
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
    this.primeSfxTemplates()
    this.tryStartBgm()
  }

  // 更新音频开关设置，供后续 BGM/SFX 判定使用。
  setSettings(musicEnabled: boolean, sfxEnabled: boolean): void {
    this.musicEnabled = musicEnabled
    this.sfxEnabled = sfxEnabled

    if (!musicEnabled) {
      this.stopBgm()
      return
    }

    this.tryStartBgm()
  }

  // 设置 BGM 运行态：running 时拉起背景音乐，其余状态保持静默。
  setBgmRunning(running: boolean): void {
    this.bgmRunning = running

    if (!running || !this.musicEnabled) {
      this.stopBgm()
      return
    }

    this.activate()
    this.tryStartBgm()
  }

  /**
   * 播放短 SFX。
   * 不同类型使用不同频率与时长参数，模拟按键/攻击/倒计时/开局/购买提示音。
   */
  playSfx(type: SfxType): void {
    if (!this.sfxEnabled) return

    this.activate()
    if (this.playSfxFromFile(type)) {
      return
    }

    this.playSynthFallback(type)
  }

  // 销毁音频上下文，通常在组件卸载时调用。
  destroy(): void {
    this.stopBgm()
    if (this.bgmAudio) {
      this.bgmAudio.src = ''
      if (!this.isJsdomEnv()) {
        this.bgmAudio.load()
      }
      this.bgmAudio = null
    }
    this.sfxTemplates.forEach((audio) => {
      audio.pause()
      audio.src = ''
      if (!this.isJsdomEnv()) {
        audio.load()
      }
    })
    this.sfxTemplates.clear()
    this.activeSfx.forEach((audio) => audio.pause())
    this.activeSfx.clear()
    this.screamNoiseBuffer = null

    if (this.context) {
      void this.context.close()
      this.context = null
    }
  }

  private stopBgm(): void {
    if (!this.bgmAudio || this.isJsdomEnv()) {
      return
    }

    this.bgmAudio.pause()
    this.bgmAudio.currentTime = 0
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
    audio.preload = 'metadata'
    audio.volume = 0.42
    this.bgmAudio = audio
    return audio
  }

  private primeSfxTemplates(): void {
    for (const type of SFX_TYPES) {
      this.ensureSfxTemplate(type)
    }
  }

  private ensureSfxTemplate(type: SfxType): HTMLAudioElement | null {
    const existing = this.sfxTemplates.get(type)
    if (existing) {
      return existing
    }

    if (typeof window === 'undefined' || typeof Audio === 'undefined') {
      return null
    }

    const audio = new Audio(SFX_SOURCES[type])
    audio.preload = 'metadata'
    audio.volume = this.resolveSfxVolume(type)
    this.sfxTemplates.set(type, audio)
    return audio
  }

  private tryStartBgm(): void {
    if (!this.musicEnabled || !this.bgmRunning || this.isJsdomEnv()) {
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
          // 浏览器自动播放被拒绝时静默重试，等待下一次用户交互激活。
        })
      }
    } catch {
      // 不支持环境下静默降级，避免影响主流程。
    }
  }

  private playSfxFromFile(type: SfxType): boolean {
    if (this.isJsdomEnv()) {
      return false
    }

    const template = this.ensureSfxTemplate(type)
    if (!template) {
      return false
    }

    const audio = new Audio(template.src)
    audio.preload = 'metadata'
    audio.volume = template.volume
    let fallbackTriggered = false
    const triggerFallback = () => {
      if (fallbackTriggered) return
      fallbackTriggered = true
      this.activeSfx.delete(audio)
      this.playSynthFallback(type)
    }
    const cleanup = () => {
      this.activeSfx.delete(audio)
    }

    audio.addEventListener('ended', cleanup, { once: true })
    audio.addEventListener('error', triggerFallback, { once: true })
    this.activeSfx.add(audio)

    try {
      const maybePromise = audio.play()
      if (maybePromise && typeof maybePromise.catch === 'function') {
        void maybePromise.catch(() => {
          triggerFallback()
        })
      }
      return true
    } catch {
      cleanup()
      return false
    }
  }

  private playSynthFallback(type: SfxType): void {
    if (type === 'death') {
      this.playGameoverSfx()
      return
    }

    if (!this.context) return

    const config = this.resolveSfxConfig(type)
    const oscillator = this.context.createOscillator()
    const gain = this.context.createGain()
    oscillator.connect(gain)
    gain.connect(this.context.destination)
    oscillator.type = config.wave
    oscillator.frequency.setValueAtTime(config.frequency, this.context.currentTime)
    gain.gain.setValueAtTime(config.volume, this.context.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.0001, this.context.currentTime + config.durationMs / 1000)
    oscillator.start()
    oscillator.stop(this.context.currentTime + config.durationMs / 1000)
  }

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

  private resolveSfxConfig(type: Exclude<SfxType, 'death'>): {
    frequency: number
    durationMs: number
    volume: number
    wave: OscillatorType
  } {
    if (type === 'attack') {
      return { frequency: 310, durationMs: 80, volume: 0.055, wave: 'triangle' }
    }

    if (type === 'start') {
      return { frequency: 440, durationMs: 100, volume: 0.05, wave: 'triangle' }
    }

    if (type === 'countdown') {
      return { frequency: 520, durationMs: 70, volume: 0.04, wave: 'square' }
    }

    if (type === 'purchase') {
      return { frequency: 560, durationMs: 140, volume: 0.075, wave: 'triangle' }
    }

    return { frequency: 420, durationMs: 60, volume: 0.04, wave: 'triangle' }
  }

  private resolveSfxVolume(type: SfxType): number {
    if (type === 'button') return 0.34
    if (type === 'attack') return 0.48
    if (type === 'death') return 0.58
    if (type === 'purchase') return 0.42
    if (type === 'start') return 0.44
    return 0.36
  }
}

/**
 * React Hook：封装 GameAudioEngine 的生命周期与稳定回调。
 */
export const useGameAudio = (musicEnabled: boolean, sfxEnabled: boolean) => {
  // useMemo 保证引擎实例在组件生命周期内稳定复用。
  const engine = useMemo(() => new GameAudioEngine(), [])

  useEffect(() => {
    // 设置变化时同步引擎开关。
    engine.setSettings(musicEnabled, sfxEnabled)
  }, [engine, musicEnabled, sfxEnabled])

  // 卸载时释放音频上下文，防止资源泄露。
  useEffect(() => () => engine.destroy(), [engine])

  return {
    activateAudio: useCallback(() => engine.activate(), [engine]),
    playSfx: useCallback((type: SfxType) => engine.playSfx(type), [engine]),
    setBgmRunning: useCallback((running: boolean) => engine.setBgmRunning(running), [engine]),
  }
}
