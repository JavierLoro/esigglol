import { readStaticAssets } from './asset-manifest.mjs'
import { verifyFrontend } from './frontend-check.mjs'

const origin = process.argv[2]
if (!origin) throw new Error('Usage: npm run verify:cloudflare:frontend -- https://your-domain.example')
const result = await verifyFrontend(origin, { manifest: readStaticAssets().manifest })
console.log(`Public frontend verified: ${result.pages} pages and ${result.assets} JavaScript/CSS assets; no data changed`)
