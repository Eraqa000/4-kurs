import type { SpeakOptions, TTSProvider } from './types'

/** TTS на базе браузерного speechSynthesis (бесплатно, без ключа). */
export class WebSpeechTTS implements TTSProvider {
  private get synth(): SpeechSynthesis | undefined {
    return typeof window !== 'undefined' ? window.speechSynthesis : undefined
  }

  get supported(): boolean {
    return Boolean(this.synth) && typeof SpeechSynthesisUtterance !== 'undefined'
  }

  private voiceFor(lang: string): SpeechSynthesisVoice | undefined {
    const prefix = lang.slice(0, 2).toLowerCase()
    return this.synth?.getVoices().find((v) => v.lang.toLowerCase().startsWith(prefix))
  }

  hasVoice(lang: string): boolean {
    return Boolean(this.voiceFor(lang))
  }

  speak(text: string, { lang, rate, onStart, onEnd }: SpeakOptions): void {
    if (!this.supported) return
    this.synth!.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = lang
    utterance.rate = rate
    const voice = this.voiceFor(lang)
    if (voice) utterance.voice = voice
    utterance.onstart = () => onStart?.()
    utterance.onend = () => onEnd?.()
    utterance.onerror = () => onEnd?.()
    this.synth!.speak(utterance)
  }

  pause(): void {
    this.synth?.pause()
  }

  resume(): void {
    this.synth?.resume()
  }

  stop(): void {
    this.synth?.cancel()
  }
}
