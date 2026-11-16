import { useAnnounce } from '../a11y/announcer'
import { useSettings } from '../features/settings/settings'
import { useI18n } from '../i18n/context'

const STEP = 20

/** Быстрые настройки в шапке: размер шрифта, контраст, язык (как в макете Stitch). */
export function QuickControls() {
  const { t } = useI18n()
  const { settings, update } = useSettings()
  const announce = useAnnounce()

  const setFont = (value: number) => {
    const next = Math.min(200, Math.max(100, value))
    update('fontScale', next)
    announce(`${t('settings.fontSize')}: ${next}%`)
  }

  return (
    <div role="group" aria-label={t('quick.label')} className="quick-controls">
      <div className="segmented">
        <button
          type="button"
          // видимый текст «A−» входит в имя кнопки (WCAG 2.5.3)
          aria-label={`A− ${t('quick.smaller')}`}
          disabled={settings.fontScale <= 100}
          onClick={() => setFont(settings.fontScale - STEP)}
        >
          A−
        </button>
        <button
          type="button"
          aria-label={`A+ ${t('quick.larger')}`}
          disabled={settings.fontScale >= 200}
          onClick={() => setFont(settings.fontScale + STEP)}
        >
          A+
        </button>
      </div>
      <button
        type="button"
        aria-pressed={settings.highContrast}
        onClick={() => {
          update('highContrast', !settings.highContrast)
          announce(t('settings.saved'))
        }}
      >
        {t('quick.contrast')}
      </button>
      <div role="group" aria-label={t('quick.language')} className="segmented">
        <button
          type="button"
          lang="kk"
          aria-pressed={settings.language === 'kk'}
          onClick={() => update('language', 'kk')}
        >
          ҚАЗ
        </button>
        <button
          type="button"
          lang="ru"
          aria-pressed={settings.language === 'ru'}
          onClick={() => update('language', 'ru')}
        >
          РУС
        </button>
      </div>
    </div>
  )
}
