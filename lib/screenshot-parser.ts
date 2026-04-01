import Anthropic from '@anthropic-ai/sdk'
import { GameDataSchema } from './schemas'
import type { GameData } from './types'
import { ANTHROPIC_API_KEY } from './env'
import { DEFAULT_SCREENSHOT_PROMPT } from './screenshot-prompt'

export async function parseScreenshot(
  imageBase64: string,
  mimeType: string,
  customPrompt?: string,
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
            text: customPrompt ?? DEFAULT_SCREENSHOT_PROMPT,
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
