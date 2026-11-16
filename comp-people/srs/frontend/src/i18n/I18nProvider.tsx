import { useCallback, useEffect, useMemo, type ReactNode } from 'react'
import { I18nContext } from './context'
import { messages, type Lang, type MessageKey } from './messages'

export function I18nProvider({ lang, children }: { lang: Lang; children: ReactNode }) {
  // Язык документа важен для screen reader: от него зависит голос синтезатора
  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  const t = useCallback(
    (key: MessageKey, vars?: Record<string, string | number>) => {
      let text: string = messages[lang][key]
      for (const [name, value] of Object.entries(vars ?? {})) {
        text = text.replace(`{${name}}`, String(value))
      }
      return text
    },
    [lang],
  )

  const value = useMemo(() => ({ lang, t }), [lang, t])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}
