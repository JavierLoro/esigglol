const pages = ['/', '/fases', '/ranking', '/comparar', '/admin/login', '/equipo/login']

// Verify the client build as well as SSR: a 200 page can still reference missing chunks.
export async function verifyFrontend(origin, { request = fetch, manifest = {} } = {}) {
  const base = new URL(origin)
  const assets = new Set(Object.keys(manifest).filter(name => /\.(?:m?js|css)$/.test(name)))
  for (const page of pages) {
    const response = await request(new URL(page, base).href, { redirect: 'manual', signal: AbortSignal.timeout(30000) })
    if (response.status !== 200 || !response.headers.get('content-type')?.includes('text/html')) {
      throw new Error(`Frontend page ${page}: expected HTML 200, received ${response.status}`)
    }
    const html = await response.text()
    let scripts = 0
    for (const tag of html.matchAll(/<(?:script|link)\b[^>]*>/gi)) {
      const value = tag[0].match(/\b(?:src|href)\s*=\s*["']([^"']+)["']/i)?.[1]
      if (!value) continue
      const url = new URL(value.replaceAll('&amp;', '&'), base)
      if (url.origin !== base.origin || !/\.(?:m?js|css)$/.test(url.pathname)) continue
      assets.add(url.pathname + url.search)
      if (tag[0].startsWith('<script')) scripts++
    }
    if (!scripts) throw new Error(`Frontend page ${page}: no client scripts found`)
  }
  for (const name of assets) {
    const response = await request(new URL(name, base).href, { redirect: 'manual', signal: AbortSignal.timeout(30000) })
    const type = response.headers.get('content-type') ?? ''
    const css = new URL(name, base).pathname.endsWith('.css')
    if (response.status !== 200 || !(css ? type.includes('text/css') : /(?:java|ecma)script/.test(type))) {
      throw new Error(`Frontend asset ${name}: expected ${css ? 'CSS' : 'JavaScript'} 200, received ${response.status} (${type})`)
    }
    if (!(await response.arrayBuffer()).byteLength) throw new Error(`Frontend asset ${name}: empty response`)
  }
  return { pages: pages.length, assets: assets.size }
}
