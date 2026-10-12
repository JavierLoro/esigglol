import { z } from 'zod'
import { AdminRequestError, errorMessage } from './admin-client'

export interface WebMCPTool {
  name: string
  description: string
  inputSchema: Record<string, unknown>
  annotations: { readOnlyHint: boolean; consequentialHint: boolean; untrustedContentHint: boolean }
  execute: (input: unknown, options?: { signal?: AbortSignal }) => Promise<string>
}

export interface WebMCPContext {
  registerTool: (tool: WebMCPTool, options: { signal: AbortSignal }) => void | Promise<void>
}

export class WebMCPError extends Error {
  constructor(public readonly code: string, message: string) { super(message) }
}

export function webMCPTool<T>(
  name: string,
  description: string,
  schema: z.ZodType<T>,
  execute: (input: T, signal: AbortSignal) => Promise<unknown>,
  readOnly = true,
): WebMCPTool {
  return {
    name,
    description,
    inputSchema: z.toJSONSchema(schema, { io: 'input' }),
    annotations: { readOnlyHint: readOnly, consequentialHint: !readOnly, untrustedContentHint: true },
    async execute(input, { signal = new AbortController().signal } = {}) {
      try {
        signal.throwIfAborted()
        const parsed = schema.safeParse(input)
        if (!parsed.success) return JSON.stringify({ ok: false, code: 'INVALID_INPUT', error: parsed.error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join('; ') })
        return JSON.stringify({ ok: true, data: await execute(parsed.data, signal) })
      } catch (error) {
        const cancelled = signal.aborted
        return JSON.stringify({
          ok: false,
          code: cancelled ? 'CANCELLED' : error instanceof WebMCPError ? error.code : error instanceof AdminRequestError ? (error.status === 409 ? 'CONFLICT' : error.kind.toUpperCase()) : 'INTERNAL',
          error: cancelled ? 'Operación cancelada. Comprueba los datos antes de reintentar: un cambio enviado puede haberse guardado.' : error instanceof WebMCPError ? error.message : errorMessage(error),
        })
      }
    },
  }
}

export function registerWebMCPTools(context: WebMCPContext, tools: WebMCPTool[]): () => void {
  const controller = new AbortController()
  let writing = false
  for (const tool of tools) {
    const registered = {
      ...tool,
      async execute(input: unknown, options: { signal?: AbortSignal } = {}) {
        if (controller.signal.aborted) return JSON.stringify({ ok: false, code: 'UNAVAILABLE', error: 'Esta herramienta ya no está disponible en la pantalla actual.' })
        if (!tool.annotations.readOnlyHint && writing) return JSON.stringify({ ok: false, code: 'BUSY', error: 'Espera a que termine el cambio anterior.' })
        if (!tool.annotations.readOnlyHint) writing = true
        try { return await tool.execute(input, { signal: options.signal ? AbortSignal.any([controller.signal, options.signal]) : controller.signal }) }
        finally { if (!tool.annotations.readOnlyHint) writing = false }
      },
    }
    try {
      Promise.resolve(context.registerTool(registered, { signal: controller.signal })).catch(() => {
        if (!controller.signal.aborted) console.warn(`No se pudo registrar WebMCP: ${tool.name}`)
      })
    } catch {
      console.warn(`No se pudo registrar WebMCP: ${tool.name}`)
    }
  }
  return () => controller.abort()
}

export function assertWebMCPTournament(expected: string | undefined, requested: string) {
  if (!expected || expected !== requested || new URLSearchParams(window.location.search).get('tournament') !== expected) {
    throw new WebMCPError('WRONG_TOURNAMENT', 'Selecciona el torneo solicitado antes de ejecutar la herramienta.')
  }
}

export function assertWebMCPNavigation() {
  if (!window.dispatchEvent(new Event('admin-webmcp-navigate', { cancelable: true }))) {
    throw new WebMCPError('PENDING_CHANGES', 'Guarda o descarta los cambios pendientes y espera a que terminen las operaciones antes de navegar.')
  }
}
