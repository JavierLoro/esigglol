import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { TwitchStatusBadge } from './LiveSection'

describe('TwitchStatusBadge', () => {
  it('shows En directo only with positive live evidence', () => {
    expect(renderToStaticMarkup(<TwitchStatusBadge status="live" />)).toContain('En directo')
    expect(renderToStaticMarkup(<TwitchStatusBadge status="offline" />)).not.toContain('En directo')
    expect(renderToStaticMarkup(<TwitchStatusBadge status="unknown" />)).not.toContain('En directo')
  })

  it('uses a neutral label for a confirmed offline channel', () => {
    expect(renderToStaticMarkup(<TwitchStatusBadge status="offline" />)).toContain('Ahora sin emisión')
    expect(renderToStaticMarkup(<TwitchStatusBadge status="unknown" />)).toBe('')
  })
})
