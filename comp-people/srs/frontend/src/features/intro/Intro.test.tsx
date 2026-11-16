import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useRoutes } from 'react-router-dom'
import { axe } from 'vitest-axe'
import { Providers } from '../../app/Providers'
import { routes } from '../../app/routes'
import type { SpeakOptions, STTProvider, TTSProvider } from '../../audio/types'

class FakeTTS implements TTSProvider {
  supported = true
  spoken: string[] = []
  stops = 0
  hasVoice() {
    return true
  }
  speak(text: string, o: SpeakOptions) {
    this.spoken.push(text)
    o.onStart?.()
  }
  pause() {}
  resume() {}
  stop() {
    this.stops++
  }
}
const stt: STTProvider = { supported: false, start() {}, stop() {} }

/** Подмена HTMLAudioElement: jsdom не умеет воспроизводить звук. */
let allowAutoplay = true
const created: FakeAudio[] = []
class FakeAudio {
  paused = true
  currentTime = 0
  onended: (() => void) | null = null
  onerror: (() => void) | null = null
  src: string
  constructor(src: string) {
    this.src = src
    created.push(this)
  }
  async play() {
    if (!allowAutoplay) throw new DOMException('blocked', 'NotAllowedError')
    this.paused = false
  }
  pause() {
    this.paused = true
  }
  finish() {
    this.paused = true
    this.onended?.()
  }
}

function Routes() {
  return useRoutes(routes)
}

function mount(settings: object = {}, delayMs = 0) {
  localStorage.clear()
  localStorage.setItem('audiocanvas.settings', JSON.stringify({ introOnStart: true, ...settings }))
  const tts = new FakeTTS()
  const view = render(
    <Providers audio={{ tts, stt }} syncProgress={false} introDelayMs={delayMs}>
      <MemoryRouter>
        <Routes />
      </MemoryRouter>
    </Providers>,
  )
  return { tts, user: userEvent.setup(), ...view }
}

beforeEach(() => {
  allowAutoplay = true
  created.length = 0
  vi.stubGlobal('Audio', FakeAudio)
})
afterEach(() => vi.unstubAllGlobals())

const dialog = () => screen.queryByRole('dialog', { name: /Дауыстық көмекші|Голосовой помощник/ })
const playingNow = () => created.some((a) => !a.paused)

describe('вступление-помощник', () => {
  it('при открытии сайта показывает окно с фокусом на главной кнопке, звук включается сам', async () => {
    const { container } = mount({}, 30)
    expect(dialog()).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Бастау' })).toHaveFocus()
    expect(screen.getByText(/3 секундтан кейін автоматты түрде басталады/)).toBeInTheDocument()
    expect(created).toHaveLength(0) // идёт отсчёт

    await waitFor(() => expect(playingNow()).toBe(true))
    expect(created[0].src).toBe('/audio/intro-kk.mp3')
    expect(screen.getByRole('button', { name: 'Тоқтату және бастау' })).toHaveFocus()
    expect(screen.getByText(/Нұсқау тыңдалуда/)).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Нұсқаудың мәтіні' })).toHaveTextContent(
      'Бұл нұсқауды тоқтатып, бірден бастау үшін Enter',
    )
    expect(await axe(container)).toHaveNoViolations()
  })

  it('появляется при каждой загрузке сайта, а не один раз за сессию', async () => {
    const first = mount()
    await waitFor(() => expect(playingNow()).toBe(true))
    await first.user.keyboard('{Enter}')
    expect(dialog()).not.toBeInTheDocument()
    first.unmount()

    created.length = 0
    render(
      <Providers audio={{ tts: new FakeTTS(), stt }} syncProgress={false} introDelayMs={0}>
        <MemoryRouter>
          <Routes />
        </MemoryRouter>
      </Providers>,
    )
    expect(dialog()).toBeInTheDocument()
    await waitFor(() => expect(playingNow()).toBe(true))
  })

  it('Enter в первые секунды пропускает подсказку совсем: звук так и не включается', async () => {
    const { user } = mount({}, 150)
    await user.keyboard('{Enter}')
    expect(dialog()).not.toBeInTheDocument()
    await new Promise((r) => setTimeout(r, 300))
    expect(created).toHaveLength(0)
  })

  it('Enter во время звука останавливает его, закрывает окно и ставит фокус на заголовок', async () => {
    const { user } = mount()
    await waitFor(() => expect(playingNow()).toBe(true))
    await user.keyboard('{Enter}')
    expect(created[0].paused).toBe(true)
    expect(dialog()).not.toBeInTheDocument()
    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1, name: 'Сурет жасау' })).toHaveFocus(),
    )
  })

  it('Esc и Space тоже останавливают и закрывают', async () => {
    const a = mount()
    await waitFor(() => expect(playingNow()).toBe(true))
    await a.user.keyboard('{Escape}')
    expect(created[0].paused).toBe(true)
    expect(dialog()).not.toBeInTheDocument()
    a.unmount()

    created.length = 0
    const b = mount()
    await waitFor(() => expect(playingNow()).toBe(true))
    await b.user.keyboard(' ')
    expect(created[0].paused).toBe(true)
    expect(dialog()).not.toBeInTheDocument()
  })

  it('когда запись закончилась, окно закрывается само', async () => {
    mount()
    await waitFor(() => expect(playingNow()).toBe(true))
    act(() => created[0].finish())
    expect(dialog()).not.toBeInTheDocument()
  })

  it('на русском играет русская запись и показан русский текст', async () => {
    mount({ language: 'ru' })
    await waitFor(() => expect(created[0]?.src).toBe('/audio/intro-ru.mp3'))
    expect(screen.getByRole('region', { name: 'Текст подсказки' })).toHaveTextContent(
      'Чтобы остановить эту подсказку и сразу начать, нажми Enter',
    )
  })

  it('пока играет запись, синтезатор молчит; после остановки снова говорит', async () => {
    const { tts, user } = mount()
    await waitFor(() => expect(playingNow()).toBe(true))
    expect(tts.spoken).toEqual([])
    await user.keyboard('{Enter}')
    await user.keyboard('{Alt>}{3}{/Alt}')
    expect(tts.spoken.at(-1)).toContain('Сабақтар')
  })

  describe('браузер заблокировал автозвук', () => {
    beforeEach(() => {
      allowAutoplay = false
    })

    it('показывает подсказку; Enter на главной кнопке запускает запись, второй Enter останавливает', async () => {
      const { user } = mount()
      expect(await screen.findByText(/Браузер дыбысты өзі қоспады/)).toBeInTheDocument()
      const listen = screen.getByRole('button', { name: 'Нұсқауды тыңдау' })
      expect(listen).toHaveFocus()

      allowAutoplay = true
      await user.keyboard('{Enter}')
      await waitFor(() => expect(playingNow()).toBe(true))
      expect(dialog()).toBeInTheDocument()

      await user.keyboard('{Enter}')
      expect(playingNow()).toBe(false)
      expect(dialog()).not.toBeInTheDocument()
    })

    it('любая другая клавиша запускает запись', async () => {
      const { user } = mount()
      await screen.findByText(/Браузер дыбысты өзі қоспады/)
      allowAutoplay = true
      await user.keyboard('a')
      await waitFor(() => expect(playingNow()).toBe(true))
    })

    it('«Өткізіп жіберу» закрывает окно без звука', async () => {
      const { user } = mount()
      await user.click(await screen.findByRole('button', { name: 'Өткізіп жіберу' }))
      expect(dialog()).not.toBeInTheDocument()
      expect(playingNow()).toBe(false)
    })
  })

  it('introOnStart=false: окно не открывается', () => {
    mount({ introOnStart: false })
    expect(dialog()).not.toBeInTheDocument()
    expect(created).toHaveLength(0)
  })

  it('без озвучки интерфейса окно показывается, но звук сам не играет; можно запустить кнопкой', async () => {
    const { user } = mount({ speakPrompts: false }, 20)
    expect(dialog()).toBeInTheDocument()
    await new Promise((r) => setTimeout(r, 80))
    expect(created).toHaveLength(0)
    await user.click(screen.getByRole('button', { name: 'Қайта тыңдау' }))
    await waitFor(() => expect(playingNow()).toBe(true))
  })

  it('клавиша H и кнопка в подвале открывают подсказку снова и сразу запускают звук', async () => {
    const { user } = mount({ introOnStart: false })
    await user.keyboard('h')
    expect(dialog()).toBeInTheDocument()
    await waitFor(() => expect(playingNow()).toBe(true))
    await user.keyboard('{Escape}')
    expect(dialog()).not.toBeInTheDocument()

    created.length = 0
    await user.click(screen.getByRole('button', { name: /Дауыстық көмекші \(H\)/ }))
    expect(dialog()).toBeInTheDocument()
    await waitFor(() => expect(playingNow()).toBe(true))
  })
})

describe('быстрые настройки в шапке', () => {
  it('A+/A−, контраст и язык меняют настройки', async () => {
    const { user } = mount({ introOnStart: false })
    await user.click(screen.getByRole('button', { name: /Шрифтті үлкейту/ }))
    expect(document.documentElement.style.getPropertyValue('--font-scale')).toBe('1.2')
    await user.click(screen.getByRole('button', { name: /Шрифтті кішірейту/ }))
    expect(screen.getByRole('button', { name: /Шрифтті кішірейту/ })).toBeDisabled()

    const contrast = screen.getByRole('button', { name: 'Контраст' })
    await user.click(contrast)
    expect(contrast).toHaveAttribute('aria-pressed', 'true')
    expect(document.documentElement.dataset.contrast).toBe('high')

    await user.click(screen.getByRole('button', { name: 'РУС' }))
    expect(document.documentElement.lang).toBe('ru')
    expect(screen.getByRole('button', { name: 'РУС' })).toHaveAttribute('aria-pressed', 'true')
  })
})
