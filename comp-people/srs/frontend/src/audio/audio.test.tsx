import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useRoutes } from 'react-router-dom'
import { axe } from 'vitest-axe'
import { Providers } from '../app/Providers'
import { routes } from '../app/routes'
import type { ListenOptions, SpeakOptions, STTProvider, TTSProvider } from './types'

class FakeTTS implements TTSProvider {
  supported = true
  spoken: string[] = []
  calls: string[] = []
  last?: SpeakOptions
  hasVoice() {
    return true
  }
  speak(text: string, o: SpeakOptions) {
    this.spoken.push(text)
    this.last = o
    o.onStart?.()
  }
  pause() {
    this.calls.push('pause')
  }
  resume() {
    this.calls.push('resume')
  }
  stop() {
    this.calls.push('stop')
    this.last?.onEnd?.()
  }
}

class FakeSTT implements STTProvider {
  supported: boolean
  constructor(supported = true) {
    this.supported = supported
  }
  opts?: ListenOptions
  start(o: ListenOptions) {
    this.opts = o
  }
  stop() {
    this.opts?.onEnd()
  }
}

function Routes() {
  return useRoutes(routes)
}

function setup(path = '/', stt = new FakeSTT(), tts = new FakeTTS()) {
  localStorage.clear()
  const view = render(
    <Providers audio={{ tts, stt }}>
      <MemoryRouter initialEntries={[path]}>
        <Routes />
      </MemoryRouter>
    </Providers>,
  )
  return { tts, stt, user: userEvent.setup(), ...view }
}

describe('аудио-слой', () => {
  it('R повторяет последнюю озвученную фразу', async () => {
    const { tts, user } = setup()
    await user.keyboard('{Alt>}{3}{/Alt}') // переход озвучивает название страницы
    expect(tts.spoken).toHaveLength(1)
    await user.keyboard('r')
    expect(tts.spoken).toHaveLength(2)
    expect(tts.spoken[1]).toBe(tts.spoken[0])
  })

  it('Esc: сначала пауза, затем остановка', async () => {
    const { tts, user } = setup()
    await user.keyboard('{Alt>}{3}{/Alt}')
    await user.keyboard('{Escape}')
    expect(tts.calls).toEqual(['pause'])
    await user.keyboard('{Escape}')
    expect(tts.calls).toEqual(['pause', 'stop'])
  })

  it('текстовая команда «назад»/«создать» выполняет навигацию', async () => {
    const { user } = setup('/lessons')
    const input = screen.getByLabelText(/Команда/)
    await user.type(input, 'создать{Enter}')
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Сурет жасау' }),
    ).toBeInTheDocument()
    await user.type(screen.getByLabelText(/Команда/), 'назад{Enter}')
    expect(await screen.findByRole('heading', { level: 1, name: 'Сабақтар' })).toBeInTheDocument()
  })

  it('голосовая команда из STT выполняется', async () => {
    const { stt, user } = setup('/gallery')
    await user.keyboard('v')
    expect(stt.opts).toBeDefined()
    stt.opts!.onResult('Создать картинку: кот на крыше')
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Сурет жасау' }),
    ).toBeInTheDocument()
    expect(screen.getByText(/Естідім/)).toBeInTheDocument()
  })

  it('фраза без команды считается описанием картинки и запускает создание', async () => {
    const { stt, user } = setup('/gallery')
    await user.keyboard('v')
    stt.opts!.onResult('кот на крыше')
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Сурет жасау' }),
    ).toBeInTheDocument()
    await waitFor(() => expect(screen.getByLabelText('Не салу керек?')).toHaveValue('кот на крыше'))
  })

  it('слишком короткий шум распознавания озвучивается как «не понял»', async () => {
    const { tts, user } = setup()
    await user.type(screen.getByLabelText(/Команда/), 'э{Enter}')
    expect(tts.spoken.at(-1)).toContain('Түсінбедім')
  })

  it('без STT показывается текстовый режим и сообщение, кнопки микрофона нет', async () => {
    const { tts, container } = setup('/', new FakeSTT(false))
    expect(screen.queryByRole('button', { name: /Микрофон/ })).not.toBeInTheDocument()
    expect(screen.getByLabelText(/Команда/)).toBeInTheDocument()
    expect(tts.spoken.some((s) => s.includes('дауысты танымайды'))).toBe(true)
    expect(await axe(container)).toHaveNoViolations()
  })

  it('отключение озвучки интерфейса убирает озвучку переходов', async () => {
    const tts = new FakeTTS()
    localStorage.setItem('audiocanvas.settings', JSON.stringify({ speakPrompts: false }))
    const user = userEvent.setup()
    render(
      <Providers audio={{ tts, stt: new FakeSTT() }}>
        <MemoryRouter>
          <Routes />
        </MemoryRouter>
      </Providers>,
    )
    await user.keyboard('{Alt>}{3}{/Alt}')
    expect(tts.spoken).toHaveLength(0)
  })
})
