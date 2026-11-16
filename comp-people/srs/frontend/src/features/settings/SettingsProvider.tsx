import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { defaultSettings, SettingsContext, type Settings } from './settings'

const STORAGE_KEY = 'audiocanvas.settings'

function load(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? { ...defaultSettings, ...JSON.parse(raw) } : defaultSettings
  } catch {
    return defaultSettings
  }
}

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(load)

  const update = useCallback<<K extends keyof Settings>(key: K, value: Settings[K]) => void>(
    (key, value) => setSettings((prev) => ({ ...prev, [key]: value })),
    [],
  )

  // Применяем настройки к документу: CSS реагирует на data-атрибуты и переменную масштаба
  useEffect(() => {
    const root = document.documentElement
    root.dataset.contrast = settings.highContrast ? 'high' : 'normal'
    root.dataset.motion = settings.reduceMotion ? 'reduce' : 'normal'
    root.style.setProperty('--font-scale', String(settings.fontScale / 100))
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
    } catch {
      /* хранилище недоступно — настройки живут до перезагрузки */
    }
  }, [settings])

  const value = useMemo(() => ({ settings, update }), [settings, update])
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>
}
