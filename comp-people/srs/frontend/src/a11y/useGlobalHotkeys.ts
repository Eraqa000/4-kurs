import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { hotkeys } from './hotkeys'

function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el) return false
  return el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)
}

/** Глобальные хоткеи. Отключаются настройкой (WCAG 2.1.4) и не срабатывают при вводе текста. */
export function useGlobalHotkeys(enabled: boolean, onHelp: () => void) {
  const navigate = useNavigate()

  useEffect(() => {
    if (!enabled) return
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) return
      const hit = hotkeys.find((h) => h.code === e.code && Boolean(h.alt) === e.altKey)
      if (hit?.to) {
        e.preventDefault()
        navigate(hit.to)
        return
      }
      if (e.key === '?' && !isTyping(e.target)) {
        e.preventDefault()
        onHelp()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [enabled, navigate, onHelp])
}
