import type { ReactNode } from 'react'
import { AnnouncerProvider } from '../a11y/AnnouncerProvider'
import { SettingsProvider } from '../features/settings/SettingsProvider'
import { useSettings } from '../features/settings/settings'
import { AudioProvider } from '../audio/AudioProvider'
import type { STTProvider, TTSProvider } from '../audio/types'
import { IntroProvider } from '../features/intro/IntroProvider'
import { ProgressProvider } from '../features/lessons/ProgressProvider'
import { I18nProvider } from '../i18n/I18nProvider'

function LangBridge({ children }: { children: ReactNode }) {
  const { settings } = useSettings()
  return <I18nProvider lang={settings.language}>{children}</I18nProvider>
}

export function Providers({
  children,
  audio,
  syncProgress = true,
  introDelayMs,
}: {
  children: ReactNode
  /** подмена адаптеров (тесты) */
  audio?: { tts?: TTSProvider; stt?: STTProvider }
  /** false — прогресс только в localStorage, без запросов к серверу (тесты) */
  syncProgress?: boolean
  /** задержка автозапуска вступления, мс (в тестах 0) */
  introDelayMs?: number
}) {
  return (
    <SettingsProvider>
      <LangBridge>
        <AnnouncerProvider>
          <AudioProvider tts={audio?.tts} stt={audio?.stt}>
            <IntroProvider delayMs={introDelayMs}>
              <ProgressProvider sync={syncProgress}>{children}</ProgressProvider>
            </IntroProvider>
          </AudioProvider>
        </AnnouncerProvider>
      </LangBridge>
    </SettingsProvider>
  )
}
