'use client'

import { useState } from 'react'
import Image from 'next/image'
import { clsx } from 'clsx'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PlayerChampionData {
  mastery: Array<{ championName: string; masteryLevel: number; masteryPoints: number }>
  season: Array<{ championName: string; games: number; wins: number; kda: number; winrate: number }>
  recent: Array<{ championName: string; games: number; wins: number }>
  iconBaseUrl: string
}

type Filter = 'mastery' | 'season' | 'kda' | 'recent'

const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: 'mastery',  label: 'Maestría' },
  { key: 'season',   label: 'Jugados'  },
  { key: 'kda',      label: 'KDA'      },
  { key: 'recent',   label: 'Recientes'},
]

interface DisplayChamp {
  championName: string
  lines: string[]
}

function getDisplayChamps(filter: Filter, data: PlayerChampionData): DisplayChamp[] {
  switch (filter) {
    case 'mastery':
      return data.mastery.slice(0, 6).map(c => ({
        championName: c.championName,
        lines: [`Nivel ${c.masteryLevel}`, `${c.masteryPoints.toLocaleString('es-ES')} pts`],
      }))

    case 'season':
      return data.season.slice(0, 6).map(c => ({
        championName: c.championName,
        lines: [`${c.games} partidas`, `${c.winrate}% WR`, `KDA ${c.kda}`],
      }))

    case 'kda':
      return data.season
        .filter(c => c.games >= 3)
        .sort((a, b) => b.kda - a.kda)
        .slice(0, 6)
        .map(c => ({
          championName: c.championName,
          lines: [`KDA ${c.kda}`, `${c.games} partidas`, `${c.winrate}% WR`],
        }))

    case 'recent':
      return data.recent.slice(0, 6).map(c => ({
        championName: c.championName,
        lines: [
          `${c.games} de 20 partidas`,
          `${c.games > 0 ? Math.round((c.wins / c.games) * 100) : 0}% WR`,
        ],
      }))
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ChampionBubbles({ data }: { data: PlayerChampionData }) {
  const [filter, setFilter] = useState<Filter>('mastery')
  const [activeChamp, setActiveChamp] = useState<string | null>(null)

  const champions = getDisplayChamps(filter, data)
  const hasData = champions.length > 0

  function handleFilter(f: Filter) {
    setFilter(f)
    setActiveChamp(null)
  }

  return (
    <div className="px-4 pb-4 pt-1 border-t border-white/[0.06]">
      {/* Filter tabs */}
      <div className="flex gap-1 mb-3 mt-3 flex-wrap">
        {FILTERS.map(f => (
          <button
            key={f.key}
            onClick={() => handleFilter(f.key)}
            className={clsx(
              'text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md transition-colors',
              filter === f.key
                ? 'bg-[var(--esi-blue)] text-white'
                : 'text-white/30 hover:text-white/60 hover:bg-white/5',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Bubbles */}
      {!hasData ? (
        <p className="text-xs text-white/20 italic">Sin datos</p>
      ) : (
        <div className="flex gap-2 flex-wrap">
          {champions.map(champ => (
            <div
              key={champ.championName}
              className="relative"
              onMouseEnter={() => setActiveChamp(champ.championName)}
              onMouseLeave={() => setActiveChamp(null)}
              onClick={() =>
                setActiveChamp(prev =>
                  prev === champ.championName ? null : champ.championName
                )
              }
            >
              {/* Bubble */}
              <div
                className={clsx(
                  'w-12 h-12 rounded-full overflow-hidden border-2 transition-all duration-150 cursor-pointer select-none',
                  activeChamp === champ.championName
                    ? 'border-[var(--esi-blue)] scale-110 shadow-lg shadow-[var(--esi-blue)]/30'
                    : 'border-white/10 hover:border-white/30 hover:scale-105',
                )}
              >
                {data.iconBaseUrl ? (
                  <Image
                    src={`${data.iconBaseUrl}/${champ.championName}.png`}
                    alt={champ.championName}
                    width={48}
                    height={48}
                    className="w-full h-full object-cover scale-[1.12]"
                  />
                ) : (
                  <div className="w-full h-full bg-white/10" />
                )}
              </div>

              {/* Tooltip */}
              {activeChamp === champ.championName && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2.5 z-50 pointer-events-none">
                  <div className="bg-[#0a0e1a] border border-white/15 rounded-lg px-3 py-2 text-center shadow-2xl min-w-max">
                    <p className="text-xs font-semibold text-white mb-1 leading-none">
                      {champ.championName}
                    </p>
                    {champ.lines.map((line, i) => (
                      <p key={i} className="text-[11px] text-white/55 leading-snug">
                        {line}
                      </p>
                    ))}
                  </div>
                  {/* Arrow */}
                  <div className="w-2.5 h-2.5 bg-[#0a0e1a] border-r border-b border-white/15 rotate-45 mx-auto -mt-[5px]" />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
