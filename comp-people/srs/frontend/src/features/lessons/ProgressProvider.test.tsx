import { render, screen, waitFor } from '@testing-library/react'
import { ProgressProvider } from './ProgressProvider'
import { useProgress } from './progress'

function Probe() {
  const { status, mark } = useProgress()
  return (
    <>
      <p>a: {status('a')}</p>
      <p>b: {status('b')}</p>
      <p>c: {status('c')}</p>
      <button onClick={() => mark('c', 'in_progress')}>mark c</button>
    </>
  )
}

const json = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })

afterEach(() => vi.restoreAllMocks())

describe('синхронизация прогресса с сервером', () => {
  it('сливает локальные и серверные данные, done не понижается, локальное уходит на сервер', async () => {
    localStorage.clear()
    localStorage.setItem('audiocanvas.progress', JSON.stringify({ a: 'in_progress', b: 'done' }))
    const puts: string[] = []
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      if (init?.method === 'PUT') {
        puts.push(`${String(input)} ${init.body}`)
        return json({ status: 'done' })
      }
      return json({ a: 'done' }) // на сервере a уже пройден, b неизвестен
    })

    render(
      <ProgressProvider>
        <Probe />
      </ProgressProvider>,
    )
    // сначала видна локальная копия
    expect(screen.getByText('a: in_progress')).toBeInTheDocument()

    await waitFor(() => expect(screen.getByText('a: done')).toBeInTheDocument())
    expect(screen.getByText('b: done')).toBeInTheDocument()
    expect(puts).toEqual(['/api/progress/b {"status":"done"}'])
    expect(JSON.parse(localStorage.getItem('audiocanvas.progress')!)).toEqual({
      a: 'done',
      b: 'done',
    })
  })

  it('mark пишет в localStorage и на сервер; без сервера работает локально', async () => {
    localStorage.clear()
    const calls: string[] = []
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      calls.push(`${init?.method ?? 'GET'} ${String(input)}`)
      if (init?.method === 'PUT') throw new Error('offline')
      return json({})
    })
    render(
      <ProgressProvider>
        <Probe />
      </ProgressProvider>,
    )
    screen.getByText('mark c').click()
    await waitFor(() => expect(screen.getByText('c: in_progress')).toBeInTheDocument())
    expect(JSON.parse(localStorage.getItem('audiocanvas.progress')!)).toEqual({ c: 'in_progress' })
    expect(calls).toContain('PUT /api/progress/c')
  })
})
