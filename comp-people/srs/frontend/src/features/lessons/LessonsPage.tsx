import { Link } from 'react-router-dom'
import { useI18n } from '../../i18n/context'
import { lessons } from './content'
import { useProgress } from './progress'

export function LessonsPage() {
  const { t, lang } = useI18n()
  const { status } = useProgress()

  return (
    <div className="stack">
      <h1 tabIndex={-1} data-page-title>
        {t('lessons.title')}
      </h1>
      <p>{t('lessons.intro')}</p>
      <ol className="lesson-list">
        {lessons.map((lesson, i) => {
          const s = status(lesson.id)
          return (
            <li key={lesson.id}>
              {/* Одна ссылка с полным названием: статус не теряется для screen reader */}
              <Link to={`/lessons/${lesson.id}`} className="lesson-link">
                {t('lessons.item', {
                  n: i + 1,
                  title: lesson.title[lang],
                  status: t(`lessons.status.${s}`),
                })}
              </Link>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
