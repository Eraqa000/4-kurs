// Проверка Lighthouse accessibility >= 95 на ключевых страницах.
// Запуск: сначала `npm run build && npm run preview`, затем `node scripts/lighthouse-check.mjs`.
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const base = process.env.BASE_URL ?? 'http://localhost:4173'
const threshold = Number(process.env.MIN_SCORE ?? 0.95)
const pages = ['/', '/gallery', '/lessons', '/lessons/left-right', '/lessons/describe', '/settings']
const dir = mkdtempSync(join(tmpdir(), 'lh-'))

let failed = false
for (const path of pages) {
  const out = join(dir, path.replace(/\W+/g, '_') + '.json')
  execFileSync(
    'npx',
    [
      '--yes',
      'lighthouse@13',
      base + path,
      '--only-categories=accessibility',
      '--chrome-flags=--headless=new --no-sandbox',
      '--output=json',
      `--output-path=${out}`,
      '--quiet',
    ],
    { stdio: 'inherit' },
  )
  const report = JSON.parse(readFileSync(out, 'utf-8'))
  const score = report.categories.accessibility.score
  const failing = Object.values(report.audits)
    .filter((a) => a.scoreDisplayMode === 'binary' && a.score === 0)
    .map((a) => a.id)
  console.log(`${score >= threshold ? 'OK  ' : 'FAIL'} ${path}  ${Math.round(score * 100)}  ${failing.join(', ')}`)
  if (score < threshold) failed = true
}
process.exit(failed ? 1 : 0)
