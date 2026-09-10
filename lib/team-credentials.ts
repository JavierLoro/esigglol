import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto'
import { SESSION_SECRET } from './env'

function key(): Buffer {
  return createHash('sha256').update(`team-access:${SESSION_SECRET}`).digest()
}

export function generateTeamPassword(): string {
  return randomBytes(12).toString('base64url')
}

export function encryptTeamPassword(password: string): string {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key(), iv)
  const encrypted = Buffer.concat([cipher.update(password, 'utf8'), cipher.final()])
  return [iv, cipher.getAuthTag(), encrypted].map(value => value.toString('base64url')).join('.')
}

export function decryptTeamPassword(value: string): string {
  const [ivValue, tagValue, encryptedValue] = value.split('.')
  if (!ivValue || !tagValue || !encryptedValue) throw new Error('Credencial de equipo inválida')
  const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(ivValue, 'base64url'))
  decipher.setAuthTag(Buffer.from(tagValue, 'base64url'))
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, 'base64url')),
    decipher.final(),
  ]).toString('utf8')
}
