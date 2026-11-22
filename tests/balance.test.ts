import { describe, expect, it } from 'vitest'
import { balanceTable } from '../tools/simulate'

const runs = 80

describe('prototype balance', () => {
  it('prints a win-rate table and meets the stage 0 bars', () => {
    const table = balanceTable(runs)
    process.stdout.write(`\n${table.text}`)
    for (const name of ['standard', 'dealers', 'noHealer', 'noTank', 'twoSupports'] as const) {
      expect(table.rows[name].cave.rate, `${name} cave`).toBeGreaterThanOrEqual(0.7)
    }
    expect(table.rows.standard.mine.rate).toBeGreaterThanOrEqual(0.6)
    expect(table.rows.noTank.mine.rate).toBeLessThanOrEqual(0.2)
    expect(table.rows.noHealer.mine.rate).toBeLessThanOrEqual(0.2)
    expect(Math.abs(table.careful - table.reckless)).toBeGreaterThanOrEqual(0.1)
  })
})