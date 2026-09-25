import { ValorantClient, retainOfficialData, type OfficialData, type ValorantLeaderboard } from './valorant'
import { getValorantRuntimeKey } from './valorant-runtime-key'

export type RankingSnapshot = OfficialData<ValorantLeaderboard> & { actName?: string; complete?: boolean }

// Public EU ladder only: never stores accounts, histories or tournament participants.
export function createRankingLoader(client = new ValorantClient(), now = Date.now) {
  let previous: RankingSnapshot | undefined
  let expires = 0
  let pending: Promise<RankingSnapshot> | undefined
  return async function load(): Promise<RankingSnapshot> {
    if (previous && now() < expires) return previous
    if (pending) return pending
    pending = (async () => {
      const content = await client.content()
      const act = content.data?.acts.find(a => a.isActive && a.type === 'act')
      const result: RankingSnapshot = act
        ? { ...await client.leaderboard(act.id), actName: act.name }
        : { source: 'Riot Games', fetchedAt: content.fetchedAt, availability: content.availability === 'available' ? 'invalid-data' : content.availability }
      if (act && result.data && result.data.actId !== act.id) {
        result.data = undefined
        result.availability = 'invalid-data'
      }
      if (act && result.data) {
        let offset = result.data.players.length
        while (offset > 0 && offset < result.data.totalPlayers) {
          const page = await client.leaderboard(act.id, offset)
          if (!page.data || page.data.actId !== act.id || page.data.players.length === 0) {
            result.complete = false
            result.retryAfter = page.retryAfter
            break
          }
          const positions = new Set(result.data.players.map(p => p.leaderboardRank))
          const additions = page.data.players.filter(p => !positions.has(p.leaderboardRank))
          if (additions.length === 0) break
          result.data.players.push(...additions)
          offset += page.data.players.length
        }
        result.complete = result.data.players.length >= result.data.totalPlayers
      }
      const sameAct = !act || previous?.data?.actId === act.id
      previous = { ...retainOfficialData(sameAct ? previous : undefined, result), actName: result.actName ?? previous?.actName, complete: result.data ? result.complete : sameAct ? previous?.complete : false }
      const retry = Number(result.retryAfter)
      expires = now() + Math.max(60_000, Number.isFinite(retry) ? retry * 1000 : 0, result.availability === 'available' ? 600_000 : 0)
      return previous
    })()
    try { return await pending } finally { pending = undefined }
  }
}

let activeKey: string | undefined
let activeLoader = createRankingLoader()
export async function loadValorantRanking() {
  const key = getValorantRuntimeKey()
  if (key !== activeKey) {
    activeKey = key
    activeLoader = createRankingLoader(new ValorantClient(key))
  }
  return activeLoader()
}

export function valorantRank(tier?: number) {
  if (tier === 27) return 'Radiante'
  if (tier === undefined || tier < 3 || tier > 26 || !Number.isInteger(tier)) return 'No disponible'
  const names = ['Hierro', 'Bronce', 'Plata', 'Oro', 'Platino', 'Diamante', 'Ascendente', 'Inmortal']
  return `${names[Math.floor((tier - 3) / 3)]} ${(tier - 3) % 3 + 1}`
}

export function visibleLadderPlayer(riotId: string, snapshot: RankingSnapshot) {
  const normalized = riotId.trim().toLocaleLowerCase('en-US')
  return snapshot.data?.players.find(p => !p.isAnonymized && p.gameName && p.tagLine && `${p.gameName}#${p.tagLine}`.toLocaleLowerCase('en-US') === normalized)
}
