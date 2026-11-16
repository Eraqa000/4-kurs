import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useRoutes } from 'react-router-dom'
import { axe } from 'vitest-axe'
import { Providers } from '../../app/Providers'
import { routes } from '../../app/routes'
import type { SpeakOptions, STTProvider, TTSProvider } from '../../audio/types'
import { checkDescription, lessons } from './content'

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

function setup(path: string, settings: object = {}) {
  localStorage.clear()
  localStorage.setItem('audiocanvas.settings', JSON.stringify({ language: 'ru', ...settings }))
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

const next = () => screen.getByRole('button', { name: 'Дальше' })

describe('содержимое уроков', () => {
  it('5–8 уроков, у каждого цель и оба языка во всех текстах', () => {
    expect(lessons.length).toBeGreaterThanOrEqual(5)
    expect(lessons.length).toBeLessThanOrEqual(8)
    for (const l of lessons) {
      expect(l.goal.kk && l.goal.ru).toBeTruthy()
      for (const s of l.steps) {
        const texts = s.type === 'info' ? [s.text] : [s.prompt]
        if (s.type === 'choice') {
          texts.push(s.correctFeedback, s.hint, ...s.options)
          expect(s.correct).toBeLessThan(s.options.length)
        }
        for (const tr of texts) expect(tr.kk && tr.ru).toBeTruthy()
      }
    }
  })

  it('checkDescription распознаёт цвет и место', () => {
    expect(checkDescription('на крыше красного дома сидит кот')).toMatchObject({ hasColor: true })
    expect(checkDescription('кот слева, дерево справа')).toMatchObject({
      hasPosition: true,
      hasColor: false,
    })
    expect(checkDescription('кот').enough).toBe(false)
  })
})

describe('список уроков', () => {
  it('показывает уроки со статусом, без нарушений axe', async () => {
    const { container } = setup('/lessons')
    const links = screen.getAllByRole('link', { name: /^Урок \d/ })
    expect(links).toHaveLength(lessons.length)
    expect(links[0]).toHaveAccessibleName('Урок 1: Что такое описание картинки, не начат')
    expect(await axe(container)).toHaveNoViolations()
  })
})

describe('прохождение урока', () => {
  it('урок «Слева и справа» проходится одной клавиатурой, прогресс сохраняется', async () => {
    const { tts, user, container } = setup('/lessons/left-right')
    expect(tts.spoken.some((s) => s.includes('Цель: различать лево и право.'))).toBe(true)
    expect(await axe(container)).toHaveNoViolations()

    await user.click(next()) // шаг 1: объяснение
    expect(tts.spoken.at(-1)).toContain('Красный круг слева')
    await user.keyboard('2')
    expect(tts.spoken.at(-1)).toBe('Правильно! Справа синий квадрат.')
    await user.click(next())
    await user.keyboard('1')
    expect(tts.spoken.at(-1)).toBe('Молодец! Слева зелёный треугольник.')
    await user.click(next())

    expect(tts.spoken.at(-1)).toBe('Урок пройден. Молодец!')
    expect(screen.getByRole('link', { name: 'К следующему уроку' })).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem('audiocanvas.progress')!)).toEqual({
      'left-right': 'done',
    })
  })

  it('ошибка: сначала подсказка, после второй ошибки показывается ответ и можно идти дальше', async () => {
    const { tts, user } = setup('/lessons/left-right')
    await user.click(next())
    await user.keyboard('1')
    expect(tts.spoken.at(-1)).toContain('Подумай про правую руку')
    await user.keyboard('1')
    expect(tts.spoken.at(-1)).toBe('Правильный ответ: Синий квадрат')
    await user.click(next())
    expect(screen.getByRole('heading', { level: 2, name: 'Шаг 3 из 3' })).toBeInTheDocument()
  })

  it('нельзя перейти дальше без ответа', async () => {
    const { tts, user } = setup('/lessons/left-right')
    await user.click(next())
    await user.click(next())
    expect(tts.spoken.at(-1)).toBe('Сначала ответь на задание.')
    expect(screen.getByRole('heading', { level: 2, name: 'Шаг 2 из 3' })).toBeInTheDocument()
  })

  it('голосовой ответ по тексту варианта и команда «дальше»', async () => {
    const { tts, user } = setup('/lessons/left-right')
    await user.click(next())
    await user.type(screen.getByLabelText(/Команда/), 'справа синий квадрат{Enter}')
    expect(tts.spoken.at(-1)).toBe('Правильно! Справа синий квадрат.')
    await user.type(screen.getByLabelText(/Команда/), 'дальше{Enter}')
    expect(screen.getByRole('heading', { level: 2, name: 'Шаг 3 из 3' })).toBeInTheDocument()
  })

  it('при выключенных горячих клавишах цифры не отвечают, кнопки работают', async () => {
    const { user } = setup('/lessons/left-right', { hotkeysEnabled: false })
    await user.click(next())
    await user.keyboard('2')
    expect(screen.queryByText('Правильно! Справа синий квадрат.')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: '2. Синий квадрат' }))
    expect(screen.getByText('Правильно! Справа синий квадрат.')).toBeInTheDocument()
  })

  it('свободное описание: мягкая обратная связь, засчитывается при ≥3 слов', async () => {
    const { tts, user } = setup('/lessons/describe')
    await user.click(next())
    const input = screen.getByLabelText('Напиши свой ответ')
    await user.type(input, 'кот{Enter}')
    expect(tts.spoken.at(-1)).toBe('Расскажи чуть больше: хотя бы три слова.')
    await user.clear(input)
    await user.type(input, 'чёрный кот сидит на крыше{Enter}')
    expect(tts.spoken.at(-1)).toContain('скажи, где что стоит')
    await user.clear(input)
    await user.type(input, 'чёрный кот на крыше, справа зелёное дерево{Enter}')
    expect(tts.spoken.at(-1)).toBe('Отлично! Ты назвал и цвет, и место.')
    await user.click(next())
    expect(tts.spoken.at(-1)).toBe('Урок пройден. Молодец!')
  })

  it('неизвестный урок', () => {
    setup('/lessons/nope')
    expect(screen.getByText('Урок не найден.')).toBeInTheDocument()
  })
})
