export class StorageQuotaError extends Error {
  readonly status = 429
  constructor() { super('Cuota de archivos agotada. La operación se ha bloqueado para evitar cargos adicionales.') }
}
