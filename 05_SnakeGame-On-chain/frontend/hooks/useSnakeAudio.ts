import { useCallback, useEffect, useRef, useState } from 'react'

type AudioStatus = {
  running: boolean
  isPaused: boolean
  isLost: boolean
  countDown: number
}

type SfxType = 'start' | 'eat' | 'gameover' | 'toggle' | 'countdown'

// 贪吃蛇音频 Hook：统一处理 BGM 与音效
export const useSnakeAudio = ({
  running,
  isPaused,
  isLost,
  countDown,
}: AudioStatus) => {
  const [musicEnabled, setMusicEnabled] = useState(true)
  const [sfxEnabled, setSfxEnabled] = useState(true)
  const audioContextRef = useRef<AudioContext | null>(null)
  const musicTimerRef = useRef<number | null>(null)
  const musicNoteIndexRef = useRef(0)
  const hasInteractedRef = useRef(false)

  // 初始化并缓存 AudioContext（首次需要用户交互）
  const ensureAudioContext = useCallback(() => {
    if (typeof window === 'undefined') return null
    if (!audioContextRef.current) {
      const AudioContextConstructor =
        window.AudioContext ||
        (
          window as typeof window & {
            webkitAudioContext?: typeof AudioContext
          }
        ).webkitAudioContext
      if (!AudioContextConstructor) return null
      audioContextRef.current = new AudioContextConstructor()
    }
    return audioContextRef.current
  }, [])

  // 恢复被浏览器挂起的 AudioContext
  const resumeAudioContext = useCallback(() => {
    const ctx = ensureAudioContext()
    if (ctx && ctx.state === 'suspended') {
      void ctx.resume()
    }
    return ctx
  }, [ensureAudioContext])

  // 使用振荡器播放指定频率的短音
  const playTone = useCallback(
    (
      frequency: number,
      duration: number,
      type: OscillatorType,
      volume: number,
      startAt = 0
    ) => {
      const ctx = resumeAudioContext()
      if (!ctx) return
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = type
      osc.frequency.value = frequency
      gain.gain.value = volume
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(ctx.currentTime + startAt)
      osc.stop(ctx.currentTime + startAt + duration)
    },
    [resumeAudioContext]
  )

  // 启动简单旋律循环作为背景音乐
  const startMusicLoop = useCallback(() => {
    if (musicTimerRef.current !== null) return
    const melody = [523, 659, 784, 659, 523, 659, 784, 880]
    playTone(melody[0], 0.22, 'triangle', 0.03)
    musicNoteIndexRef.current = 1
    musicTimerRef.current = window.setInterval(() => {
      const index = musicNoteIndexRef.current
      const note = melody[index % melody.length]
      playTone(note, 0.22, 'triangle', 0.03)
      musicNoteIndexRef.current = index + 1
    }, 360)
  }, [playTone])

  // 停止背景音乐循环
  const stopMusicLoop = useCallback(() => {
    if (musicTimerRef.current !== null) {
      window.clearInterval(musicTimerRef.current)
      musicTimerRef.current = null
    }
  }, [])

  // 播放短音效（受设置开关控制）
  const playSfx = useCallback(
    (type: SfxType) => {
      if (!sfxEnabled) return
      switch (type) {
        case 'start':
          playTone(523, 0.1, 'square', 0.08)
          playTone(659, 0.12, 'square', 0.08, 0.12)
          break
        case 'eat':
          playTone(784, 0.08, 'square', 0.07)
          break
        case 'gameover':
          playTone(392, 0.2, 'sawtooth', 0.08)
          playTone(330, 0.22, 'sawtooth', 0.08, 0.2)
          break
        case 'countdown':
          playTone(880, 0.08, 'square', 0.06)
          break
        case 'toggle':
          playTone(880, 0.05, 'square', 0.05)
          break
        default:
          break
      }
    },
    [playTone, sfxEnabled]
  )

  // 标记用户交互并解锁音频播放
  const handleUserInteraction = useCallback(() => {
    hasInteractedRef.current = true
    resumeAudioContext()
  }, [resumeAudioContext])

  useEffect(() => {
    if (countDown > 0 && countDown < 4) {
      playSfx('countdown')
    }
  }, [countDown, playSfx])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const stored = localStorage.getItem('audio-settings')
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as {
          music?: boolean
          sfx?: boolean
        }
        if (typeof parsed.music === 'boolean') setMusicEnabled(parsed.music)
        if (typeof parsed.sfx === 'boolean') setSfxEnabled(parsed.sfx)
      } catch {
        // 忽略无效的本地设置
      }
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    localStorage.setItem(
      'audio-settings',
      JSON.stringify({ music: musicEnabled, sfx: sfxEnabled })
    )
  }, [musicEnabled, sfxEnabled])

  useEffect(() => {
    const shouldPlayMusic =
      musicEnabled &&
      hasInteractedRef.current &&
      running &&
      !isPaused &&
      !isLost &&
      countDown === 0
    if (shouldPlayMusic) {
      startMusicLoop()
    } else {
      stopMusicLoop()
    }
  }, [countDown, isLost, isPaused, musicEnabled, running, startMusicLoop, stopMusicLoop])

  useEffect(() => {
    return () => {
      stopMusicLoop()
    }
  }, [stopMusicLoop])

  return {
    musicEnabled,
    setMusicEnabled,
    sfxEnabled,
    setSfxEnabled,
    playSfx,
    handleUserInteraction,
  }
}
