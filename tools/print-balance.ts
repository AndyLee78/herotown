import { balanceTable, pct } from './simulate'

const runs = Number(process.env.RUNS ?? 1000)
const table = balanceTable(runs)
process.stdout.write(table.text)
const failures: string[] = []
for (const name of ['standard', 'dealers', 'noHealer', 'noTank', 'twoSupports'] as const) {
  if (table.rows[name].cave.rate < 0.7) {
    failures.push(`${name} cave ${pct(table.rows[name].cave.rate)}`)
  }
}
if (table.rows.standard.mine.rate < 0.6) {
  failures.push(`standard mine ${pct(table.rows.standard.mine.rate)}`)
}
if (table.rows.noTank.mine.rate > 0.2) {
  failures.push(`noTank mine ${pct(table.rows.noTank.mine.rate)}`)
}
if (table.rows.noHealer.mine.rate > 0.2) {
  failures.push(`noHealer mine ${pct(table.rows.noHealer.mine.rate)}`)
}
if (Math.abs(table.careful - table.reckless) < 0.1) {
  failures.push(`tactics delta ${pct(Math.abs(table.careful - table.reckless))}`)
}
if (failures.length) {
  process.stderr.write(`${failures.join('\n')}\n`)
  process.exitCode = 1
}
