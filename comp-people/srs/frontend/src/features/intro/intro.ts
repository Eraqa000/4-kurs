import { createContext, useContext } from 'react'

/**
 * Состояния вступления:
 * countdown — идёт обратный отсчёт до автозапуска (Enter пропускает сразу);
 * blocked — браузер не разрешил автозвук, нужен жест пользователя;
 * playing — звучит запись;
 * idle — тихо (звук закончился или автозвук выключен настройкой).
 */
export type IntroPhase = 'countdown' | 'blocked' | 'playing' | 'idle'

export interface IntroApi {
  open: boolean
  phase: IntroPhase
  /** Открыть подсказку и сразу проиграть её (по жесту пользователя: клавиша H, кнопка) */
  replay: () => void
  /** Включить звук в открытом окне */
  play: () => void
  /** Остановить звук и закрыть окно */
  skip: () => void
  /** Остановить звук, если он идёт. true — было что останавливать */
  stopIfPlaying: () => boolean
}

export const IntroContext = createContext<IntroApi | null>(null)

export function useIntro(): IntroApi {
  const ctx = useContext(IntroContext)
  if (!ctx) throw new Error('useIntro вне IntroProvider')
  return ctx
}

export const introSrc = (lang: string) => `/audio/intro-${lang}.mp3`
export const DEFAULT_DELAY_MS = 3000
