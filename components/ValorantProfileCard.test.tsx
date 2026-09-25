import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import ValorantProfileCard from './ValorantProfileCard'
import { valorantPreviewFixture } from '@/lib/valorant-fixtures'

describe('Valorant profile availability', () => {
  it('shows provenance, act and observation date from an explicit fixture', () => {
    const html = renderToStaticMarkup(<ValorantProfileCard profile={valorantPreviewFixture.profile} />)
    expect(html).toContain('fixture-act')
    expect(html).toContain('700')
    expect(html).toContain('2026-09-01T10:00:00Z')
    expect(html).toContain('Riot Games')
  })
  it('does not turn absent access into an unranked player', () => {
    const html = renderToStaticMarkup(<ValorantProfileCard />)
    expect(html).toContain('No disponible')
    expect(html).not.toContain('Sin rango')
    expect(html).not.toContain('UNRANKED')
  })
})
