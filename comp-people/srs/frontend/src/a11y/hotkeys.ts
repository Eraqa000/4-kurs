import type { MessageKey } from '../i18n/messages'

export interface Hotkey {
  /** значение KeyboardEvent.key (для Alt-комбинаций — по code) */
  code: string
  alt?: boolean
  label: string
  description: MessageKey
  /** путь для навигации */
  to?: string
}

// Alt+цифра не конфликтует с командами screen reader (у них Insert/CapsLock/VO)
export const hotkeys: Hotkey[] = [
  { code: 'Digit1', alt: true, label: 'Alt+1', description: 'hotkeys.goCreate', to: '/' },
  { code: 'Digit2', alt: true, label: 'Alt+2', description: 'hotkeys.goGallery', to: '/gallery' },
  { code: 'Digit3', alt: true, label: 'Alt+3', description: 'hotkeys.goLessons', to: '/lessons' },
  { code: 'Digit4', alt: true, label: 'Alt+4', description: 'hotkeys.goSettings', to: '/settings' },
]

export const HELP_KEY_LABEL = '?'
