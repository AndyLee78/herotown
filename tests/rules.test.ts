import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
// @ts-expect-error plain ESM helper without types
import { cursorRule } from '../tools/sync-rules.mjs'

describe('agent rules', () => {
  it('keeps the Cursor rule a copy of AGENTS.md (run npm run sync:rules)', () => {
    const agents = readFileSync(new URL('../AGENTS.md', import.meta.url), 'utf8')
    const cursor = readFileSync(new URL('../.cursor/rules/simulation-core.mdc', import.meta.url), 'utf8')
    expect(cursor).toBe(cursorRule(agents))
  })
})
