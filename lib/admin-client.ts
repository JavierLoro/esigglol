export type AdminErrorKind = 'validation' | 'session' | 'internal' | 'network'

export class AdminRequestError extends Error {
  constructor(public readonly kind: AdminErrorKind, message: string, public readonly status?: number) {
    super(message)
    this.name = 'AdminRequestError'
  }
}

function errorKind(status?: number): AdminErrorKind {
  if (status === 401 || status === 403) return 'session'
  if (status === 400 || status === 422) return 'validation'
  return 'internal'
}

export function errorMessage(error: unknown): string {
  if (error instanceof AdminRequestError) {
    if (error.kind === 'session') return 'Sesión expirada. Vuelve a iniciar sesión.'
    if (error.kind === 'validation') return `Error de validación: ${error.message}`
    if (error.kind === 'network') return 'Error de conexión. Comprueba tu red.'
    return `Error interno: ${error.message}`
  }
  return 'Error interno. Inténtalo de nuevo.'
}

export async function adminRequest<T>(request: Promise<Response>, validate: (value: unknown) => value is T): Promise<T> {
  let response: Response
  try {
    response = await request
  } catch {
    throw new AdminRequestError('network', 'No se pudo conectar')
  }

  let body: unknown
  try { body = await response.json() } catch { body = undefined }
  if (!response.ok) {
    const message = body && typeof body === 'object' && 'error' in body
      ? typeof body.error === 'string' ? body.error : 'La petición no es válida'
      : response.statusText || 'La petición ha fallado'
    throw new AdminRequestError(errorKind(response.status), message, response.status)
  }
  if (!validate(body)) throw new AdminRequestError('internal', 'La respuesta del servidor no tiene un formato válido', response.status)
  return body
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function isOk(value: unknown): value is { ok: true } {
  return isRecord(value) && value.ok === true
}

export function isArrayOfRecords<T = Record<string, unknown>>(value: unknown): value is T[] {
  return Array.isArray(value) && value.every(isRecord)
}

export function isEntity(value: unknown): value is { id: string } {
  return isRecord(value) && typeof value.id === 'string'
}
