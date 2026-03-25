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

    // ── Eliminación clásica ──────────────────────────────────────────────────
    if (body.type === 'elimination') {
      if (phaseMatches.length > 0) {
        return NextResponse.json({ created: 0, message: 'Ya existen partidos para esta fase' })
      }
      const teamIds = phase.config.bracketTeamIds ?? []
      if (teamIds.length < 2) {
        return NextResponse.json({ error: 'Se necesitan al menos 2 equipos' }, { status: 400 })
      }
      const numRounds = Math.ceil(Math.log2(teamIds.length))
      let matchesInRound = Math.ceil(teamIds.length / 2)

      for (let i = 0; i < matchesInRound; i++) {
        created.push({
          id: generateId('match'),
          phaseId: phase.id,
          round: 1,
          team1Id: teamIds[i * 2] ?? 'TBD',
          team2Id: teamIds[i * 2 + 1] ?? 'TBD',
          result: null,
          riotMatchIds: [],
        })
      }

      for (let r = 2; r <= numRounds; r++) {
        matchesInRound = Math.ceil(matchesInRound / 2)
        for (let i = 0; i < matchesInRound; i++) {
          created.push({
            id: generateId('match'),
            phaseId: phase.id,
            round: r,
            team1Id: 'TBD',
            team2Id: 'TBD',
            result: null,
            riotMatchIds: [],
          })
        }
      }
    }

    // ── Final Four ───────────────────────────────────────────────────────────
    if (body.type === 'final-four') {
      if (phaseMatches.length > 0) {
        return NextResponse.json({ created: 0, message: 'Ya existen partidos para esta fase' })
      }
      const teamIds = phase.config.bracketTeamIds ?? []
      created.push({ id: generateId('match'), phaseId: phase.id, round: 1, team1Id: teamIds[0] ?? 'TBD', team2Id: teamIds[1] ?? 'TBD', result: null, riotMatchIds: [] })
      created.push({ id: generateId('match'), phaseId: phase.id, round: 1, team1Id: teamIds[2] ?? 'TBD', team2Id: teamIds[3] ?? 'TBD', result: null, riotMatchIds: [] })
      created.push({ id: generateId('match'), phaseId: phase.id, round: 2, team1Id: 'TBD', team2Id: 'TBD', result: null, riotMatchIds: [] })
      if (phase.config.include3rdPlace) {
        created.push({ id: generateId('match'), phaseId: phase.id, round: 98, team1Id: 'TBD', team2Id: 'TBD', result: null, riotMatchIds: [] })
      }
    }

    // ── Upper/Lower Bracket ──────────────────────────────────────────────────
    if (body.type === 'upper-lower') {
      if (phaseMatches.length > 0) {
        return NextResponse.json({ created: 0, message: 'Ya existen partidos para esta fase' })
      }
      const teamIds = phase.config.bracketTeamIds ?? []
      const n = teamIds.length
      const phaseId = phase.id

      function tbdMatch(round: number): Match {
        return { id: generateId('match'), phaseId, round, team1Id: 'TBD', team2Id: 'TBD', result: null, riotMatchIds: [] }
      }

      if (n <= 4) {
        created.push({ id: generateId('match'), phaseId: phase.id, round: 1, team1Id: teamIds[0] ?? 'TBD', team2Id: teamIds[1] ?? 'TBD', result: null, riotMatchIds: [] })
        created.push({ id: generateId('match'), phaseId: phase.id, round: 1, team1Id: teamIds[2] ?? 'TBD', team2Id: teamIds[3] ?? 'TBD', result: null, riotMatchIds: [] })
        created.push(tbdMatch(2))
        created.push(tbdMatch(-1))
        created.push(tbdMatch(-2))
        created.push(tbdMatch(99))
      } else {
        for (let i = 0; i < 4; i++) {
          created.push({ id: generateId('match'), phaseId: phase.id, round: 1, team1Id: teamIds[i * 2] ?? 'TBD', team2Id: teamIds[i * 2 + 1] ?? 'TBD', result: null, riotMatchIds: [] })
        }
        created.push(tbdMatch(2)); created.push(tbdMatch(2))
        created.push(tbdMatch(3))
        created.push(tbdMatch(-1)); created.push(tbdMatch(-1))
        created.push(tbdMatch(-2)); created.push(tbdMatch(-2))
        created.push(tbdMatch(-3))
        created.push(tbdMatch(-4))
        created.push(tbdMatch(99))
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
