import './load-env'

const API_KEY = process.env.RIOT_API_KEY
if (!API_KEY) {
  console.error('Error: RIOT_API_KEY env var not found')
  process.exit(1)
}

const REGION = process.env.RIOT_REGION || 'euw1'
const MATCH_CLUSTER = REGION.startsWith('na') ? 'americas' : REGION.startsWith('kr') ? 'asia' : 'europe'
const BASE = `https://${REGION}.api.riotgames.com`
const MATCH_BASE = `https://${MATCH_CLUSTER}.api.riotgames.com`

async function riotGet<T>(url: string, label: string): Promise<T> {
  process.stdout.write(`  -> ${label}... `)
  const res = await fetch(url, { headers: { 'X-Riot-Token': API_KEY! } })
  if (!res.ok) {
    console.log(`ERROR ${res.status}`)
    throw new Error(`Riot API ${res.status} ${res.statusText}: ${url}`)
  }
  console.log('OK')
  return res.json() as Promise<T>
}

function formatTier(tier: string, rank: string, lp: number) {
  const noRank = ['MASTER', 'GRANDMASTER', 'CHALLENGER']
  return noRank.includes(tier) ? `${tier} ${lp} LP` : `${tier} ${rank} ${lp} LP`
}

async function main() {
  const nameTag = process.argv[2]
  if (!nameTag || !nameTag.includes('#')) {
    console.error('Uso: npm run test-riot "Nombre#TAG"')
    process.exit(1)
  }

  const [name, tag] = nameTag.split('#')

  console.log(`\n=== Riot API Test: ${nameTag} ===\n`)

  // 1. Account (PUUID)
  console.log('[1] account-v1 — identificador de cuenta')
  const account = await riotGet<{ puuid: string; gameName: string; tagLine: string }>(
    `https://${MATCH_CLUSTER}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`,
    'GET by-riot-id'
  )
  console.log(`    gameName : ${account.gameName}`)
  console.log(`    tagLine  : ${account.tagLine}`)
  console.log(`    puuid    : ${account.puuid}\n`)

  // 2. Summoner
  console.log('[2] summoner-v4 — datos del invocador')
  const summoner = await riotGet<{ puuid: string; profileIconId: number; summonerLevel: number }>(
    `${BASE}/lol/summoner/v4/summoners/by-puuid/${account.puuid}`,
    'GET by-puuid'
  )
  console.log(`    nivel    : ${summoner.summonerLevel}`)
  console.log(`    icono    : ${summoner.profileIconId}\n`)

  // 3. Ranked (todas las colas)
  console.log('[3] league-v4 — clasificatoria (todas las colas)')
  const ranked = await riotGet<Array<{
    queueType: string; tier: string; rank: string; leaguePoints: number
    wins: number; losses: number; hotStreak: boolean; veteran: boolean; freshBlood: boolean
  }>>(
    `${BASE}/lol/league/v4/entries/by-puuid/${account.puuid}`,
    'GET entries by-puuid'
  )
  if (ranked.length === 0) {
    console.log('    Sin datos de clasificatoria')
  } else {
    for (const e of ranked) {
      const total = e.wins + e.losses
      const wr = total > 0 ? Math.round((e.wins / total) * 100) : 0
      const cola = e.queueType === 'RANKED_SOLO_5x5' ? 'Solo/Duo' : e.queueType === 'RANKED_FLEX_SR' ? 'Flex 5v5' : e.queueType
      const flags: string[] = []
      if (e.hotStreak)  flags.push('en racha')
      if (e.veteran)    flags.push('veterano')
      if (e.freshBlood) flags.push('nuevo')
      console.log(`    [${cola}] ${formatTier(e.tier, e.rank, e.leaguePoints)} | ${e.wins}V/${e.losses}D (${wr}%)${flags.length ? ' [' + flags.join(', ') + ']' : ''}`)
    }
  }
  console.log()

  // 4. Champion mastery top 5
  console.log('[4] champion-mastery-v4 — top 5 campeones')
  const masteries = await riotGet<Array<{
    championId: number; championLevel: number; championPoints: number; lastPlayTime: number
  }>>(
    `${BASE}/lol/champion-mastery/v4/champion-masteries/by-puuid/${account.puuid}/top?count=5`,
    'GET top masteries'
  )
  for (let i = 0; i < masteries.length; i++) {
    const m = masteries[i]
    const lastPlayed = new Date(m.lastPlayTime).toLocaleDateString('es-ES')
    console.log(`    #${i + 1}  championId=${m.championId} | nivel ${m.championLevel} | ${m.championPoints.toLocaleString('es-ES')} pts | ultimo: ${lastPlayed}`)
  }
  console.log()

  // 5. Mastery score total
  console.log('[5] champion-mastery-v4 — puntuacion total de maestria')
  const masteryScore = await riotGet<number>(
    `${BASE}/lol/champion-mastery/v4/scores/by-puuid/${account.puuid}`,
    'GET score'
  )
  console.log(`    puntuacion total: ${masteryScore}\n`)

  // 6. Match IDs (ranked solo, ultimas 5)
  console.log('[6] match-v5 — IDs de las ultimas 5 partidas (Solo/Duo ranked)')
  const matchIds = await riotGet<string[]>(
    `${MATCH_BASE}/lol/match/v5/matches/by-puuid/${account.puuid}/ids?queue=420&count=5`,
    'GET match ids'
  )
  console.log(`    encontradas: ${matchIds.length} partidas`)
  console.log()

  // 7. Match details
  if (matchIds.length > 0) {
    console.log('[7] match-v5 — detalles de cada partida')
    for (const matchId of matchIds) {
      const match = await riotGet<{
        metadata: { matchId: string }
        info: {
          gameDuration: number
          gameCreation: number
          participants: Array<{
            puuid: string
            championName: string
            teamPosition: string
            kills: number; deaths: number; assists: number
            totalMinionsKilled: number; neutralMinionsKilled: number
            goldEarned: number
            totalDamageDealtToChampions: number
            visionScore: number
            win: boolean
            pentaKills: number; quadraKills: number; tripleKills: number
            itemsPurchased?: number
            summoner1Id: number; summoner2Id: number
          }>
        }
      }>(
        `${MATCH_BASE}/lol/match/v5/matches/${matchId}`,
        `GET ${matchId}`
      )

      const p = match.info.participants.find(p => p.puuid === account.puuid)
      if (!p) { console.log(`    (no se encontro al jugador en ${matchId})\n`); continue }

      const durSec = match.info.gameDuration
      const durMin = Math.floor(durSec / 60)
      const durS   = durSec % 60
      const cs = p.totalMinionsKilled + p.neutralMinionsKilled
      const csMin = durSec > 0 ? (cs / (durSec / 60)).toFixed(1) : '0'
      const fecha = new Date(match.info.gameCreation).toLocaleDateString('es-ES')
      const resultado = p.win ? 'VICTORIA' : 'DERROTA'
      const pos = p.teamPosition || 'UNKNOWN'
      const multi = p.pentaKills > 0 ? '[PENTA]' : p.quadraKills > 0 ? '[CUADRA]' : p.tripleKills > 0 ? '[TRIPLE]' : ''

      console.log(`    ${resultado} | ${fecha} | ${durMin}m${durS}s`)
      console.log(`      campeon    : ${p.championName} (${pos})`)
      console.log(`      kda        : ${p.kills}/${p.deaths}/${p.assists}${multi ? ' ' + multi : ''}`)
      console.log(`      cs         : ${cs} (${csMin}/min)`)
      console.log(`      oro        : ${p.goldEarned.toLocaleString('es-ES')}`)
      console.log(`      dano       : ${p.totalDamageDealtToChampions.toLocaleString('es-ES')}`)
      console.log(`      vision     : ${p.visionScore}`)
      console.log(`      hechizos   : D=${p.summoner1Id} F=${p.summoner2Id}`)
      console.log()
    }
  }

  console.log('=== Fin del test. Todos los endpoints respondieron correctamente. ===\n')
}

main().catch(err => {
  console.error(`\nError: ${err.message}`)
  process.exit(1)
})
