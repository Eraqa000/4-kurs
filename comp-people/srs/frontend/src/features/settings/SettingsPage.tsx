import { useAnnounce } from '../../a11y/announcer'
import { useAudio } from '../../audio/audio'
import { useI18n } from '../../i18n/context'
import type { Lang } from '../../i18n/messages'
import { useSettings } from './settings'

export function SettingsPage() {
  const { t } = useI18n()
  const { settings, update } = useSettings()
  const announce = useAnnounce()
  const { ttsLangFallback } = useAudio()

  const saved = () => announce(t('settings.saved'))

  return (
    <form onSubmit={(e) => e.preventDefault()} className="stack card">
      <h1 tabIndex={-1} data-page-title>
        {t('settings.title')}
      </h1>

      <div className="field">
        <label htmlFor="lang">{t('settings.language')}</label>
        <select
          id="lang"
          value={settings.language}
          onChange={(e) => {
            update('language', e.target.value as Lang)
            saved()
          }}
        >
          <option value="kk">Қазақша</option>
          <option value="ru">Русский</option>
        </select>
      </div>

      <div className="field field--check">
        <input
          id="contrast"
          type="checkbox"
          checked={settings.highContrast}
          onChange={(e) => {
            update('highContrast', e.target.checked)
            saved()
          }}
        />
        <label htmlFor="contrast">{t('settings.contrast')}</label>
      </div>

      <div className="field">
        <label htmlFor="font">
          {t('settings.fontSize')}: {settings.fontScale}%
        </label>
        <input
          id="font"
          type="range"
          min={100}
          max={200}
          step={10}
          value={settings.fontScale}
          onChange={(e) => update('fontScale', Number(e.target.value))}
          onKeyUp={saved}
        />
      </div>

      <div className="field">
        <label htmlFor="rate">
          {t('settings.speechRate')}: {settings.speechRate.toFixed(1)}
        </label>
        <input
          id="rate"
          type="range"
          min={0.5}
          max={2}
          step={0.1}
          value={settings.speechRate}
          onChange={(e) => update('speechRate', Number(e.target.value))}
          onKeyUp={saved}
        />
      </div>

      <div className="field field--check">
        <input
          id="motion"
          type="checkbox"
          checked={settings.reduceMotion}
          onChange={(e) => {
            update('reduceMotion', e.target.checked)
            saved()
          }}
        />
        <label htmlFor="motion">{t('settings.reduceMotion')}</label>
      </div>

      <div className="field field--check">
        <input
          id="hotkeys"
          type="checkbox"
          checked={settings.hotkeysEnabled}
          onChange={(e) => {
            update('hotkeysEnabled', e.target.checked)
            saved()
          }}
        />
        <label htmlFor="hotkeys">{t('settings.hotkeys')}</label>
      </div>

      <div className="field field--check">
        <input
          id="speak"
          type="checkbox"
          checked={settings.speakPrompts}
          onChange={(e) => {
            update('speakPrompts', e.target.checked)
            saved()
          }}
        />
        <label htmlFor="speak">{t('settings.speakPrompts')}</label>
      </div>
      <p>{t('settings.speakHint')}</p>

      <div className="field field--check">
        <input
          id="intro"
          type="checkbox"
          checked={settings.introOnStart}
          onChange={(e) => {
            update('introOnStart', e.target.checked)
            saved()
          }}
        />
        <label htmlFor="intro">{t('settings.intro')}</label>
      </div>
      {ttsLangFallback && <p>{t('settings.noKkVoice')}</p>}
    </form>
  )
}
