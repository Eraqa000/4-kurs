import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ApiError, listMaterials, type Material } from '../../api/client'
import { useVoiceCommand } from '../../audio/audio'
import { useAudio } from '../../audio/audio'
import { useSay } from '../../audio/useSay'
import { useI18n } from '../../i18n/context'

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; items: Material[] }

export function GalleryPage() {
  const { t, lang } = useI18n()
  const say = useSay()
  const { speak } = useAudio()
  const [state, setState] = useState<State>({ status: 'loading' })
  const [query, setQuery] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    listMaterials(controller.signal)
      .then((items) => setState({ status: 'ready', items }))
      .catch((err) => {
        if (controller.signal.aborted) return
        setState({
          status: 'error',
          message: err instanceof ApiError && err.message ? err.message : t('gallery.loadFailed'),
        })
      })
    return () => controller.abort()
    // список грузим один раз при открытии страницы
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Количество работ озвучиваем, когда список загрузился
  const count = state.status === 'ready' ? state.items.length : null
  useEffect(() => {
    if (count !== null) say(t('gallery.count', { n: count }))
    // только при изменении количества
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count])

  useEffect(() => {
    if (state.status === 'error') say(state.message, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.status])

  const visible = useMemo(() => {
    if (state.status !== 'ready') return []
    const q = query.trim().toLowerCase()
    if (!q) return state.items
    return state.items.filter(
      (m) =>
        m.prompt.toLowerCase().includes(q) ||
        m.texts[lang].alt_text.toLowerCase().includes(q) ||
        m.texts[lang].long_description.toLowerCase().includes(q),
    )
  }, [state, query, lang])

  // «Слушать» — перечислить названия работ
  useVoiceCommand('listen', () => {
    if (state.status !== 'ready' || state.items.length === 0) {
      speak(t('gallery.empty'))
      return
    }
    const list = visible.map((m, i) => `${i + 1}. ${m.prompt}`).join('. ')
    speak(t('gallery.titles', { list }))
  })

  return (
    <div className="stack">
      <h1 tabIndex={-1} data-page-title>
        {t('gallery.title')}
      </h1>
      <p>{t('gallery.intro')}</p>

      {state.status === 'loading' && <p aria-busy="true">{t('gallery.loading')}…</p>}
      {state.status === 'error' && <p>{state.message}</p>}

      {state.status === 'ready' && state.items.length === 0 && (
        <>
          <p>{t('gallery.empty')}</p>
          <Link to="/" className="button-link primary">
            {t('gallery.toCreate')}
          </Link>
        </>
      )}

      {state.status === 'ready' && state.items.length > 0 && (
        <>
          <div className="field">
            <label htmlFor="gallery-search">{t('gallery.searchLabel')}</label>
            <input
              id="gallery-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          {visible.length === 0 ? (
            <p>{t('gallery.noMatch')}</p>
          ) : (
            <ul className="gallery-list">
              {visible.map((m) => (
                <li key={m.id}>
                  {/* Миниатюра декоративная: то же самое сказано текстом рядом */}
                  <img src={m.image_url} alt="" width={96} height={96} />
                  <div>
                    <h2>
                      <Link to={`/gallery/${m.id}`}>{m.prompt}</Link>
                    </h2>
                    <p>{m.texts[lang].alt_text}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}
