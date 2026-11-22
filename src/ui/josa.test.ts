import { describe, expect, it } from 'vitest'
import { josa } from './josa'

describe('Korean particles', () => {
  it('picks the particle from the last hangul batchim', () => {
    expect(josa('영웅', '이')).toBe('영웅이')
    expect(josa('전사', '이')).toBe('전사가')
    expect(josa('영웅', '은')).toBe('영웅은')
    expect(josa('전사', '은')).toBe('전사는')
    expect(josa('영웅', '을')).toBe('영웅을')
    expect(josa('전사', '을')).toBe('전사를')
    expect(josa('영웅', '과')).toBe('영웅과')
    expect(josa('전사', '과')).toBe('전사와')
  })

  it('treats a Latin name as having no batchim', () => {
    expect(josa('Mara', '을')).toBe('Mara를')
    expect(josa('Mara', '이')).toBe('Mara가')
  })
})
