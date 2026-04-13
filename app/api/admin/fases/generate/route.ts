import { NextRequest, NextResponse } from 'next/server'
import { getPhaseById, getMatches, saveMatches, generateId } from '@/lib/data'
import { requireAdminSession } from '@/lib/auth'
import { GenerateSchema } from '@/lib/schemas'
import logger from '@/lib/logger'
import type { Match, BOFormat } from '@/lib/types'

const log = logger.child({ module: 'generate' })

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export async function POST(req: NextRequest) {
  const deny = await requireAdminSession()
  if (deny) return deny

  let raw: unknown
  try { raw = await req.json() } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }

  const parsed = GenerateSchema.safeParse(raw)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })

  const body = parsed.data
  const phase = getPhaseById(body.phaseId)
  if (!phase) return NextResponse.json({ error: 'Fase no encontrada' }, { status: 404 })

  const allMatches = getMatches()
  const phaseMatches = allMatches.filter(m => m.phaseId === phase.id)
  const created: Match[] = []

  try {
    // ── Helpers comunes para los formatos de bracket ─────────────────────────
    const exists  = (r: number) => phaseMatches.some(m => m.round === r)
    const complete = (r: number) => {
      const ms = phaseMatches.filter(m => m.round === r)
      return ms.length > 0 && ms.every(m => m.result && m.winnerId)
    }
    const sorted  = (r: number) => phaseMatches.filter(m => m.round === r).sort((a, b) => a.id.localeCompare(b.id))
    const loserOf = (m: Match): string => m.winnerId === m.team1Id ? m.team2Id : m.team1Id
    const newMatch = (round: number, t1: string, t2: string): Match => ({
      id: generateId('match'), phaseId: phase.id, round,
      team1Id: t1, team2Id: t2, result: null, riotMatchIds: [],
    })

    // ── Grupos ───────────────────────────────────────────────────────────────
    if (body.type === 'groups') {
      const groups = phase.config.groups ?? []
      for (const group of groups) {
        const ids = group.teamIds
        for (let i = 0; i < ids.length; i++) {
          for (let j = i + 1; j < ids.length; j++) {
            const a = ids[i], b = ids[j]
            const exists = phaseMatches.some(m =>
              (m.team1Id === a && m.team2Id === b) ||
              (m.team1Id === b && m.team2Id === a)
            )
            if (exists) continue
            created.push({
              id: generateId('match'),
              phaseId: phase.id,
              round: 1,
              team1Id: a,
              team2Id: b,
              result: null,
              riotMatchIds: [],
            })
          }
        }
      }
    }

    // ── Suizo ────────────────────────────────────────────────────────────────
    if (body.type === 'swiss') {
      const round = body.round ?? 1
      const teamIds = phase.config.swissTeamIds ?? []
      const roundBo = (phase.config.roundBo?.[String(round)] ?? phase.config.bo) as BOFormat

      if (round === 1) {
        const shuffled = shuffle(teamIds)
        for (let i = 0; i < shuffled.length - 1; i += 2) {
          created.push({
            id: generateId('match'),
            phaseId: phase.id,
            round,
            team1Id: shuffled[i],
            team2Id: shuffled[i + 1],
            result: null,
            riotMatchIds: [],
          })
        }
      } else {
        const stats: Record<string, { wins: number; losses: number }> = {}
        for (const id of teamIds) stats[id] = { wins: 0, losses: 0 }

        for (const m of phaseMatches) {
          if (!m.result) continue
          if (m.result.team1Score > m.result.team2Score) {
            if (stats[m.team1Id]) stats[m.team1Id].wins++
            if (stats[m.team2Id]) stats[m.team2Id].losses++
          } else {
            if (stats[m.team2Id]) stats[m.team2Id].wins++
            if (stats[m.team1Id]) stats[m.team1Id].losses++
          }
        }

        const advW = phase.config.advanceWins ?? 2
        const elimL = phase.config.eliminateLosses ?? 2

        const active = teamIds.filter(id => {
          const s = stats[id]
          return s && s.wins < advW && s.losses < elimL
        })

        const groups: Record<string, string[]> = {}
        for (const id of active) {
          const key = `${stats[id].wins}-${stats[id].losses}`
          if (!groups[key]) groups[key] = []
          groups[key].push(id)
        }

        const alreadyPlayed = new Set(phaseMatches.map(m => [m.team1Id, m.team2Id].sort().join('|')))

        for (const bucket of Object.values(groups)) {
          const shuffledBucket = shuffle(bucket)
          const remaining = [...shuffledBucket]
          while (remaining.length >= 2) {
            const a = remaining.shift()!
            const idx = remaining.findIndex(b => !alreadyPlayed.has([a, b].sort().join('|')))
            const b = idx !== -1 ? remaining.splice(idx, 1)[0] : remaining.shift()!
            created.push({
              id: generateId('match'),
              phaseId: phase.id,
              round,
              team1Id: a,
              team2Id: b,
              result: null,
              riotMatchIds: [],
            })
          }
        }
      }

      void roundBo // BO del round guardado en la fase; no se replica en cada partido
    }

    // ── Eliminación clásica — generación progresiva ──────────────────────────
    if (body.type === 'elimination') {
      const teamIds = phase.config.bracketTeamIds ?? []
      if (teamIds.length < 2) {
        return NextResponse.json({ error: 'Se necesitan al menos 2 equipos' }, { status: 400 })
      }

      if (!exists(1)) {
        // Ronda 1: emparejar equipos secuencialmente; último sin pareja tiene bye (no se crea partido)
        for (let i = 0; i < Math.ceil(teamIds.length / 2); i++) {
          const t1 = teamIds[i * 2]
          const t2 = teamIds[i * 2 + 1]
          if (t2 !== undefined) created.push(newMatch(1, t1, t2))
          // Si t2 === undefined → bye, ese equipo pasa directamente a R2
        }
      } else {
        // Rondas siguientes: usar ganadores de la ronda anterior
        const maxRound = Math.max(...phaseMatches.map(m => m.round))

        if (!complete(maxRound)) {
          return NextResponse.json({ created: 0, message: 'Ronda anterior incompleta' })
        }

        const prev = sorted(maxRound)
        if (prev.length === 1 && prev[0].result) {
          return NextResponse.json({ created: 0, message: 'Bracket completado' })
        }

        // Equipos con bye (aparecen en bracketTeamIds pero no en ningún partido)
        const byeTeams = teamIds.filter(t => !phaseMatches.some(m => m.team1Id === t || m.team2Id === t))
        const winners = [...prev.map(m => m.winnerId!), ...byeTeams]

        const nextRound = maxRound + 1
        for (let i = 0; i < Math.floor(winners.length / 2); i++) {
          created.push(newMatch(nextRound, winners[i * 2], winners[i * 2 + 1]))
        }
      }
    }

    // ── Final Four — generación progresiva ───────────────────────────────────
    if (body.type === 'final-four') {
      const teamIds = phase.config.bracketTeamIds ?? []
      if (teamIds.length < 4) {
        return NextResponse.json({ error: 'Se necesitan 4 equipos' }, { status: 400 })
      }

      if (!exists(1)) {
        // Generar semifinales
        created.push(newMatch(1, teamIds[0], teamIds[1]))
        created.push(newMatch(1, teamIds[2], teamIds[3]))
      } else if (!exists(2)) {
        // Generar final y 3er puesto con los equipos reales
        const r1 = sorted(1)
        if (r1.some(m => !m.result || !m.winnerId)) {
          return NextResponse.json({ created: 0, message: 'Semifinales incompletas' })
        }
        created.push(newMatch(2, r1[0].winnerId!, r1[1].winnerId!))
        if (phase.config.include3rdPlace) {
          created.push(newMatch(98, loserOf(r1[0]), loserOf(r1[1])))
        }
      } else {
        return NextResponse.json({ created: 0, message: 'Bracket completado' })
      }
    }

    // ── Upper/Lower Bracket — generación progresiva ──────────────────────────
    if (body.type === 'upper-lower') {
      const teamIds = phase.config.bracketTeamIds ?? []
      const n = teamIds.length

      if (n <= 4) {
        // ── 4 equipos: G1→G2→G3→G4 ──────────────────────────────────────────
        // G1: R1 (×2)
        if (!exists(1)) {
          created.push(newMatch(1, teamIds[0], teamIds[1]))
          created.push(newMatch(1, teamIds[2], teamIds[3]))

        // G2: R2 (upper final ×1) + R-1 (lower R1 ×1)
        } else if (!exists(2) && !exists(-1)) {
          if (!complete(1)) return NextResponse.json({ created: 0, message: 'Ronda 1 incompleta' })
          const r1 = sorted(1)
          created.push(newMatch(2, r1[0].winnerId!, r1[1].winnerId!))
          created.push(newMatch(-1, loserOf(r1[0]), loserOf(r1[1])))

        // G3: R-2 (lower final ×1)
        } else if (!exists(-2)) {
          if (!complete(2) || !complete(-1)) return NextResponse.json({ created: 0, message: 'Rondas incompletas' })
          const r2 = sorted(2)[0]
          const rNeg1 = sorted(-1)[0]
          created.push(newMatch(-2, loserOf(r2), rNeg1.winnerId!))

        // G4: R99 (gran final ×1)
        } else if (!exists(99)) {
          if (!complete(-2)) return NextResponse.json({ created: 0, message: 'Lower bracket incompleto' })
          const r2 = sorted(2)[0]
          const rNeg2 = sorted(-2)[0]
          created.push(newMatch(99, r2.winnerId!, rNeg2.winnerId!))

        } else {
          return NextResponse.json({ created: 0, message: 'Bracket completado' })
        }

      } else {
        // ── 8 equipos: G1→G2→G3→G4→G5→G6 ───────────────────────────────────
        // G1: R1 (×4)
        if (!exists(1)) {
          for (let i = 0; i < 4; i++) {
            created.push(newMatch(1, teamIds[i * 2], teamIds[i * 2 + 1]))
          }

        // G2: R2 (upper ×2) + R-1 (lower ×2)
        } else if (!exists(2) && !exists(-1)) {
          if (!complete(1)) return NextResponse.json({ created: 0, message: 'Ronda 1 incompleta' })
          const r1 = sorted(1) // 4 partidos
          created.push(newMatch(2, r1[0].winnerId!, r1[1].winnerId!))
          created.push(newMatch(2, r1[2].winnerId!, r1[3].winnerId!))
          created.push(newMatch(-1, loserOf(r1[0]), loserOf(r1[1])))
          created.push(newMatch(-1, loserOf(r1[2]), loserOf(r1[3])))

        // G3: R3 (upper final ×1) + R-2 (lower ×2)
        } else if (!exists(3) && !exists(-2)) {
          if (!complete(2) || !complete(-1)) return NextResponse.json({ created: 0, message: 'Rondas incompletas' })
          const r2 = sorted(2)     // 2 partidos
          const rNeg1 = sorted(-1) // 2 partidos
          created.push(newMatch(3, r2[0].winnerId!, r2[1].winnerId!))
          // Emparejamiento por índice: R2[i].loser vs R-1[i].winner
          created.push(newMatch(-2, loserOf(r2[0]), rNeg1[0].winnerId!))
          created.push(newMatch(-2, loserOf(r2[1]), rNeg1[1].winnerId!))

        // G4: R-3 (lower semi ×1) — los dos ganadores de R-2 se enfrentan
        } else if (!exists(-3)) {
          if (!complete(-2)) return NextResponse.json({ created: 0, message: 'Lower bracket incompleto' })
          const rNeg2 = sorted(-2)
          created.push(newMatch(-3, rNeg2[0].winnerId!, rNeg2[1].winnerId!))

        // G5: R-4 (lower final ×1) — perdedor upper final vs ganador lower semi
        } else if (!exists(-4)) {
          if (!complete(3) || !complete(-3)) return NextResponse.json({ created: 0, message: 'Rondas incompletas' })
          const r3 = sorted(3)[0]
          const rNeg3 = sorted(-3)[0]
          created.push(newMatch(-4, loserOf(r3), rNeg3.winnerId!))

        // G6: R99 (gran final ×1)
        } else if (!exists(99)) {
          if (!complete(3) || !complete(-4)) return NextResponse.json({ created: 0, message: 'Rondas incompletas' })
          const r3 = sorted(3)[0]
          const rNeg4 = sorted(-4)[0]
          created.push(newMatch(99, r3.winnerId!, rNeg4.winnerId!))

        } else {
          return NextResponse.json({ created: 0, message: 'Bracket completado' })
        }
      }
    }
  } catch (err) {
    log.error({ err }, 'Error generando partidos')
    return NextResponse.json({ error: 'Error al generar el bracket' }, { status: 500 })
  }

  if (created.length === 0) {
    return NextResponse.json({ created: 0, message: 'No hay partidos nuevos que generar' })
  }

  allMatches.push(...created)
  try { saveMatches(allMatches) } catch (err) { log.error({ err }, 'DB write failed'); return NextResponse.json({ error: 'Error interno' }, { status: 500 }) }
  return NextResponse.json({ created: created.length })
}
