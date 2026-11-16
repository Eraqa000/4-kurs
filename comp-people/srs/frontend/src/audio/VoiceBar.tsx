import { useEffect, useId, useState } from 'react'
import { useAnnounce } from '../a11y/announcer'
import { useIntro } from '../features/intro/intro'
import { useI18n } from '../i18n/context'
import { useAudio } from './audio'

/**
 * Панель команд. Текстовый ввод равноправен голосу и есть всегда;
 * кнопка микрофона появляется, только если браузер умеет распознавать речь.
 */
export function VoiceBar() {
  const { t } = useI18n()
  const announce = useAnnounce()
  const { sttSupported, listening, toggleListening, handleText, lastHeard, speak } = useAudio()
  const { open: introOpen } = useIntro()
  const [text, setText] = useState('')
  const headingId = useId()
  const inputId = useId()

  // Сообщаем о запасном режиме один раз, чтобы пользователь знал, как управлять
  useEffect(() => {
    if (!sttSupported) {
      const msg = t('voice.noStt')
      announce(msg)
      // пока открыто вступление, его запись объясняет управление; синтезатор молчит
      if (!introOpen) speak(msg)
    }
    // только при монтировании
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <section aria-labelledby={headingId} className="voice-bar">
      <div className="card">
        <h2 id={headingId}>{t('voice.title')}</h2>
        {sttSupported ? (
          <button type="button" aria-pressed={listening} onClick={toggleListening}>
            {listening ? t('voice.stop') : t('voice.start')} (V)
          </button>
        ) : (
          <p>{t('voice.noStt')}</p>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (!text.trim()) return
            handleText(text)
            setText('')
          }}
        >
          <label htmlFor={inputId}>{t('voice.textLabel')}</label>
          <input id={inputId} type="text" value={text} onChange={(e) => setText(e.target.value)} />
          <button type="submit">{t('voice.run')}</button>
        </form>
        <p>{lastHeard && t('voice.heard', { text: lastHeard })}</p>
      </div>
    </section>
  )
}
