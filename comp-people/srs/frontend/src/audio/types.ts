export interface SpeakOptions {
  lang: string // BCP 47: kk-KZ, ru-RU
  rate: number
  onStart?: () => void
  onEnd?: () => void
}

/** Адаптер синтеза речи. Реализации заменяемы (Web Speech, облачный провайдер). */
export interface TTSProvider {
  readonly supported: boolean
  /** Есть ли голос для языка (для казахского часто нет) */
  hasVoice(lang: string): boolean
  speak(text: string, options: SpeakOptions): void
  pause(): void
  resume(): void
  stop(): void
}

export interface ListenOptions {
  lang: string
  onResult: (text: string) => void
  onError: (code: string) => void
  onEnd: () => void
}

/** Адаптер распознавания речи. */
export interface STTProvider {
  readonly supported: boolean
  start(options: ListenOptions): void
  stop(): void
}

export type Command = 'create' | 'listen' | 'repeat' | 'back' | 'save' | 'next'
export type CommandHandler = (args: string) => void
