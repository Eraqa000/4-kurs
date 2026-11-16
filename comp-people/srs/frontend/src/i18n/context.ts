import { createContext, useContext } from 'react'
import type { Lang, MessageKey } from './messages'

export interface I18n {
  lang: Lang
  t: (key: MessageKey, vars?: Record<string, string | number>) => string
}

export const I18nContext = createContext<I18n | null>(null)

export function useI18n(): I18n {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n вне I18nProvider')
  return ctx
}
