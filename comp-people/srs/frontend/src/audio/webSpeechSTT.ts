import type { ListenOptions, STTProvider } from './types'

// В lib.dom нет типов SpeechRecognition — описываем только то, что используем
interface SpeechRecognition {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((e: SpeechRecognitionEvent) => void) | null
  onerror: ((e: SpeechRecognitionErrorEvent) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
}

// В Chrome/Safari конструктор доступен с префиксом webkit
type RecognitionCtor = new () => SpeechRecognition

function getCtor(): RecognitionCtor | undefined {
  if (typeof window === 'undefined') return undefined
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor
    webkitSpeechRecognition?: RecognitionCtor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition
}

/** STT на базе Web Speech API. Один короткий запрос за раз (без непрерывного прослушивания). */
export class WebSpeechSTT implements STTProvider {
  private recognition?: SpeechRecognition

  get supported(): boolean {
    return Boolean(getCtor())
  }

  start({ lang, onResult, onError, onEnd }: ListenOptions): void {
    const Ctor = getCtor()
    if (!Ctor) {
      onError('not-supported')
      onEnd()
      return
    }
    this.stop()
    const rec = new Ctor()
    rec.lang = lang
    rec.continuous = false
    rec.interimResults = false
    rec.onresult = (e: SpeechRecognitionEvent) => {
      const text = e.results[e.results.length - 1]?.[0]?.transcript
      if (text) onResult(text)
    }
    rec.onerror = (e: SpeechRecognitionErrorEvent) => onError(e.error)
    rec.onend = () => {
      this.recognition = undefined
      onEnd()
    }
    this.recognition = rec
    rec.start()
  }

  stop(): void {
    this.recognition?.stop()
  }
}
