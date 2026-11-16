import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useRoutes } from 'react-router-dom'
import { axe } from 'vitest-axe'
import { describeRetryDelays } from '../../api/client'
import { Providers } from '../../app/Providers'
import { routes } from '../../app/routes'
import type { SpeakOptions, STTProvider, TTSProvider } from '../../audio/types'

class FakeTTS implements TTSProvider {
  supported = true
  spoken: string[] = []
  hasVoice() {
    return true
  }
  speak(text: string, o: SpeakOptions) {
    this.spoken.push(text)
    o.onStart?.()
  }
  pause() {}
  resume() {}
  stop() {}
}
const stt: STTProvider = { supported: false, start() {}, stop() {} }

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers })

function Routes() {
  return useRoutes(routes)
}

function setup(path = '/') {
  localStorage.setItem('audiocanvas.settings', JSON.stringify({ language: 'ru' }))
  const tts = new FakeTTS()
  const view = render(
    <Providers audio={{ tts, stt }} syncProgress={false}>
      <MemoryRouter initialEntries={[path]}>
        <Routes />
      </MemoryRouter>
    </Providers>,
  )
  return { tts, user: userEvent.setup(), ...view }
}

const mockApi = () =>
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = String(input)
    if (url.endsWith('/generate')) {
      return json({
        image_id: 'abc',
        image_url: '/api/images/abc',
        prompt: 'кот на крыше',
        cached: false,
      })
    }
    return json({
      image_id: 'abc',
      alt_text: 'Картинка: кот на крыше.',
      long_description: 'Слева красный круг. В центре синий квадрат. Справа зелёный треугольник.',
      language: 'ru',
      ai_generated: true,
      cached: false,
    })
  })

beforeEach(() => localStorage.clear())
afterEach(() => vi.restoreAllMocks())

describe('создание картинки', () => {
  it('команда «создать картинку: …» → статус, «Готово», автоматическое описание', async () => {
    mockApi()
    const { tts, user, container } = setup()
    await user.type(screen.getByLabelText(/Команда/), 'создать картинку: кот на крыше{Enter}')

    expect(tts.spoken).toContain('Картинка создаётся')
    const img = await screen.findByRole('img', { name: 'Картинка: кот на крыше.' })
    expect(img).toHaveAttribute('src', '/api/images/abc')
    await waitFor(() => expect(tts.spoken.at(-1)).toBe('Готово. Картинка: кот на крыше.'))
    expect(screen.getByText(/создано искусственным интеллектом/)).toBeInTheDocument()
    expect(await axe(container)).toHaveNoViolations()

    // «слушать» озвучивает подробное описание
    await user.type(screen.getByLabelText(/Команда/), 'слушать{Enter}')
    expect(tts.spoken.at(-1)).toContain('Слева красный круг')
  })

  it('команда «создать …» из другого раздела переводит на страницу и запускает создание', async () => {
    mockApi()
    const { tts, user } = setup('/lessons')
    await user.type(screen.getByLabelText(/Команда/), 'создать кот на крыше{Enter}')
    expect(await screen.findByRole('img')).toBeInTheDocument()
    expect(tts.spoken).toContain('Картинка создаётся')
    expect(globalThis.fetch).toHaveBeenCalledWith(
      '/api/generate',
      expect.objectContaining({ body: JSON.stringify({ prompt: 'кот на крыше', language: 'ru' }) }),
    )
  })

  it('«создать» без описания спрашивает, что рисовать', async () => {
    mockApi()
    const { tts, user } = setup()
    await user.type(screen.getByLabelText(/Команда/), 'создать{Enter}')
    expect(tts.spoken.at(-1)).toContain('Что нарисовать?')
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('ошибка модерации озвучивается сообщением сервера', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      json({ detail: { code: 'unsafe_prompt', message: 'Это нельзя нарисовать.' } }, 422),
    )
    const { tts, user } = setup()
    await user.type(screen.getByLabelText('Что нарисовать?'), 'пистолет{Enter}')
    await waitFor(() => expect(tts.spoken.at(-1)).toBe('Это нельзя нарисовать.'))
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })

  it('при лимите запросов добавляется время ожидания', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      json({ detail: { code: 'rate_limited', message: 'Слишком много запросов.' } }, 429, {
        'Retry-After': '12',
      }),
    )
    const { tts, user } = setup()
    await user.type(screen.getByLabelText('Что нарисовать?'), 'дом{Enter}')
    await waitFor(() => expect(tts.spoken.at(-1)).toContain('через 12 сек'))
  })

  it('если сервер не отвечает, озвучивается отдельное сообщение', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'))
    const { tts, user } = setup()
    await user.type(screen.getByLabelText('Что нарисовать?'), 'дом{Enter}')
    await waitFor(() =>
      expect(tts.spoken.at(-1)).toBe('Нет связи с сервером. Проверь, что сервер запущен.'),
    )
  })

  it('клавиша L озвучивает подробное описание', async () => {
    mockApi()
    const { tts, user } = setup()
    await user.type(screen.getByLabelText(/Команда/), 'создать кот на крыше{Enter}')
    await screen.findByRole('img', { name: /кот на крыше/ })
    await user.click(document.body)
    await user.keyboard('l')
    expect(tts.spoken.at(-1)).toContain('Слева красный круг')
  })

  it('если описание временно не получилось (502), запрос повторяется и всё равно удаётся', async () => {
    const saved = [...describeRetryDelays]
    describeRetryDelays.splice(0, describeRetryDelays.length, 0, 0)
    let describeCalls = 0
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      if (String(input).endsWith('/generate')) {
        return json({ image_id: 'abc', image_url: '/api/images/abc', prompt: 'кот', cached: false })
      }
      describeCalls++
      if (describeCalls < 3) {
        return json({ detail: { code: 'provider_error', message: 'Не получилось.' } }, 502)
      }
      return json({
        image_id: 'abc',
        alt_text: 'Кот.',
        long_description: 'Слева кот.',
        language: 'ru',
        ai_generated: true,
        cached: false,
      })
    })
    const { tts, user } = setup()
    await user.type(screen.getByLabelText('Что нарисовать?'), 'кот{Enter}')
    expect(await screen.findByRole('img', { name: 'Кот.' })).toBeInTheDocument()
    expect(describeCalls).toBe(3)
    await waitFor(() => expect(tts.spoken.at(-1)).toBe('Готово. Кот.'))
    describeRetryDelays.splice(0, describeRetryDelays.length, ...saved)
  })

  it('постоянная ошибка описания не повторяется бесконечно', async () => {
    const saved = [...describeRetryDelays]
    describeRetryDelays.splice(0, describeRetryDelays.length, 0, 0)
    let describeCalls = 0
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      if (String(input).endsWith('/generate')) {
        return json({ image_id: 'abc', image_url: '/api/images/abc', prompt: 'кот', cached: false })
      }
      describeCalls++
      return json({ detail: { code: 'provider_error', message: 'Не получилось.' } }, 502)
    })
    const { tts, user } = setup()
    await user.type(screen.getByLabelText('Что нарисовать?'), 'кот{Enter}')
    await waitFor(() => expect(tts.spoken.at(-1)).toBe('Не получилось.'))
    expect(describeCalls).toBe(3)
    describeRetryDelays.splice(0, describeRetryDelays.length, ...saved)
  })
})
