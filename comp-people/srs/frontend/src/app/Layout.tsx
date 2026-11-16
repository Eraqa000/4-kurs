import { useCallback, useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAnnounce } from '../a11y/announcer'
import { HELP_KEY_LABEL, hotkeys } from '../a11y/hotkeys'
import { Modal } from '../a11y/Modal'
import { RouteFocus } from '../a11y/RouteFocus'
import { SkipLink } from '../a11y/SkipLink'
import { useGlobalHotkeys } from '../a11y/useGlobalHotkeys'
import { useVoiceCommand } from '../audio/audio'
import { useAudioHotkeys } from '../audio/useAudioHotkeys'
import { VoiceBar } from '../audio/VoiceBar'
import { useIntro } from '../features/intro/intro'
import { useSettings } from '../features/settings/settings'
import { useI18n } from '../i18n/context'
import type { MessageKey } from '../i18n/messages'
import { QuickControls } from './QuickControls'

const navItems: { to: string; label: MessageKey; end?: boolean }[] = [
  { to: '/', label: 'nav.create', end: true },
  { to: '/gallery', label: 'nav.gallery' },
  { to: '/lessons', label: 'nav.lessons' },
  { to: '/settings', label: 'nav.settings' },
]

export function Layout() {
  const { t } = useI18n()
  const { settings } = useSettings()
  const announce = useAnnounce()
  const [helpOpen, setHelpOpen] = useState(false)

  const openHelp = useCallback(() => {
    setHelpOpen(true)
    announce(t('hotkeys.title'))
  }, [announce, t])

  useGlobalHotkeys(settings.hotkeysEnabled, openHelp)
  const intro = useIntro()
  useAudioHotkeys({
    charKeys: settings.hotkeysEnabled,
    onEscape: intro.stopIfPlaying,
    onHelper: intro.replay,
  })

  const navigate = useNavigate()
  // со страницы «Создать» команда обрабатывается самой страницей, отсюда — переход к ней
  useVoiceCommand('create', (args) => navigate('/', { state: args ? { prompt: args } : null }), {
    fallback: true,
  })
  useVoiceCommand('back', () => navigate(-1), { fallback: true })

  return (
    <>
      <SkipLink />
      <RouteFocus />
      <header className="site-header">
        <p className="brand">
          {t('app.name')}
          <small>{t('app.tagline')}</small>
        </p>
        <nav aria-label={t('nav.label')}>
          <ul className="nav-list">
            {navItems.map((item) => (
              <li key={item.to}>
                <NavLink to={item.to} end={item.end}>
                  {t(item.label)}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <QuickControls />
      </header>

      <main id="main" tabIndex={-1}>
        <Outlet />
      </main>

      <VoiceBar />

      <footer className="site-footer">
        <p>{t('footer.text')}</p>
        <div className="hint-bar">
          <span>
            <strong>{t('hint.label')}:</strong>
          </span>
          <span>
            <kbd>Tab</kbd> {t('hint.tab')}
          </span>
          <span>
            <kbd>Space</kbd> / <kbd>Enter</kbd> {t('hint.choose')}
          </span>
          <span>
            <kbd>Esc</kbd> {t('hint.stop')}
          </span>
        </div>
        <div className="row">
          <button type="button" onClick={intro.replay}>
            {t('intro.helper')} (H)
          </button>
          {settings.hotkeysEnabled && (
            <button type="button" onClick={openHelp}>
              {t('hotkeys.help')} ({HELP_KEY_LABEL})
            </button>
          )}
        </div>
      </footer>

      {helpOpen && (
        <Modal
          title={t('hotkeys.title')}
          closeLabel={t('hotkeys.close')}
          onClose={() => setHelpOpen(false)}
        >
          <ul>
            <li>
              <kbd>{HELP_KEY_LABEL}</kbd> — {t('hotkeys.help')}
            </li>
            <li>
              <kbd>R</kbd> — {t('hotkeys.repeat')}
            </li>
            <li>
              <kbd>V</kbd> — {t('hotkeys.voice')}
            </li>
            <li>
              <kbd>L</kbd> — {t('hotkeys.listen')}
            </li>
            <li>
              <kbd>H</kbd> — {t('hotkeys.intro')}
            </li>
            <li>
              <kbd>Esc</kbd> — {t('hotkeys.esc')}
            </li>
            {hotkeys.map((h) => (
              <li key={h.label}>
                <kbd>{h.label}</kbd> — {t(h.description)}
              </li>
            ))}
          </ul>
        </Modal>
      )}
    </>
  )
}
