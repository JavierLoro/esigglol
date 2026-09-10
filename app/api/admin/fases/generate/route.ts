import { NextRequest, NextResponse } from 'next/server'
import { createMatches, getPhaseById, getMatches, generateId } from '@/lib/data'
import { requireAdminSession } from '@/lib/auth'
import { GenerateSchema } from '@/lib/schemas'
import logger from '@/lib/logger'
import type { Match, BOFormat } from '@/lib/types'
import { bracketSizeError } from '@/lib/bracket-sizes'
import { validateGroupsConfig } from '@/lib/phase-validation'
import { createSwissPairings, getSwissRecords, getSwissRoundError } from '@/lib/swiss'
import { orderBracketMatches } from '@/lib/bracket-position'

const log = logger.child({ module: 'generate' })

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

  // El tipo persistido es la única fuente de verdad. No se acepta un tipo
  // redundante en el contrato para evitar generar partidos con otra fase.
  const type = phase.type

  const configuredCount = type === 'swiss'
    ? phase.config.swissTeamIds?.length
    : type === 'groups' ? undefined : phase.config.bracketTeamIds?.length
  if (configuredCount !== undefined) {
    const sizeError = bracketSizeError(type, configuredCount)
    if (sizeError) return NextResponse.json({ error: sizeError }, { status: 400 })
  }

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
    const sorted  = (r: number) => orderBracketMatches(phaseMatches.filter(m => m.round === r))
    const loserOf = (m: Match): string => m.winnerId === m.team1Id ? m.team2Id : m.team1Id
    const newMatch = (round: number, t1: string, t2: string, bracketPosition = 0): Match => ({
      id: generateId('match'), phaseId: phase.id, round,
      bracketPosition,
      team1Id: t1, team2Id: t2, result: null, riotMatchIds: [],
    })

    // ── Grupos ───────────────────────────────────────────────────────────────
    if (type === 'groups') {
      const groups = phase.config.groups ?? []
      const validationErrors = validateGroupsConfig(phase.config)
      if (validationErrors.length > 0) {
        return NextResponse.json({ error: 'Configuración de grupos inválida', details: validationErrors }, { status: 400 })
      }
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
    if (type === 'swiss') {
      const round = body.round ?? 1
      const teamIds = phase.config.swissTeamIds ?? []
      const roundBo = (phase.config.roundBo?.[String(round)] ?? phase.config.bo) as BOFormat

      const sequenceError = getSwissRoundError(phaseMatches, round, phase.config.confirmedRounds)
      if (sequenceError) return NextResponse.json({ error: sequenceError }, { status: 400 })

      if (round === 1) {
        for (let i = 0; i < teamIds.length - 1; i += 2) {
          created.push({
            id: generateId('match'),
            phaseId: phase.id,
            round,
            team1Id: teamIds[i],
            team2Id: teamIds[i + 1],
            result: null,
            riotMatchIds: [],
          })
        }
      } else {
        const stats = getSwissRecords(phaseMatches, teamIds)

        const advW = phase.config.advanceWins ?? 2
        const elimL = phase.config.eliminateLosses ?? 2

        const active = teamIds.filter(id => {
          const s = stats[id]
          return s && s.wins < advW && s.losses < elimL
        })

        const pairing = createSwissPairings(active, phaseMatches, stats)
        for (const { team1Id: a, team2Id: b } of pairing.pairs) {
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
        if (pairing.unpairedTeamId) {
          return NextResponse.json({
            error: `No se ha podido emparejar al equipo ${pairing.unpairedTeamId} sin dejar un bye. Revisa los resultados de la ronda anterior.`,
          }, { status: 400 })
        }
      }

      void roundBo // BO del round guardado en la fase; no se replica en cada partido
    }

    // ── Eliminación clásica — generación progresiva ──────────────────────────
    if (type === 'elimination') {
      const teamIds = phase.config.bracketTeamIds ?? []
      const sizeError = bracketSizeError(type, teamIds.length)
      if (sizeError) return NextResponse.json({ error: sizeError }, { status: 400 })

      if (!exists(1)) {
        // Ronda 1: emparejar equipos secuencialmente; último sin pareja tiene bye (no se crea partido)
        for (let i = 0; i < Math.ceil(teamIds.length / 2); i++) {
          const t1 = teamIds[i * 2]
          const t2 = teamIds[i * 2 + 1]
          if (t2 !== undefined) created.push(newMatch(1, t1, t2, i))
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
          created.push(newMatch(nextRound, winners[i * 2], winners[i * 2 + 1], i))
        }
      }
    }

    // ── Final Four ───────────────────────────────────────────────────────────
    if (type === 'final-four') {
      const teamIds = phase.config.bracketTeamIds ?? []
      const sizeError = bracketSizeError(type, teamIds.length)
      if (sizeError) return NextResponse.json({ error: sizeError }, { status: 400 })

      if (!exists(1)) {
        // Persistimos toda la topología desde el principio. Los resultados de
        // las semifinales rellenan después los slots TBD de forma automática.
        created.push(newMatch(1, teamIds[0], teamIds[1], 0))
        created.push(newMatch(1, teamIds[2], teamIds[3], 1))
      }
      const completedSemis = complete(1) ? sorted(1) : []
      if (!exists(2)) {
        created.push(newMatch(2, completedSemis[0]?.winnerId ?? 'TBD', completedSemis[1]?.winnerId ?? 'TBD'))
      }
      if (phase.config.include3rdPlace && !exists(98)) {
        created.push(newMatch(
          98,
          completedSemis[0] ? loserOf(completedSemis[0]) : 'TBD',
          completedSemis[1] ? loserOf(completedSemis[1]) : 'TBD',
        ))
      }
    }

    // ── Upper/Lower Bracket ──────────────────────────────────────────────────
    if (type === 'upper-lower') {
      const teamIds = phase.config.bracketTeamIds ?? []
      const n = teamIds.length
      const sizeError = bracketSizeError(type, n)
      if (sizeError) return NextResponse.json({ error: sizeError }, { status: 400 })

      if (n <= 4) {
        // La topología completa hace visible y administrable el Lower desde el
        // inicio. advanceWinner rellena cada plaza tras guardar un resultado.
        if (!exists(1)) {
          created.push(newMatch(1, teamIds[0], teamIds[1], 0))
          created.push(newMatch(1, teamIds[2], teamIds[3], 1))
        }
        if (!exists(2)) created.push(newMatch(2, 'TBD', 'TBD'))
        if (!exists(-1)) created.push(newMatch(-1, 'TBD', 'TBD'))
        if (!exists(-2)) created.push(newMatch(-2, 'TBD', 'TBD'))
        if (!exists(99)) created.push(newMatch(99, 'TBD', 'TBD'))

      } else {
        if (!exists(1)) {
          for (let i = 0; i < 4; i++) {
            created.push(newMatch(1, teamIds[i * 2], teamIds[i * 2 + 1], i))
          }
        }
        if (!exists(2)) {
          created.push(newMatch(2, 'TBD', 'TBD', 0))
          created.push(newMatch(2, 'TBD', 'TBD', 1))
        }
        if (!exists(3)) created.push(newMatch(3, 'TBD', 'TBD'))
        if (!exists(-1)) {
          created.push(newMatch(-1, 'TBD', 'TBD', 0))
          created.push(newMatch(-1, 'TBD', 'TBD', 1))
        }
        if (!exists(-2)) {
          created.push(newMatch(-2, 'TBD', 'TBD', 0))
          created.push(newMatch(-2, 'TBD', 'TBD', 1))
        }
        if (!exists(-3)) created.push(newMatch(-3, 'TBD', 'TBD'))
        if (!exists(-4)) created.push(newMatch(-4, 'TBD', 'TBD'))
        if (!exists(99)) created.push(newMatch(99, 'TBD', 'TBD'))
      }
    }
  } catch (err) {
    log.error({ err }, 'Error generando partidos')
    return NextResponse.json({ error: 'Error al generar el bracket' }, { status: 500 })
  }

  if (created.length === 0) {
    return NextResponse.json({ created: 0, message: 'No hay partidos nuevos que generar' })
  }

  try { createMatches(created) } catch (err) { log.error({ err }, 'DB write failed'); return NextResponse.json({ error: 'Error interno' }, { status: 500 }) }
  return NextResponse.json({ created: created.length })
}
