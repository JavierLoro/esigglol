import { randomBytes } from 'node:crypto'

// 256 bits of OS-backed randomness, encoded for safe use in dotenv files.
const secret = randomBytes(32).toString('base64url')
console.log(`SESSION_SECRET=${secret}`)
