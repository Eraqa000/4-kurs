import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useVoiceAnswer, useVoiceCommand } from '../../audio/audio'
import { useSay } from '../../audio/useSay'
import { useI18n } from '../../i18n/context'
import { checkDescription, findLesson, type ChoiceStep, lessons } from './content'
import { useProgress } from './progress'
import { useSettings } from '../settings/settings'

const NUMBER_WORDS: string[][] = [
  ['1', 'один', 'первый', 'бір', 'birinshi'],
  ['2', 'два', 'второй', 'екі'],
  ['3', 'три', 'третий', 'үш'],
  ['4', 'четыре', 'четвёртый', 'төрт'],
]

/** Номер варианта по фразе: цифра, слово-число или кусочек текста варианта. */
function matchOption(text: string, options: string[]): number {
  const words = text
    .toLowerCase()
    .replace(/[.,!?]/g, '')
    .split(/\s+/)
  const byNumber = NUMBER_WORDS.findIndex((alts) => words.some((w) => alts.includes(w)))
  if (byNumber >= 0 && byNumber < options.length) return byNumber
  const phrase = words.join(' ')
  return options.findIndex((o) => {
    const opt = o.toLowerCase().replace(/[.,!?]/g, '')
    return phrase.includes(opt) || opt.includes(phrase)
  })
}

export function LessonPage() {
  const { id } = useParams()
  // key: при смене урока всё состояние создаётся заново
  return <LessonRunner key={id} id={id} />
}

function LessonRunner({ id }: { id: string | undefined }) {
  const lesson = findLesson(id)
  const { t, lang } = useI18n()
  const { settings } = useSettings()
  const { mark } = useProgress()
  const say = useSay()
  const navigate = useNavigate()

  const [index, setIndex] = useState(0)
  const [tries, setTries] = useState(0)
  const [solved, setSolved] = useState(lesson?.steps[0]?.type === 'info')
  const [feedback, setFeedback] = useState('')
  const [answer, setAnswer] = useState('')
  const [finished, setFinished] = useState(false)
  const headingRef = useRef<HTMLHeadingElement>(null)

  const step = lesson?.steps[index]
  const total = lesson?.steps.length ?? 0

  const stepText = useCallback(() => {
    if (!step) return ''
    if (step.type === 'info') return step.text[lang]
    if (step.type === 'describe') return step.prompt[lang]
    const options = step.options.map((o, i) => `${i + 1}. ${o[lang]}`).join(' ')
    return `${step.prompt[lang]} ${options}`
  }, [step, lang])

  // Вход в шаг: сбрасываем состояние, переносим фокус на заголовок шага и озвучиваем задание
  useEffect(() => {
    if (!lesson || finished) return
    headingRef.current?.focus()
    mark(lesson.id, 'in_progress')
    const intro = index === 0 ? `${lesson.goal[lang]} ` : ''
    say(`${intro}${stepText()}`)
    // озвучиваем только при смене шага/урока, не при каждой перерисовке
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lesson?.id, index, finished])

  const goNext = useCallback(() => {
    if (!lesson) return
    if (!solved) {
      say(t('lessons.needAnswer'))
      return
    }
    if (index + 1 >= total) {
      mark(lesson.id, 'done')
      setFinished(true)
      say(t('lessons.complete'))
    } else {
      // состояние нового шага сбрасываем здесь, а не в эффекте
      setIndex(index + 1)
      setTries(0)
      setFeedback('')
      setAnswer('')
      setSolved(lesson.steps[index + 1].type === 'info')
    }
  }, [lesson, solved, index, total, mark, say, t])

  const chooseOption = useCallback(
    (choice: number) => {
      const s = step as ChoiceStep
      if (solved) return
      if (choice === s.correct) {
        setSolved(true)
        setFeedback(s.correctFeedback[lang])
        say(s.correctFeedback[lang])
        return
      }
      const nextTries = tries + 1
      setTries(nextTries)
      if (nextTries >= 2) {
        // После двух ошибок показываем ответ и идём дальше: без наказаний
        const msg = `${t('lessons.reveal')} ${s.options[s.correct][lang]}`
        setSolved(true)
        setFeedback(msg)
        say(msg)
      } else {
        setFeedback(s.hint[lang])
        say(s.hint[lang])
      }
    },
    [step, solved, tries, lang, say, t],
  )

  const submitDescription = useCallback(
    (text: string) => {
      const check = checkDescription(text)
      let msg: string
      if (!check.enough) {
        msg = t('lessons.tooShort')
      } else {
        // Любое содержательное описание засчитывается; подсказки только добавляют мягкий совет
        setSolved(true)
        if (check.hasColor && check.hasPosition) msg = t('lessons.praiseBoth')
        else if (check.hasPosition) msg = t('lessons.needColor')
        else if (check.hasColor) msg = t('lessons.needPosition')
        else msg = t('lessons.needBoth')
      }
      setFeedback(msg)
      say(msg)
    },
    [say, t],
  )

  // Цифры 1-9 выбирают вариант (если хоткеи включены: WCAG 2.1.4)
  useEffect(() => {
    if (!settings.hotkeysEnabled || finished || step?.type !== 'choice') return
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const target = e.target as HTMLElement
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return
      const n = Number(e.key)
      if (n >= 1 && n <= step.options.length) chooseOption(n - 1)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [settings.hotkeysEnabled, finished, step, chooseOption])

  // Голосовые ответы: номер или текст варианта, либо описание целиком
  useVoiceAnswer((text) => {
    if (!lesson || finished || !step) return false
    if (step.type === 'choice') {
      const i = matchOption(
        text,
        step.options.map((o) => o[lang]),
      )
      if (i < 0) return false
      chooseOption(i)
      return true
    }
    if (step.type === 'describe' && text.trim().split(/\s+/).length >= 3) {
      setAnswer(text)
      submitDescription(text)
      return true
    }
    return false
  })

  useVoiceCommand('next', goNext)
  useVoiceCommand('back', () => navigate('/lessons'))

  if (!lesson) {
    return (
      <div className="stack">
        <h1 tabIndex={-1} data-page-title>
          {t('lessons.title')}
        </h1>
        <p>{t('lessons.notFound')}</p>
        <Link to="/lessons">{t('lessons.back')}</Link>
      </div>
    )
  }

  const lessonIndex = lessons.findIndex((l) => l.id === lesson.id)
  const nextLesson = lessons[lessonIndex + 1]

  return (
    <div className="stack">
      <h1 tabIndex={-1} data-page-title>
        {lesson.title[lang]}
      </h1>

      {finished ? (
        <section aria-labelledby="done-title" className="card stack">
          <h2 id="done-title" tabIndex={-1} ref={headingRef}>
            {t('lessons.complete')}
          </h2>
          <div className="row">
            {nextLesson && <Link to={`/lessons/${nextLesson.id}`}>{t('lessons.nextLesson')}</Link>}
            <Link to="/lessons">{t('lessons.back')}</Link>
          </div>
        </section>
      ) : (
        step && (
          <section aria-labelledby="step-title" className="stack card">
            <h2 id="step-title" tabIndex={-1} ref={headingRef}>
              {t('lessons.stepOf', { n: index + 1, total })}
            </h2>

            {step.type === 'info' && <p>{step.text[lang]}</p>}

            {step.type === 'choice' && (
              <>
                <p>{step.prompt[lang]}</p>
                <p>{t('lessons.optionHint')}</p>
                <ol className="options">
                  {step.options.map((o, i) => (
                    <li key={i}>
                      <button type="button" onClick={() => chooseOption(i)} disabled={solved}>
                        {i + 1}. {o[lang]}
                      </button>
                    </li>
                  ))}
                </ol>
              </>
            )}

            {step.type === 'describe' && (
              <>
                <p>{step.prompt[lang]}</p>
                <form
                  className="field"
                  onSubmit={(e) => {
                    e.preventDefault()
                    submitDescription(answer)
                  }}
                >
                  <label htmlFor="answer">{t('lessons.answerLabel')}</label>
                  <div className="row">
                    <input
                      id="answer"
                      type="text"
                      value={answer}
                      onChange={(e) => setAnswer(e.target.value)}
                    />
                    <button type="submit">{t('lessons.submit')}</button>
                  </div>
                </form>
              </>
            )}

            {/* Отзыв — видимый текст; озвучка идёт через общий live-регион */}
            <p className="feedback">{feedback}</p>

            <button type="button" className="primary" onClick={goNext} aria-disabled={!solved}>
              {t('lessons.next')}
            </button>
          </section>
        )
      )}
    </div>
  )
}
