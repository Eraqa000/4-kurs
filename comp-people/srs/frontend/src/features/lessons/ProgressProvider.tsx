import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { getProgress, putProgress } from '../../api/client'
import {
  LocalProgressStore,
  ProgressContext,
  type LessonStatus,
  type ProgressMap,
  type ProgressStore,
} from './progress'

const RANK: Record<LessonStatus, number> = { not_started: 0, in_progress: 1, done: 2 }
const best = (a: LessonStatus | undefined, b: LessonStatus | undefined): LessonStatus =>
  RANK[a ?? 'not_started'] >= RANK[b ?? 'not_started'] ? (a ?? 'not_started') : (b ?? 'not_started')

/**
 * Прогресс хранится в локальной БД на сервере; копия в localStorage нужна для мгновенного
 * отклика и работы без сервера. При запуске копии сливаются (done не понижается),
 * то, что есть только локально, отправляется на сервер.
 */
export function ProgressProvider({
  children,
  store: storeProp,
  sync = true,
}: {
  children: ReactNode
  store?: ProgressStore
  /** false — только localStorage (тесты без сервера) */
  sync?: boolean
}) {
  const [store] = useState<ProgressStore>(() => storeProp ?? new LocalProgressStore())
  const [map, setMap] = useState<ProgressMap>(() => store.load())
  const mapRef = useRef(map)
  useEffect(() => {
    mapRef.current = map
  })

  useEffect(() => {
    if (!sync) return
    const controller = new AbortController()
    getProgress(controller.signal)
      .then((remote) => {
        const local = mapRef.current
        const merged: ProgressMap = {}
        for (const id of new Set([...Object.keys(local), ...Object.keys(remote)])) {
          merged[id] = best(local[id], remote[id])
          if (merged[id] !== remote[id]) void putProgress(id, merged[id]).catch(() => {})
        }
        store.save(merged)
        setMap(merged)
      })
      .catch(() => {
        /* сервер недоступен: работаем с локальной копией */
      })
    return () => controller.abort()
  }, [store, sync])

  const status = useCallback((id: string): LessonStatus => map[id] ?? 'not_started', [map])

  const mark = useCallback(
    (id: string, next: LessonStatus) => {
      const prev = mapRef.current[id]
      if (prev === 'done' && next !== 'done') return
      if (prev === next) return
      const updated = { ...mapRef.current, [id]: next }
      mapRef.current = updated
      setMap(updated)
      store.save(updated)
      if (sync) void putProgress(id, next).catch(() => {})
    },
    [store, sync],
  )

  const value = useMemo(() => ({ status, mark }), [status, mark])
  return <ProgressContext.Provider value={value}>{children}</ProgressContext.Provider>
}
