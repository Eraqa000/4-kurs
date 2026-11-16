import { useEffect, useId, useRef, type ReactNode } from 'react'

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

interface ModalProps {
  title: string
  closeLabel: string
  onClose: () => void
  children: ReactNode
  /** кнопки перед кнопкой закрытия */
  extraActions?: ReactNode
  /** кнопка закрытия — главное действие и получает фокус первой */
  closePrimary?: boolean
  /** действие кнопки закрытия, если оно отличается от Esc */
  onPrimary?: () => void
}

/**
 * Модальное окно: фокус уходит внутрь, Tab зациклен, Esc закрывает,
 * после закрытия фокус возвращается на элемент, открывший окно.
 */
export function Modal({
  title,
  closeLabel,
  onClose,
  children,
  extraActions,
  closePrimary,
  onPrimary,
}: ModalProps) {
  const titleId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null
    const preferred = dialogRef.current?.querySelector<HTMLElement>('[data-autofocus]')
    ;(preferred ?? dialogRef.current?.querySelector<HTMLElement>(FOCUSABLE))?.focus()
    return () => opener?.focus()
  }, [])

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation()
      onClose()
      return
    }
    if (e.key !== 'Tab') return
    const items = dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE)
    if (!items?.length) return
    const first = items[0]
    const last = items[items.length - 1]
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault()
      first.focus()
    }
  }

  return (
    <div className="modal-backdrop">
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
      <div
        ref={dialogRef}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={onKeyDown}
      >
        <h2 id={titleId}>{title}</h2>
        {children}
        <div className="modal-actions">
          {extraActions}
          <button
            type="button"
            className={closePrimary ? 'primary' : undefined}
            data-autofocus={closePrimary ? '' : undefined}
            onClick={onPrimary ?? onClose}
          >
            {closeLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
