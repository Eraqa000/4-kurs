import type { Command } from './types'

export interface ParsedCommand {
  command: Command
  args: string
}

// Основы слов на казахском и русском: распознаватель может вернуть любую форму слова
const STEMS: Record<Command, string[]> = {
  create: ['созда', 'нарису', 'жаса', 'сыз'],
  listen: ['слуша', 'тыңда', 'тында'],
  repeat: ['повтор', 'қайтала', 'кайтала'],
  back: ['назад', 'артқа', 'артка'],
  save: ['сохран', 'сақта', 'сакта'],
  next: ['дальше', 'далее', 'следующ', 'келесі', 'кейінгі'],
}

const FILLER = new Set(['картинку', 'картинка', 'рисунок', 'сурет', 'суретті', 'мне'])

function normalize(text: string): string {
  return text.toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim()
}

/** Находит голосовую команду в распознанной фразе. «Создать картинку: кот на крыше» → create + «кот на крыше». */
export function parseCommand(input: string): ParsedCommand | null {
  const text = normalize(input)
  const words = text.split(' ')
  for (let i = 0; i < words.length; i++) {
    const word = words[i].replace(/[.,:;!?]/g, '')
    for (const [command, stems] of Object.entries(STEMS) as [Command, string[]][]) {
      if (!stems.some((s) => word.startsWith(s))) continue
      const rest = words.slice(i + 1)
      while (rest.length && FILLER.has(rest[0].replace(/[.,:;!?]/g, ''))) rest.shift()
      const args = rest
        .join(' ')
        .replace(/^[:,\-–—\s]+/, '')
        .trim()
      return { command, args }
    }
  }
  return null
}
