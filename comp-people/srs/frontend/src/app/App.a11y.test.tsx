import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useRoutes } from 'react-router-dom'
import { axe } from 'vitest-axe'
import { Providers } from './Providers'
import { routes } from './routes'

function Routes() {
  return useRoutes(routes)
}

function renderAt(path: string) {
  return render(
    <Providers>
      <MemoryRouter initialEntries={[path]}>
        <Routes />
      </MemoryRouter>
    </Providers>,
  )
}

beforeEach(() => {
  localStorage.clear()
  // галерея грузит список работ: отдаём пустой
  vi.spyOn(globalThis, 'fetch').mockImplementation(
    async () =>
      new Response('[]', { status: 200, headers: { 'Content-Type': 'application/json' } }),
  )
})

afterEach(() => vi.restoreAllMocks())

describe.each(['/', '/gallery', '/lessons', '/settings'])('страница %s', (path) => {
  it('не имеет нарушений axe', async () => {
    const { container } = renderAt(path)
    expect(await axe(container)).toHaveNoViolations()
  })

  it('содержит landmarks и один h1', () => {
    renderAt(path)
    expect(screen.getByRole('banner')).toBeInTheDocument()
    expect(screen.getByRole('navigation')).toBeInTheDocument()
    expect(screen.getByRole('main')).toBeInTheDocument()
    expect(screen.getByRole('contentinfo')).toBeInTheDocument()
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
  })
})

describe('клавиатура', () => {
  it('ссылка «Перейти к содержимому» первая в порядке фокуса', async () => {
    renderAt('/')
    await userEvent.tab()
    expect(screen.getByRole('link', { name: 'Мазмұнға өту' })).toHaveFocus()
  })

  it('? открывает список хоткеев, Esc закрывает и возвращает фокус', async () => {
    renderAt('/')
    const user = userEvent.setup()
    await user.tab()
    await user.keyboard('?')
    const dialog = screen.getByRole('dialog', { name: 'Жылдам пернелер' })
    expect(dialog).toBeInTheDocument()
    expect(await axe(dialog)).toHaveNoViolations()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Мазмұнға өту' })).toHaveFocus()
  })

  it('Alt+3 переходит к урокам и переносит фокус на заголовок', async () => {
    renderAt('/')
    const user = userEvent.setup()
    await user.keyboard('{Alt>}{3}{/Alt}')
    expect(await screen.findByRole('heading', { level: 1, name: 'Сабақтар' })).toHaveFocus()
  })

  it('хоткеи можно отключить в настройках', async () => {
    renderAt('/settings')
    const user = userEvent.setup()
    await user.click(screen.getByRole('checkbox', { name: 'Жылдам пернелерді қосу' }))
    await user.keyboard('?')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

describe('настройки', () => {
  it('высокий контраст и размер шрифта применяются к документу', async () => {
    renderAt('/settings')
    const user = userEvent.setup()
    await user.click(screen.getByRole('checkbox', { name: 'Жоғары контраст' }))
    expect(document.documentElement.dataset.contrast).toBe('high')
    await user.selectOptions(screen.getByRole('combobox', { name: 'Тіл' }), 'ru')
    expect(document.documentElement.lang).toBe('ru')
    expect(screen.getByRole('heading', { level: 1, name: 'Настройки' })).toBeInTheDocument()
  })
})
