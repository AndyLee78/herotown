// Writes the Cursor rule from AGENTS.md so every agent reads the same rules.
// Run: npm run sync:rules
import { readFileSync, writeFileSync } from 'node:fs'

export const HEADER = `---
description: HeroTown project rules (generated from AGENTS.md by npm run sync:rules; do not edit)
alwaysApply: true
---

`

export function cursorRule(agents) {
  return HEADER + agents
}

if (process.argv[1] && process.argv[1].replaceAll('\\', '/').endsWith('tools/sync-rules.mjs')) {
  const agents = readFileSync(new URL('../AGENTS.md', import.meta.url), 'utf8')
  writeFileSync(new URL('../.cursor/rules/simulation-core.mdc', import.meta.url), cursorRule(agents))
  console.log('Wrote .cursor/rules/simulation-core.mdc from AGENTS.md')
}
