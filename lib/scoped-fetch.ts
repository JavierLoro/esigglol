/** Browser requests carry an explicit edition; team endpoints derive it from the session. */
export function scopedFetch(input: string, init?: RequestInit): Promise<Response> {
  const params = new URLSearchParams(typeof window === 'undefined' ? '' : window.location.search)
  const url = new URL(input, typeof window === 'undefined' ? 'http://localhost' : window.location.origin)
  const tournamentId = params.get('tournament')
  if (url.pathname.startsWith('/api/admin/') && !tournamentId) {
    return Promise.reject(new Error('Selecciona un torneo antes de gestionar la competición'))
  }
  url.searchParams.set('tournament', tournamentId ?? 'legacy-lol')
  return fetch(`${url.pathname}${url.search}`, init)
}
