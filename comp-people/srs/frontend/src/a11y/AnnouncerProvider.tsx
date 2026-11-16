import { useCallback, useState, type ReactNode } from 'react'
import { AnnouncerContext, type Announce } from './announcer'

/**
 * Две постоянные live-области (polite и assertive). Они должны быть в DOM с самого начала,
 * иначе screen reader не отследит изменения. Текст сначала очищается, чтобы повторное
 * одинаковое сообщение тоже было озвучено.
 */
export function AnnouncerProvider({ children }: { children: ReactNode }) {
  const [polite, setPolite] = useState('')
  const [assertive, setAssertive] = useState('')

  const announce = useCallback<Announce>((message, politeness = 'polite') => {
    const set = politeness === 'assertive' ? setAssertive : setPolite
    set('')
    window.setTimeout(() => set(message), 50)
  }, [])

  return (
    <AnnouncerContext.Provider value={announce}>
      {children}
      <div className="visually-hidden" role="status" aria-live="polite" aria-atomic="true">
        {polite}
      </div>
      <div className="visually-hidden" role="alert" aria-live="assertive" aria-atomic="true">
        {assertive}
      </div>
    </AnnouncerContext.Provider>
  )
}
