import { createContext, useContext } from 'react'

export type LessonStatus = 'not_started' | 'in_progress' | 'done'
export type ProgressMap = Record<string, LessonStatus>

/** Хранилище прогресса. Сейчас localStorage, позже Supabase (таблица lesson_progress). */
export interface ProgressStore {
  load(): ProgressMap
  save(map: ProgressMap): void
}

export class LocalProgressStore implements ProgressStore {
  private key = 'audiocanvas.progress'

  load(): ProgressMap {
    try {
      const raw = localStorage.getItem(this.key)
      return raw ? (JSON.parse(raw) as ProgressMap) : {}
    } catch {
      return {}
    }
  }

  save(map: ProgressMap): void {
    try {
      localStorage.setItem(this.key, JSON.stringify(map))
    } catch {
      /* хранилище недоступно */
    }
  }
}

export interface ProgressApi {
  status: (lessonId: string) => LessonStatus
  /** done не понижается до in_progress при повторном прохождении */
  mark: (lessonId: string, status: LessonStatus) => void
}

export const ProgressContext = createContext<ProgressApi | null>(null)

export function useProgress(): ProgressApi {
  const ctx = useContext(ProgressContext)
  if (!ctx) throw new Error('useProgress вне ProgressProvider')
  return ctx
}
