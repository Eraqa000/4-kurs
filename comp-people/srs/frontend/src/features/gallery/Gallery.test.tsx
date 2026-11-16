import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useRoutes } from 'react-router-dom'
import { axe } from 'vitest-axe'
import { Providers } from '../../app/Providers'
import { routes } from '../../app/routes'
import type { SpeakOptions, STTProvider, TTSProvider } from '../../audio/types'
import { installFakeApi, sampleMaterial } from '../../test/fakeApi'

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

function Routes() {
  return useRoutes(routes)
}

function setup(path: string) {
  localStorage.clear()
  localStorage.setItem('audiocanvas.settings', JSON.stringify({ language: 'ru' }))
  const tts = new FakeTTS()
  const view = render(
    <Providers audio={{ tts, stt }}>
      <MemoryRouter initialEntries={[path]}>
        <Routes />
      </MemoryRouter>
    </Providers>,
  )
  return { tts, user: userEvent.setup(), ...view }
}

afterEach(() => vi.restoreAllMocks())

describe('сохранение из «Создать»', () => {
  it('команда «сохранить» сохраняет работу и озвучивает, где её найти', async () => {
    const { calls } = installFakeApi()
    const { tts, user } = setup('/')
    await user.type(screen.getByLabelText(/Команда/), 'создать кот на крыше{Enter}')
    await screen.findByRole('img', { name: /кот на крыше/ })

    await user.type(screen.getByLabelText(/Команда/), 'сохранить{Enter}')
    await waitFor(() => expect(tts.spoken.at(-1)).toContain('Сохранено'))
    const post = calls.find((c) => c.method === 'POST' && c.url === '/api/materials')
    expect(post?.body).toEqual({ image_id: 'img1' })
    expect(post?.owner).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Открыть мои работы' })).toBeInTheDocument()

    await user.type(screen.getByLabelText(/Команда/), 'сохранить{Enter}')
    expect(tts.spoken.at(-1)).toBe('Эта работа уже сохранена.')
  })

  it('«сохранить» без картинки подсказывает, что сначала нужно создать', async () => {
    installFakeApi()
    const { tts, user } = setup('/')
    await user.type(screen.getByLabelText(/Команда/), 'сохранить{Enter}')
    expect(tts.spoken.at(-1)).toBe('Сначала нужно создать картинку.')
  })
})

describe('галерея', () => {
  const items = [sampleMaterial('a', 'кот на крыше'), sampleMaterial('b', 'красный дом')]

  it('показывает работы, озвучивает количество, без нарушений axe', async () => {
    installFakeApi(items)
    const { tts, container } = setup('/gallery')
    expect(await screen.findByRole('link', { name: 'кот на крыше' })).toHaveAttribute(
      'href',
      '/gallery/a',
    )
    await waitFor(() => expect(tts.spoken).toContain('Работ: 2'))
    expect(await axe(container)).toHaveNoViolations()
  })

  it('пустая галерея ведёт к созданию', async () => {
    installFakeApi([])
    const { tts } = setup('/gallery')
    expect(await screen.findByText('Пока нет работ.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Перейти к созданию картинки' })).toBeInTheDocument()
    await waitFor(() => expect(tts.spoken).toContain('Работ: 0'))
  })

  it('поиск фильтрует работы', async () => {
    installFakeApi(items)
    const { user } = setup('/gallery')
    await screen.findByRole('link', { name: 'красный дом' })
    await user.type(screen.getByLabelText('Найти работу'), 'дом')
    expect(screen.queryByRole('link', { name: 'кот на крыше' })).not.toBeInTheDocument()
    await user.clear(screen.getByLabelText('Найти работу'))
    await user.type(screen.getByLabelText('Найти работу'), 'ничего')
    expect(screen.getByText('Ничего не найдено.')).toBeInTheDocument()
  })

  it('«слушать» перечисляет названия', async () => {
    installFakeApi(items)
    const { tts, user } = setup('/gallery')
    await screen.findByRole('link', { name: 'красный дом' })
    await user.type(screen.getByLabelText(/Команда/), 'слушать{Enter}')
    expect(tts.spoken.at(-1)).toBe('Работы: 1. кот на крыше. 2. красный дом')
  })

  it('ошибка загрузки озвучивается', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'))
    const { tts } = setup('/gallery')
    expect(await screen.findByText('Не удалось загрузить работы.')).toBeInTheDocument()
    await waitFor(() => expect(tts.spoken).toContain('Не удалось загрузить работы.'))
  })
})

describe('страница работы', () => {
  const items = () => [sampleMaterial('a', 'кот на крыше')]

  it('показывает описание, пометку ИИ, ссылки на скачивание; axe чисто', async () => {
    installFakeApi(items())
    const { container } = setup('/gallery/a')
    expect(
      await screen.findByRole('heading', { level: 1, name: 'кот на крыше' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Картинка: кот на крыше.' })).toBeInTheDocument()
    expect(screen.getByText(/создано искусственным интеллектом/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Скачать ZIP/ })).toHaveAttribute(
      'href',
      '/api/materials/a/export?language=ru',
    )
    expect(screen.getByRole('link', { name: 'Скачать аудио' })).toHaveAttribute(
      'href',
      '/api/materials/a/audio?language=ru',
    )
    expect(await axe(container)).toHaveNoViolations()
  })

  it('кнопки озвучивают краткое и подробное описание, «слушать» — оба', async () => {
    installFakeApi(items())
    const { tts, user } = setup('/gallery/a')
    await screen.findByRole('heading', { level: 1 })
    await user.click(screen.getByRole('button', { name: 'Послушать кратко' }))
    expect(tts.spoken.at(-1)).toBe('Картинка: кот на крыше.')
    await user.click(screen.getByRole('button', { name: 'Послушать подробно' }))
    expect(tts.spoken.at(-1)).toBe('Слева красный круг. Справа синий квадрат.')
    await user.type(screen.getByLabelText(/Команда/), 'слушать{Enter}')
    expect(tts.spoken.at(-1)).toBe(
      'Картинка: кот на крыше. Слева красный круг. Справа синий квадрат.',
    )
  })

  it('редактирование: фокус в поле, сохранение, пометка «отредактировано», фокус возвращается', async () => {
    const { calls } = installFakeApi(items())
    const { tts, user } = setup('/gallery/a')
    await screen.findByRole('heading', { level: 1 })
    await user.click(screen.getByRole('button', { name: 'Редактировать описание' }))
    const short = await screen.findByLabelText('Краткое описание', { selector: 'textarea' })
    await waitFor(() => expect(short).toHaveFocus())

    await user.clear(short)
    await user.type(short, 'Чёрный кот сидит на крыше.')
    await user.click(screen.getByRole('button', { name: 'Сохранить правки' }))

    expect(await screen.findByText('Описание отредактировано человеком.')).toBeInTheDocument()
    expect(tts.spoken).toContain('Описание сохранено')
    expect(calls.find((c) => c.method === 'PATCH')?.body).toEqual({
      language: 'ru',
      alt_text: 'Чёрный кот сидит на крыше.',
      long_description: 'Слева красный круг. Справа синий квадрат.',
    })
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Редактировать описание' })).toHaveFocus(),
    )
  })

  it('отказ сервера при правке озвучивается его сообщением', async () => {
    installFakeApi(items(), {
      patchError: { code: 'invalid_text', message: 'Этот текст нельзя сохранить.' },
    })
    const { tts, user } = setup('/gallery/a')
    await screen.findByRole('heading', { level: 1 })
    await user.click(screen.getByRole('button', { name: 'Редактировать описание' }))
    await user.click(screen.getByRole('button', { name: 'Сохранить правки' }))
    await waitFor(() => expect(tts.spoken.at(-1)).toBe('Этот текст нельзя сохранить.'))
  })

  it('удаление требует подтверждения, фокус на «Нет»; после «Да» работа исчезает из списка', async () => {
    const { items: store } = installFakeApi(items())
    const { tts, user } = setup('/gallery/a')
    await screen.findByRole('heading', { level: 1 })
    await user.click(screen.getByRole('button', { name: 'Удалить работу' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Нет' })).toHaveFocus())

    await user.click(screen.getByRole('button', { name: 'Нет' }))
    expect(store).toHaveLength(1)
    await user.click(screen.getByRole('button', { name: 'Удалить работу' }))
    await user.click(screen.getByRole('button', { name: 'Да, удалить' }))

    await waitFor(() => expect(store).toHaveLength(0))
    expect(tts.spoken).toContain('Работа удалена')
    expect(await screen.findByText('Пока нет работ.')).toBeInTheDocument()
  })

  it('несуществующая работа', async () => {
    installFakeApi([])
    setup('/gallery/zzz')
    expect(await screen.findByText('Работа не найдена.')).toBeInTheDocument()
  })
})
