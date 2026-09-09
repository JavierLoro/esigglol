import { TWITCH_CHANNEL, TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET } from '@/lib/env'
import logger from '@/lib/logger'

export type TwitchStatus = 'live' | 'offline' | 'unknown'

export interface TwitchStatusResult {
  status: TwitchStatus
  checkedAt: string
}

const STATUS_TTL_MS = 30_000
const ERROR_TTL_MS = 10_000
const REQUEST_TIMEOUT_MS = 5_000
const TOKEN_EXPIRY_MARGIN_MS = 60_000

let cachedStatus: { value: TwitchStatusResult; expiresAt: number } | undefined
let cachedToken: { value: string; expiresAt: number } | undefined
let statusRequest: Promise<TwitchStatusResult> | undefined

function result(status: TwitchStatus): TwitchStatusResult {
  return { status, checkedAt: new Date().toISOString() }
}

async function getAppAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.value

  const body = new URLSearchParams({
    client_id: TWITCH_CLIENT_ID,
    client_secret: TWITCH_CLIENT_SECRET,
    grant_type: 'client_credentials',
  })
  const response = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    body,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  if (!response.ok) throw new Error(`Twitch token request failed (${response.status})`)

  const payload = await response.json() as { access_token?: unknown; expires_in?: unknown }
  if (typeof payload.access_token !== 'string' || typeof payload.expires_in !== 'number') {
    throw new Error('Twitch token response was invalid')
  }

  cachedToken = {
    value: payload.access_token,
    expiresAt: Date.now() + Math.max(0, payload.expires_in * 1000 - TOKEN_EXPIRY_MARGIN_MS),
  }
  return cachedToken.value
}

async function requestTwitchStatus(): Promise<TwitchStatusResult> {
  if (!TWITCH_CHANNEL || !TWITCH_CLIENT_ID || !TWITCH_CLIENT_SECRET) return result('unknown')

  try {
    const token = await getAppAccessToken()
    const url = new URL('https://api.twitch.tv/helix/streams')
    url.searchParams.set('user_login', TWITCH_CHANNEL)
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Client-Id': TWITCH_CLIENT_ID,
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
    if (!response.ok) throw new Error(`Twitch streams request failed (${response.status})`)

    const payload = await response.json() as { data?: unknown }
    if (!Array.isArray(payload.data)) throw new Error('Twitch streams response was invalid')
    return result(payload.data.length > 0 ? 'live' : 'offline')
  } catch (error) {
    logger.warn({ err: error }, 'Unable to determine Twitch live status')
    return result('unknown')
  }
}

export async function getTwitchStatus(): Promise<TwitchStatusResult> {
  if (cachedStatus && cachedStatus.expiresAt > Date.now()) return cachedStatus.value
  if (statusRequest) return statusRequest

  statusRequest = requestTwitchStatus().then(value => {
    cachedStatus = {
      value,
      expiresAt: Date.now() + (value.status === 'unknown' ? ERROR_TTL_MS : STATUS_TTL_MS),
    }
    return value
  }).finally(() => {
    statusRequest = undefined
  })
  return statusRequest
}
