import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useAudio } from '../../audio/audio'
import { useI18n } from '../../i18n/context'
import { useSettings } from '../settings/settings'
import { DEFAULT_DELAY_MS, IntroContext, introSrc, type IntroApi, type IntroPhase } from './intro'
import { IntroDialog } from './IntroDialog'

/**
 * Вступительная подсказка при каждом открытии и обновлении сайта: окно с текстом и
 * записанное заранее аудио (kk/ru). Через 3 секунды звук включается сам; Enter, Space или
 * Esc останавливают его и закрывают окно (в первые секунды — пропускают совсем).
 * Если браузер блокирует автозвук, запись начнётся с первого нажатия клавиши или касания.
 */
export function IntroProvider({
  children,
  delayMs = DEFAULT_DELAY_MS,
}: {
  children: ReactNode
  delayMs?: number
}) {
  const { lang } = useI18n()
  const { settings } = useSettings()
  const { setMuted, stop: stopSpeech } = useAudio()

  const autoplay = settings.introOnStart && settings.speakPrompts
  const [open, setOpen] = useState(settings.introOnStart)
  const [playing, setPlaying] = useState(false)
  const [blocked, setBlocked] = useState(false)
  const [pending, setPending] = useState(autoplay)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  const close = useCallback(() => {
    setOpen(false)
    setPending(false)
    // после закрытия фокус на заголовке страницы, а не на <body>
    setTimeout(() => document.querySelector<HTMLElement>('[data-page-title]')?.focus(), 0)
  }, [])

  const release = useCallback(() => {
    setPlaying(false)
    setMuted(false)
  }, [setMuted])

  const stopIfPlaying = useCallback(() => {
    const audio = audioRef.current
    if (!audio || audio.paused) return false
    audio.pause()
    audio.currentTime = 0
    release()
    return true
  }, [release])

  const play = useCallback(async () => {
    if (typeof Audio === 'undefined') return false
    audioRef.current?.pause()
    const audio = new Audio(introSrc(lang))
    audioRef.current = audio
    audio.onended = () => {
      // запись закончилась: окно закрывается само, чтобы не оставлять человека в диалоге
      release()
      close()
    }
    audio.onerror = release
    // пока играет запись, встроенный синтезатор молчит, чтобы голоса не накладывались
    stopSpeech()
    setMuted(true)
    try {
      await audio.play()
      setPlaying(true)
      setBlocked(false)
      setPending(false)
      return true
    } catch {
      release()
      return false
    }
  }, [lang, release, close, setMuted, stopSpeech])

  // Автозапуск через delayMs после открытия
  useEffect(() => {
    if (!open || !pending) return
    const timer = window.setTimeout(() => {
      void play().then((ok) => {
        if (!ok) {
          setBlocked(true)
          setPending(false)
        }
      })
    }, delayMs)
    return () => window.clearTimeout(timer)
  }, [open, pending, delayMs, play])

  // Автозвук запрещён браузером: запись стартует с первого нажатия (кроме Enter/Space/Esc,
  // они работают на кнопках окна) или касания вне кнопок
  useEffect(() => {
    if (!open || !blocked) return
    const start = (e: Event) => {
      if (e instanceof KeyboardEvent) {
        // Enter, Space и Esc работают на кнопках окна
        if (['Escape', 'Enter', ' '].includes(e.key)) return
      } else if (e.target instanceof Element && e.target.closest('button')) {
        return // клик по кнопке обрабатывает сама кнопка
      }
      void play()
    }
    window.addEventListener('keydown', start)
    window.addEventListener('pointerdown', start)
    return () => {
      window.removeEventListener('keydown', start)
      window.removeEventListener('pointerdown', start)
    }
  }, [open, blocked, play])

  // Смена языка во время звука: останавливаем, чтобы не говорить на старом языке
  const lastLang = useRef(lang)
  useEffect(() => {
    if (lastLang.current === lang) return
    lastLang.current = lang
    stopIfPlaying()
  }, [lang, stopIfPlaying])

  useEffect(
    () => () => {
      audioRef.current?.pause()
    },
    [],
  )

  const skip = useCallback(() => {
    stopIfPlaying()
    close()
  }, [stopIfPlaying, close])

  const replay = useCallback(() => {
    setOpen(true)
    void play()
  }, [play])

  const phase: IntroPhase = playing
    ? 'playing'
    : blocked
      ? 'blocked'
      : pending
        ? 'countdown'
        : 'idle'

  const value = useMemo<IntroApi>(
    () => ({ open, phase, replay, play: () => void play(), skip, stopIfPlaying }),
    [open, phase, replay, play, skip, stopIfPlaying],
  )

  return (
    <IntroContext.Provider value={value}>
      {children}
      {open && <IntroDialog />}
    </IntroContext.Provider>
  )
}
