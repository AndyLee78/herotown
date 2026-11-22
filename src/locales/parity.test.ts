import en from './en.json'
import ko from './ko.json'
import { describe, expect, it } from 'vitest'

describe('locale catalogs', () => {
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
