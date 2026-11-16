import { useI18n } from '../i18n/context'

export function SkipLink() {
  const { t } = useI18n()
  return (
    <a className="skip-link" href="#main">
      {t('skip.link')}
    </a>
  )
}
