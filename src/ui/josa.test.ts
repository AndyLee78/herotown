import { describe, expect, it } from 'vitest'
import names from '../data/names.json'
import { josa } from './josa'

const BATCHIM = new Set([
  'Aileen', 'Aldon', 'Ansel', 'Anwen', 'Arlen', 'Baldwin', 'Bastian', 'Bertram', 'Bram', 'Brennan',
  'Brynn', 'Callum', 'Cassian', 'Corin', 'Crispin', 'Cyril', 'Darian', 'Delphine', 'Doran', 'Duncan',
  'Eamon', 'Ewan', 'Farlan', 'Florian', 'Galien', 'Goran', 'Gwen', 'Hadrian', 'Halden', 'Harlan',
  'Irene', 'Jessamine', 'Joren', 'Julian', 'Kael', 'Lucan', 'Mabel', 'Maren', 'Mirabel', 'Nadine',
  'Orin', 'Pascal', 'Perrin', 'Quentin', 'Rowan', 'Sable', 'Soren', 'Stefan', 'Sybil', 'Taran',
  'Theron', 'Torin', 'Tristan', 'Valen', 'Venn', 'Vivian', 'Wystan', 'Yoren', 'Adele', 'Adrian',
])

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

  it('reads a Latin ending the way Korean does', () => {
    expect(josa('Kael', '이')).toBe('Kael이')
    expect(josa('Brynn', '이')).toBe('Brynn이')
    expect(josa('Ingrid', '이')).toBe('Ingrid가')
    expect(josa('Adele', '이')).toBe('Adele이')
    expect(josa('Nadine', '이')).toBe('Nadine이')
    expect(josa('Henrik', '이')).toBe('Henrik가')
    expect(josa('Roland', '이')).toBe('Roland가')
    expect(josa('Walter', '이')).toBe('Walter가')
    expect(josa('Edith', '이')).toBe('Edith가')
    expect(josa('Olga', '이')).toBe('Olga가')
    expect(josa('Esme', '이')).toBe('Esme가')
    expect(josa('Selene', '이')).toBe('Selene가')
    expect(josa('Evadne', '이')).toBe('Evadne가')
    expect(josa('Mara', '을')).toBe('Mara를')
    expect(josa('Mara', '이')).toBe('Mara가')
  })

  it('uses the same batchim for the other pairs', () => {
    expect(josa('Kael', '은')).toBe('Kael은')
    expect(josa('Henrik', '은')).toBe('Henrik는')
    expect(josa('Nadine', '을')).toBe('Nadine을')
    expect(josa('Olga', '을')).toBe('Olga를')
    expect(josa('Brynn', '과')).toBe('Brynn과')
    expect(josa('Walter', '과')).toBe('Walter와')
  })

  it('classifies every fantasy name', () => {
    const all = [...names.male, ...names.female]
    expect(new Set(all).size).toBe(all.length)
    for (const name of all) {
      const particle = BATCHIM.has(name) ? '이' : '가'
      expect(josa(name, '이')).toBe(`${name}${particle}`)
    }
    for (const name of BATCHIM) expect(all).toContain(name)
  })
})
