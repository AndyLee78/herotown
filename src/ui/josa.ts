const PAIRED = {
  이: '가',
  은: '는',
  을: '를',
  과: '와',
} as const

export type JosaParticle = keyof typeof PAIRED

// Spelling rules miss these spoken endings. false = no batchim.
const EXCEPTIONS: Record<string, boolean> = {
  Esme: false,
  Evadne: false,
  Selene: false,
}

export function josa(word: string, particle: JosaParticle): string {
  return `${word}${hasBatchim(word) ? particle : PAIRED[particle]}`
}

function hasBatchim(word: string): boolean {
  if (word in EXCEPTIONS) return EXCEPTIONS[word]
  const last = word.charCodeAt(word.length - 1)
  if (last >= 0xac00 && last <= 0xd7a3) return (last - 0xac00) % 28 !== 0
  return latinBatchim(word.toLowerCase())
}

function latinBatchim(word: string): boolean {
  if (word.endsWith('ng')) return true
  const last = word.at(-1)
  if (last === 'l' || last === 'm' || last === 'n') return true
  if (last === 'e') {
    const before = word.at(-2)
    if (before === 'l' || before === 'n') return true
  }
  return false
}
