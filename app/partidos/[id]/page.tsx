import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft } from 'lucide-react'
import { clsx } from 'clsx'
import { getMatchById, getPhaseById, getTeamById } from '@/lib/data'
import { getMatchDetails } from '@/lib/riot'
import { getVersion } from '@/lib/ddragon'
import type { Team, GameData, GamePlayerData } from '@/lib/types'

export const dynamic = 'force-dynamic'

// ── Riot match-v5 types (local only) ─────────────────────────────────────────

interface RiotParticipant {
  teamId: 100 | 200
  riotIdGameName: string
  riotIdTagline: string
  championName: string
  teamPosition: string
  kills: number
  deaths: number
  assists: number
  totalMinionsKilled: number
  goldEarned: number
  totalDamageDealtToChampions: number
  win: boolean
  item0: number
  item1: number
  item2: number
  item3: number
  item4: number
  item5: number
  item6: number
}

interface RiotMatchInfo {
  gameDuration: number
  participants: RiotParticipant[]
}

interface RiotMatchData {
  info: RiotMatchInfo
}

function isRiotMatchData(d: unknown): d is RiotMatchData {
  return (
    typeof d === 'object' && d !== null &&
    'info' in d &&
    typeof (d as Record<string, unknown>).info === 'object'
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const POS_MAP: Record<string, string> = {
  TOP: 'Top',
  JUNGLE: 'Jungla',
  MIDDLE: 'Mid',
  BOTTOM: 'Bot',
  UTILITY: 'Support',
}

function formatNum(n: number): string {
  return n >= 1000 ? (n / 1000).toFixed(1) + 'k' : String(n)
}

function formatDuration(seconds: number): string {
  const secs = seconds > 7200 ? Math.floor(seconds / 1000) : seconds
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function championIconUrl(championName: string, version: string | null): string {
  const v = version ?? '15.1.1'
  return `https://ddragon.leagueoflegends.com/cdn/${v}/img/champion/${championName}.png`
}

function itemIconUrl(itemId: number, version: string | null): string {
  const v = version ?? '15.1.1'
  return `https://ddragon.leagueoflegends.com/cdn/${v}/img/item/${itemId}.png`
}

function getItems(p: RiotParticipant): number[] {
  return [p.item0, p.item1, p.item2, p.item3, p.item4, p.item5, p.item6].filter(id => id > 0)
}

// ── Riot data scoreboard ─────────────────────────────────────────────────────

function RiotTeamTable({
  participants,
  teamId,
  ddragonVersion,
}: {
  participants: RiotParticipant[]
  teamId: 100 | 200
  ddragonVersion: string | null
}) {
  const players = participants.filter(p => p.teamId === teamId)
  const won = players[0]?.win ?? false
  const label = teamId === 100 ? 'Equipo Azul' : 'Equipo Rojo'
  const accentClass = teamId === 100 ? 'text-blue-400' : 'text-red-400'
  const totalK = players.reduce((s, p) => s + p.kills, 0)
  const totalD = players.reduce((s, p) => s + p.deaths, 0)
  const totalA = players.reduce((s, p) => s + p.assists, 0)

  return (
    <div className={clsx('rounded-lg overflow-hidden border', won ? 'border-[#0097D7]/30' : 'border-white/[0.06]')}>
      <div className={clsx(
        'px-3 py-2 flex items-center justify-between text-xs font-bold uppercase tracking-wider',
        won ? 'bg-[#0097D7]/10 text-[#0097D7]' : 'bg-white/[0.03] text-white/30'
      )}>
        <div className="flex items-center gap-2">
          <span className={accentClass}>{label}</span>
          <span className="text-white/50 tabular-nums text-[11px] normal-case tracking-normal">{totalK}/{totalD}/{totalA}</span>
        </div>
        {won && <span className="text-[#0097D7]">Victoria</span>}
      </div>

      <div className="grid grid-cols-[32px_1fr_60px_60px_50px_50px_60px_auto] gap-x-2 px-3 py-1 border-b border-white/[0.05] text-[10px] text-white/25 font-medium uppercase tracking-wider">
        <span />
        <span>Jugador</span>
        <span className="text-center">Posición</span>
        <span className="text-center">K/D/A</span>
        <span className="text-right">CS</span>
        <span className="text-right">Oro</span>
        <span className="text-right">Daño</span>
        <span className="text-center">Items</span>
      </div>

      {players.map((p, i) => (
        <div
          key={i}
          className={clsx(
            'grid grid-cols-[32px_1fr_60px_60px_50px_50px_60px_auto] gap-x-2 px-3 py-1.5 items-center text-xs',
            i < players.length - 1 && 'border-b border-white/[0.04]',
            !won && 'opacity-60'
          )}
        >
          <div className="w-8 h-8 rounded overflow-hidden bg-white/5 shrink-0">
            <Image src={championIconUrl(p.championName, ddragonVersion)} alt={p.championName} width={32} height={32} className="object-cover" unoptimized />
          </div>
          <span className="truncate text-white/80 font-medium">
            {p.riotIdGameName}<span className="text-white/30 text-[10px]">#{p.riotIdTagline}</span>
          </span>
          <span className="text-center text-white/50">{POS_MAP[p.teamPosition] ?? '—'}</span>
          <span className="text-center tabular-nums">
            <span className="text-white/80">{p.kills}</span><span className="text-white/25">/</span>
            <span className="text-red-400/80">{p.deaths}</span><span className="text-white/25">/</span>
            <span className="text-white/80">{p.assists}</span>
          </span>
          <span className="text-right tabular-nums text-white/60">{p.totalMinionsKilled}</span>
          <span className="text-right tabular-nums text-yellow-400/70">{formatNum(p.goldEarned)}</span>
          <span className="text-right tabular-nums text-orange-400/70">{formatNum(p.totalDamageDealtToChampions)}</span>
          <div className="flex items-center gap-0.5">
            {getItems(p).map((itemId, j) => (
              <div key={j} className="w-5 h-5 rounded-sm overflow-hidden bg-white/5 shrink-0">
                <Image src={itemIconUrl(itemId, ddragonVersion)} alt={String(itemId)} width={20} height={20} className="object-cover" unoptimized />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Stored game data scoreboard ──────────────────────────────────────────────

function StoredTeamTable({
  players,
  label,
  won,
  accentClass,
  ddragonVersion,
}: {
  players: GamePlayerData[]
  label: string
  won: boolean
  accentClass: string
  ddragonVersion: string | null
}) {
  const totalK = players.reduce((s, p) => s + p.kills, 0)
  const totalD = players.reduce((s, p) => s + p.deaths, 0)
  const totalA = players.reduce((s, p) => s + p.assists, 0)

  return (
    <div className={clsx('rounded-lg overflow-hidden border', won ? 'border-[#0097D7]/30' : 'border-white/[0.06]')}>
      <div className={clsx(
        'px-3 py-2 flex items-center justify-between text-xs font-bold uppercase tracking-wider',
        won ? 'bg-[#0097D7]/10 text-[#0097D7]' : 'bg-white/[0.03] text-white/30'
      )}>
        <div className="flex items-center gap-2">
          <span className={accentClass}>{label}</span>
          <span className="text-white/50 tabular-nums text-[11px] normal-case tracking-normal">{totalK}/{totalD}/{totalA}</span>
        </div>
        {won && <span className="text-[#0097D7]">Victoria</span>}
      </div>

      <div className="grid grid-cols-[32px_1fr_60px_50px_50px_auto] gap-x-2 px-3 py-1 border-b border-white/[0.05] text-[10px] text-white/25 font-medium uppercase tracking-wider">
        <span />
        <span>Jugador</span>
        <span className="text-center">K/D/A</span>
        <span className="text-right">CS</span>
        <span className="text-right">Oro</span>
        <span className="text-center">Items</span>
      </div>

      {players.map((p, i) => (
        <div
          key={i}
          className={clsx(
            'grid grid-cols-[32px_1fr_60px_50px_50px_auto] gap-x-2 px-3 py-1.5 items-center text-xs',
            i < players.length - 1 && 'border-b border-white/[0.04]',
            !won && 'opacity-60'
          )}
        >
          <div className="w-8 h-8 rounded overflow-hidden bg-white/5 shrink-0">
            <Image src={championIconUrl(p.championName, ddragonVersion)} alt={p.championName} width={32} height={32} className="object-cover" unoptimized />
          </div>
          <span className="truncate text-white/80 font-medium">{p.summonerName}</span>
          <span className="text-center tabular-nums">
            <span className="text-white/80">{p.kills}</span><span className="text-white/25">/</span>
            <span className="text-red-400/80">{p.deaths}</span><span className="text-white/25">/</span>
            <span className="text-white/80">{p.assists}</span>
          </span>
          <span className="text-right tabular-nums text-white/60">{p.cs}</span>
          <span className="text-right tabular-nums text-yellow-400/70">{formatNum(p.gold)}</span>
          <div className="flex items-center gap-0.5">
            {p.items.filter(Boolean).map((item, j) => (
              <div key={j} className="w-5 h-5 rounded-sm overflow-hidden bg-white/5" title={item}>
                <div className="w-full h-full bg-white/10 flex items-center justify-center text-[7px] text-white/30">
                  {item.slice(0, 2)}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Game card ─────────────────────────────────────────────────────────────────

function GameCard({
  index,
  storedData,
  riotData,
  ddragonVersion,
}: {
  index: number
  storedData: GameData | null
  riotData: RiotMatchData | null
  ddragonVersion: string | null
}) {
  const duration = storedData?.duration ?? (riotData ? formatDuration(riotData.info.gameDuration) : null)

  return (
    <div className="rounded-xl border border-white/[0.08] bg-[#0d1321] overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.06] bg-white/[0.02]">
        <span className="text-sm font-bold text-white/80">Partida {index + 1}</span>
        {duration && <span className="text-xs text-white/30">{duration}</span>}
      </div>

      {storedData ? (
        <div className="p-4 flex flex-col gap-3">
          <StoredTeamTable
            players={storedData.team1Players}
            label="Equipo 1"
            won={storedData.winner === 'team1'}
            accentClass="text-blue-400"
            ddragonVersion={ddragonVersion}
          />
          <StoredTeamTable
            players={storedData.team2Players}
            label="Equipo 2"
            won={storedData.winner === 'team2'}
            accentClass="text-red-400"
            ddragonVersion={ddragonVersion}
          />
        </div>
      ) : riotData ? (
        <div className="p-4 flex flex-col gap-3">
          <RiotTeamTable participants={riotData.info.participants} teamId={100} ddragonVersion={ddragonVersion} />
          <RiotTeamTable participants={riotData.info.participants} teamId={200} ddragonVersion={ddragonVersion} />
        </div>
      ) : (
        <div className="px-4 py-8 text-center text-white/25 text-sm">
          Sin datos
        </div>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function PartidoPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const match = getMatchById(id)
  if (!match) notFound()

  if (match.result === null) {
    const t1 = match.team1Id !== 'TBD' ? `?t1=${match.team1Id}` : ''
    const t2 = match.team2Id !== 'TBD' ? `${t1 ? '&' : '?'}t2=${match.team2Id}` : ''
    redirect(`/comparar${t1}${t2}`)
  }

  const phase = getPhaseById(match.phaseId)
  const team1 = match.team1Id !== 'TBD' ? getTeamById(match.team1Id) : undefined
  const team2 = match.team2Id !== 'TBD' ? getTeamById(match.team2Id) : undefined

  const bo: number = phase
    ? (phase.config.roundBo?.[String(match.round)] ?? phase.config.bo ?? 1)
    : 1

  const ddragonVersion = getVersion()

  // Fetch Riot data only for games without stored data
  const riotResults = await Promise.allSettled(
    Array.from({ length: bo }, (_, i) => {
      if (match.games?.[i]) return Promise.resolve(null) // stored data takes priority
      const riotId = match.riotMatchIds[i]
      if (!riotId) return Promise.resolve(null)
      return getMatchDetails(riotId)
    })
  )

  const riotGames: (RiotMatchData | null)[] = riotResults.map(r => {
    if (r.status === 'rejected') return null
    if (r.value === null) return null
    return isRiotMatchData(r.value) ? r.value : null
  })

  const played = match.result !== null
  const winner =
    played && match.result!.team1Score > match.result!.team2Score ? 'team1'
    : played && match.result!.team2Score > match.result!.team1Score ? 'team2'
    : null

  const teamDisplay = (team: Team | undefined, side: 'left' | 'right') => {
    const isWinner = (side === 'left' && winner === 'team1') || (side === 'right' && winner === 'team2')
    const isLoser = played && !isWinner
    return (
      <div className={clsx(
        'flex items-center gap-3',
        side === 'right' && 'flex-row-reverse',
        isLoser && 'opacity-40'
      )}>
        {team?.logo && (
          <Image src={team.logo} alt={team.name} width={48} height={48} className="rounded object-contain" />
        )}
        <span className={clsx('font-bold text-lg', isWinner ? 'text-white' : 'text-white/70')}>
          {team?.name ?? 'TBD'}
        </span>
      </div>
    )
  }

  return (
    <main className="max-w-5xl mx-auto px-4 py-8 flex flex-col gap-6">
      <Link href="/fases" className="flex items-center gap-1.5 text-sm text-white/40 hover:text-white/70 transition-colors w-fit">
        <ArrowLeft size={15} />
        Volver a fases
      </Link>

      {/* Series header */}
      <div className="rounded-xl border border-white/10 bg-[#0d1321] overflow-hidden">
        <div className="px-6 py-3 border-b border-white/[0.06] flex items-center gap-2 flex-wrap">
          {phase && (
            <span className="text-xs text-white/40 font-medium uppercase tracking-wider">
              {phase.name} &middot; Ronda {match.round} &middot; BO{bo}
            </span>
          )}
          {match.scheduledAt && !played && (
            <span className="ml-auto text-xs font-semibold text-[#0097D7] bg-[#0097D7]/10 px-2 py-0.5 rounded-full">
              {new Date(match.scheduledAt).toLocaleString('es-ES', {
                weekday: 'short', day: '2-digit', month: 'short',
                hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid',
              })}
            </span>
          )}
          {played && (
            <span className="ml-auto text-xs font-semibold text-white/30 bg-white/5 px-2 py-0.5 rounded-full">
              Finalizado
            </span>
          )}
        </div>

        <div className="px-6 py-6 flex items-center justify-between gap-4">
          <div className="flex-1">
            {teamDisplay(team1, 'left')}
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {played ? (
              <>
                <span className={clsx('text-4xl font-bold tabular-nums w-10 text-center', winner === 'team1' ? 'text-[#0097D7]' : 'text-white/30')}>
                  {match.result!.team1Score}
                </span>
                <span className="text-white/20 text-lg font-bold">–</span>
                <span className={clsx('text-4xl font-bold tabular-nums w-10 text-center', winner === 'team2' ? 'text-[#0097D7]' : 'text-white/30')}>
                  {match.result!.team2Score}
                </span>
              </>
            ) : (
              <span className="text-white/20 font-bold text-xl px-2">VS</span>
            )}
          </div>
          <div className="flex-1 flex justify-end">
            {teamDisplay(team2, 'right')}
          </div>
        </div>
      </div>

      {/* Game list */}
      <div className="flex flex-col gap-4">
        {Array.from({ length: bo }, (_, i) => (
          <GameCard
            key={i}
            index={i}
            storedData={match.games?.[i] ?? null}
            riotData={riotGames[i]}
            ddragonVersion={ddragonVersion}
          />
        ))}
      </div>
    </main>
  )
}
