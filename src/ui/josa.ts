const PAIRED = {
  이: '가',
  은: '는',
  을: '를',
  과: '와',
} as const

export type JosaParticle = keyof typeof PAIRED

export function josa(word: string, particle: JosaParticle): string {
  const last = word.charCodeAt(word.length - 1)
  const hasBatchim = last >= 0xac00 && last <= 0xd7a3 && (last - 0xac00) % 28 !== 0
  return `${word}${hasBatchim ? particle : PAIRED[particle]}`
}
