import { describe, expect, it } from 'vitest'
import { adminRequest, AdminRequestError, errorMessage, isOk } from '@/lib/admin-client'

function response(status: number, body: unknown) {
  return Promise.resolve(new Response(JSON.stringify(body), { status, statusText: 'Error' }))
}

describe('adminRequest', () => {
  it.each([
    [401, 'Sesión expirada'],
    [422, 'validación'],
    [500, 'interno'],
  ])('expone errores HTTP %s sin aceptar el cuerpo como entidad', async (status, expected) => {
    const result = adminRequest(response(status, { error: 'fallo' }), isOk)
    await expect(result).rejects.toBeInstanceOf(AdminRequestError)
    await expect(result.catch(error => errorMessage(error))).resolves.toContain(expected)
  })

  it('valida la forma de respuestas correctas', async () => {
    await expect(adminRequest(response(200, { ok: true }), isOk)).resolves.toEqual({ ok: true })
    await expect(adminRequest(response(200, { error: 'no es entidad' }), isOk)).rejects.toThrow('formato válido')
  })

  it('clasifica errores de red', async () => {
    await expect(adminRequest(Promise.reject(new Error('offline')), isOk).catch(error => errorMessage(error))).resolves.toContain('conexión')
    expect(errorMessage(new AdminRequestError('validation', 'campo requerido'))).toContain('validación')
  })
})
