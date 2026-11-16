import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const css = readFileSync(resolve(import.meta.dirname, '../index.css'), 'utf-8')

/** WCAG 2.1 AA: текст ≥ 4.5:1, элементы интерфейса и фокус ≥ 3:1. Читаем реальные значения из index.css. */

function vars(selector: string): Record<string, string> {
  const block = css.match(new RegExp(`${selector.replace(/[[\]'.]/g, '\\$&')}\\s*\\{([^}]*)\\}`))
  if (!block) throw new Error(`Нет блока ${selector}`)
  const out: Record<string, string> = {}
  for (const m of block[1].matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})/g)) out[m[1]] = m[2]
  return out
}

const luminance = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export const ratio = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

const normal = vars(':root')
const high = { ...normal, ...vars(":root[data-contrast='high']") }

describe.each([
  ['обычная тема', normal],
  ['высокий контраст', high],
])('контраст: %s', (_name, p) => {
  it.each([
    ['текст на фоне', 'fg', 'bg', 4.5],
    ['второстепенный текст на фоне', 'muted', 'bg', 4.5],
    ['текст на акцентной кнопке', 'accent-fg', 'accent', 4.5],
    ['акцент на фоне (нетекстовый)', 'accent', 'bg', 3],
    ['рамки на фоне', 'border', 'bg', 3],
    ['текст на карточке', 'fg', 'surface', 4.5],
    ['второстепенный текст на карточке', 'muted', 'surface', 4.5],
    ['рамки на карточке', 'border', 'surface', 3],
    ['акцент на карточке (нетекстовый)', 'accent', 'surface', 3],
    ['голубая рамка кнопок на карточке', 'sky', 'surface', 3],
    ['ссылки (голубой) на фоне', 'sky', 'bg', 4.5],
    ['контур фокуса на фоне', 'focus', 'bg', 3],
  ])('%s ≥ %s', (_label, a, b, min) => {
    expect(ratio(p[a], p[b])).toBeGreaterThanOrEqual(min as number)
  })
})

it('контур фокуса отступает от элемента, поэтому лежит на фоне страницы, а не на цвете кнопки', () => {
  expect(css).toMatch(/:focus-visible\s*\{[^}]*outline-offset:\s*[2-9]px/)
})

it('толщина контура фокуса не меньше 3px', () => {
  expect(Number(css.match(/--focus-width:\s*(\d+)px/)?.[1])).toBeGreaterThanOrEqual(3)
})
