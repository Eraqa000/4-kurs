import { createContext, useContext } from 'react'
import type { Lang } from '../../i18n/messages'

export interface Settings {
  language: Lang
  highContrast: boolean
  fontScale: number // процент: 100-200
  speechRate: number // 0.5-2
  reduceMotion: boolean
  hotkeysEnabled: boolean
  /** озвучка подсказок интерфейса встроенным синтезатором (выключить, если есть screen reader) */
  speakPrompts: boolean
  /** вступительная подсказка с аудио при первом открытии сайта за сессию */
  introOnStart: boolean
}

export const defaultSettings: Settings = {
  language: 'kk',
  highContrast: false,
  fontScale: 100,
  speechRate: 1,
  // по умолчанию уважаем системную настройку prefers-reduced-motion
  reduceMotion:
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false,
  hotkeysEnabled: true,
  speakPrompts: true,
  // в тестах вступление выключено по умолчанию; тесты вступления включают его явно
  introOnStart: import.meta.env.MODE !== 'test',
}

export interface SettingsContextValue {
  settings: Settings
  update: <K extends keyof Settings>(key: K, value: Settings[K]) => void
}

export const SettingsContext = createContext<SettingsContextValue | null>(null)

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings вне SettingsProvider')
  return ctx
}
