import { titleRules } from '../core/titles'
import en from './en.json'
import ko from './ko.json'
import { describe, expect, it } from 'vitest'

describe('locale catalogs', () => {
  it('describes every attainable title and its deed in both languages', () => {
    for (const locale of [ko, en]) {
      for (const { id, deed } of titleRules) {
        expect(locale.deeds.names[id]).toBeTruthy()
        expect(locale.deeds.effects[id]).toBeTruthy()
        expect(locale.deeds.keys[deed]).toBeTruthy()
      }
    }
  })

  it('gives English and Korean the same keys', () => {
    expect(flatKeys(ko)).toEqual(flatKeys(en))
  })
})

function flatKeys(value: unknown, prefix = ''): string[] {
  if (value === null || typeof value !== 'object') {
    return [prefix.slice(0, -1)]
  }
  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) =>
    flatKeys(child, `${prefix}${key}.`),
  )
}
