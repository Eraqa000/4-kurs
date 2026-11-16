import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ApiError,
  audioUrl,
  deleteMaterial,
  exportUrl,
  getMaterial,
  updateMaterialText,
  type Material,
} from '../../api/client'
import { useAudio, useVoiceCommand } from '../../audio/audio'
import { useSay } from '../../audio/useSay'
import { useI18n } from '../../i18n/context'

type Load = { status: 'loading' } | { status: 'missing' } | { status: 'ready'; material: Material }

export function MaterialPage() {
  const { id = '' } = useParams()
  const { t, lang } = useI18n()
  const say = useSay()
  const { speak } = useAudio()
  const navigate = useNavigate()

  const [load, setLoad] = useState<Load>({ status: 'loading' })
  const [editing, setEditing] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [shortDraft, setShortDraft] = useState('')
  const [longDraft, setLongDraft] = useState('')
  const editButton = useRef<HTMLButtonElement>(null)
  const shortField = useRef<HTMLTextAreaElement>(null)
  const confirmNo = useRef<HTMLButtonElement>(null)
  const deleteButton = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const controller = new AbortController()
    getMaterial(id, controller.signal)
      .then((material) => setLoad({ status: 'ready', material }))
      .catch(() => {
        if (!controller.signal.aborted) setLoad({ status: 'missing' })
      })
    return () => controller.abort()
  }, [id])

  const material = load.status === 'ready' ? load.material : null
  const text = material?.texts[lang]

  useVoiceCommand('listen', () => {
    if (text) speak(`${text.alt_text} ${text.long_description}`)
  })
  useVoiceCommand('back', () => navigate('/gallery'))

  const startEdit = () => {
    if (!text) return
    setShortDraft(text.alt_text)
    setLongDraft(text.long_description)
    setEditing(true)
    // фокус переносим после появления формы
    setTimeout(() => shortField.current?.focus(), 0)
  }

  const closeEdit = () => {
    setEditing(false)
    setTimeout(() => editButton.current?.focus(), 0)
  }

  const saveEdit = async () => {
    if (!material) return
    try {
      const updated = await updateMaterialText(material.id, lang, {
        alt_text: shortDraft,
        long_description: longDraft,
      })
      setLoad({ status: 'ready', material: updated })
      say(t('material.editSaved'))
      closeEdit()
    } catch (err) {
      say(err instanceof ApiError && err.message ? err.message : t('create.error'), true)
    }
  }

  const confirmDelete = async () => {
    if (!material) return
    try {
      await deleteMaterial(material.id)
      say(t('material.deleted'))
      navigate('/gallery')
    } catch (err) {
      say(err instanceof ApiError && err.message ? err.message : t('create.error'), true)
    }
  }

  if (load.status === 'loading') {
    return (
      <div className="stack">
        <h1 tabIndex={-1} data-page-title>
          {t('gallery.title')}
        </h1>
        <p aria-busy="true">{t('gallery.loading')}…</p>
      </div>
    )
  }

  if (!material || !text) {
    return (
      <div className="stack">
        <h1 tabIndex={-1} data-page-title>
          {t('gallery.title')}
        </h1>
        <p>{t('material.notFound')}</p>
        <Link to="/gallery">{t('material.back')}</Link>
      </div>
    )
  }

  return (
    <div className="stack">
      <h1 tabIndex={-1} data-page-title>
        {material.prompt}
      </h1>
      <img src={material.image_url} alt={text.alt_text} width={320} height={320} />

      <section aria-labelledby="short-title" className="card">
        <h2 id="short-title">{t('material.shortTitle')}</h2>
        <p>{text.alt_text}</p>
      </section>
      <section aria-labelledby="long-title" className="card">
        <h2 id="long-title">{t('material.longTitle')}</h2>
        <p>{text.long_description}</p>
      </section>
      <p>
        <em>{text.ai_generated ? t('material.aiNote') : t('material.editedNote')}</em>
      </p>

      <div className="row">
        <button type="button" onClick={() => speak(text.alt_text)}>
          {t('material.listenShort')}
        </button>
        <button type="button" onClick={() => speak(text.long_description)}>
          {t('material.listenLong')}
        </button>
        <button type="button" ref={editButton} onClick={startEdit} hidden={editing}>
          {t('material.edit')}
        </button>
      </div>

      {editing && (
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault()
            void saveEdit()
          }}
        >
          <div className="field">
            <label htmlFor="edit-short">{t('material.editShort')}</label>
            <textarea
              id="edit-short"
              ref={shortField}
              rows={2}
              value={shortDraft}
              onChange={(e) => setShortDraft(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="edit-long">{t('material.editLong')}</label>
            <textarea
              id="edit-long"
              rows={6}
              value={longDraft}
              onChange={(e) => setLongDraft(e.target.value)}
            />
          </div>
          <div className="row">
            <button type="submit">{t('material.saveEdit')}</button>
            <button type="button" onClick={closeEdit}>
              {t('material.cancel')}
            </button>
          </div>
        </form>
      )}

      <section aria-labelledby="export-title" className="card stack">
        <h2 id="export-title">{t('material.exportTitle')}</h2>
        <p>{t('material.exportHint')}</p>
        <div className="row">
          <a className="button-link" href={exportUrl(material.id, lang)} download>
            {t('material.exportZip')}
          </a>
          <a className="button-link" href={audioUrl(material.id, lang)} download>
            {t('material.exportAudio')}
          </a>
        </div>
      </section>

      <div className="row">
        {!confirming ? (
          <button
            type="button"
            ref={deleteButton}
            onClick={() => {
              setConfirming(true)
              // безопасный выбор по умолчанию: фокус на «Нет»
              setTimeout(() => confirmNo.current?.focus(), 0)
            }}
          >
            {t('material.delete')}
          </button>
        ) : (
          <div role="group" aria-label={t('material.confirmDelete')} className="row">
            <p>{t('material.confirmDelete')}</p>
            <button type="button" onClick={() => void confirmDelete()}>
              {t('material.confirmYes')}
            </button>
            <button
              type="button"
              ref={confirmNo}
              onClick={() => {
                setConfirming(false)
                setTimeout(() => deleteButton.current?.focus(), 0)
              }}
            >
              {t('material.confirmNo')}
            </button>
          </div>
        )}
        <Link to="/gallery">{t('material.back')}</Link>
      </div>
    </div>
  )
}
