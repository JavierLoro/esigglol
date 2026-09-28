import type { Match, Phase, Team, Tournament } from '@/lib/types'
import { DEFAULT_OVERLAY_COLOR, overlayRoundLabel, overlaySections, resolveOverlay, type OverlayConfig, type OverlayKind, type OverlayColumn, type OverlayDetails } from '@/lib/overlay'
import type { CSSProperties } from 'react'
import { getEffectiveBO } from '@/lib/match-validation'
import LocalDateTime from '@/components/LocalDateTime'
import TeamLogo from './TeamLogo'
import SwissView from '@/components/brackets/SwissView'
import { getPublishedMatches } from '@/lib/publication'

function TeamIdentity({ team, logos = true }: { team?: Team; logos?: boolean }) {
  const name = team?.name ?? 'Por determinar'
  return <div className="obs-team"><TeamLogo name={name} logo={team?.logo} hidden={!logos} /><span className="obs-name">{name}</span></div>
}

function MatchCard({ match, phase, teams, selected, details, focusTeams = [] }: { match: Match; phase: Phase; teams: Team[]; selected: boolean; details: OverlayDetails; focusTeams?: string[] }) {
  const follows = focusTeams.map(id => Boolean(id && id !== 'TBD' && (match.team1Id === id || match.team2Id === id)))
  return <article className={`obs-match${selected ? ' obs-selected' : ''}${follows[0] ? ' obs-path-first' : ''}${follows[1] ? ' obs-path-second' : ''}`} data-match-id={match.id} data-finished={Boolean(match.winnerId) || undefined}>
    <div className="obs-match-meta"><span className="obs-match-bo" data-obs-hidden={!details.bo || undefined}>BO{getEffectiveBO(phase, match.round)}</span><span className="obs-match-status" data-obs-hidden={!details.status || undefined}>{match.winnerId ? 'Finalizado' : match.result ? 'Resultado parcial' : 'Pendiente'}</span></div>
    {[match.team1Id, match.team2Id].map((id, index) => <div className={`obs-match-team${match.winnerId === id ? ' obs-winner' : ''}`} key={index}>
      <TeamIdentity team={teams.find(t => t.id === id)} logos={details.logos} /><strong>{match.result ? index === 0 ? match.result.team1Score : match.result.team2Score : '—'}</strong>
    </div>)}
  </article>
}

function Column({ column, previous, phase, teams, matchId, details, focusTeams }: { column: OverlayColumn; previous?: OverlayColumn; phase: Phase; teams: Team[]; matchId?: string; details: OverlayDetails; focusTeams: string[] }) {
  const count = column.matches?.length ?? 0
  const previousCount = previous?.matches?.length ?? 0
  return <section className="obs-column" style={{ gridColumn: column.slot }}>
    <h2 data-obs-hidden={!details.columnTitles || undefined}>{column.title}</h2>
    {column.standings && <div className="obs-standings" data-with-points={phase.type === 'groups' || undefined}>
      <div className="obs-standing obs-table-head"><span>#</span><span>Equipo</span><span>V</span><span>D</span>{phase.type === 'groups' && <span>Pts</span>}</div>
      {column.standings.map((standing, index) => <div className="obs-standing" data-advancing={phase.type === 'groups' && (column.rankStart ?? 1) + index <= (phase.config.advanceCount ?? 2) || undefined} key={standing.teamId} style={{ height: `${Math.min(3.25, 27 / column.standings!.length)}cqw` }}>
        <span>{(column.rankStart ?? 1) + index}</span><TeamIdentity team={teams.find(t => t.id === standing.teamId)} logos={details.logos} /><strong>{standing.wins}</strong><span>{standing.losses}</span>{phase.type === 'groups' && <strong>{standing.points}</strong>}
      </div>)}
    </div>}
    {column.matches && <div className="obs-match-list">
      {column.connects && count > 0 && previousCount > 0 && <svg className="obs-connectors" viewBox="0 0 100 1000" preserveAspectRatio="none" aria-hidden="true">
        {Array.from({ length: previousCount }, (_, i) => {
          const y1 = (i + 0.5) * 1000 / previousCount
          const y2 = (Math.floor(i * count / previousCount) + 0.5) * 1000 / count
          return <path key={i} d={`M0 ${y1} H50 V${y2} H100`} />
        })}
      </svg>}
      {column.matches.map(match => <MatchCard key={match.id} match={match} phase={phase} teams={teams} selected={match.id === matchId} details={details} focusTeams={focusTeams} />)}
    </div>}
  </section>
}

export default function OverlayScene({ kind, tournament, config, phases, matches, teams }: {
  kind: OverlayKind; tournament: Tournament; config: OverlayConfig; phases: Phase[]; matches: Match[]; teams: Team[]
}) {
  const resolved = resolveOverlay(config, phases, matches)
  const { match, summary, pages } = resolved
  const phase = kind === 'fase' ? resolved.phase : phases.find(p => p.id === match?.phaseId)
  const team1 = teams.find(t => t.id === match?.team1Id)
  const team2 = teams.find(t => t.id === match?.team2Id)
  const game = tournament.game === 'lol' ? 'League of Legends' : 'Valorant'
  const neutral = kind === 'fase' ? !summary : !match
  const details: OverlayDetails = config.visibility?.[kind] ?? {}
  const overview = kind === 'fase' && Boolean(pages[0]?.overview)
  const focusTeams = kind === 'fase' && match && phase && match.phaseId === phase.id && config.visibility?.fase?.history !== false ? [match.team1Id, match.team2Id] : []
  return <div className={`obs-viewport obs-${tournament.game}`} data-overlay={kind} style={{ '--obs-accent': config.accentColor ?? DEFAULT_OVERLAY_COLOR } as CSSProperties}>
    <div className={`obs-canvas obs-${kind}${overview ? ' obs-overview' : ''}`}>
      {kind === 'marcador' ? !neutral && match && phase && <div className="obs-scoreboard">
        <div className="obs-score-team"><TeamIdentity team={team1} logos={details.logos} /><strong className="obs-score-value">{match.result?.team1Score ?? 0}</strong></div>
        <div className="obs-score-context" data-obs-hidden={(!details.tournament && !details.bo) || undefined}><span className="obs-score-versus" aria-hidden="true">VS</span><span className="obs-name" data-obs-hidden={!details.tournament || undefined}>{tournament.name}</span><b data-obs-hidden={!details.bo || undefined}>BO{getEffectiveBO(phase, match.round)}</b></div>
        <div className="obs-score-team obs-reverse"><TeamIdentity team={team2} logos={details.logos} /><strong className="obs-score-value">{match.result?.team2Score ?? 0}</strong></div>
      </div> : neutral && !details.empty ? null : <>
        <header className="obs-header" data-obs-hidden={(!details.tournament && !details.eyebrow && !details.brand) || undefined}><div><p className="obs-eyebrow" data-obs-hidden={!details.eyebrow || undefined}>{game} · {kind === 'previa' ? 'Encuentro' : 'Resumen de fase'}</p><h1 className="obs-name" data-obs-hidden={!details.tournament || undefined}>{tournament.name}</h1></div><span className="obs-brand" data-obs-hidden={!details.brand || undefined}>ESI<span>gg</span></span></header>
        {neutral ? <div className="obs-neutral" data-obs-hidden={!details.empty || undefined}><span className="obs-neutral-mark">—</span><h2>Sin contenido seleccionado</h2></div>
          : kind === 'previa' && match && phase ? <>
            <div className="obs-phase-label" data-obs-hidden={(!details.context && !details.bo) || undefined}><span className="obs-phase-name" data-obs-hidden={!details.context || undefined}>{phase.name}</span><span className="obs-phase-round" data-obs-hidden={!details.context || undefined}>{overlayRoundLabel(phase, match.round, matches.filter(m => m.phaseId === phase.id))}</span><b className="obs-phase-bo" data-obs-hidden={!details.bo || undefined}>BO{getEffectiveBO(phase, match.round)}</b></div>
            <div className="obs-versus"><TeamIdentity team={team1} logos={details.logos} /><div className="obs-versus-center" data-has-result={Boolean(match.result) || undefined}><span className="obs-eyebrow" data-obs-hidden={!match.result || undefined}>VS</span><strong>{match.result ? `${match.result.team1Score} : ${match.result.team2Score}` : 'VS'}</strong>{match.result && <span data-obs-hidden={!details.status || undefined}>{match.winnerId ? 'Resultado final' : 'Resultado parcial'}</span>}</div><TeamIdentity team={team2} logos={details.logos} /></div>
            <div className="obs-details">
              {match.scheduledAt && <LocalDateTime iso={match.scheduledAt} className={details.date ? undefined : 'obs-hidden'} />}
              {tournament.game === 'valorant' && match.maps && <div className="obs-maps" data-obs-hidden={!details.maps || undefined}>{match.maps.map((map, index) => <div key={index}><span>{map.map ?? `Mapa ${index + 1}`}</span><strong>{map.team1Rounds} : {map.team2Rounds}</strong><small>Rondas</small></div>)}</div>}
            </div>
          </> : phase && summary && <>
            <div className="obs-phase-label" data-obs-hidden={(!details.context && !details.page) || undefined}><span className="obs-phase-name" data-obs-hidden={!details.context || undefined}>{phase.name}</span><b className="obs-phase-section" data-obs-hidden={!details.context || undefined}>{overview ? 'Todas las rondas' : overlaySections(phase, matches).find(s => s.id === summary.section)?.label}</b><span className="obs-phase-page" data-obs-hidden={!details.page || undefined}>{overview ? `Rondas publicadas: ${pages[0].columns.length}` : `Página ${summary.page} / ${pages.length}`}</span></div>
            {overview ? <div className="obs-swiss" data-hide-logos={details.logos === false || undefined} data-hide-titles={!details.columnTitles || undefined} data-hide-bo={!details.bo || undefined}>
              <SwissView fit phase={phase} matches={getPublishedMatches([phase], matches)} teams={teams} renderMatch={item => <MatchCard match={item} phase={phase} teams={teams} selected={item.id === match?.id} details={details} focusTeams={focusTeams} />} />
            </div> : <div className={`obs-columns${phase.type === 'groups' || phase.type === 'swiss' ? ' obs-group-columns' : ''}`}>{pages[summary.page - 1].columns.map((column, index, columns) => <Column key={column.slot ?? index} column={column} previous={columns[index - 1]} phase={phase} teams={teams} matchId={match?.id} details={details} focusTeams={focusTeams} />)}</div>}
          </>}
        {focusTeams.some(id => id && id !== 'TBD') ? <footer className="obs-path-legend" aria-label="Recorridos resaltados">{focusTeams.map((id, index) => id && id !== 'TBD' && <div className={index === 0 ? 'obs-path-first' : 'obs-path-second'} key={index}><TeamIdentity team={teams.find(t => t.id === id)} logos={details.logos} /></div>)}</footer>
          : <footer className="obs-footer" data-obs-hidden={!details.footer || undefined}><span>{game}</span><span>{kind === 'previa' ? 'Torneo · PC / EU' : 'Clasificación y resultados'}</span></footer>}
      </>}
    </div>
  </div>
}
