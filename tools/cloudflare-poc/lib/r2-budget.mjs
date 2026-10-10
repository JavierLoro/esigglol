// Conservative lifetime limits for this isolated pilot, not an account spend cap.
export const R2_LIMITS = Object.freeze({ classA: 100, classB: 1000, uploadedBytes: 1024 * 1024, objectBytes: 32 * 1024 })

// CAST also preserves numeric comparisons when the D1 REST API binds strings.
export const RESERVE_R2_SQL = `UPDATE r2_budget
  SET class_a = class_a + ?, class_b = class_b + ?, uploaded_bytes = uploaded_bytes + ?
  WHERE id = 'pilot' AND class_a + ? <= CAST(? AS INTEGER)
    AND class_b + ? <= CAST(? AS INTEGER) AND uploaded_bytes + ? <= CAST(? AS INTEGER)
  RETURNING class_a, class_b, uploaded_bytes`

export class R2BudgetError extends Error {
  constructor(code, status) {
    super(code)
    this.name = 'R2BudgetError'
    this.code = code
    this.status = status
  }
}

async function reserve(database, classA, classB, bytes) {
  let row
  try {
    row = await database.prepare(RESERVE_R2_SQL)
      .bind(classA, classB, bytes, classA, R2_LIMITS.classA, classB, R2_LIMITS.classB, bytes, R2_LIMITS.uploadedBytes).first()
    if (!row && !await database.prepare("SELECT id FROM r2_budget WHERE id = 'pilot'").first()) {
      throw new Error('Missing budget row')
    }
  } catch {
    throw new R2BudgetError('R2 budget unavailable', 503)
  }
  if (!row) throw new R2BudgetError('R2 quota exceeded', 429)
  // Never release reservations: timeouts and failures can have billed operations.
}

function snapshotWrite(value, options = {}) {
  let body
  if (typeof value === 'string') {
    if (value.length > R2_LIMITS.objectBytes) throw new R2BudgetError('R2 object too large', 413)
    body = new TextEncoder().encode(value)
  } else if (value instanceof Uint8Array) {
    if (value.byteLength > R2_LIMITS.objectBytes) throw new R2BudgetError('R2 object too large', 413)
    body = new Uint8Array(value)
  } else if (value instanceof ArrayBuffer) {
    if (value.byteLength > R2_LIMITS.objectBytes) throw new R2BudgetError('R2 object too large', 413)
    body = new Uint8Array(value.slice(0))
  } else throw new R2BudgetError('R2 payload must have a bounded size', 400)
  if (body.byteLength > R2_LIMITS.objectBytes) throw new R2BudgetError('R2 object too large', 413)
  // Only the write options used by the fixture are supported. No multipart,
  // arbitrary metadata or Infrequent Access charges can enter this adapter.
  if (!options || Object.keys(options).some(key => !['httpMetadata', 'storageClass'].includes(key)) ||
      options.storageClass && options.storageClass !== 'Standard') {
    throw new R2BudgetError('Unsupported R2 write options', 400)
  }
  const metadata = options.httpMetadata ?? {}
  if (Object.keys(metadata).some(key => key !== 'contentType') ||
      metadata.contentType !== undefined && (typeof metadata.contentType !== 'string' || metadata.contentType.length > 128)) {
    throw new R2BudgetError('Unsupported R2 metadata', 400)
  }
  const safeMetadata = metadata.contentType === undefined ? {} : { contentType: metadata.contentType }
  const metadataBytes = new TextEncoder().encode(JSON.stringify(safeMetadata)).byteLength
  return { body, bytes: body.byteLength + metadataBytes, options: { storageClass: 'Standard', httpMetadata: safeMetadata } }
}

export function createBudgetedBucket(bucket, database) {
  const preparePut = async (key, value, options) => {
    const snapshot = snapshotWrite(value, options)
    await reserve(database, 1, 0, snapshot.bytes)
    let used = false
    return async () => {
      if (used) throw new R2BudgetError('R2 reservation already used', 409)
      used = true
      return bucket.put(key, snapshot.body, snapshot.options)
    }
  }
  // Do not expose the raw binding or unmetered APIs such as list/multipart.
  return Object.freeze({
    preparePut,
    async put(key, value, options) { return (await preparePut(key, value, options))() },
    async get(key) { await reserve(database, 0, 1, 0); return bucket.get(key) },
    async head(key) { await reserve(database, 0, 1, 0); return bucket.head(key) },
    // Deletes are free and remain available for cleanup after R2 exhaustion.
    async delete(key) { return bucket.delete(key) },
  })
}

export function pilotFiles(env) {
  if (!env.FILES) return undefined
  return env.PROBE_REMOTE === '1' ? createBudgetedBucket(env.FILES, env.DB) : env.FILES
}

export async function readR2Budget(database) {
  let row
  try {
    row = await database.prepare("SELECT class_a, class_b, uploaded_bytes FROM r2_budget WHERE id = 'pilot'").first()
  } catch {
    throw new R2BudgetError('R2 budget unavailable', 503)
  }
  if (!row) throw new R2BudgetError('R2 budget unavailable', 503)
  return { scope: 'pilot-lifetime', limits: R2_LIMITS, used: { classA: row.class_a, classB: row.class_b, uploadedBytes: row.uploaded_bytes } }
}

export async function withR2Budget(operation) {
  try { return await operation() } catch (error) {
    if (!(error instanceof R2BudgetError)) throw error
    return Response.json({ error: error.code }, { status: error.status, headers: { 'Cache-Control': 'no-store' } })
  }
}
