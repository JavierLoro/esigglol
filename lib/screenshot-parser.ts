import Anthropic from '@anthropic-ai/sdk'
import { GameDataSchema } from './schemas'
import type { GameData } from './types'
import { ANTHROPIC_API_KEY } from './env'

const PROMPT = `Analyze this League of Legends end-game screenshot and extract player data into JSON.

Return ONLY valid JSON matching this exact schema (no markdown, no backticks, no explanation):

{
  "duration": "MM:SS",
  "date": "MM/DD/YYYY",
  "winner": "team1" or "team2",
  "team1Players": [
    {
      "summonerName": "PlayerName",
      "championName": "ChampionKey",
      "level": 18,
      "kills": 5,
      "deaths": 2,
      "assists": 8,
      "cs": 200,
      "gold": 15000,
      "items": ["ItemName1", "ItemName2", ...],
      "keystone": "KeystoneName"
    }
  ],
  "team2Players": [same structure]
}

Rules:
- "winner": If the header says "DEFEAT", the screenshot is from team1's perspective → team2 won. If "VICTORY" → team1 won.
- "championName": Use the official English DDragon champion key. Examples: "Yone", "MonkeyKing" (for Wukong), "Ahri", "FiddleSticks", "KSante", "Renata". Use PascalCase as DDragon expects.
- "items": List all visible items by their official English name. Include trinket/ward. Empty slots = skip. Up to 8 items (6 items + trinket + boots from boot mission).
- "keystone": The primary keystone rune name in English (e.g. "Conqueror", "Electrocute", "FleetFootwork", "Grasp of the Undying").
- "gold": Individual player gold, not team total.
- "cs": Minions killed count for that player.
- "date": Extract from the header if visible, format MM/DD/YYYY.
- Players are listed top to bottom as they appear in the screenshot.
- There should be exactly 5 players per team.`

export async function parseScreenshot(
  imageBase64: string,
  mimeType: string,
): Promise<GameData> {
  if (!ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY env var is required')
  }

  const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY })

  const mediaType = mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: imageBase64,
            },
          },
          {
            type: 'text',
            text: PROMPT,
          },
        ],
      },
    ],
  })

  const textBlock = response.content.find(b => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No se recibió respuesta de texto de Claude')
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(textBlock.text)
  } catch {
    throw new Error(`No se pudo parsear la respuesta como JSON: ${textBlock.text.slice(0, 200)}`)
  }

  const result = GameDataSchema.safeParse(parsed)
  if (!result.success) {
    throw new Error(`Datos extraídos no válidos: ${result.error.message}`)
  }

  return result.data
}
