import { createContext, useContext, useEffect, useRef } from 'react'
import type { Command, CommandHandler } from './types'

export interface AudioApi {
  ttsSupported: boolean
  sttSupported: boolean
  /** Для выбранного языка нет голоса — говорим запасным (русским) */
  ttsLangFallback: boolean
  speaking: boolean
  paused: boolean
  listening: boolean
  /** Последняя распознанная или введённая фраза */
  lastHeard: string
  /** Пока true, встроенный синтезатор молчит (идёт записанное вступление). Фраза запоминается для R */
  setMuted: (muted: boolean) => void
  speak: (text: string) => void
  /** Повторить последнюю озвученную фразу (клавиша R) */
  repeat: () => void
  /** Esc: речь идёт → пауза; на паузе → остановка */
  pauseOrStop: () => void
  stop: () => void
  toggleListening: () => void
  /** Разобрать фразу (голос или текст) и выполнить команду */
  handleText: (text: string) => void
  /** fallback: общий обработчик, который уступает обработчику текущей страницы */
  /** Обработчик ответа на задание: получает фразу раньше команд, true — фраза использована */
  registerAnswer: (handler: (text: string) => boolean) => () => void
  register: (
    command: Command,
    handler: CommandHandler,
    options?: { fallback?: boolean },
  ) => () => void
}

export const AudioContext = createContext<AudioApi | null>(null)

export function useAudio(): AudioApi {
  const ctx = useContext(AudioContext)
  if (!ctx) throw new Error('useAudio вне AudioProvider')
  return ctx
}

/** Подписка компонента на голосовую команду на время его жизни. */
/** Подписка на свободные ответы (задания в уроках). */
export function useVoiceAnswer(handler: (text: string) => boolean) {
  const { registerAnswer } = useAudio()
  const ref = useRef(handler)
  useEffect(() => {
    ref.current = handler
  })
  useEffect(() => registerAnswer((text) => ref.current(text)), [registerAnswer])
}

export function useVoiceCommand(
  command: Command,
  handler: CommandHandler,
  options?: { fallback?: boolean },
) {
  const { register } = useAudio()
  const ref = useRef(handler)
  useEffect(() => {
    ref.current = handler
  })
  const fallback = options?.fallback
  useEffect(
    () => register(command, (args) => ref.current(args), { fallback }),
    [register, command, fallback],
  )
}
