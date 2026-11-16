import type { Lang } from '../i18n/messages'

export interface GeneratedImage {
  image_id: string
  image_url: string
  prompt: string
  cached: boolean
}

export interface ImageDescription {
  image_id: string
  alt_text: string
  long_description: string
  language: Lang
  ai_generated: boolean
  cached: boolean
}

export interface MaterialText {
  alt_text: string
  long_description: string
  /** false — текст правил человек */
  ai_generated: boolean
}

export interface Material {
  id: string
  prompt: string
  image_url: string
  created_at: string
  texts: Record<Lang, MaterialText>
}

/** Ошибка API. message уже на языке пользователя — её можно сразу озвучивать. */
export class ApiError extends Error {
  status: number
  code: string
  retryAfter?: number

  constructor(status: number, code: string, message: string, retryAfter?: number) {
    super(message)
    this.status = status
    this.code = code
    this.retryAfter = retryAfter
  }
}

const OWNER_KEY = 'audiocanvas.owner'

/**
 * Анонимный идентификатор устройства: пока нет входа, он отделяет работы разных детей
 * на одном сервере. Это не защита, а разделение списков.
 */
export function getOwnerId(): string {
  try {
    const saved = localStorage.getItem(OWNER_KEY)
    if (saved) return saved
    const id =
      globalThis.crypto?.randomUUID?.() ?? `dev-${Math.random().toString(36).slice(2)}${Date.now()}`
    localStorage.setItem(OWNER_KEY, id)
    return id
  } catch {
    return 'device-session-' + Math.random().toString(36).slice(2, 18).padEnd(16, '0')
  }
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      'X-Owner-Id': getOwnerId(),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal,
  })
  if (!res.ok) {
    const data = await res.json().catch(() => null)
    const detail = data?.detail
    const retry = Number(res.headers.get('Retry-After')) || undefined
    throw new ApiError(res.status, detail?.code ?? 'unknown', detail?.message ?? '', retry)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export const generateImage = (prompt: string, language: Lang, signal?: AbortSignal) =>
  request<GeneratedImage>('POST', '/generate', { prompt, language }, signal)

/** Паузы перед повторами описания (мс). Картинка уже создана и лежит на сервере, терять её жалко. */
export const describeRetryDelays: number[] = [1500, 3000]

/**
 * Описание: если ИИ-сервис временно перегружен (502) или нет связи, пробуем ещё раз.
 * Остальные ошибки (картинка не найдена, лимит запросов) повторять бесполезно.
 */
export async function describeImage(
  imageId: string,
  language: Lang,
  signal?: AbortSignal,
): Promise<ImageDescription> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await request<ImageDescription>(
        'POST',
        '/describe',
        { image_id: imageId, language },
        signal,
      )
    } catch (err) {
      const temporary = !(err instanceof ApiError) || err.status === 502
      if (!temporary || attempt >= describeRetryDelays.length || signal?.aborted) throw err
      await new Promise((resolve) => setTimeout(resolve, describeRetryDelays[attempt]))
    }
  }
}

export const saveMaterial = (imageId: string) =>
  request<Material>('POST', '/materials', { image_id: imageId })

export const listMaterials = (signal?: AbortSignal) =>
  request<Material[]>('GET', '/materials', undefined, signal)

export const getMaterial = (id: string, signal?: AbortSignal) =>
  request<Material>('GET', `/materials/${id}`, undefined, signal)

export const updateMaterialText = (
  id: string,
  language: Lang,
  texts: { alt_text?: string; long_description?: string },
) => request<Material>('PATCH', `/materials/${id}`, { language, ...texts })

export type LessonStatus = 'not_started' | 'in_progress' | 'done'

export const getProgress = (signal?: AbortSignal) =>
  request<Record<string, LessonStatus>>('GET', '/progress', undefined, signal)

export const putProgress = (lessonId: string, status: LessonStatus) =>
  request<{ status: LessonStatus }>('PUT', `/progress/${lessonId}`, { status })

export const deleteMaterial = (id: string) => request<void>('DELETE', `/materials/${id}`)

/** Ссылки на скачивание: идентификатор работы — случайный UUID, заголовок владельца не нужен. */
export const exportUrl = (id: string, language: Lang) =>
  `/api/materials/${id}/export?language=${language}`
export const audioUrl = (id: string, language: Lang) =>
  `/api/materials/${id}/audio?language=${language}`
