import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useAudio } from '../audio/audio'
import { useSettings } from '../features/settings/settings'
import { useI18n } from '../i18n/context'
import { useAnnounce } from './announcer'

/**
 * При смене страницы SPA не перезагружается, поэтому screen reader ничего не объявит сам.
 * Переносим фокус на заголовок h1 новой страницы и озвучиваем её название.
 * При первой загрузке фокус не трогаем.
 */
export function RouteFocus() {
  const { pathname } = useLocation()
  const { t } = useI18n()
  const announce = useAnnounce()
  const { speak } = useAudio()
  const { settings } = useSettings()
  const first = useRef(true)

  useEffect(() => {
    const heading = document.querySelector<HTMLElement>('[data-page-title]')
    const title = heading?.textContent ?? ''
    document.title = title ? `${title} — ${t('app.name')}` : t('app.name')
    if (first.current) {
      first.current = false
      return
    }
    heading?.focus()
    if (title) {
      announce(t('status.page', { title }))
      if (settings.speakPrompts) speak(t('status.page', { title }))
    }
    // язык не должен вызывать перенос фокуса, только путь
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  return null
}
