import db from './db'

export interface SiteBranding { title: string; subtitle: string; logo: string }
export const defaultBranding: SiteBranding = {
  title: 'I Copa Intercampus\nUCLM', subtitle: 'ESI Ciudad Real · Torneo LoL', logo: '/logo-torneo.png',
}
export function getSiteBranding(): SiteBranding {
  const row = db.prepare('SELECT data FROM tournament_config WHERE key = ?').get('site-branding') as { data: string } | undefined
  return row ? { ...defaultBranding, ...JSON.parse(row.data) } : defaultBranding
}
export function saveSiteBranding(value: SiteBranding) {
  db.prepare('INSERT OR REPLACE INTO tournament_config (key, data) VALUES (?, ?)').run('site-branding', JSON.stringify(value))
}
