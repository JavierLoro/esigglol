import './load-env'
import { parseArgs } from 'node:util'
import { getTeams, saveTeams, generateId } from '@/lib/data'
import type { Team, Player, Role } from '@/lib/types'

const TEAM_NAMES = [
  'Wolves ESI', 'Dragones UCLM', 'Fénix Gaming', 'Osos del Campus',
  'Águilas Esport', 'Lobos Plateados', 'Titanes ESI', 'Serpientes Élite',
  'Cóndores', 'Rayos Azules', 'Halcones Furiosos', 'Panteras Negras',
  'Truenos del Norte', 'Víboras', 'Escorpiones', 'Grifos Dorados',
]

const PLAYER_POOL: string[] = [
  // Wolves ESI (0-5)
  'WolfTop#ESI', 'WolfJungle#ESI', 'WolfMid#ESI', 'WolfBot#ESI', 'WolfSupport#ESI', 'WolfSub#ESI',
  // Dragones UCLM (6-11)
  'DragonTop#UCL', 'DragonJungle#UCL', 'DragonMid#UCL', 'DragonBot#UCL', 'DragonSupport#UCL', 'DragonSub#UCL',
  // Fénix Gaming (12-17)
  'FenixTop#LOL', 'FenixJungle#LOL', 'FenixMid#LOL', 'FenixBot#LOL', 'FenixSupport#LOL', 'FenixSub#LOL',
  // Osos del Campus (18-23)
  'OsoTop#DEV', 'OsoJungle#DEV', 'OsoMid#DEV', 'OsoBot#DEV', 'OsoSupport#DEV', 'OsoSub#DEV',
  // Águilas Esport (24-29)
  'AguilaTop#TEST', 'AguilaJungle#TEST', 'AguilaMid#TEST', 'AguilaBot#TEST', 'AguilaSupport#TEST', 'AguilaSub#TEST',
  // Lobos Plateados (30-35)
  'PlataTop#ESI', 'PlataJungle#ESI', 'PlataMid#ESI', 'PlataBot#ESI', 'PlataSupport#ESI', 'PlataSub#ESI',
  // Titanes ESI (36-41)
  'TitanTop#UCL', 'TitanJungle#UCL', 'TitanMid#UCL', 'TitanBot#UCL', 'TitanSupport#UCL', 'TitanSub#UCL',
  // Serpientes Élite (42-47)
  'SerpTop#LOL', 'SerpJungle#LOL', 'SerpMid#LOL', 'SerpBot#LOL', 'SerpSupport#LOL', 'SerpSub#LOL',
  // Cóndores (48-53)
  'CondorTop#DEV', 'CondorJungle#DEV', 'CondorMid#DEV', 'CondorBot#DEV', 'CondorSupport#DEV', 'CondorSub#DEV',
  // Rayos Azules (54-59)
  'RayoTop#TEST', 'RayoJungle#TEST', 'RayoMid#TEST', 'RayoBot#TEST', 'RayoSupport#TEST', 'RayoSub#TEST',
  // Halcones Furiosos (60-65)
  'HalconTop#ESI', 'HalconJungle#ESI', 'HalconMid#ESI', 'HalconBot#ESI', 'HalconSupport#ESI', 'HalconSub#ESI',
  // Panteras Negras (66-71)
  'PanteraTop#UCL', 'PanteraJungle#UCL', 'PanteraMid#UCL', 'PanteraBot#UCL', 'PanteraSupport#UCL', 'PanteraSub#UCL',
  // Truenos del Norte (72-77)
  'TruenoTop#LOL', 'TruenoJungle#LOL', 'TruenoMid#LOL', 'TruenoBot#LOL', 'TruenoSupport#LOL', 'TruenoSub#LOL',
  // Víboras (78-83)
  'ViboraTop#DEV', 'ViboraJungle#DEV', 'ViboraMid#DEV', 'ViboraBot#DEV', 'ViboraSupport#DEV', 'ViboraSub#DEV',
  // Escorpiones (84-89)
  'EscorpTop#TEST', 'EscorpJungle#TEST', 'EscorpMid#TEST', 'EscorpBot#TEST', 'EscorpSupport#TEST', 'EscorpSub#TEST',
  // Grifos Dorados (90-95)
  'GrifoTop#ESI', 'GrifoJungle#ESI', 'GrifoMid#ESI', 'GrifoBot#ESI', 'GrifoSupport#ESI', 'GrifoSub#ESI',
]

const STARTER_ROLES: Role[] = ['Top', 'Jungle', 'Mid', 'Bot', 'Support']

const { values } = parseArgs({
  options: {
    teams:   { type: 'string', default: '8' },
    players: { type: 'string', default: '5' },
  },
})

const numTeams   = parseInt(values.teams   ?? '8')
const numPlayers = parseInt(values.players ?? '5')

const existing = getTeams()

const newTeams: Team[] = TEAM_NAMES.slice(0, numTeams).map((name, ti) => {
  const players: Player[] = []

  for (let i = 0; i < numPlayers; i++) {
    players.push({
      id: generateId('player'),
      summonerName: PLAYER_POOL[ti * 6 + i],
      primaryRole: STARTER_ROLES[i] ?? 'Fill',
    })
  }

  // Suplente siempre añadido
  players.push({
    id: generateId('player'),
    summonerName: PLAYER_POOL[ti * 6 + numPlayers],
    primaryRole: 'Suplente',
  })

  return { id: generateId('team'), name, logo: '', players }
})

saveTeams([...existing, ...newTeams])

const totalPlayers = newTeams.reduce((sum, t) => sum + t.players.length, 0)

console.log('✓ Seed completado')
console.log(`  Equipos añadidos:  ${newTeams.length}`)
console.log(`  Jugadores totales: ${totalPlayers}`)
console.log(`  Equipos en BD ahora: ${existing.length + newTeams.length}`)
