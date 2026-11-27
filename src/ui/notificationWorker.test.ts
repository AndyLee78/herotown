import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { describe, expect, it, vi } from 'vitest'

const source = readFileSync(new URL('../../public/notification-worker.js', import.meta.url), 'utf8')
const scope = 'https://example.com/herotown/'

describe('notification click handler', () => {
  async function click(windows: { url: string; focus: () => Promise<object> }[]) {
    const close = vi.fn()
    const openWindow = vi.fn()
    const matchAll = vi.fn().mockResolvedValue(windows)
    let handle: ((event: unknown) => void) | undefined
    runInNewContext(source, {
      self: {
        registration: { scope }, clients: { matchAll, openWindow },
        addEventListener: (_: string, callback: typeof handle) => { handle = callback },
      },
    })
    let work: Promise<void> | undefined
    handle?.({ notification: { data: { herotown: true }, close }, waitUntil: (promise: Promise<void>) => { work = promise } })
    await work
    expect(close).toHaveBeenCalledOnce()
    expect(matchAll).toHaveBeenCalledWith({ type: 'window', includeUncontrolled: true })
    return openWindow
  }

  it('focuses an existing game in the worker scope', async () => {
    const unrelated = vi.fn()
    const focus = vi.fn().mockResolvedValue({})
    const openWindow = await click([{ url: 'https://example.com/other/', focus: unrelated }, { url: scope, focus }])
    expect(unrelated).not.toHaveBeenCalled()
    expect(focus).toHaveBeenCalledOnce()
    expect(openWindow).not.toHaveBeenCalled()
  })

  it('opens the scoped game if no tab can be focused', async () => {
    const focus = vi.fn().mockRejectedValue(new Error('Tab closed'))
    const openWindow = await click([{ url: scope, focus }])
    expect(openWindow).toHaveBeenCalledOnce()
    expect(openWindow).toHaveBeenCalledWith(scope)
  })
})
