import { parseCommand } from './commands'

describe('parseCommand', () => {
  it.each([
    ['создать', 'create'],
    ['Слушать', 'listen'],
    ['повторить', 'repeat'],
    ['назад', 'back'],
    ['сохранить', 'save'],
    ['жасау', 'create'],
    ['тыңда', 'listen'],
    ['қайтала', 'repeat'],
    ['артқа', 'back'],
    ['сақта', 'save'],
  ])('«%s» → %s', (text, command) => {
    expect(parseCommand(text)?.command).toBe(command)
  })

  it('достаёт описание картинки из фразы', () => {
    expect(parseCommand('Создать картинку: кот на крыше')).toEqual({
      command: 'create',
      args: 'кот на крыше',
    })
    expect(parseCommand('нарисуй кота')).toEqual({ command: 'create', args: 'кота' })
  })

  it('возвращает null для непонятной фразы', () => {
    expect(parseCommand('абракадабра')).toBeNull()
    expect(parseCommand('')).toBeNull()
  })
})

describe('команда «дальше»', () => {
  it.each(['дальше', 'Далее', 'келесі'])('«%s» → next', (text) => {
    expect(parseCommand(text)?.command).toBe('next')
  })
})
