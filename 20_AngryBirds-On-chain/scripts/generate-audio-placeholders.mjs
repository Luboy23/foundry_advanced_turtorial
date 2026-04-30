import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')
const audioRoot = path.join(projectRoot, 'frontend', 'public', 'audio')

const SAMPLE_RATE = 44_100

const clampSample = (value) => Math.max(-1, Math.min(1, value))
const softClip = (value) => Math.tanh(value * 1.35)

const writeMonoWav = (filePath, samples, sampleRate = SAMPLE_RATE) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })

  const bytesPerSample = 2
  const dataSize = samples.length * bytesPerSample
  const buffer = Buffer.alloc(44 + dataSize)

  buffer.write('RIFF', 0)
  buffer.writeUInt32LE(36 + dataSize, 4)
  buffer.write('WAVE', 8)
  buffer.write('fmt ', 12)
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(1, 20)
  buffer.writeUInt16LE(1, 22)
  buffer.writeUInt32LE(sampleRate, 24)
  buffer.writeUInt32LE(sampleRate * bytesPerSample, 28)
  buffer.writeUInt16LE(bytesPerSample, 32)
  buffer.writeUInt16LE(16, 34)
  buffer.write('data', 36)
  buffer.writeUInt32LE(dataSize, 40)

  for (let index = 0; index < samples.length; index += 1) {
    buffer.writeInt16LE(Math.round(clampSample(samples[index]) * 32_767), 44 + index * bytesPerSample)
  }

  fs.writeFileSync(filePath, buffer)
}

const renderClip = (durationSeconds, sampleFn, sampleRate = SAMPLE_RATE) => {
  const frameCount = Math.floor(durationSeconds * sampleRate)
  return Array.from({ length: frameCount }, (_, frame) => sampleFn(frame / sampleRate, frame, sampleRate))
}

const pseudoNoise = (frame, seed) => {
  const raw = Math.sin((frame + 1) * (12.9898 + seed * 78.233)) * 43_758.5453
  return (raw - Math.floor(raw)) * 2 - 1
}

const triangleWave = (frequency, time) => 2 * Math.abs(2 * ((time * frequency) % 1) - 1) - 1

const noteToFrequency = (semitonesFromA4) => 440 * 2 ** (semitonesFromA4 / 12)

const generateMenuLoop = () =>
  renderClip(16, (time, frame) => {
    const bpm = 94
    const beat = 60 / bpm
    const bar = beat * 4
    const progression = [
      [-9, -5, -2],
      [-14, -10, -7],
      [-16, -12, -9],
      [-11, -7, -4],
    ]
    const barIndex = Math.floor(time / bar) % progression.length
    const chord = progression[barIndex]
    const barTime = time % bar
    const beatTime = time % beat
    const eighth = beat / 2
    const eighthIndex = Math.floor(time / eighth) % 8
    const arpNote = chord[eighthIndex % chord.length]

    const pad =
      chord.reduce((sum, semitone) => {
        const frequency = noteToFrequency(semitone - 5)
        return sum + Math.sin(2 * Math.PI * frequency * time) * 0.05
      }, 0) *
      (0.72 + Math.sin(time * 0.34) * 0.08)

    const bassFrequency = noteToFrequency(chord[0] - 17)
    const bassEnvelope = Math.exp(-beatTime * 1.9)
    const bass =
      (Math.sin(2 * Math.PI * bassFrequency * time) * 0.18 +
        triangleWave(bassFrequency / 2, time) * 0.05) *
      bassEnvelope

    const arpFrequency = noteToFrequency(arpNote + 3)
    const arpTime = time % eighth
    const arpEnvelope = Math.max(0, 1 - arpTime / (eighth * 0.92)) ** 1.9
    const arp =
      (Math.sin(2 * Math.PI * arpFrequency * time) * 0.14 +
        Math.sin(2 * Math.PI * arpFrequency * 2 * time) * 0.03) *
      arpEnvelope

    const kick =
      (Math.sin(2 * Math.PI * (118 - beatTime * 90) * beatTime) * 0.22 +
        pseudoNoise(frame, 0.12) * 0.03) *
      Math.exp(-beatTime * 10.5)

    const snareGate = (Math.floor(time / beat) % 4) === 1 || (Math.floor(time / beat) % 4) === 3
    const snare = snareGate
      ? pseudoNoise(frame, 0.22) * Math.exp(-beatTime * 17) * 0.05
      : 0

    const shakerTime = time % (beat / 4)
    const shaker = pseudoNoise(frame, 0.31) * Math.exp(-shakerTime * 28) * 0.02

    return softClip(pad + bass + arp + kick + snare + shaker) * 0.9
  })

const generateClick = () =>
  renderClip(0.11, (time) => {
    const decay = Math.exp(-time * 34)
    const frequency = 980 - time * 180
    const tone = Math.sin(2 * Math.PI * frequency * time)
    const overtone = Math.sin(2 * Math.PI * frequency * 1.8 * time) * 0.35
    return (tone + overtone) * decay * 0.32
  })

const generateUiOpen = () =>
  renderClip(0.16, (time) => {
    const decay = Math.exp(-time * 18)
    const toneA = Math.sin(2 * Math.PI * (640 + time * 980) * time)
    const toneB = Math.sin(2 * Math.PI * (980 + time * 620) * time) * 0.45
    return (toneA + toneB) * decay * 0.26
  })

const generateUiClose = () =>
  renderClip(0.17, (time) => {
    const decay = Math.exp(-time * 18)
    const toneA = Math.sin(2 * Math.PI * (940 - time * 620) * time)
    const toneB = Math.sin(2 * Math.PI * (620 - time * 240) * time) * 0.38
    return (toneA + toneB) * decay * 0.24
  })

const generateLaunch = () =>
  renderClip(0.22, (time, frame) => {
    const decay = Math.exp(-time * 12)
    const twang = triangleWave(240 + time * 120, time) * 0.15
    const sweep = Math.sin(2 * Math.PI * (720 - time * 420) * time) * 0.12
    const noise = pseudoNoise(frame, 0.17) * Math.exp(-time * 9) * 0.08
    return softClip((twang + sweep + noise) * decay)
  })

const generateBreakPig = () =>
  renderClip(0.18, (time, frame) => {
    const decay = Math.exp(-time * 14)
    const pop = Math.sin(2 * Math.PI * (340 - time * 180) * time) * 0.26
    const air = pseudoNoise(frame, 0.51) * 0.08
    return softClip((pop + air) * decay)
  })

const renderNoteSequence = (notes, stepLength, amplitude = 0.28) =>
  renderClip(notes.length * stepLength + 0.2, (time) => {
    const stepIndex = Math.floor(time / stepLength)
    if (stepIndex >= notes.length) {
      return 0
    }

    const noteTime = time - stepIndex * stepLength
    const envelope = Math.max(0, 1 - noteTime / (stepLength * 0.92)) ** 1.6
    const frequency = noteToFrequency(notes[stepIndex])
    const lead = Math.sin(2 * Math.PI * frequency * time)
    const harmony = Math.sin(2 * Math.PI * frequency * 2 * time) * 0.28
    return (lead + harmony) * envelope * amplitude
  })

const generateClearJingle = () => renderNoteSequence([0, 4, 7, 12], 0.18, 0.26)

const generateFailJingle = () => renderNoteSequence([0, -2, -5, -9], 0.2, 0.24)

writeMonoWav(path.join(audioRoot, 'music', 'bgm-menu-field-of-dreams.wav'), generateMenuLoop())
writeMonoWav(path.join(audioRoot, 'ui', 'ui-click-01.wav'), generateClick())
writeMonoWav(path.join(audioRoot, 'ui', 'ui-open-01.wav'), generateUiOpen())
writeMonoWav(path.join(audioRoot, 'ui', 'ui-close-01.wav'), generateUiClose())
writeMonoWav(path.join(audioRoot, 'gameplay', 'launch-01.wav'), generateLaunch())
writeMonoWav(path.join(audioRoot, 'impact', 'break-pig-01.wav'), generateBreakPig())
writeMonoWav(path.join(audioRoot, 'music', 'jingle-clear-01.wav'), generateClearJingle())
writeMonoWav(path.join(audioRoot, 'music', 'jingle-fail-01.wav'), generateFailJingle())

console.log('Generated authored audio assets in frontend/public/audio')
