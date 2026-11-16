import { useCallback } from 'react'
import { useAnnounce } from '../a11y/announcer'
import { useSettings } from '../features/settings/settings'
import { useAudio } from './audio'

/** Статус всегда уходит в aria-live; встроенный синтезатор говорит, только если он включён. */
export function useSay() {
  const announce = useAnnounce()
  const { speak } = useAudio()
  const { settings } = useSettings()

  return useCallback(
    (text: string, assertive = false) => {
      announce(text, assertive ? 'assertive' : 'polite')
      if (settings.speakPrompts) speak(text)
    },
    [announce, settings.speakPrompts, speak],
  )
}
