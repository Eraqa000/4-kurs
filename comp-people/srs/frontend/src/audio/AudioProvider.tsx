import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useAnnounce } from '../a11y/announcer'
import { useSettings } from '../features/settings/settings'
import { useI18n } from '../i18n/context'
import { AudioContext, type AudioApi } from './audio'
import { parseCommand } from './commands'
import type { Command, CommandHandler, STTProvider, TTSProvider } from './types'
import { WebSpeechSTT } from './webSpeechSTT'
import { WebSpeechTTS } from './webSpeechTTS'

const LOCALES = { kk: 'kk-KZ', ru: 'ru-RU' } as const

interface Props {
  children: ReactNode
  tts?: TTSProvider
  stt?: STTProvider
}

export function AudioProvider({ children, tts: ttsProp, stt: sttProp }: Props) {
  const { t, lang } = useI18n()
  const { settings } = useSettings()
  const announce = useAnnounce()

  const [tts] = useState<TTSProvider>(() => ttsProp ?? new WebSpeechTTS())
  const [stt] = useState<STTProvider>(() => sttProp ?? new WebSpeechSTT())
  const [speaking, setSpeaking] = useState(false)
  const [paused, setPaused] = useState(false)
  const [listening, setListening] = useState(false)
  const [lastHeard, setLastHeard] = useState('')
  // голоса в браузере подгружаются асинхронно — перерисовываемся, когда список готов
  const [voicesVersion, setVoicesVersion] = useState(0)

  const lastSpoken = useRef('')
  const muted = useRef(false)
  // обработчики страницы важнее общих (fallback), порядок монтирования не влияет
  const handlers = useRef(new Map<Command, CommandHandler>())
  const fallbacks = useRef(new Map<Command, CommandHandler>())
  const answerHandler = useRef<((text: string) => boolean) | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return
    const synth = window.speechSynthesis
    const onChange = () => setVoicesVersion((v) => v + 1)
    synth.addEventListener?.('voiceschanged', onChange)
    return () => synth.removeEventListener?.('voiceschanged', onChange)
  }, [])

  // Если для казахского нет голоса, говорим по-русски: текст всё равно будет услышан
  const ttsLangFallback = useMemo(
    () => tts.supported && lang === 'kk' && !tts.hasVoice(LOCALES.kk),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tts, lang, voicesVersion],
  )
  const speechLocale = ttsLangFallback ? LOCALES.ru : LOCALES[lang]

  const speak = useCallback(
    (text: string) => {
      if (!tts.supported || !text) return
      lastSpoken.current = text
      if (muted.current) return
      setPaused(false)
      tts.speak(text, {
        lang: speechLocale,
        rate: settings.speechRate,
        onStart: () => setSpeaking(true),
        onEnd: () => {
          setSpeaking(false)
          setPaused(false)
        },
      })
    },
    [tts, speechLocale, settings.speechRate],
  )

  const setMuted = useCallback(
    (value: boolean) => {
      muted.current = value
      if (value) tts.stop()
    },
    [tts],
  )

  const repeat = useCallback(() => {
    if (lastSpoken.current) speak(lastSpoken.current)
  }, [speak])

  const stop = useCallback(() => {
    tts.stop()
    setSpeaking(false)
    setPaused(false)
  }, [tts])

  const pauseOrStop = useCallback(() => {
    if (!speaking) return
    if (paused) {
      stop()
    } else {
      tts.pause()
      setPaused(true)
    }
  }, [speaking, paused, tts, stop])

  const register = useCallback(
    (command: Command, handler: CommandHandler, options?: { fallback?: boolean }) => {
      const map = options?.fallback ? fallbacks.current : handlers.current
      map.set(command, handler)
      return () => {
        if (map.get(command) === handler) map.delete(command)
      }
    },
    [],
  )

  const registerAnswer = useCallback((handler: (text: string) => boolean) => {
    answerHandler.current = handler
    return () => {
      if (answerHandler.current === handler) answerHandler.current = null
    }
  }, [])

  const handleText = useCallback(
    (text: string) => {
      setLastHeard(text)
      // Сначала задание: ответ может случайно содержать слово-команду
      if (answerHandler.current?.(text)) return
      const parsed = parseCommand(text)
      if (!parsed) {
        // Фраза без команды — это описание картинки («кот на крыше»): рисуем по ней.
        // Слишком короткий шум распознавания («э», «м») за запрос не считаем.
        const prompt = text.trim()
        const create = handlers.current.get('create') ?? fallbacks.current.get('create')
        if (create && prompt.length >= 3) {
          create(prompt)
          return
        }
        const msg = t('voice.unknown', { text })
        announce(msg)
        speak(msg)
        return
      }
      const handler =
        handlers.current.get(parsed.command) ??
        fallbacks.current.get(parsed.command) ??
        (parsed.command === 'repeat' ? repeat : undefined)
      if (handler) {
        handler(parsed.args)
      } else {
        const msg = t('voice.unavailable')
        announce(msg)
        speak(msg)
      }
    },
    [t, announce, speak, repeat],
  )

  const toggleListening = useCallback(() => {
    if (listening) {
      stt.stop()
      return
    }
    if (!stt.supported) return
    // пока слушаем, собственную речь останавливаем, чтобы микрофон не ловил синтезатор
    stop()
    setListening(true)
    announce(t('voice.listening'))
    stt.start({
      lang: LOCALES[lang],
      onResult: handleText,
      onError: (code) => {
        const msg = code === 'no-speech' ? t('voice.noSpeech') : t('voice.error')
        announce(msg, 'assertive')
        speak(msg)
      },
      onEnd: () => setListening(false),
    })
  }, [listening, stt, stop, announce, t, lang, handleText, speak])

  // Ресурсы освобождаем при выходе
  useEffect(
    () => () => {
      tts.stop()
      stt.stop()
    },
    [tts, stt],
  )

  const value = useMemo<AudioApi>(
    () => ({
      ttsSupported: tts.supported,
      sttSupported: stt.supported,
      ttsLangFallback,
      speaking,
      paused,
      listening,
      lastHeard,
      setMuted,
      speak,
      repeat,
      pauseOrStop,
      stop,
      toggleListening,
      handleText,
      register,
      registerAnswer,
    }),
    [
      tts,
      stt,
      ttsLangFallback,
      speaking,
      paused,
      listening,
      lastHeard,
      setMuted,
      speak,
      repeat,
      pauseOrStop,
      stop,
      toggleListening,
      handleText,
      register,
      registerAnswer,
    ],
  )

  return <AudioContext.Provider value={value}>{children}</AudioContext.Provider>
}
