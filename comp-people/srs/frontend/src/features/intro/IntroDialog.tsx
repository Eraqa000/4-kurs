import { Modal } from '../../a11y/Modal'
import { useI18n } from '../../i18n/context'
import type { MessageKey } from '../../i18n/messages'
import texts from './intro-texts.json'
import { useIntro } from './intro'

/**
 * Окно вступления. Главная кнопка всегда получает фокус, поэтому Enter (или Space) работает сразу:
 * в первые секунды пропускает подсказку, во время звука останавливает её и начинает работу.
 * Когда браузер не включил звук сам, главная кнопка запускает запись.
 */
export function IntroDialog() {
  const { t, lang } = useI18n()
  const { phase, play, skip } = useIntro()

  const primary: { label: MessageKey; action: () => void } =
    phase === 'blocked'
      ? { label: 'intro.listen', action: play }
      : phase === 'playing'
        ? { label: 'intro.stopStart', action: skip }
        : { label: 'intro.start', action: skip }

  const lead: MessageKey =
    phase === 'countdown'
      ? 'intro.leadCountdown'
      : phase === 'blocked'
        ? 'intro.blocked'
        : phase === 'playing'
          ? 'intro.leadPlaying'
          : 'intro.leadIdle'

  return (
    <Modal
      title={t('intro.title')}
      closeLabel={t(primary.label)}
      closePrimary
      onPrimary={primary.action}
      // Esc: остановить звук и закрыть окно
      onClose={skip}
      extraActions={
        phase === 'blocked' ? (
          <button type="button" onClick={skip}>
            {t('intro.skip')}
          </button>
        ) : phase === 'idle' ? (
          <button type="button" onClick={play}>
            {t('intro.replay')}
          </button>
        ) : undefined
      }
    >
      <p className="lead" role="status">
        {t(lead)}
      </p>
      <p>
        <kbd>Enter</kbd> / <kbd>Space</kbd> — {t('intro.keyEnter')}. <kbd>Esc</kbd> —{' '}
        {t('intro.keyEsc')}.
      </p>
      {/* Прокручиваемый блок должен получать фокус, чтобы его читали клавиатурой */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex */}
      <div className="transcript" tabIndex={0} role="region" aria-label={t('intro.transcript')}>
        <p>{texts[lang]}</p>
      </div>
    </Modal>
  )
}
