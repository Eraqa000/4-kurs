import { useEffect } from 'react'
import { useAudio } from './audio'

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  return (
    Boolean(el) && (el!.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el!.tagName))
  )
}

interface Options {
  /** Односимвольные клавиши (R, V, H) включены в настройках; Esc работает всегда (WCAG 2.1.4) */
  charKeys: boolean
  /** Esc: остановить записанное вступление. true — Esc использован */
  onEscape?: () => boolean
  /** H: открыть подсказку-помощника */
  onHelper?: () => void
}

/** R — повтор, V — микрофон, L — подробное описание, H — подсказка, Esc — пауза, затем стоп. */
export function useAudioHotkeys({ charKeys, onEscape, onHelper }: Options) {
  const { repeat, toggleListening, pauseOrStop, handleText } = useAudio()

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return
      if (e.key === 'Escape') {
        if (!onEscape?.()) pauseOrStop()
        return
      }
      if (!charKeys || isTyping(e.target)) return
      const key = e.key.toLowerCase()
      if (key === 'r') {
        e.preventDefault()
        repeat()
      } else if (key === 'v') {
        e.preventDefault()
        toggleListening()
      } else if (key === 'l') {
        e.preventDefault()
        handleText('слушать') // та же команда, что «слушать» голосом: подробное описание
      } else if (key === 'h' && onHelper) {
        e.preventDefault()
        onHelper()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [charKeys, onEscape, onHelper, repeat, toggleListening, pauseOrStop, handleText])
}
