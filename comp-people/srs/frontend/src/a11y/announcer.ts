import { createContext, useContext } from 'react'

export type Politeness = 'polite' | 'assertive'
export type Announce = (message: string, politeness?: Politeness) => void

export const AnnouncerContext = createContext<Announce | null>(null)

/** Озвучка статуса через глобальную aria-live область. */
export function useAnnounce(): Announce {
  const ctx = useContext(AnnouncerContext)
  if (!ctx) throw new Error('useAnnounce вне AnnouncerProvider')
  return ctx
}
