import type { Material } from '../api/client'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

export const sampleMaterial = (id: string, prompt: string): Material => ({
  id,
  prompt,
  image_url: `/api/materials/${id}/image`,
  created_at: '2026-10-12T10:00:00Z',
  texts: {
    ru: {
      alt_text: `Картинка: ${prompt}.`,
      long_description: 'Слева красный круг. Справа синий квадрат.',
      ai_generated: true,
    },
    kk: {
      alt_text: `Сурет: ${prompt}.`,
      long_description: 'Сол жақта қызыл шеңбер. Оң жақта көк шаршы.',
      ai_generated: true,
    },
  },
})

/** Минимальная имитация бэкенда: список работ в памяти. */
export function installFakeApi(
  initial: Material[] = [],
  options: { patchError?: { code: string; message: string } } = {},
) {
  const items = [...initial]
  const calls: { method: string; url: string; body?: unknown; owner?: string }[] = []

  const spy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = String(input)
    const method = init?.method ?? 'GET'
    const headers = (init?.headers ?? {}) as Record<string, string>
    const body = init?.body ? JSON.parse(String(init.body)) : undefined
    calls.push({ method, url, body, owner: headers['X-Owner-Id'] })

    if (url === '/api/generate') {
      return json({
        image_id: 'img1',
        image_url: '/api/images/img1',
        prompt: body.prompt,
        cached: false,
      })
    }
    if (url === '/api/describe') {
      return json({
        image_id: 'img1',
        alt_text: 'Картинка: кот на крыше.',
        long_description: 'Слева красный круг. Справа синий квадрат.',
        language: body.language,
        ai_generated: true,
        cached: false,
      })
    }
    if (url === '/api/materials' && method === 'POST') {
      const m = sampleMaterial('m-new', 'кот на крыше')
      items.unshift(m)
      return json(m, 201)
    }
    if (url === '/api/materials') return json(items)

    const match = url.match(/^\/api\/materials\/([^/]+)$/)
    if (match) {
      const index = items.findIndex((m) => m.id === match[1])
      if (index < 0) {
        return json({ detail: { code: 'material_not_found', message: 'Работа не найдена.' } }, 404)
      }
      if (method === 'GET') return json(items[index])
      if (method === 'DELETE') {
        items.splice(index, 1)
        return new Response(null, { status: 204 })
      }
      if (method === 'PATCH') {
        if (options.patchError) return json({ detail: options.patchError }, 422)
        const m = items[index]
        m.texts[body.language as 'kk' | 'ru'] = {
          alt_text: body.alt_text ?? m.texts[body.language as 'kk' | 'ru'].alt_text,
          long_description:
            body.long_description ?? m.texts[body.language as 'kk' | 'ru'].long_description,
          ai_generated: false,
        }
        return json(m)
      }
    }
    return json({ detail: { code: 'unknown', message: 'нет' } }, 500)
  })
  return { items, calls, spy }
}
