import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  ApiError,
  describeImage,
  generateImage,
  saveMaterial,
  type ImageDescription,
} from '../../api/client'
import { useAudio, useVoiceCommand } from '../../audio/audio'
import { useSay } from '../../audio/useSay'
import { useI18n } from '../../i18n/context'

type Status = 'idle' | 'working' | 'ready' | 'error'

export function CreatePage() {
  const { t, lang } = useI18n()
  const { speak } = useAudio()
  const location = useLocation()
  const navigate = useNavigate()

  const [prompt, setPrompt] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [image, setImage] = useState<{ id: string; url: string; prompt: string } | null>(null)
  const [saved, setSaved] = useState(false)
  const [description, setDescription] = useState<ImageDescription | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const requestId = useRef(0)
  const inputId = useId()

  const say = useSay()

  const run = useCallback(
    async (text: string) => {
      const query = text.trim()
      if (!query) return
      const id = ++requestId.current
      setStatus('working')
      setImage(null)
      setDescription(null)
      setSaved(false)
      say(t('create.generating'))
      try {
        const img = await generateImage(query, lang)
        const desc = await describeImage(img.image_id, lang)
        if (id !== requestId.current) return // пришёл более новый запрос
        setImage({ id: img.image_id, url: img.image_url, prompt: img.prompt })
        setDescription(desc)
        setStatus('ready')
        // «Готово», затем краткое описание — одной фразой, чтобы они не перебивали друг друга
        say(`${t('create.ready')}. ${desc.alt_text}`)
      } catch (err) {
        if (id !== requestId.current) return
        setStatus('error')
        // не ApiError — сервер не ответил совсем (выключен или нет сети)
        let msg = err instanceof ApiError ? t('create.error') : t('create.offline')
        if (err instanceof ApiError) {
          msg = err.message || msg
          if (err.status === 429 && err.retryAfter) {
            msg = `${msg} ${t('create.wait', { seconds: err.retryAfter })}`
          }
        }
        say(msg, true)
      }
    },
    [lang, say, t],
  )

  // Голосовая команда «создать»; без описания спрашиваем, что рисовать
  useVoiceCommand('create', (args) => {
    if (args) {
      setPrompt(args)
      void run(args)
    } else {
      inputRef.current?.focus()
      say(t('create.askPrompt'))
    }
  })

  const save = useCallback(async () => {
    if (!image || !description) {
      say(t('create.nothingYet'))
      return
    }
    if (saved) {
      say(t('create.alreadySaved'))
      return
    }
    try {
      await saveMaterial(image.id)
      setSaved(true)
      say(t('create.saved'))
    } catch (err) {
      say(err instanceof ApiError && err.message ? err.message : t('create.saveFailed'), true)
    }
  }, [image, description, saved, say, t])

  // «Сохранить» — работа попадает в галерею
  useVoiceCommand('save', () => void save())

  // «Слушать» — подробное описание
  useVoiceCommand('listen', () => {
    if (description) say(description.long_description)
    else say(t('create.nothingYet'))
  })

  // Пришли из другого раздела с командой «создать …»
  const consumed = useRef(false)
  useEffect(() => {
    const fromNav = (location.state as { prompt?: string } | null)?.prompt
    if (!fromNav || consumed.current) return
    consumed.current = true
    setPrompt(fromNav)
    navigate('.', { replace: true, state: null })
    void run(fromNav)
  }, [location.state, navigate, run])

  return (
    <div className="stack">
      <h1 tabIndex={-1} data-page-title>
        {t('create.title')}
      </h1>
      <p>{t('create.intro')}</p>

      <form
        className="field card"
        onSubmit={(e) => {
          e.preventDefault()
          void run(prompt)
        }}
      >
        <label htmlFor={inputId}>{t('create.promptLabel')}</label>
        <div className="row">
          <input
            id={inputId}
            ref={inputRef}
            type="text"
            value={prompt}
            maxLength={200}
            onChange={(e) => setPrompt(e.target.value)}
          />
          <button type="submit" className="primary" disabled={status === 'working'}>
            {t('create.submit')}
          </button>
        </div>
      </form>

      {status === 'working' && <p aria-busy="true">{t('create.generating')}…</p>}

      {status === 'ready' && image && description && (
        <section className="result card" aria-labelledby="result-title">
          <h2 id="result-title">{image.prompt}</h2>
          <img src={image.url} alt={description.alt_text} width={320} height={320} />
          <h3>{t('create.alt')}</h3>
          <p>{description.alt_text}</p>
          <h3>{t('create.long')}</h3>
          <p>{description.long_description}</p>
          <p>
            <em>{t('create.aiNote')}</em>
          </p>
          <div className="row">
            <button type="button" onClick={() => speak(description.alt_text)}>
              {t('create.listenShort')}
            </button>
            <button type="button" onClick={() => speak(description.long_description)}>
              {t('create.listenLong')}
            </button>
            <button type="button" className="primary" onClick={() => void save()}>
              {t('create.save')}
            </button>
            {saved && <Link to="/gallery">{t('create.openGallery')}</Link>}
          </div>
        </section>
      )}
    </div>
  )
}
